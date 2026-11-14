import { describe, expect, it } from 'vitest'
import { computeEvidence, formatTrace, parseTestReport, traceGap, traceOf, withBoundTests, type TestCase, type TraceNode } from '../src/check'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import type { C4Node, C4Relation } from '../src/c4'

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
const rel = (id: string, relationType: string, sourceId: string, targetId: string): C4Relation =>
  ({ id, relationType, sourceId, targetId })

const NOW = Date.parse('2026-11-14T12:00:00Z')

/** A need, a requirement derived from it and one derived from that; two
 *  scenarios on the first (one failing); an ADR constraining two
 *  containers, with a fitness function measured for each and one that
 *  names no check. */
function fixture() {
  const nodes = [
    node('need', 'need', 'Trust the check'),
    node('req', 'requirement', 'Failing test turns red', { action: 'a' }),
    node('sub', 'requirement', 'Message shown', { action: 'a' }),
    node('s-fail', 'scenario', 'Red on failure', { given: 'g', when: 'w', then: 't' }),
    node('s-pass', 'scenario', 'Green on pass', { given: 'g', when: 'w', then: 't' }),
    node('s-sub', 'scenario', 'Message in the panel', { given: 'g', when: 'w', then: 't', metrics: 'test(a.test.ts › sum › zero) passed' }),
    node('adr', 'adr', 'No cycles', { status: 'accepted' }),
    node('c1', 'container', 'Studio'),
    node('c2', 'container', 'CLI'),
    node('ff', 'fitness-fn', 'Cycle count', { metrics: 'deps.cycles <= 0\ntest(a.test.ts › sum › zero) passed' }),
    node('ff-none', 'fitness-fn', 'Reviewed by hand'),
    node('comp', 'component', 'Inspector'),
  ]
  const relations = [
    rel('d1', 'derives', 'req', 'need'),
    rel('d2', 'derives', 'sub', 'req'),
    rel('v1', 'verifies', 's-fail', 'req'),
    rel('v2', 'verifies', 's-pass', 'req'),
    rel('v3', 'verifies', 's-sub', 'sub'),
    rel('i1', 'implements', 'ff', 'adr'),
    rel('i2', 'implements', 'ff-none', 'adr'),
    rel('k1', 'constrains', 'adr', 'c1'),
    rel('k2', 'constrains', 'adr', 'c2'),
    rel('sat', 'satisfies', 'comp', 'req'),
  ]
  const cases: TestCase[] = parseTestReport(JSON.stringify({
    testResults: [{ name: '/repo/a.test.ts', assertionResults: [
      { ancestorTitles: ['sum'], title: 'adds', status: 'failed', duration: 4, location: { line: 12 }, failureMessages: ['AssertionError: expected 3 to be 4'] },
      { ancestorTitles: ['sum'], title: 'zero', status: 'passed', duration: 1, location: { line: 20 } },
    ] }],
  }), 'v.json')
  const verifies = [
    { element: 's-fail', tests: ['a.test.ts › sum › adds'] },
    { element: 's-pass', tests: ['a.test.ts › sum › zero'] },
  ]
  const byId = Object.fromEntries(withBoundTests(nodes, verifies).map((n) => [n.id, n]))
  const relById = Object.fromEntries(relations.map((r) => [r.id, r]))
  const measurements = [
    { metric: 'deps.cycles', value: 0, labels: { element: 'c1' }, source: 'madge', at: '2026-11-14T10:00:00Z' },
    { metric: 'deps.cycles', value: 2, unit: 'cycles', labels: { element: 'c2' }, source: 'madge', at: '2026-11-14T10:00:00Z' },
  ]
  const evidence = computeEvidence({ nodes: byId, relations: relById, metamodel: builtInGovernanceMetamodel(), tests: cases, measurements, now: NOW })
  return { nodes: byId, relations: relById, evidence, cases }
}

const shape = (n: TraceNode): unknown => [n.id, n.status, ...(n.target ? ['◀'] : []), n.children.map(shape)]

describe('verification path', () => {
  it('goes from a requirement up to its need and down to every test, failing first', () => {
    const f = fixture()
    const trace = traceOf(f, 'req')
    expect(trace.roots.map(shape)).toEqual([
      ['need', 'broken', [
        ['req', 'broken', '◀', [
          ['s-fail', 'failed', []],
          ['s-pass', 'passed', []],
          ['sub', 'verified', [['s-sub', 'passed', []]]],
        ]],
      ]],
    ])
    const failing = trace.roots[0].children[0].children[0]
    expect(failing.results).toHaveLength(1)
    expect(failing.results[0]).toMatchObject({ test: 'a.test.ts › sum › adds', outcome: 'failed' })
    expect(failing.results[0].cases).toEqual([{ file: '/repo/a.test.ts', title: ['sum', 'adds'], status: 'failed', message: 'AssertionError: expected 3 to be 4', durationMs: 4, line: 12 }])
  })

  it('keeps above the element only what leads to it', () => {
    const trace = traceOf(fixture(), 'sub')
    expect(trace.roots.map(shape)).toEqual([
      ['need', 'broken', [['req', 'broken', [['sub', 'verified', '◀', [['s-sub', 'passed', []]]]]]]],
    ])
  })

  it('goes from a fitness function up to its ADR and down to each element it is measured for', () => {
    const trace = traceOf(fixture(), 'ff')
    const [adr] = trace.roots
    expect(adr).toMatchObject({ id: 'adr', status: 'broken' })
    // Above the target only what leads to it: not the other fitness function.
    expect(adr.children.map((c) => c.id)).toEqual(['ff'])
    const ff = adr.children[0]
    expect(ff.results.map((r) => [r.test ?? r.condition, r.outcome])).toEqual([['a.test.ts › sum › zero', 'passed']])
    expect(ff.elements!.map((e) => [e.label, e.status])).toEqual([['CLI', 'failed'], ['Studio', 'passed']])
    expect(ff.elements![0].results[0]).toMatchObject({ condition: 'deps.cycles <= 0', outcome: 'failed', measurement: { value: 2, unit: 'cycles', source: 'madge' } })
  })

  it('shows from an ADR every fitness function, and says what is missing', () => {
    const trace = traceOf(fixture(), 'adr')
    const ids = trace.roots[0].children.map((c) => c.id)
    expect(ids).toEqual(['ff', 'ff-none'])
    const none = trace.roots[0].children[1]
    expect(none.status).toBe('no-checks')
    expect(traceGap(none)).toBe('names no check')
  })

  it('has no path for an element of another type or an unknown id', () => {
    const f = fixture()
    expect(traceOf(f, 'comp').roots).toEqual([])
    expect(traceOf(f, 'nope').roots).toEqual([])
    expect(formatTrace(traceOf(f, 'nope'), f.nodes)).toBe('No element nope in the model.')
    expect(formatTrace(traceOf(f, 'comp'), f.nodes)).toMatch(/^Inspector \(component\) is on no verification path/)
  })

  it('draws a cycle of derives once', () => {
    const f = fixture()
    f.relations.loop = rel('loop', 'derives', 'req', 'sub')
    const trace = traceOf(f, 'sub')
    const flat = JSON.stringify(trace)
    expect(flat).toContain('"repeated":true')
  })

  it('prints the path as text, with why a test failed', () => {
    const f = fixture()
    expect(formatTrace(traceOf(f, 'req'), f.nodes, NOW)).toBe([
      'Verification path of Failing test turns red [req]',
      '- Need: Trust the check [need] — broken',
      '  ▶ Requirement: Failing test turns red [req] — broken',
      '    - Scenario: Red on failure [s-fail] — failed',
      '        · a.test.ts › sum › adds — failed',
      '            AssertionError: expected 3 to be 4',
      '    - Scenario: Green on pass [s-pass] — passed',
      '        · a.test.ts › sum › zero — passed',
      '    - Requirement: Message shown [sub] — verified',
      '      - Scenario: Message in the panel [s-sub] — passed',
      '          · a.test.ts › sum › zero — passed',
    ].join('\n'))
    expect(formatTrace(traceOf(f, 'ff'), f.nodes, NOW)).toContain('      for CLI [c2] — failed\n        · deps.cycles <= 0 — failed · 2 cycles by madge, 2 h ago')
  })
})
