import { describe, expect, it } from 'vitest'
import { checkModel, fitnessResult, reviewMeasurements, type Measurement } from '../src/check'
import { deserializeFromMdFolder, serializeToMdFolder } from '../src/formats/mdFolder'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import { FITNESS_CHARACTERISTICS } from '../src/metamodel/presets/governance'
import type { C4Node, DiagramData } from '../src/c4'

// A fitness function is classified as Building Evolutionary Architectures
// classifies it: what it protects, how much it takes in, when it runs and on
// what, who runs it, and what to run; its result is read from its metrics.

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
const fields = (n: C4Node | undefined): Record<string, unknown> => n as unknown as Record<string, unknown>

const NOW = Date.parse('2026-10-30T12:00:00Z')
const DAY = 86400e3

const CLASSIFIED = { characteristic: 'performance-efficiency', scope: 'holistic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated' }

const model = (...nodes: C4Node[]): DiagramData => ({ metamodel: builtInGovernanceMetamodel(), nodes, relations: [] })
const messages = (data: DiagramData, rule: string, options: Parameters<typeof checkModel>[2] = {}): string[] =>
  checkModel(data, {}, { now: NOW, ...options }).findings.filter((f) => f.rule === rule).map((f) => f.message)

describe('fitness function classification', () => {
  it('gives a fitness function the dimensions of Building Evolutionary Architectures', () => {
    const type = builtInGovernanceMetamodel().nodeTypes['fitness-fn']
    const prop = (key: string) => type.properties!.find((p) => p.key === key)
    expect(type.properties!.map((p) => p.key)).toEqual(['description', 'characteristic', 'scope', 'cadence', 'trigger', 'every', 'invocation', 'measure', 'metrics', 'combine', 'max_age'])
    expect(prop('characteristic')!.options).toEqual([...FITNESS_CHARACTERISTICS])
    expect(prop('characteristic')!.options).toContain('performance-efficiency')
    expect(prop('scope')!.options).toEqual(['atomic', 'holistic'])
    expect(prop('cadence')!.options).toEqual(['triggered', 'continual', 'temporal'])
    expect(prop('trigger')).toMatchObject({ options: ['pull-request', 'nightly', 'weekly', 'release', 'deploy'], visibleWhen: { key: 'cadence', values: ['triggered'] } })
    expect(prop('every')!.visibleWhen).toEqual({ key: 'cadence', values: ['temporal'] })
    expect(prop('invocation')!.options).toEqual(['automated', 'manual'])
    expect(prop('measure')!.visibleWhen).toEqual({ key: 'invocation', values: ['automated'] })
    expect(prop('category')).toBeUndefined()
    // The wizard asks for them.
    expect(type.wizard!.steps.flatMap((s) => (s.kind === 'fields' ? s.fields : []))).toEqual(expect.arrayContaining(['characteristic', 'scope', 'cadence', 'trigger', 'every', 'invocation', 'measure']))
  })

  it('classifies a fitness function saved with a category, and leaves empty what the category cannot tell', () => {
    const files = serializeToMdFolder(model(
      node('h', 'fitness-fn', 'Whole flow', { category: 'holistic', metrics: 'test(apps/e2e/tests) passed' }),
      node('s', 'fitness-fn', 'No cycles', { category: 'structural', metrics: 'test(tests/arch.test.ts › no cycles) passed' }),
      node('o', 'fitness-fn', 'Latency', { category: 'operational', metrics: 'api.p95 <= 300 ms' }),
      node('p', 'fitness-fn', 'Process', { category: 'process' }),
      node('set', 'fitness-fn', 'Already set', { category: 'structural', characteristic: 'security', cadence: 'continual', metrics: 'test(a.test.ts) passed' }),
    ), 'Old')
    const { data } = deserializeFromMdFolder(files)
    const ff = (id: string) => fields(data.nodes.find((n) => n.id === id))
    for (const id of ['h', 's', 'o', 'p', 'set']) expect(ff(id).category).toBeUndefined()
    expect(ff('h')).toMatchObject({ scope: 'holistic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated' })
    expect(ff('h').characteristic).toBeUndefined()
    expect(ff('s')).toMatchObject({ characteristic: 'maintainability', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated' })
    expect(ff('s').scope).toBeUndefined()
    // A metric needs a sensor and a time to run: nothing tells which.
    for (const key of ['characteristic', 'scope', 'cadence', 'trigger', 'invocation']) expect(ff('o')[key]).toBeUndefined()
    expect(Object.keys(ff('p')).filter((k) => ['characteristic', 'scope', 'cadence', 'invocation'].includes(k))).toEqual([])
    // What is stated stays.
    expect(ff('set')).toMatchObject({ characteristic: 'security', cadence: 'continual' })
    expect(ff('set').trigger).toBeUndefined()
    // Saved again, the files hold no category.
    expect(Object.values(serializeToMdFolder(data, 'Old')).some((text) => /^category:/m.test(text))).toBe(false)
  })

  it('brings a saved fitness-function type from its category to the classification', () => {
    const mm = builtInGovernanceMetamodel()
    const type = mm.nodeTypes['fitness-fn']
    const old = {
      ...type,
      properties: [type.properties![0], { key: 'category', label: 'Category', type: 'enum' as const, options: ['structural', 'operational', 'process', 'holistic'] }, ...type.properties!.filter((p) => ['metrics', 'combine', 'max_age'].includes(p.key))],
      wizard: { trigger: 'create' as const, steps: [{ kind: 'fields' as const, title: 'Name & category', fields: ['label', 'category'] }] },
    }
    // A custom metamodel is kept as saved, and moved to the classification.
    const custom = { ...mm, id: 'mine', name: 'Mine', nodeTypes: { ...mm.nodeTypes, 'fitness-fn': old } }
    const { data } = deserializeFromMdFolder(serializeToMdFolder({ metamodel: custom, nodes: [], relations: [] }, 'Old'))
    const moved = data.metamodel!.nodeTypes['fitness-fn']
    expect(moved.properties!.map((p) => p.key)).toEqual(['description', 'characteristic', 'scope', 'cadence', 'trigger', 'every', 'invocation', 'measure', 'metrics', 'combine', 'max_age'])
    expect(moved.wizard!.steps[0]).toMatchObject({ fields: ['label', 'characteristic'] })
  })

  it('reports a fitness function that lacks a dimension, naming the ones it lacks', () => {
    const data = model(
      node('part', 'fitness-fn', 'Half done', { characteristic: 'security', scope: 'atomic' }),
      node('trig', 'fitness-fn', 'No event', { characteristic: 'security', scope: 'atomic', cadence: 'triggered', invocation: 'automated' }),
      node('temp', 'fitness-fn', 'No time', { characteristic: 'security', scope: 'atomic', cadence: 'temporal', invocation: 'manual' }),
      node('done', 'fitness-fn', 'Done', CLASSIFIED),
    )
    expect(messages(data, 'fitness-fn-unclassified')).toEqual([
      'Fitness function "Half done" states no cadence, invocation.',
      'Fitness function "No event" states no trigger.',
      'Fitness function "No time" states no every.',
    ])
  })

  it('reads the result as static from limits and as dynamic from a baseline', () => {
    expect(fitnessResult('api.p95{env=staging} <= 300 ms\ntest(a.test.ts) passed')).toBe('static')
    expect(fitnessResult('api.p95 <= 300 ms\napi.p95 <= baseline + 20%')).toBe('dynamic')
    expect(fitnessResult('test(a.test.ts) passed\nreview(Security review) passed')).toBeUndefined()
    expect(fitnessResult(undefined)).toBeUndefined()
  })

  it('reports a measure line that names no sensor', () => {
    const data = model(node('ff', 'fitness-fn', 'Page speed', {
      ...CLASSIFIED,
      measure: 'lighthouse report.json --label page=home\nplaywright tests/load.spec.ts --cwd apps/e2e\n# a comment\n',
    }))
    expect(messages(data, 'fitness-fn-measure-invalid')).toEqual([
      'Fitness function "Page speed": measure "lighthouse report.json --label page=home" names no sensor; radical sense has command, json, playwright.',
    ])
  })

  it('leaves out of a pull-request check the fitness functions that run on another trigger', () => {
    const data = model(
      node('night', 'fitness-fn', 'Night', { ...CLASSIFIED, metrics: 'studio.open_ms <= 11000 ms' }),
      node('gate', 'fitness-fn', 'Gate', { ...CLASSIFIED, trigger: 'pull-request', metrics: 'workspaces.exit_code == 0' }),
      node('prod', 'fitness-fn', 'Production', { ...CLASSIFIED, cadence: 'continual', trigger: undefined, metrics: 'api.p95 <= 300 ms' }),
    )
    const measurements: Measurement[] = []
    expect(messages(data, 'metric-not-measured', { measurements, trigger: 'pull-request' })).toEqual(['Fitness function "Gate": nothing measured workspaces.exit_code == 0.'])
    // Without a trigger, every one is.
    expect(messages(data, 'metric-not-measured', { measurements })).toHaveLength(3)
    // Measured, a nightly one is still judged in the gate.
    const late: Measurement = { metric: 'studio.open_ms', value: 16000, unit: 'ms', labels: {}, source: 'playwright', at: new Date(NOW - 3600e3).toISOString() }
    expect(messages(data, 'metric-failed', { measurements: [late], trigger: 'pull-request' })).toHaveLength(1)
  })

  it('evaluates a review condition against the latest review of the fitness function', () => {
    const data = model(node('ff', 'fitness-fn', 'Security review', {
      characteristic: 'security', scope: 'holistic', cadence: 'temporal', every: '90d', invocation: 'manual',
      metrics: 'review(Security review) passed', max_age: '90d',
    }))
    const review = (result: 'passed' | 'failed', daysAgo: number) => ({ name: 'Security review', result, by: 'tzajac', at: new Date(NOW - daysAgo * DAY).toISOString() })
    const outcome = (reviews: ReturnType<typeof review>[]) => {
      const found = checkModel(data, {}, { measurements: reviewMeasurements(reviews), now: NOW }).findings
      return ['metric-failed', 'metric-stale', 'metric-not-measured'].filter((rule) => found.some((f) => f.rule === rule))
    }
    expect(outcome([review('passed', 10)])).toEqual([])
    // The latest counts: passed, then failed.
    expect(outcome([review('passed', 20), review('failed', 5)])).toEqual(['metric-failed'])
    expect(outcome([review('failed', 20), review('passed', 5)])).toEqual([])
    // Older than max_age, it is due again.
    expect(outcome([review('passed', 120)])).toEqual(['metric-stale'])
    expect(outcome([])).toEqual(['metric-not-measured'])
    expect(reviewMeasurements([review('passed', 1)])[0]).toMatchObject({ metric: 'review', value: 1, labels: { name: 'Security review' }, source: 'review', context: { by: 'tzajac' } })
  })
})
