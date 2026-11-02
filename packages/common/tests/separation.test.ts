import { describe, expect, it } from 'vitest'
import { checkModel, type TestCase } from '../src/check'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import type { C4Node, C4Relation, DiagramData } from '../src/c4'

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
const rel = (id: string, relationType: string, sourceId: string, targetId: string): C4Relation => ({ id, relationType, sourceId, targetId })
const FF = { characteristic: 'performance-efficiency', scope: 'holistic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated' }

const MODEL: DiagramData = {
  metamodel: builtInGovernanceMetamodel(),
  nodes: [
    node('adr', 'adr', 'Fast', { status: 'accepted', date: '2026-11-02', context: 'c', decision: 'd', consequences: 'q' }),
    node('named', 'fitness-fn', 'Named', { ...FF, measure: 'studio-scale', metrics: 'studio.open_ms <= 11000 ms' }),
    node('args', 'fitness-fn', 'Args', { ...FF, measure: 'playwright tests/scale.spec.ts --cwd apps/e2e', metrics: 'studio.open_ms <= 11000 ms' }),
    node('sc', 'scenario', 'Pays', { given: 'g', when: 'w', then: 't' }),
    node('api', 'container', 'API', { description: 'Built in apps/api/src/main.ts, see apps/api/src/gone.ts.' }),
  ],
  relations: [rel('i1', 'implements', 'named', 'adr'), rel('i2', 'implements', 'args', 'adr')],
}
const found = (result: ReturnType<typeof checkModel>, rule: string) => result.findings.filter((f) => f.rule === rule).map((f) => [f.nodeId ?? f.path ?? null, f.message])

describe('the model folder holds nothing of the repository', () => {
  it('warns about a measure line with the repository\'s arguments', () => {
    expect(found(checkModel(MODEL), 'measure-with-arguments')).toEqual([[
      'args', 'Fitness function "Args": measure "playwright tests/scale.spec.ts --cwd apps/e2e" has the repository\'s arguments; name a sensor of .radical/sensors/sensors.json that holds them ({ "adapter": "playwright", "args": [...] }).',
    ]])
  })

  it('reads the repository\'s test files from radical.json and warns about such settings in check.json', () => {
    const tests: TestCase[] = [{ file: 'apps/e2e/pay.spec.ts', title: ['pays'], status: 'passed' }, { file: 'apps/web/x.test.ts', title: ['x'], status: 'passed' }]
    const repository = { file: '.radical/radical.json', implements: [], verifies: [], tests: { include: ['apps/e2e/**'] }, ci: { artifacts: ['reports'] } }
    // From radical.json: the e2e test no scenario names is unbound.
    const result = checkModel(MODEL, {}, { tests, repository })
    expect(found(result, 'test-unbound').map(([, m]) => m)).toEqual(['apps/e2e/pay.spec.ts: 1 of 1 test named by no scenario or fitness function.'])
    expect(found(result, 'repository-settings-in-model')).toEqual([])
    // The same settings in check.json still count, with a warning each.
    const old = checkModel(MODEL, { rules: { 'test-unbound': { severity: 'warning', include: ['apps/e2e/**'] } }, ci: { artifacts: ['reports'] } }, { tests })
    expect(found(old, 'test-unbound')).toHaveLength(1)
    expect(found(old, 'repository-settings-in-model')).toEqual([
      ['check.json', 'check.json holds the repository\'s test-unbound include and exclude; it belongs in .radical/radical.json ("tests": { "include": [...], "exclude": [...] }).'],
      ['check.json', 'check.json holds the repository\'s ci artifacts; they belong in .radical/radical.json ("ci": { "artifacts": [...] }).'],
    ])
  })

  it('warns about a description naming a path the repository does not have', () => {
    expect(found(checkModel(MODEL, {}, { missingPaths: { api: ['apps/api/src/gone.ts'] } }), 'description-path-missing'))
      .toEqual([['api', 'Container "API" names apps/api/src/gone.ts, which the repository does not have.']])
  })
})
