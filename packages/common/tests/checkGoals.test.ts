import { describe, expect, it } from 'vitest'
import { CHECK_METRICS, CHECK_RULES, FOLDER_RULES, CHECK_DIMENSIONS, checkModel, compareCheckConfig, defaultSeverity, formatCheckText, parseCheckConfig, type CheckConfig, type TestCase } from '../src/check'
import { builtInC4Metamodel, builtInGovernanceMetamodel } from '../src/metamodel'
import type { C4Node, C4Relation, DiagramData } from '../src/c4'

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
const rel = (id: string, relationType: string, sourceId: string, targetId: string): C4Relation =>
  ({ id, relationType, sourceId, targetId })

const ACCEPTED_ADR = { status: 'accepted', date: '2026-10-16', context: 'c', decision: 'd', consequences: 'q' }

/** Four requirements, three of them with a scenario; two accepted ADRs and
 *  a proposed one, one accepted ADR with a fitness function. */
function model(): DiagramData {
  const req = (id: string): C4Node => node(id, 'requirement', id, { ears_type: 'ubiquitous', action: `do ${id}` })
  return {
    metamodel: builtInGovernanceMetamodel(),
    nodes: [
      node('sys', 'system', 'Shop'),
      node('need', 'need', 'Brief'),
      req('r1'), req('r2'), req('r3'), req('r4'),
      node('s1', 'scenario', 'S1', { given: 'g', when: 'w', then: 't', tests: 'tests/a.test.ts › one' }),
      node('s2', 'scenario', 'S2', { given: 'g', when: 'w', then: 't', tests: 'tests/a.test.ts › two' }),
      node('s3', 'scenario', 'S3', { given: 'g', when: 'w', then: 't' }),
      node('a1', 'adr', 'A1', ACCEPTED_ADR),
      node('a2', 'adr', 'A2', ACCEPTED_ADR),
      node('a3', 'adr', 'A3', { status: 'proposed' }),
      node('ff', 'fitness-fn', 'F', { threshold: 'passes', tests: 'tests/f.test.ts › holds' }),
    ],
    relations: [
      ...['r1', 'r2', 'r3', 'r4'].flatMap((r) => [rel(`d-${r}`, 'derives', r, 'need'), rel(`s-${r}`, 'satisfies', 'sys', r)]),
      rel('v1', 'verifies', 's1', 'r1'),
      rel('v2', 'verifies', 's2', 'r2'),
      rel('v3', 'verifies', 's3', 'r3'),
      rel('i1', 'implements', 'ff', 'a1'),
    ],
  }
}

const TESTS: TestCase[] = [
  { file: '/repo/tests/a.test.ts', title: ['one'], status: 'passed' },
  { file: '/repo/tests/a.test.ts', title: ['two'], status: 'failed' },
  { file: '/repo/tests/f.test.ts', title: ['holds'], status: 'passed' },
  { file: '/repo/tests/a.test.ts', title: ['three'], status: 'passed' },
]

const metric = (result: ReturnType<typeof checkModel>, id: string) => result.metrics.find((m) => m.id === id)

describe('radical check goals', () => {
  it('measures what share of the model meets each rule', () => {
    const result = checkModel(model())
    expect(metric(result, 'requirements-with-scenario')).toMatchObject({ count: 3, total: 4, percent: 75, met: true })
    expect(metric(result, 'scenarios-with-tests')).toMatchObject({ count: 2, total: 3, percent: 66 })
    // Only accepted ADRs count.
    expect(metric(result, 'adrs-with-fitness-fn')).toMatchObject({ count: 1, total: 2, percent: 50 })
    expect(metric(result, 'requirements-satisfied')).toMatchObject({ count: 4, total: 4, percent: 100 })
    // Without reports there is nothing the tests say.
    expect(metric(result, 'requirements-verified')).toBeUndefined()
  })

  it('measures what the tests verify with reports', () => {
    const config: CheckConfig = { rules: { 'test-unbound': { include: ['tests/**'] } } }
    const result = checkModel(model(), config, { tests: TESTS })
    expect(metric(result, 'requirements-verified')).toMatchObject({ count: 1, total: 4 })
    expect(metric(result, 'scenarios-passing')).toMatchObject({ count: 1, total: 3 })
    expect(metric(result, 'adrs-verified')).toMatchObject({ count: 1, total: 2 })
    expect(metric(result, 'named-tests-passing')).toMatchObject({ count: 2, total: 3 })
    // "three" is in an included file, and nothing names it.
    expect(metric(result, 'tests-bound')).toMatchObject({ count: 3, total: 4 })
  })

  it('leaves out a metric the model has nothing to count for', () => {
    const c4: DiagramData = { metamodel: builtInC4Metamodel(), nodes: [node('sys', 'system', 'Shop')], relations: [] }
    expect(checkModel(c4).metrics.map((m) => m.id)).toEqual(['elements-valid'])
  })

  it('fails a goal below its minimum as goal-unmet, rounding the share down', () => {
    const result = checkModel(model(), { goals: { 'scenarios-with-tests': { min: 67 }, 'requirements-with-scenario': { min: 75 } } })
    expect(metric(result, 'scenarios-with-tests')).toMatchObject({ percent: 66, min: 67, met: false })
    expect(metric(result, 'requirements-with-scenario')).toMatchObject({ min: 75, met: true })
    const unmet = result.findings.filter((f) => f.rule === 'goal-unmet')
    expect(unmet).toHaveLength(1)
    expect(unmet[0]).toMatchObject({ code: 'scenarios-with-tests', severity: 'error', message: 'Scenarios that name a test: 66% (2 of 3), below the goal of 67%.' })
    expect(result.ok).toBe(false)
    expect(result.rules.find((r) => r.id === 'goal-unmet')).toMatchObject({ count: 1, failed: true })
  })

  it('lets the config turn one goal into a warning', () => {
    const result = checkModel(model(), { goals: { 'scenarios-with-tests': { min: 90 } }, rules: { 'goal-unmet/scenarios-with-tests': 'warning' } })
    expect(result.ok).toBe(true)
    expect(result.findings.find((f) => f.rule === 'goal-unmet')).toMatchObject({ key: 'goal-unmet/scenarios-with-tests', severity: 'warning' })
  })

  it('names goals for metrics that do not exist', () => {
    expect(checkModel(model(), { goals: { 'requirements-loved': { min: 50 } } }).unknownGoals).toEqual(['requirements-loved'])
  })

  it('prints the goals in the text output', () => {
    const text = formatCheckText(checkModel(model(), { goals: { 'scenarios-with-tests': { min: 67 } } }), { folder: 'model' })
    expect(text).toContain('Goals:\n  ✖ scenarios-with-tests  66% (2 of 3, min 67%)')
  })

  it('reads goals from check.json, and refuses one without a percentage', () => {
    expect(parseCheckConfig('{"goals":{"requirements-verified":{"min":80}}}').goals).toEqual({ 'requirements-verified': { min: 80 } })
    expect(() => parseCheckConfig('{"goals":{"requirements-verified":{"min":120}}}')).toThrow(/0 to 100/)
    expect(() => parseCheckConfig('{"goals":{"requirements-verified":80}}')).toThrow(/"min"/)
  })

  it('gives every rule and metric a dimension the catalogue has', () => {
    const dimensions = new Set(CHECK_DIMENSIONS.map((d) => d.id))
    for (const item of [...FOLDER_RULES, ...CHECK_RULES, ...CHECK_METRICS]) expect(dimensions.has(item.dimension)).toBe(true)
  })
})

describe('check.json changes', () => {
  const change = (before: CheckConfig, after: CheckConfig) => compareCheckConfig(before, after, defaultSeverity)

  it('says which changes loosen the gate', () => {
    expect(change(
      { rules: { 'requirement-without-scenario': { severity: 'error', max: 61 } } },
      { rules: { 'requirement-without-scenario': { severity: 'error', max: 70 } } },
    )).toEqual([{ kind: 'rule', key: 'requirement-without-scenario', changes: ['max 61 → 70'], loosens: true }])
    // test-skipped is a warning by default: making it an error tightens.
    expect(change({}, { rules: { 'test-skipped': 'error' } })).toEqual([{ kind: 'rule', key: 'test-skipped', changes: ['severity warning → error'], loosens: false }])
    expect(change({ rules: { metamodel: 'error' } }, { rules: { metamodel: 'off' } })[0]).toMatchObject({ loosens: true })
    // A baseline where there was none lets findings through; removing one does not.
    expect(change({}, { rules: { 'test-failed': { max: 2 } } })[0]).toMatchObject({ changes: ['max none → 2'], loosens: true })
    expect(change({ rules: { 'test-failed': { max: 2 } } }, {})[0]).toMatchObject({ loosens: false })
  })

  it('counts fewer test files looked at, and a lower goal, as loosening', () => {
    expect(change(
      { rules: { 'test-unbound': { include: ['apps/e2e/**'] } } },
      { rules: { 'test-unbound': { include: ['apps/e2e/**'], exclude: ['**/slow.spec.ts'] } } },
    )[0]).toMatchObject({ changes: ['exclude + **/slow.spec.ts'], loosens: true })
    expect(change({ goals: { 'requirements-verified': { min: 80 } } }, { goals: { 'requirements-verified': { min: 75 } } }))
      .toEqual([{ kind: 'goal', key: 'requirements-verified', changes: ['min 80% → 75%'], loosens: true }])
    expect(change({}, { goals: { 'requirements-verified': { min: 75 } } })[0]).toMatchObject({ loosens: false })
    expect(change({ goals: { 'requirements-verified': { min: 75 } } }, {})[0]).toMatchObject({ changes: ['min 75% → none'], loosens: true })
  })
})
