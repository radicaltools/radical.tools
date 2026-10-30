import { describe, expect, it } from 'vitest'
import type { C4Node } from '@radical/common/c4'
import type { Measurement } from '@radical/common/check'
import type { Finding } from '@radical/crucible/findings'
import { nightlyFindings } from './nightly-findings'

// The night's measurements become findings: a condition that does not hold,
// or one the night measured nothing for, once, as radical check reads it.

const NOW = Date.parse('2026-10-31T03:00:00Z')

const fitness = (metrics: string): C4Node =>
  ({ id: 'ff', type: 'fitness-fn', label: 'Large model stays responsive', x: 0, y: 0, width: 0, height: 0, collapsed: false, metrics, max_age: '3d' }) as unknown as C4Node

const measured = (metric: string, value: number): Measurement =>
  ({ metric, value, unit: 'ms', labels: { model: 'radical-x14' }, source: 'json', at: '2026-10-31T02:40:00Z', context: { commit: 'abc12345' } })

const CONDITIONS = 'studio.open_ms{model=radical-x14} <= 11000 ms\nstudio.search_key_ms{model=radical-x14} <= 600 ms\nworkspaces.exit_code == 0'

describe('nightly findings', () => {
  it('makes one for each condition of the night that does not hold, and none for those that hold or are not the night\'s', () => {
    const found = nightlyFindings([fitness(CONDITIONS)], [measured('studio.open_ms', 12300), measured('studio.search_key_ms', 240)], [], { expect: 'studio.', commit: 'abc12345def', now: NOW })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      id: 'F-0001', source: 'sense', status: 'open', round: 'nightly', commit: 'abc12345', found: '2026-10-31',
      title: 'Large model stays responsive: studio.open_ms measured 12300 ms, beyond <= 11000 ms',
      rule: 'Fitness function "Large model stays responsive"',
    })
    expect(found[0].detail).toContain('Actual: 12300 ms (model=radical-x14; json')
  })

  it('makes one when the night measured nothing it should have', () => {
    const found = nightlyFindings([fitness(CONDITIONS)], [measured('studio.search_key_ms', 240)], [], { expect: 'studio.', now: NOW })
    expect(found.map((f) => f.title)).toEqual(['Large model stays responsive: the night measured no studio.open_ms'])
  })

  it('says nothing an open finding already says, and numbers the next one after the last', () => {
    const first = nightlyFindings([fitness(CONDITIONS)], [measured('studio.open_ms', 12300)], [], { expect: 'studio.', now: NOW })
    const existing: Finding[] = [{ ...first[0], id: 'F-0109' }]
    const again = nightlyFindings([fitness(CONDITIONS)], [measured('studio.open_ms', 12900), measured('studio.search_key_ms', 900)], existing, { expect: 'studio.', now: NOW })
    expect(again.map((f) => [f.id, f.title])).toEqual([['F-0110', 'Large model stays responsive: studio.search_key_ms measured 900 ms, beyond <= 600 ms']])
    // Fixed, it is said again when it comes back.
    expect(nightlyFindings([fitness(CONDITIONS)], [measured('studio.open_ms', 12900), measured('studio.search_key_ms', 100)], [{ ...existing[0], status: 'fixed' }], { expect: 'studio.', now: NOW })).toHaveLength(1)
  })
})
