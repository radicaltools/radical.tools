// Fitness function "Pipeline fast and reliable": what radical sense
// github-actions measures from the runs of the last 30 days, judged by the
// night (tools/nightly-findings.ts) against the conditions of the model.
// The repository's own figures are measured every night by nightly.yml.
import { describe, expect, it } from 'vitest'
import type { C4Node } from '@radical/common/c4'
import type { Measurement } from '@radical/common/check'
import { runValues } from '../../apps/cli/src/sensors/github-actions'
import { nightlyFindings } from '../nightly-findings'

const NOW = Date.parse('2026-11-24T03:00:00Z')

/** The fitness function as the model holds it (CI/CD pipeline pack, 15 min,
 *  90 %, 5 %). */
const HEALTH = {
  id: 'ff-pipeline-health', type: 'fitness-fn', label: 'Pipeline fast and reliable', x: 0, y: 0, width: 0, height: 0, collapsed: false,
  cadence: 'triggered', trigger: 'nightly', invocation: 'automated', measure: 'github-actions',
  metrics: 'ci.pr.duration.p90 <= 15 min\nci.main.success.rate >= 90 %\nci.rerun.rate <= 5 %',
} as unknown as C4Node

let id = 0
/** A completed run of `minutes`, started at `start` minutes past 09:00 on
 *  2026-11-23. */
const run = (o: { event: string; sha: string; minutes?: number; start?: number; conclusion?: string; attempt?: number }) => {
  const from = Date.parse('2026-11-23T09:00:00Z') + (o.start ?? 0) * 60_000
  return {
    id: ++id, name: 'CI', path: '.github/workflows/ci.yml', event: o.event, head_branch: o.event === 'push' ? 'main' : 'feat/x', head_sha: o.sha,
    status: 'completed', conclusion: o.conclusion ?? 'success', run_attempt: o.attempt ?? 1,
    run_started_at: new Date(from).toISOString(), created_at: new Date(from).toISOString(), updated_at: new Date(from + (o.minutes ?? 5) * 60_000).toISOString(),
  }
}

/** Ten pull-request commits of `prMinutes`, twenty commits on main of which
 *  `red` failed, and `reruns` of those thirty runs run twice. */
function night({ prMinutes = 8, red = 0, reruns = 0 } = {}): Measurement[] {
  const runs = [
    ...Array.from({ length: 10 }, (_, i) => run({ event: 'pull_request', sha: `p${i}`, minutes: prMinutes })),
    ...Array.from({ length: 20 }, (_, i) => run({ event: 'push', sha: `m${i}`, conclusion: i < red ? 'failure' : 'success' })),
  ].map((r, i) => ({ ...r, run_attempt: i < reruns ? 2 : 1 }))
  return runValues(runs, 'main').map((v) => ({ ...v, labels: {}, source: 'github-actions', at: '2026-11-24T02:40:00Z' }) as Measurement)
}

const titles = (measurements: Measurement[]): string[] => nightlyFindings([HEALTH], measurements, [], { trigger: 'nightly', now: NOW }).map((f) => f.title)

describe('Pipeline fast and reliable', () => {
  it('holds on a night within every limit', () => {
    expect(titles(night())).toEqual([])
  })

  it('Slow pipeline found: the 90th percentile of the pull-request commits\' pipeline time over 15 minutes fails the night', () => {
    expect(titles(night({ prMinutes: 15 }))).toEqual([])
    expect(titles(night({ prMinutes: 16 }))).toEqual(['Pipeline fast and reliable: ci.pr.duration.p90 measured 16 min, beyond <= 15 min'])
  })

  it('Red main counted: fewer than 90 % of the commits on main with every run successful fails the night', () => {
    expect(titles(night({ red: 2 }))).toEqual([])
    expect(titles(night({ red: 3 }))).toEqual(['Pipeline fast and reliable: ci.main.success.rate measured 85 %, beyond >= 90 %'])
  })

  it('Reruns counted: more than 5 % of the runs with a second attempt fails the night', () => {
    expect(titles(night({ reruns: 1 }))).toEqual([])
    expect(titles(night({ reruns: 2 }))).toEqual(['Pipeline fast and reliable: ci.rerun.rate measured 6.7 %, beyond <= 5 %'])
  })
})
