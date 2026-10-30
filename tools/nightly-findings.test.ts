import { describe, expect, it } from 'vitest'
import type { C4Node } from '@radical/common/c4'
import type { Measurement } from '@radical/common/check'
import type { Finding } from '@radical/crucible/findings'
import { nightlyFindings } from './nightly-findings'

// The night's measurements become findings: a condition that does not hold,
// or one the night measured nothing for, once, as radical check reads it.

const NOW = Date.parse('2026-10-31T03:00:00Z')

const NIGHTLY = { cadence: 'triggered', trigger: 'nightly', invocation: 'automated' }

const fitness = (metrics: string, props: Record<string, unknown> = NIGHTLY, id = 'ff', label = 'Large model stays responsive'): C4Node =>
  ({ id, type: 'fitness-fn', label, x: 0, y: 0, width: 0, height: 0, collapsed: false, metrics, max_age: '3d', ...props }) as unknown as C4Node

/** A fitness function the pull-request gate measures, beside the night's. */
const gate = fitness('workspaces.exit_code == 0', { ...NIGHTLY, trigger: 'pull-request' }, 'gate', 'Workspace boundaries')

const measured = (metric: string, value: number): Measurement =>
  ({ metric, value, unit: 'ms', labels: { model: 'radical-x14' }, source: 'json', at: '2026-10-31T02:40:00Z', context: { commit: 'abc12345' } })

const CONDITIONS = 'studio.open_ms{model=radical-x14} <= 11000 ms\nstudio.search_key_ms{model=radical-x14} <= 600 ms'

describe('nightly findings', () => {
  it('judges only the fitness functions that run on the night', () => {
    const manual = fitness('studio.open_ms{model=radical-x14} <= 1 ms', { ...NIGHTLY, invocation: 'manual' }, 'manual', 'Manual')
    const weekly = fitness('studio.open_ms{model=radical-x14} <= 1 ms', { ...NIGHTLY, trigger: 'weekly' }, 'weekly', 'Weekly')
    const unclassified = fitness('studio.open_ms{model=radical-x14} <= 1 ms', {}, 'none', 'Unclassified')
    const found = nightlyFindings([fitness(CONDITIONS), gate, manual, weekly, unclassified], [measured('studio.open_ms', 12300), measured('studio.search_key_ms', 240)], [], { trigger: 'nightly', now: NOW })
    expect(found.map((f) => f.title)).toEqual(['Large model stays responsive: studio.open_ms measured 12300 ms, beyond <= 11000 ms'])
  })


  it('makes one for each condition of the night that does not hold, and none for those that hold or run on another trigger', () => {
    const found = nightlyFindings([fitness(CONDITIONS), gate], [measured('studio.open_ms', 12300), measured('studio.search_key_ms', 240)], [], { trigger: 'nightly', commit: 'abc12345def', now: NOW })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      id: 'F-0001', source: 'sense', status: 'open', round: 'nightly', commit: 'abc12345', found: '2026-10-31',
      title: 'Large model stays responsive: studio.open_ms measured 12300 ms, beyond <= 11000 ms',
      rule: 'Fitness function "Large model stays responsive"',
    })
    expect(found[0].detail).toContain('Actual: 12300 ms (model=radical-x14; json')
  })

  it('makes one when the night measured nothing it should have', () => {
    const found = nightlyFindings([fitness(CONDITIONS)], [measured('studio.search_key_ms', 240)], [], { trigger: 'nightly', now: NOW })
    expect(found.map((f) => f.title)).toEqual(['Large model stays responsive: the night measured no studio.open_ms'])
  })

  it('says nothing an open finding already says, and numbers the next one after the last', () => {
    const first = nightlyFindings([fitness(CONDITIONS)], [measured('studio.open_ms', 12300)], [], { trigger: 'nightly', now: NOW })
    const existing: Finding[] = [{ ...first[0], id: 'F-0109' }]
    const again = nightlyFindings([fitness(CONDITIONS)], [measured('studio.open_ms', 12900), measured('studio.search_key_ms', 900)], existing, { trigger: 'nightly', now: NOW })
    expect(again.map((f) => [f.id, f.title])).toEqual([['F-0110', 'Large model stays responsive: studio.search_key_ms measured 900 ms, beyond <= 600 ms']])
    // Fixed, it is said again when it comes back.
    expect(nightlyFindings([fitness(CONDITIONS)], [measured('studio.open_ms', 12900), measured('studio.search_key_ms', 100)], [{ ...existing[0], status: 'fixed' }], { trigger: 'nightly', now: NOW })).toHaveLength(1)
  })

  it('compares a condition against a baseline with the earlier nights, and makes nothing of it while there are none', () => {
    const relative = fitness('studio.open_ms{model=radical-x14} <= baseline + 20%')
    const earlier = [5000, 5100, 4900].map((v, i) => ({ ...measured('studio.open_ms', v), at: new Date(NOW - (i + 1) * 86400e3).toISOString() }))
    expect(nightlyFindings([relative], [measured('studio.open_ms', 5500)], [], { trigger: 'nightly', now: NOW }, earlier)).toEqual([])
    const slow = nightlyFindings([relative], [measured('studio.open_ms', 6500)], [], { trigger: 'nightly', now: NOW }, earlier)
    expect(slow.map((f) => f.title)).toEqual(['Large model stays responsive: studio.open_ms measured 6500 ms, beyond the baseline + 20% (baseline 5000 ms, the median of 3; limit 6000 ms)'])
    expect(nightlyFindings([relative], [measured('studio.open_ms', 9000)], [], { trigger: 'nightly', now: NOW })).toEqual([])
  })
})
