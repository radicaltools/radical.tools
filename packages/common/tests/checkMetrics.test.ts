import { describe, expect, it } from 'vitest'
import { checkModel, computeEvidence, convertUnit, mergeMeasurements, metricsFileProblems, parseCombine, parseCondition, parseMaxAge, parseMeasurementStore, parseMetricsFile, serializeMeasurementStore, serializeMetricsFile, type Measurement } from '../src/check'
import { checkedStatus } from '../src/check/evidence'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import type { C4Node, C4Relation, DiagramData } from '../src/c4'

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
const rel = (id: string, relationType: string, sourceId: string, targetId: string): C4Relation => ({ id, relationType, sourceId, targetId })

const NOW = Date.parse('2026-10-29T12:00:00Z')
const DAY = 86400e3
const at = (msAgo: number): string => new Date(NOW - msAgo).toISOString()
const measured = (metric: string, value: number, unit: string | undefined, labels: Record<string, string> = {}, msAgo = 3600e3): Measurement =>
  ({ metric, value, ...(unit ? { unit } : {}), labels, source: 'json', at: at(msAgo) })

/** An ADR with one fitness function holding `metrics`. */
function model(metrics: string, props: Record<string, unknown> = {}): DiagramData {
  return {
    metamodel: builtInGovernanceMetamodel(),
    nodes: [
      node('adr', 'adr', 'Fast checkout', { status: 'accepted', date: '2026-10-29', context: 'c', decision: 'd', consequences: 'q' }),
      node('ff', 'fitness-fn', 'Checkout latency', { metrics, ...props }),
    ],
    relations: [rel('i', 'implements', 'ff', 'adr')],
  }
}
const run = (data: DiagramData, measurements?: Measurement[]) => checkModel(data, {}, { ...(measurements ? { measurements } : {}), now: NOW })
const messages = (result: ReturnType<typeof run>, rule: string): string[] => result.findings.filter((f) => f.rule === rule).map((f) => f.message)

describe('metric conditions', () => {
  it('reads a condition as a test or a metric with labels, a comparison, a number and a unit', () => {
    expect(parseCondition('test(apps/cli/src/sense.test.ts › radical sense) passed')).toMatchObject({ kind: 'test', id: { file: 'apps/cli/src/sense.test.ts', title: ['radical sense'] } })
    expect(parseCondition('test(packages/a.test.ts)')).toMatchObject({ kind: 'test', id: { file: 'packages/a.test.ts', title: [] } })
    expect(parseCondition('api.latency.p95{env=staging, endpoint="/orders"} <= 300 ms')).toEqual({
      kind: 'metric', raw: 'api.latency.p95{env=staging, endpoint="/orders"} <= 300 ms', metric: 'api.latency.p95',
      labels: { env: 'staging', endpoint: '/orders' }, op: '<=', value: 300, unit: 'ms',
    })
    expect(parseCondition('deps.cycles = 0')).toMatchObject({ kind: 'metric', op: '==', value: 0, labels: {} })
  })

  it('evaluates each condition against the latest measurement with its metric and labels', () => {
    const data = model('api.latency.p95{env=staging} <= 300 ms\ndeps.cycles == 0')
    const result = run(data, [
      measured('api.latency.p95', 250, 'ms', { env: 'staging', endpoint: '/orders' }, 2 * DAY),
      measured('api.latency.p95', 0.31, 's', { env: 'staging' }, 3600e3),
      measured('api.latency.p95', 100, 'ms', { env: 'prod' }, 60e3),
      measured('deps.cycles', 0, undefined),
    ])
    const ev = result.evidence!.nodes.ff
    expect(ev.conditions!.map((c) => [c.outcome, c.measurement?.value])).toEqual([['failed', 0.31], ['passed', 0]])
    expect(ev.status).toBe('failed')
    expect(result.evidence!.nodes.adr.status).toBe('broken')
    expect(messages(result, 'metric-failed')).toEqual(['Fitness function "Checkout latency": api.latency.p95{env=staging} <= 300 ms does not hold (0.31 s from json, 1 h ago).'])
    expect(result.findings.find((f) => f.rule === 'metric-failed')!.relatedIds).toEqual(['adr'])
  })

  it('reports a condition nothing measured, and runs the value rules only with measurements', () => {
    const data = model('api.latency.p95 <= 300 ms')
    expect(messages(run(data, []), 'metric-not-measured')).toEqual(['Fitness function "Checkout latency": nothing measured api.latency.p95 <= 300 ms.'])
    expect(run(data, []).evidence!.nodes.ff.status).toBe('not-run')
    const without = run(data)
    expect(without.rules.filter((r) => r.id.startsWith('metric-') && r.id !== 'metric-invalid').map((r) => r.notRun)).toEqual([])
    expect(without.evidence).toBeUndefined()
    expect(checkModel(data, { rules: { 'metric-failed': { max: 0 } } }, { now: NOW }).rules.find((r) => r.id === 'metric-failed')).toMatchObject({ notRun: 'no-measurements' })
  })

  it('combines the outcomes as combine says', () => {
    const outcomes = (...list: string[]) => list.map((outcome) => ({ outcome: outcome as 'passed' }))
    expect(checkedStatus(outcomes('passed', 'failed'))).toBe('failed')
    expect(checkedStatus(outcomes('passed', 'not-run'))).toBe('not-run')
    expect(checkedStatus(outcomes('passed', 'failed'), { kind: 'any' })).toBe('passed')
    expect(checkedStatus(outcomes('failed', 'not-run'), { kind: 'any' })).toBe('not-run')
    expect(checkedStatus(outcomes('failed', 'failed'), { kind: 'any' })).toBe('failed')
    expect(checkedStatus(outcomes('passed', 'passed', 'failed'), { kind: 'at-least', n: 2 })).toBe('passed')
    expect(checkedStatus(outcomes('passed', 'failed', 'failed'), { kind: 'at-least', n: 2 })).toBe('failed')
    expect(checkedStatus(outcomes('passed', 'stale', 'failed'), { kind: 'at-least', n: 2 })).toBe('stale')
    expect(checkedStatus([])).toBe('no-checks')
    expect(parseCombine('At least 2')).toEqual({ kind: 'at-least', n: 2 })
    expect(parseCombine('')).toEqual({ kind: 'all' })
    expect(parseCombine('most')).toBeNull()
    const data = model('a.x == 1\na.y == 1', { combine: 'any' })
    expect(run(data, [measured('a.x', 1, undefined), measured('a.y', 2, undefined)]).evidence!.nodes.ff.status).toBe('passed')
  })

  it('converts units of one kind, and reads and keeps measurement files', () => {
    expect(convertUnit(1.5, 's', 'ms')).toBe(1500)
    expect(convertUnit(2, 'MiB', 'KiB')).toBe(2048)
    expect(convertUnit(5, '%', '%')).toBe(5)
    expect(convertUnit(5, 'ms', 'MB')).toBeNull()
    const text = serializeMetricsFile({ source: 'json', at: at(0), context: { commit: 'abc' }, measurements: [{ metric: 'a.b', value: 1, unit: 'ms', labels: { env: 'ci' } }] })
    expect(parseMetricsFile(text, 'm.json')).toEqual([{ metric: 'a.b', value: 1, unit: 'ms', labels: { env: 'ci' }, source: 'json', at: at(0), context: { commit: 'abc' } }])
    expect(metricsFileProblems({ format: 'radical-metrics', version: 1, source: 'x', at: 'later', measurements: [{ metric: '1bad', value: Infinity }] }))
      .toEqual(['at is no ISO time', 'measurement 1: metric is no name (letters, digits, . _ : / -)', 'measurement 1: value is no finite number'])
    expect(() => parseMetricsFile('{"format":"other"}', 'm.json')).toThrow('m.json is no radical-metrics/1 file')
    // The store keeps the latest of each metric and labels.
    const merged = mergeMeasurements([measured('a', 1, 'ms', {}, DAY), measured('a', 2, 'ms', { env: 'x' }, DAY)], [measured('a', 3, 'ms', {}, 60e3)])
    expect(merged.map((m) => m.value)).toEqual([3, 2])
    expect(parseMeasurementStore(serializeMeasurementStore(merged))).toEqual(merged)
    expect(parseMeasurementStore('not json')).toEqual([])
  })
})

describe('stale measurements', () => {
  it('reports a condition whose latest measurement is older than max_age as stale, never passed', () => {
    const data = model('api.latency.p95 <= 300 ms', { max_age: '7d' })
    const old = run(data, [measured('api.latency.p95', 120, 'ms', {}, 10 * DAY)])
    expect(old.evidence!.nodes.ff.conditions![0]).toMatchObject({ outcome: 'stale', detail: 'measured 10 d ago' })
    expect(old.evidence!.nodes.ff.status).toBe('stale')
    expect(old.evidence!.nodes.adr.status).toBe('unverified')
    expect(messages(old, 'metric-stale')).toEqual(['Fitness function "Checkout latency": api.latency.p95 <= 300 ms has only a stale measurement (120 ms from json, 10 d ago).'])
    expect(run(data, [measured('api.latency.p95', 120, 'ms', {}, 6 * DAY)]).evidence!.nodes.ff.status).toBe('passed')
    expect(parseMaxAge('12 h')).toBe(12 * 3600e3)
    expect(parseMaxAge('30min')).toBe(30 * 60e3)
    expect(parseMaxAge('')).toBeUndefined()
    expect(parseMaxAge('soon')).toBeNull()
  })
})

describe('invalid conditions', () => {
  it('reports a line that is no condition, a unit that does not convert, and a combine or max_age that cannot be read', () => {
    const data = model('p95 is fine\nload.share{env=prod} <= 300 ms', { combine: 'most', max_age: 'soon' })
    const result = run(data, [measured('load.share', 40, '%', { env: 'prod' })])
    expect(messages(result, 'metric-invalid')).toEqual([
      'Fitness function "Checkout latency": "p95 is fine" cannot be read: it is neither `test(<file> › <title>) passed`, `<metric>{<labels>} <op> <number> [unit]` nor `<metric>{<labels>} <op> baseline [+|- <number> %|unit]`.',
      'Fitness function "Checkout latency": "load.share{env=prod} <= 300 ms" cannot be evaluated: the measurement is in %, which does not convert to ms.',
      'Fitness function "Checkout latency": combine "most" is none of all, any, at least N.',
      'Fitness function "Checkout latency": max_age "soon" is no age such as 7d, 12h or 30min.',
    ])
    expect(result.evidence!.nodes.ff.status).toBe('failed')
    expect(result.ok).toBe(false)
    // Without measurements only what the lines themselves say.
    expect(messages(run(data), 'metric-invalid')).toHaveLength(3)
    expect(computeEvidence({ nodes: { ff: data.nodes[1] }, relations: {}, metamodel: data.metamodel!, measurements: [] }).nodes.ff.conditions![0].outcome).toBe('invalid')
  })
})

describe('conditions against a baseline', () => {
  const night = (value: number, nightsAgo: number, unit = 'ms'): Measurement => measured('studio.open_ms', value, unit, { model: 'x14' }, nightsAgo * DAY)
  const withBaseline = (data: DiagramData, measurements: Measurement[], baseline?: Measurement[]) =>
    checkModel(data, {}, { measurements, ...(baseline ? { baseline } : {}), now: NOW })

  it('reads the baseline with a margin in percent or in a unit, and none', () => {
    expect(parseCondition('studio.open_ms{model=x14} <= baseline + 20%')).toMatchObject({ kind: 'metric', metric: 'studio.open_ms', labels: { model: 'x14' }, op: '<=', baseline: { sign: 1, by: 20, percent: true } })
    expect(parseCondition('bundle.kb >= baseline - 5 kb')).toMatchObject({ kind: 'metric', op: '>=', baseline: { sign: -1, by: 5, percent: false, unit: 'kb' } })
    expect(parseCondition('deps.cycles <= baseline')).toMatchObject({ kind: 'metric', baseline: { sign: 1, by: 0, percent: true } })
    expect(parseCondition('studio.open_ms <= baseline + 20')).toMatchObject({ kind: 'invalid' })
  })

  it('compares the latest measurement with the median of the latest seven of the baseline, plus the margin', () => {
    // Nine nights: the two oldest are past the seven, and one slow night does not move the median.
    const baseline = [5000, 5100, 4900, 9000, 5050, 4950, 5000, 20000, 20000].map((v, i) => night(v, i + 1))
    const data = model('studio.open_ms{model=x14} <= baseline + 20%')
    const ok = withBaseline(data, [night(5900, 0.1)], baseline)
    expect(ok.evidence!.nodes.ff.conditions![0]).toMatchObject({ outcome: 'passed', detail: 'baseline 5000 ms, the median of 7; limit 6000 ms' })
    const slow = withBaseline(data, [night(6100, 0.1)], baseline)
    expect(messages(slow, 'metric-failed')).toEqual(['Fitness function "Checkout latency": studio.open_ms{model=x14} <= baseline + 20% does not hold (6100 ms from json, 2 h ago); baseline 5000 ms, the median of 7; limit 6000 ms.'])
  })

  it('takes a margin in a unit, and a baseline measured in another unit, in the measurement\'s unit', () => {
    const baseline = [night(5, 1, 's'), night(5, 2, 's'), night(5, 3, 's')]
    expect(withBaseline(model('studio.open_ms{model=x14} <= baseline + 0.5 s'), [night(5400, 0.1)], baseline).evidence!.nodes.ff.status).toBe('passed')
    expect(withBaseline(model('studio.open_ms{model=x14} <= baseline + 0.5 s'), [night(5600, 0.1)], baseline).evidence!.nodes.ff.status).toBe('failed')
  })

  it('says a condition is not evaluated while the baseline has nothing to compare with, and fails nothing for it', () => {
    const result = withBaseline(model('studio.open_ms{model=x14} <= baseline + 20%'), [night(9000, 0.1)])
    expect(result.evidence!.nodes.ff.status).toBe('not-run')
    expect(messages(result, 'metric-failed')).toEqual([])
    expect(messages(result, 'metric-not-measured')).toEqual(['Fitness function "Checkout latency": studio.open_ms{model=x14} <= baseline + 20% was not evaluated: no baseline to compare with (9000 ms from json, 2 h ago).'])
  })
})
