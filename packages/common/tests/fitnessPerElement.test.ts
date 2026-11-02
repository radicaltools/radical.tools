import { describe, expect, it } from 'vitest'
import { checkModel, type Measurement } from '../src/check'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import type { C4Node, C4Relation, DiagramData } from '../src/c4'

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
const rel = (id: string, relationType: string, sourceId: string, targetId: string): C4Relation => ({ id, relationType, sourceId, targetId })

const NOW = Date.parse('2026-11-02T12:00:00Z')
const measured = (metric: string, value: number, labels: Record<string, string> = {}): Measurement =>
  ({ metric, value, labels, source: 'command', at: new Date(NOW - 3600e3).toISOString() })
const ADR = { status: 'accepted', date: '2026-11-02', context: 'c', decision: 'd', consequences: 'q' }

/** A system with two APIs and a worker; an ADR constrains both APIs, and a
 *  fitness function implements it with `metrics`. With `standards`, the ADR
 *  and the fitness function are another model's, fetched by a federation. */
function model(metrics: string, standards = false): DiagramData {
  const theirs = standards ? { origin: 'standards@abc1234' } : {}
  return {
    metamodel: builtInGovernanceMetamodel(),
    nodes: [
      node('pay', 'system', 'Payments'),
      node('pay-api', 'container', 'Payments API', { parentId: 'pay', technology: 'Node' }),
      node('refund-api', 'container', 'Refunds API', { parentId: 'pay' }),
      node('worker', 'container', 'Ledger worker', { parentId: 'pay' }),
      node('adr', 'adr', 'APIs are described in OpenAPI', { ...ADR, ...theirs }),
      node('ff', 'fitness-fn', 'APIs described in OpenAPI', { metrics, ...theirs }),
    ],
    relations: [
      rel('i', 'implements', 'ff', 'adr'),
      rel('c1', 'constrains', 'adr', 'pay-api'),
      rel('c2', 'constrains', 'adr', 'refund-api'),
    ],
  }
}
const run = (data: DiagramData, measurements: Measurement[]) => checkModel(data, {}, { measurements, now: NOW })
const findings = (result: ReturnType<typeof run>, rule: string) => result.findings.filter((f) => f.rule === rule).map((f) => [f.nodeId, f.message])

describe('fitness functions per element', () => {
  it('evaluates a fitness function for each element its decision constrains', () => {
    const result = run(model('openapi.exit_code == 0'), [
      measured('openapi.exit_code', 0, { element: 'pay-api' }),
      measured('openapi.exit_code', 1, { element: 'refund-api' }),
      measured('openapi.exit_code', 0, { element: 'worker' }),
    ])
    const ev = result.evidence!.nodes.ff
    expect(ev.elements!.map((e) => [e.id, e.status, e.conditions[0].measurement?.value])).toEqual([['pay-api', 'passed', 0], ['refund-api', 'failed', 1]])
    expect(ev.status).toBe('failed')
    expect(result.evidence!.nodes.adr.status).toBe('broken')
    expect(findings(result, 'metric-failed')).toEqual([
      ['ff', 'Fitness function "APIs described in OpenAPI": openapi.exit_code == 0 does not hold (1 from command, 1 h ago) for container "Refunds API".'],
    ])

    // An element its sensor did not reach is not measured; the others still count.
    const partly = run(model('openapi.exit_code == 0'), [measured('openapi.exit_code', 0, { element: 'pay-api' })])
    expect(partly.evidence!.nodes.ff.status).toBe('not-run')
    expect(findings(partly, 'metric-not-measured')).toEqual([
      ['ff', 'Fitness function "APIs described in OpenAPI": nothing measured openapi.exit_code == 0 for container "Refunds API".'],
    ])

    // Measured once, without elements, it is judged once, as before.
    const whole = run(model('openapi.exit_code == 0'), [measured('openapi.exit_code', 0)])
    expect(whole.evidence!.nodes.ff).toMatchObject({ status: 'passed' })
    expect(whole.evidence!.nodes.ff.elements).toBeUndefined()
  })

  it('judges a fetched standard on the model\'s own elements', () => {
    const data = model('openapi.exit_code == 0', true)
    const result = run(data, [
      measured('openapi.exit_code', 0, { element: 'pay-api' }),
      measured('openapi.exit_code', 2, { element: 'refund-api' }),
    ])
    const ev = result.evidence!.nodes.ff
    expect(ev).toMatchObject({ origin: 'standards@abc1234', status: 'failed', tests: [] })
    expect(ev.elements!.map((e) => [e.id, e.status])).toEqual([['pay-api', 'passed'], ['refund-api', 'failed']])
    // The finding is on the model's own element, which the fitness function's model cannot fix.
    const failed = result.findings.filter((f) => f.rule === 'metric-failed')
    expect(failed.map((f) => [f.nodeId, f.message, f.relatedIds])).toEqual([[
      'refund-api',
      'Fitness function "APIs described in OpenAPI": openapi.exit_code == 0 does not hold (2 from command, 1 h ago) for container "Refunds API" (a fitness function of standards@abc1234).',
      ['ff'],
    ]])
    // The standard's ADR stays its own model's.
    expect(result.evidence!.nodes.adr).toBeUndefined()

    // Not measured here at all: the standard is not this model's evidence.
    const none = run(data, [])
    expect(none.evidence!.nodes.ff).toBeUndefined()
    expect(none.findings.filter((f) => f.rule.startsWith('metric-'))).toEqual([])
  })
})
