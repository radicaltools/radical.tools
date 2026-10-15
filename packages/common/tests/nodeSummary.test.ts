import { describe, it, expect } from 'vitest'
import type { C4Node, C4Relation } from '../src/c4'
import { nodeSummary, summaryTemplate, summaryTokens, DEFAULT_SUMMARIES } from '../src/nodeSummary'
import { builtInGovernanceMetamodel } from '../src/metamodel/presets/governance'
import type { Metamodel } from '../src/metamodel/types'

const node = (id: string, type: string, extra: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label: id, x: 0, y: 0, width: 100, height: 60, ...extra }) as C4Node

describe('element summary', () => {
  const svc = node('svc', 'container', { label: 'Payments Service', technology: 'Java', description: 'Moves money.\n\nMore detail.' })
  const req = node('req', 'requirement', { ears_type: 'event-driven', trigger: 'a payment is submitted', action: 'check the limit', description: 'Why.' })
  const nodes: Record<string, C4Node> = { svc, req }
  const relations: Record<string, C4Relation> = { s: { id: 's', sourceId: 'svc', targetId: 'req', relationType: 'satisfies' } as C4Relation }
  const summary = (n: C4Node) => nodeSummary(n, { ...nodes, [n.id]: n }, relations)

  it('says what each type means by it', () => {
    expect(summary(req)).toBe('When a payment is submitted, Payments Service shall check the limit.')
    expect(summary(node('sc', 'scenario', { given: 'a batch', when: 'it is approved twice', then: 'the second is rejected' })))
      .toBe('When it is approved twice → then the second is rejected')
    expect(summary(node('adr', 'adr', { status: 'accepted', decision: 'Use Postgres.' }))).toBe('Accepted: Use Postgres.')
    expect(summary(node('ff', 'fitness-fn', { description: 'p95 latency of checkout', threshold: '< 300 ms' }))).toBe('p95 latency of checkout — threshold < 300 ms')
    expect(summary(node('m', 'mockup', { screen: '/checkout', description: 'Pay for the basket' }))).toBe('/checkout — Pay for the basket')
    expect(summary(svc)).toBe('[Java] Moves money.')
  })

  it('falls back to the description\'s first sentence, in one line', () => {
    expect(summary(node('n', 'need', { description: '# Brief\nCustomers want\n  click & collect. They say so often.\n\nDetails.' }))).toBe('Brief Customers want click & collect.')
    expect(summary(node('r2', 'requirement', { description: 'Not written as EARS yet.' }))).toBe('Not written as EARS yet.')
    expect(summary(node('x', 'scenario'))).toBe('')
  })
})

describe('element summary: the type\'s template', () => {
  const mm = builtInGovernanceMetamodel()
  const withSummary = (type: string, summary: string): Metamodel =>
    ({ ...mm, nodeTypes: { ...mm.nodeTypes, [type]: { ...mm.nodeTypes[type], summary } } })
  const adr = node('adr', 'adr', { status: 'accepted', decision: 'Use Postgres. It has transactions.', context: 'Orders need them.', supersededBy: undefined })
  const nodes: Record<string, C4Node> = { adr, sys: node('sys', 'system', { label: 'Bookstore' }) }

  it('a type takes its own template, else the built-in one for its id, else the description', () => {
    expect(summaryTemplate('adr', mm)).toBe(DEFAULT_SUMMARIES.adr)
    expect(summaryTemplate('adr', withSummary('adr', '{context}'))).toBe('{context}')
    expect(summaryTemplate('risk', mm)).toBe('{description.sentence}')
    expect(nodeSummary(adr, nodes, {}, withSummary('adr', '{context} — {decision.sentence}'))).toBe('Orders need them. — Use Postgres.')
  })

  it('leaves out a part in [ ] whose token is empty, and tidies what is left', () => {
    const tpl = withSummary('adr', '[{status.cap}][ · {consequences}][: {decision}]')
    expect(nodeSummary(adr, nodes, {}, tpl)).toBe('Accepted: Use Postgres. It has transactions.')
    expect(nodeSummary(node('a2', 'adr', { decision: 'Cache it.' }), nodes, {}, tpl)).toBe('Cache it.')
    // Empty, it falls back to the description.
    expect(nodeSummary(node('a3', 'adr', { description: 'Draft. More.' }), nodes, {}, tpl)).toBe('Draft.')
  })

  it('names the elements a ref points at, and escapes brackets', () => {
    const scenario = node('sc', 'scenario', { label: 'Pay', when: 'paid' })
    const refType: Metamodel = { ...mm, nodeTypes: { ...mm.nodeTypes, scenario: { ...mm.nodeTypes.scenario, summary: '\\[{label}\\] {owner}', properties: [...(mm.nodeTypes.scenario.properties ?? []), { key: 'owner', label: 'Owner', type: 'ref', refType: 'system' }] } } }
    expect(nodeSummary({ ...scenario, owner: 'sys' } as C4Node, nodes, {}, refType)).toBe('[Pay] Bookstore')
  })

  it('offers the tokens a type has', () => {
    expect(summaryTokens('requirement', mm)).toEqual(expect.arrayContaining(['label', 'description', 'ears', 'action', 'ears_type']))
    expect(summaryTokens('scenario', mm)).toEqual(expect.arrayContaining(['when', 'then']))
    expect(summaryTokens('scenario', mm)).not.toContain('ears')
  })
})
