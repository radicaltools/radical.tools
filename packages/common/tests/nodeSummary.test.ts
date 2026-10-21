import { describe, it, expect } from 'vitest'
import type { C4Node, C4Relation } from '../src/c4'
import { nodeSummary, nodeSummaryDetail, summaryTemplate, summaryTokens, DEFAULT_SUMMARIES } from '../src/nodeSummary'
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
    expect(summary(req)).toBe('**Payments Service shall check the limit** — when a payment is submitted')
    expect(summary(node('sc', 'scenario', { given: 'a batch', when: 'it is approved twice', then: 'the second is rejected' })))
      .toBe('**The second is rejected** — when it is approved twice')
    expect(summary(node('adr', 'adr', { status: 'accepted', decision: 'Use Postgres.' }))).toBe('**Accepted**: Use Postgres.')
    expect(summary(node('ff', 'fitness-fn', { description: 'p95 latency of checkout', threshold: '< 300 ms' }))).toBe('p95 latency of checkout — threshold **< 300 ms**')
    expect(summary(node('m', 'mockup', { screen: '/checkout', description: 'Pay for the basket' }))).toBe('**/checkout** — Pay for the basket')
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

describe('element summary: Markdown', () => {
  const mm = builtInGovernanceMetamodel()
  const withSummary = (type: string, summary: string): Metamodel =>
    ({ ...mm, nodeTypes: { ...mm.nodeTypes, [type]: { ...mm.nodeTypes[type], summary } } })

  it('keeps the marks of a Markdown field and escapes a plain value', () => {
    const adr = node('a', 'adr', { label: 'Use *the* DB', status: 'accepted', decision: 'Use **Postgres** for `orders`.' })
    expect(nodeSummary(adr, { a: adr }, {}, mm)).toBe('**Accepted**: Use **Postgres** for `orders`.')
    expect(nodeSummary(adr, { a: adr }, {}, withSummary('adr', '{label}'))).toBe('Use \\*the\\* DB')
  })

  it('keeps the Markdown of a requirement\'s EARS sentence', () => {
    const req = node('r', 'requirement', { ears_type: 'ubiquitous', action: 'keep **every** payment for `10` years' })
    expect(nodeSummary(req, { r: req }, {}, mm)).toBe('**The system shall keep every payment for `10` years**')
    expect(nodeSummaryDetail(req, { r: req }, {}, mm)).toBe('The system shall keep every payment for 10 years.')
  })

  it('lets a template use Markdown, and capitalises past the marks', () => {
    const adr = node('a', 'adr', { status: 'accepted', decision: '_use_ Postgres.' })
    expect(nodeSummary(adr, { a: adr }, {}, withSummary('adr', '**{status.cap}**: {decision.cap}'))).toBe('**Accepted**: _Use_ Postgres.')
  })
})

describe('element summary: a requirement, obligation first', () => {
  const sys = node('sys', 'container', { label: 'MCP server' })
  const relations: Record<string, C4Relation> = { s: { id: 's', sourceId: 'sys', targetId: 'r', relationType: 'satisfies' } as C4Relation }
  const summary = (extra: Record<string, unknown>) => {
    const r = node('r', 'requirement', extra)
    return { short: nodeSummary(r, { sys, r }, relations), detail: nodeSummaryDetail(r, { sys, r }, relations) }
  }

  it('says who shall do what, up to the action\'s first phrase, then the condition', () => {
    const r = summary({ ears_type: 'unwanted-behaviour', unwanted_condition: 'a call would add an invalid type', action: 'reject the write with a message: what is wrong and where' })
    expect(r.short).toBe('**MCP server shall reject the write with a message** — if a call would add an invalid type')
    expect(r.detail).toBe('If a call would add an invalid type, then MCP server shall reject the write with a message: what is wrong and where.')
  })

  it('keeps an action\'s own subject, and has no condition when it always holds', () => {
    expect(summary({ ears_type: 'ubiquitous', action: 'The wiki view shall show a page per element — with its facts' }).short).toBe('**The wiki view shall show a page per element**')
    expect(summary({ ears_type: 'complex', precondition: 'Studio is in Designer', trigger: 'the user clicks a name', action: 'edit it in place' }).short)
      .toBe('**MCP server shall edit it in place** — while Studio is in Designer, when the user clicks a name')
  })

  it('offers the parts as tokens', () => {
    expect(summaryTokens('requirement', builtInGovernanceMetamodel())).toEqual(expect.arrayContaining(['ears', 'obligation', 'condition']))
  })
})

describe('element summary: what matters first, never empty', () => {
  const mm = builtInGovernanceMetamodel()
  const n = (id: string, type: string, extra: Record<string, unknown> = {}) => node(id, type, extra)
  const nodes: Record<string, C4Node> = {
    m: n('m', 'state-machine', { label: 'Order lifecycle', description: 'How an order goes.' }),
    o: n('o', 'entity', { label: 'Order' }),
    i: n('i', 'pseudostate', { kind: 'initial' }),
    a: n('a', 'state', { label: 'Open' }),
    b: n('b', 'state', { label: 'Paid', description: 'The money is in. More.' }),
    z: n('z', 'state', { label: 'Closed', kind: 'final' }),
    pay: n('pay', 'event', { label: 'Pay' }),
    cancel: n('cancel', 'event', { label: 'Cancel', description: 'The buyer gives up.' }),
    sc: n('sc', 'scenario', { when: 'it is approved twice', then: 'the second is rejected: with a message; logged' }),
    d: n('d', 'domain', { kind: 'core', description: 'Taking orders. And more.' }),
  }
  const rel = (id: string, sourceId: string, targetId: string, relationType: string, extra: Record<string, unknown> = {}) =>
    ({ id, sourceId, targetId, relationType, ...extra }) as unknown as C4Relation
  const relations: Record<string, C4Relation> = {
    l: rel('l', 'm', 'o', 'lifecycle-of'),
    t0: rel('t0', 'i', 'a', 'transition'),
    t1: rel('t1', 'a', 'b', 'transition', { event: 'pay' }),
    t2: rel('t2', 'a', 'z', 'transition', { event: ['cancel'] }),
  }
  const summary = (id: string) => nodeSummary(nodes[id], nodes, relations, mm)

  it('reads a state machine by its entity, and its states and events by where they lead', () => {
    expect(summary('m')).toBe('Lifecycle of **Order**: How an order goes.')
    expect(summary('i')).toBe('**Initial** → **Open**')
    expect(summary('a')).toBe('On Pay → **Paid**; on Cancel → **Closed**')
    expect(summary('b')).toBe('The money is in.')
    expect(summary('z')).toBe('Final')
    expect(summary('pay')).toBe('Open → **Paid**')
    expect(summary('cancel')).toBe('The buyer gives up.')
  })

  // Open point (runs 45–64): an event only raised (^Event) showed nothing.
  it('says which transitions raise an event', () => {
    const shipped = n('shipped', 'event', { label: 'Shipped' })
    const raised = { ...relations, t1: rel('t1', 'a', 'b', 'transition', { event: 'pay', raises: ['shipped'] }) }
    expect(nodeSummary(shipped, { ...nodes, shipped }, raised, mm)).toBe('Raised by Open → Paid')
  })

  it('cuts a scenario\'s outcome at its first phrase, and puts a domain\'s kind first', () => {
    expect(summary('sc')).toBe('**The second is rejected** — when it is approved twice')
    expect(summary('d')).toBe('**Core** · Taking orders.')
  })

  it('takes the first alternative with a value, and names linked elements', () => {
    const custom: Metamodel = { ...mm, nodeTypes: { ...mm.nodeTypes, state: { ...mm.nodeTypes.state, summary: '{technology|description.phrase|label} ← {in:transition}' } } }
    expect(nodeSummary(nodes.b, nodes, relations, custom)).toBe('The money is in ← Open')
    expect(summaryTokens('event', mm)).toContain('transitions')
  })
})
