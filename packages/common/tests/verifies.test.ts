import { describe, expect, it } from 'vitest'
import { checkModel, type RepositoryMapping, type TestCase } from '../src/check'
import { parseRepositoryFile, serializeRepositoryFile } from '../src/repositoryMapping'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import type { C4Node, C4Relation, DiagramData } from '../src/c4'

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
const rel = (id: string, relationType: string, sourceId: string, targetId: string): C4Relation => ({ id, relationType, sourceId, targetId })
const scenario = (id: string, label: string, props: Record<string, unknown> = {}) => node(id, 'scenario', label, { given: 'g', when: 'w', then: 't', ...props })

/** A shop whose API satisfies four requirements, each with a scenario, and
 *  a report requirement no element of the repository satisfies. */
const MODEL: DiagramData = {
  metamodel: builtInGovernanceMetamodel(),
  nodes: [
    node('shop', 'system', 'Shop'), node('api', 'container', 'Orders API', { parentId: 'shop' }), node('erp', 'system', 'ERP'),
    ...['pay', 'refund', 'cancel', 'quote', 'report'].map((r) => node(r, 'requirement', r, { ears_type: 'ubiquitous', action: `The system shall ${r}` })),
    scenario('s-pay', 'Pays'), scenario('s-refund', 'Refunds'),
    scenario('s-cancel', 'Cancels', { metrics: 'test(tests/cancel.test.ts › cancels) passed' }),
    scenario('s-quote', 'Quotes'), scenario('s-report', 'Reports'),
  ],
  relations: [
    ...['pay', 'refund', 'cancel', 'quote'].map((r) => rel(`sat-${r}`, 'satisfies', 'api', r)),
    rel('sat-report', 'satisfies', 'erp', 'report'),
    ...['pay', 'refund', 'cancel', 'quote', 'report'].map((r) => rel(`ver-${r}`, 'verifies', `s-${r}`, r)),
  ],
}

const TESTS: TestCase[] = [
  { file: 'tests/pay.test.ts', title: ['pays'], status: 'passed' },
  { file: 'tests/refund.test.ts', title: ['refunds'], status: 'failed' },
  { file: 'tests/cancel.test.ts', title: ['cancels'], status: 'passed' },
]

describe('tests bound outside the model', () => {
  it('judges scenarios by the tests .radical/radical.json binds, and warns about tests in the model and scenarios the repository leaves unverified', () => {
    // As the file is written and read back.
    const file = parseRepositoryFile(serializeRepositoryFile({
      implements: [{ element: 'shop', name: 'Shop', paths: ['.'] }],
      verifies: [
        { element: 's-pay', name: 'Pays', tests: ['tests/pay.test.ts › pays'] },
        { element: 's-refund', name: 'Refunds', tests: ['tests/refund.test.ts › refunds', 'tests/refund.test.ts › gone'] },
      ],
    }))
    const repository: RepositoryMapping = { file: '.radical/radical.json', implements: file.implements.map((m) => ({ ...m, missing: [] })), verifies: file.verifies }
    const result = checkModel(MODEL, {}, { tests: TESTS, repository })
    const status = (id: string) => result.evidence!.nodes[id].status
    expect([status('s-pay'), status('s-refund'), status('s-cancel'), status('s-quote')]).toEqual(['passed', 'failed', 'passed', 'no-checks'])
    expect([status('pay'), status('refund'), status('cancel')]).toEqual(['verified', 'broken', 'verified'])
    expect(result.evidence!.nodes['s-pay'].tests).toEqual([{ id: 'tests/pay.test.ts › pays', outcome: 'passed' }])

    const found = (rule: string) => result.findings.filter((f) => f.rule === rule).map((f) => [f.nodeId ?? null, f.message])
    // A test in the model still counts, and is warned about.
    expect(found('model-names-tests')).toEqual([['s-cancel', 'Scenario "Cancels" names 1 test in its Metrics; it belongs in .radical/radical.json (radical setup moves them).']])
    // The repository builds the API: its scenarios are the repository's to verify.
    expect(found('scenario-not-verified-here')).toEqual([['s-quote', 'Scenario "Quotes" is this repository\'s to verify (an element it builds satisfies its requirement), and .radical/radical.json binds no test to it: radical verify s-quote --test "<file> › <title>".']])
    // Another system's scenario is no check of this repository's, but still none.
    expect(found('scenario-without-metrics')).toEqual([['s-report', 'Scenario "Reports" names no check.']])
    // A bound test the reports lack.
    expect(found('test-not-found').map(([, m]) => m)).toEqual([expect.stringContaining('tests/refund.test.ts › gone')])
  })

  it('names a binding the model does not have', () => {
    const repository: RepositoryMapping = { file: '.radical/radical.json', implements: [], verifies: [
      { element: 'nope', name: 'Ghost', tests: ['tests/x.test.ts'] },
      { element: 'api', name: 'Orders API', tests: ['tests/x.test.ts'] },
      { element: 's-pay', name: 'Paying', tests: ['tests/pay.test.ts › pays'] },
    ] }
    const messages = checkModel(MODEL, {}, { repository }).findings.filter((f) => f.rule === 'repository-mapping').map((f) => f.message)
    expect(messages).toEqual([
      '.radical/radical.json: tests bound to "Ghost" (nope), which is no element of the model.',
      '.radical/radical.json: tests bound to container "Orders API"; only a scenario or a fitness function is checked by tests.',
      '.radical/radical.json: s-pay is named "Paying"; the model calls it "Pays".',
    ])
  })
})
