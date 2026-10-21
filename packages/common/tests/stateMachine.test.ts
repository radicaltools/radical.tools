import { describe, it, expect } from 'vitest'
import type { C4Node, C4Relation } from '../src/c4'
import { isContainerType } from '../src/c4'
import { builtInC4Metamodel, builtInDddC4Metamodel, builtInGovernanceMetamodel, composeEarsSentence, isPlacementAllowed, relationDisplayLabel, requirementStatePhrase, validateModel } from '../src/metamodel'
import { checkAddNode, checkAddRelation, checkNodeUpdate, checkPatchRelation, checkReparent, insertNode, type ModelState } from '../src/model'
import { addChoices } from '../src/viewPipeline'

const mm = builtInGovernanceMetamodel()
const pairsOf = (rel: string) => mm.relationTypes[rel].allowedPairs.map((p) => `${p.from}->${p.to}`)

let seq = 0
function node(type: string, label: string, parentId?: string, props: Record<string, string> = {}): C4Node {
  return { id: `${type}-${++seq}`, type, label, parentId, collapsed: false, x: 0, y: 0, width: 160, height: 60, ...props } as C4Node
}
function transition(source: C4Node, target: C4Node, props: Record<string, string | string[]> = {}): C4Relation {
  return { id: `t-${++seq}`, sourceId: source.id, targetId: target.id, relationType: 'transition', ...props } as C4Relation
}
const byId = <T extends { id: string }>(items: T[]): Record<string, T> => Object.fromEntries(items.map((i) => [i.id, i]))
const issuesOf = (nodes: C4Node[], relations: C4Relation[], prefix = 'sm-') =>
  validateModel(byId(nodes), byId(relations), mm).filter((i) => i.id.startsWith(prefix))
const kinds = (issues: { id: string }[]) => issues.map((i) => i.id.split(':')[0]).sort()

/** Order: Pending → (pay) → Paid ⟨Packing ‖ Invoicing⟩ → (ship) → Shipped (final). */
function orderMachine() {
  const order = node('entity', 'Order', undefined, { kind: 'aggregate-root' })
  const machine = node('state-machine', 'Order lifecycle')
  const init = node('pseudostate', 'Start', machine.id, { kind: 'initial' })
  const pending = node('state', 'Pending', machine.id)
  const paid = node('state', 'Paid', machine.id, { kind: 'parallel' })
  const packing = node('state', 'Packing', paid.id)
  const packInit = node('pseudostate', 'Start', packing.id, { kind: 'initial' })
  const picking = node('state', 'Picking', packing.id)
  const invoicing = node('state', 'Invoicing', paid.id)
  const shipped = node('state', 'Shipped', machine.id, { kind: 'final' })
  const pay = node('event', 'PaymentReceived', machine.id)
  const ship = node('event', 'Shipped', machine.id)
  const orderPaid = node('event', 'OrderPaid', machine.id)
  const nodes = [order, machine, init, pending, paid, packing, packInit, picking, invoicing, shipped, pay, ship, orderPaid]
  const relations = [
    { id: `l-${++seq}`, sourceId: machine.id, targetId: order.id, relationType: 'lifecycle-of' } as C4Relation,
    transition(init, pending),
    transition(pending, paid, { event: pay.id, guard: 'amount covers total', actions: 'reserve stock', raises: [orderPaid.id] }),
    transition(packInit, picking),
    transition(paid, shipped, { event: ship.id }),
  ]
  return { nodes, relations, order, machine, init, pending, paid, packing, picking, invoicing, shipped, pay, ship, orderPaid }
}

describe('state machine types (governance preset)', () => {
  it('nests states in a machine and in each other, as containers', () => {
    expect(mm.nodeTypes.state.allowedParents).toEqual(['state-machine', 'state'])
    expect(mm.nodeTypes.pseudostate.allowedParents).toEqual(['state-machine', 'state'])
    expect(mm.nodeTypes.state.allowedAtRoot).toBe(false)
    expect(isContainerType('state-machine')).toBe(true)
    expect(isContainerType('state')).toBe(true)
    expect(mm.nodeTypes.state.properties?.find((p) => p.key === 'kind')?.options).toEqual(['normal', 'parallel', 'final'])
  })

  it('links transitions between states and pseudostates, and ties machines to the rest of the model', () => {
    expect(pairsOf('transition').sort()).toEqual([
      'pseudostate->pseudostate', 'pseudostate->state', 'state->pseudostate', 'state->state',
    ])
    // A machine is the lifecycle of a domain entity; C4 elements implement it
    // and own the entity's data.
    expect(pairsOf('lifecycle-of')).toEqual(['state-machine->entity'])
    expect(pairsOf('implements')).toEqual(expect.arrayContaining(['fitness-fn->adr', 'component->state-machine', 'container->state-machine', 'system->state-machine', 'webapp->state-machine']))
    expect(pairsOf('realises')).toEqual(expect.arrayContaining(['component->entity', 'container->domain']))
    expect(mm.nodeTypes['state-machine'].properties?.some((p) => p.key === 'subject')).toBe(false)
    expect(pairsOf('emits')).toContain('component->event')
    // A state raises an event on entry, on exit or from its do activity.
    expect(pairsOf('emits')).toContain('state->event')
    expect(mm.relationTypes.emits.properties?.find((p) => p.key === 'on')?.options).toEqual(['entry', 'exit', 'do'])
    expect(pairsOf('satisfies')).toContain('state-machine->requirement')
    expect(pairsOf('verifies')).toContain('scenario->state-machine')
    expect(pairsOf('illustrates')).toContain('mockup->state')
  })

  it('points a transition at its trigger and the events it raises by reference', () => {
    const props = Object.fromEntries((mm.relationTypes.transition.properties ?? []).map((p) => [p.key, p]))
    expect(Object.keys(props)).toEqual(['event', 'guard', 'actions', 'raises', 'kind'])
    expect(props.event).toMatchObject({ type: 'ref', refType: 'event' })
    expect(props.event.multiple).toBeUndefined()
    expect(props.raises).toMatchObject({ type: 'ref', refType: 'event', multiple: true })
  })

  it('stays out of the C4 preset; the entity belongs to DDD', () => {
    expect(builtInC4Metamodel().nodeTypes.state).toBeUndefined()
    expect(builtInDddC4Metamodel().nodeTypes.entity).toMatchObject({ allowedParents: ['domain', 'group'], allowedAtRoot: true })
    expect(builtInDddC4Metamodel().nodeTypes.entity.properties?.find((p) => p.key === 'kind')?.options).toEqual(['aggregate-root', 'entity'])
    expect(mm.nodeTypes.requirement.properties?.find((p) => p.key === 'precondition_state')).toMatchObject({ type: 'ref', refType: 'state' })
  })

  it('labels a transition `event [guard] / actions ^raised` by the events\' names', () => {
    const { nodes, relations, pay } = orderMachine()
    const all = byId(nodes)
    expect(relationDisplayLabel(relations[2], all)).toBe('PaymentReceived [amount covers total] / reserve stock ^OrderPaid')
    expect(relationDisplayLabel(relations[1], all)).toBeUndefined()
    expect(relationDisplayLabel({ ...relations[2], label: 'pay' }, all)).toBe('pay')
    // Renaming the event renames the label: the transition holds its id.
    expect(relationDisplayLabel(relations[2], { ...all, [pay.id]: { ...pay, label: 'Paid' } })).toMatch(/^Paid \[/)
  })
})

describe('reference properties', () => {
  it('accept the ids of nodes of their type', () => {
    const { nodes, relations } = orderMachine()
    expect(issuesOf(nodes, relations, 'bad-ref')).toEqual([])
  })

  it('flag an id with no node, and a node of another type', () => {
    const m = orderMachine()
    const relations = [
      ...m.relations,
      transition(m.pending, m.shipped, { event: 'gone', guard: 'x' }),
      transition(m.picking, m.picking, { event: m.pending.id, raises: [m.orderPaid.id, 'gone-too'] }),
    ]
    const issues = issuesOf(m.nodes, relations, 'bad-ref')
    expect(issues.map((i) => i.message)).toEqual([
      'Transition "Pending" → "Shipped": "Event (trigger; none = completion)" points at nothing valid (no node has id "gone").',
      'Transition "Picking" → "Picking": "Event (trigger; none = completion)" points at nothing valid ("Pending" is of type state, not event).',
      'Transition "Picking" → "Picking": "Raises (events it publishes)" points at nothing valid (no node has id "gone-too").',
    ])
    expect(issues.every((i) => i.severity === 'warning' && i.relationId)).toBe(true)
  })
})

describe('state machine rules', () => {
  it('accepts a well-formed machine with a parallel state', () => {
    const { nodes, relations } = orderMachine()
    expect(validateModel(byId(nodes), byId(relations), mm)).toEqual([])
  })

  it('wants one initial pseudostate in a machine and in each compound state, none in a parallel one', () => {
    const m = orderMachine()
    const nodes = m.nodes.filter((n) => n.id !== m.init.id)
    nodes.push(node('pseudostate', 'Start', m.paid.id, { kind: 'initial' }))
    nodes.push(node('pseudostate', 'Again', m.packing.id, { kind: 'initial' }))
    const relations = m.relations.filter((r) => r.sourceId !== m.init.id)
    expect(kinds(issuesOf(nodes, relations))).toEqual([
      'sm-initial-out', 'sm-initial-out', 'sm-many-initials', 'sm-no-initial', 'sm-parallel-initial',
    ])
  })

  it('flags a parallel state with one region and a final state that is left', () => {
    const m = orderMachine()
    const nodes = m.nodes.filter((n) => n.id !== m.invoicing.id)
    const relations = [...m.relations, transition(m.shipped, m.pending, { event: m.ship.id })]
    expect(kinds(issuesOf(nodes, relations))).toEqual(['sm-final-out', 'sm-parallel-regions'])
  })

  it('flags unguarded conflicts and transitions that leave the machine', () => {
    const m = orderMachine()
    const payment = node('entity', 'Payment')
    const other = node('state-machine', 'Payment')
    const otherInit = node('pseudostate', 'Start', other.id, { kind: 'initial' })
    const elsewhere = node('state', 'Authorised', other.id)
    const relations = [
      ...m.relations,
      { id: 'l-pay', sourceId: other.id, targetId: payment.id, relationType: 'lifecycle-of' } as C4Relation,
      transition(otherInit, elsewhere),
      transition(m.pending, m.shipped, { event: m.ship.id }),
      transition(m.pending, m.pending, { event: m.ship.id }),
      transition(m.pending, m.pending, { event: m.pay.id, guard: 'within 14 days' }),
      transition(m.picking, elsewhere),
    ]
    const issues = issuesOf([...m.nodes, payment, other, otherInit, elsewhere], relations)
    expect(kinds(issues)).toEqual(['sm-cross-machine', 'sm-nondeterministic'])
    expect(issues.find((i) => i.id.startsWith('sm-nondeterministic'))?.message).toBe('"Pending" has 2 unguarded transitions on "Shipped"; only one can fire.')
  })

  it('finds states no path from the initial state reaches', () => {
    const m = orderMachine()
    const orphan = node('state', 'Refunded', m.machine.id)
    const orphanInit = node('pseudostate', 'Start', orphan.id, { kind: 'initial' })
    const inner = node('state', 'Inner', orphan.id)
    const issues = issuesOf([...m.nodes, orphan, orphanInit, inner], [...m.relations, transition(orphanInit, inner)])
    // One warning for the orphan, not one per state inside it.
    expect(issues.map((i) => i.id)).toEqual([`sm-unreachable:${orphan.id}`])
  })

  it('wants each machine to be the lifecycle of one entity, and one machine per entity', () => {
    const m = orderMachine()
    const noEntity = m.relations.filter((r) => r.relationType !== 'lifecycle-of')
    expect(issuesOf(m.nodes, noEntity).map((i) => i.id)).toEqual([`sm-no-entity:${m.machine.id}`])
    const second = node('state-machine', 'Order payment')
    const twice = [...m.relations, { id: 'l-2', sourceId: second.id, targetId: m.order.id, relationType: 'lifecycle-of' } as C4Relation]
    const issue = issuesOf([...m.nodes, second], twice).find((i) => i.id.startsWith('sm-many-machines'))!
    expect(issue.message).toContain('Entity "Order" has 2 state machines (Order lifecycle, Order payment)')
  })

  it('reaches a state through a transition from an ancestor', () => {
    const m = orderMachine()
    const cancelled = node('state', 'Cancelled', m.machine.id, { kind: 'final' })
    const cancel = node('event', 'Cancel', m.machine.id)
    const relations = [...m.relations, transition(m.paid, cancelled, { event: cancel.id })]
    expect(issuesOf([...m.nodes, cancelled, cancel], relations)).toEqual([])
  })
})

// The validation flags a final state that holds anything; every way of
// putting something there refuses it first, with the reason.
describe('a final state holds nothing', () => {
  const stateOf = (nodes: C4Node[]): ModelState => ({
    c4Nodes: byId(nodes), c4Relations: {}, sequences: {}, views: {}, activeViewId: null, metamodel: mm,
  } as unknown as ModelState)
  const draft = (type: string, parentId: string) =>
    ({ type, label: 'New', parentId, collapsed: false, x: 0, y: 0, width: 160, height: 60 }) as unknown as Omit<C4Node, 'id'>

  it('refuses a state or pseudostate added, moved or placed inside it', () => {
    const m = orderMachine()
    const s = stateOf(m.nodes)
    expect(isPlacementAllowed(mm, 'state', m.shipped, s.c4Nodes)).toBe(false)
    expect(isPlacementAllowed(mm, 'state', m.pending, s.c4Nodes)).toBe(true)
    expect(checkAddNode(s, draft('state', m.shipped.id))).toBe('Cannot place State inside Final state "Shipped": a final state cannot contain other states.')
    expect(checkAddNode(s, draft('pseudostate', m.shipped.id))).toMatch(/final state cannot contain other states/)
    expect(checkAddNode(s, draft('state', m.pending.id))).toBeNull()
    expect(checkReparent(s, [m.pending.id], m.shipped.id)).toMatch(/Cannot place State "Pending" inside Final state "Shipped"/)
    expect(checkNodeUpdate(s, m.pending.id, { parentId: m.shipped.id })).toMatch(/final state cannot contain other states/)
  })

  it('refuses making a state that holds states final', () => {
    const m = orderMachine()
    const s = stateOf(m.nodes)
    expect(checkNodeUpdate(s, m.packing.id, { kind: 'final' } as Partial<C4Node>)).toBe('Cannot make State "Packing" final: it holds 2 elements, and a final state cannot contain other states.')
    expect(checkNodeUpdate(s, m.pending.id, { kind: 'final' } as Partial<C4Node>)).toBeNull()
  })

  it('offers nothing to add under it in a table', () => {
    const m = orderMachine()
    const ctx = { nodes: byId(m.nodes), relations: m.relations, metamodel: mm }
    expect(addChoices(undefined, ctx, { node: m.shipped, depth: 0 })).toEqual([])
    expect(addChoices(undefined, ctx, { node: m.pending, depth: 0 }).map((c) => c.type)).toEqual(expect.arrayContaining(['state', 'pseudostate']))
  })
})

// Item 221: what validateStateMachines flags is refused when an edit would
// make it, in Studio and over MCP alike (both go through these checks).
describe('an edit the statechart rules flag is refused', () => {
  const stateOf = (nodes: C4Node[], relations: C4Relation[]): ModelState => ({
    c4Nodes: byId(nodes), c4Relations: byId(relations), sequences: {}, views: {}, activeViewId: null, metamodel: mm,
  } as unknown as ModelState)
  const draft = (type: string, parentId: string, props: Record<string, string> = {}) =>
    ({ type, label: 'New', parentId, collapsed: false, x: 0, y: 0, width: 160, height: 60, ...props }) as unknown as Omit<C4Node, 'id'>
  const rel = (source: C4Node, target: C4Node, relationType?: string) => ({ sourceId: source.id, targetId: target.id, ...(relationType ? { relationType } : {}) })

  it('a transition out of a final state, into an initial pseudostate, a second from an initial one, or out of its machine', () => {
    const m = orderMachine()
    const s = stateOf(m.nodes, m.relations)
    expect(checkAddRelation(s, rel(m.shipped, m.pending, 'transition'))).toBe('Relation not allowed: Final state "Shipped" cannot have outgoing transitions.')
    // Untyped, as Alt-drag adds it: the type it is given is a transition.
    expect(checkAddRelation(s, rel(m.shipped, m.pending))).toMatch(/Final state "Shipped" cannot have outgoing transitions/)
    expect(checkAddRelation(s, rel(m.pending, m.init, 'transition'))).toMatch(/cannot point at the initial pseudostate of "Order lifecycle"/)
    expect(checkAddRelation(s, rel(m.init, m.paid, 'transition'))).toMatch(/initial pseudostate of "Order lifecycle" has its one transition/)
    const other = node('state-machine', 'Payment')
    const authorised = node('state', 'Authorised', other.id)
    expect(checkAddRelation(stateOf([...m.nodes, other, authorised], m.relations), rel(m.pending, authorised, 'transition'))).toMatch(/cannot leave its state machine/)
    expect(checkAddRelation(s, rel(m.pending, m.shipped, 'transition'))).toBeNull()
  })

  it('an end of a transition moved onto a final source or an initial target', () => {
    const m = orderMachine()
    const s = stateOf(m.nodes, m.relations)
    const pendingToPaid = m.relations.find((r) => r.sourceId === m.pending.id)!
    expect(checkPatchRelation(s, pendingToPaid.id, { sourceId: m.shipped.id })).toMatch(/Final state "Shipped" cannot have outgoing transitions/)
    expect(checkPatchRelation(s, pendingToPaid.id, { targetId: m.init.id })).toMatch(/cannot point at the initial pseudostate/)
    // The initial pseudostate's own transition may be moved to another state.
    const initOut = m.relations.find((r) => r.sourceId === m.init.id)!
    expect(checkPatchRelation(s, initOut.id, { targetId: m.paid.id })).toBeNull()
  })

  it('a state made final while transitions leave it', () => {
    const m = orderMachine()
    const s = stateOf(m.nodes, m.relations)
    expect(checkNodeUpdate(s, m.pending.id, { kind: 'final' } as Partial<C4Node>)).toBe('Cannot make State "Pending" final: 1 transition leaves it, and a final state cannot have outgoing transitions.')
    const pendingLeft = stateOf(m.nodes, m.relations.filter((r) => r.sourceId !== m.pending.id))
    expect(checkNodeUpdate(pendingLeft, m.pending.id, { kind: 'final' } as Partial<C4Node>)).toBeNull()
  })

  it('an initial pseudostate added, moved or made in a parallel state, or beside another', () => {
    const m = orderMachine()
    const s = stateOf(m.nodes, m.relations)
    expect(checkAddNode(s, draft('pseudostate', m.paid.id, { kind: 'initial' }))).toMatch(/Parallel state "Paid" enters all its regions; it takes no initial pseudostate/)
    expect(checkAddNode(s, draft('pseudostate', m.machine.id, { kind: 'initial' }))).toMatch(/"Order lifecycle" has an initial pseudostate already/)
    expect(checkReparent(s, [m.init.id], m.paid.id)).toMatch(/Parallel state "Paid"/)
    const choice = node('pseudostate', 'Which', m.machine.id, { kind: 'choice' })
    const withChoice = stateOf([...m.nodes, choice], m.relations)
    expect(checkNodeUpdate(withChoice, choice.id, { kind: 'initial' } as Partial<C4Node>)).toMatch(/has an initial pseudostate already/)
    expect(checkAddNode(s, draft('pseudostate', m.pending.id, { kind: 'initial' }))).toBeNull()
  })

  it('a pseudostate added with no kind where an initial one may not go is a choice', () => {
    const m = orderMachine()
    const s = stateOf(m.nodes, m.relations)
    insertNode(s, 'p-machine', draft('pseudostate', m.machine.id))
    insertNode(s, 'p-paid', draft('pseudostate', m.paid.id))
    insertNode(s, 'p-pending', draft('pseudostate', m.pending.id))
    expect((s.c4Nodes['p-machine'] as unknown as { kind: string }).kind).toBe('choice')
    expect((s.c4Nodes['p-paid'] as unknown as { kind: string }).kind).toBe('choice')
    expect((s.c4Nodes['p-pending'] as unknown as { kind: string }).kind).toBe('initial')
    expect(validateModel(s.c4Nodes, s.c4Relations, mm).filter((i) => i.id.startsWith('sm-many-initials') || i.id.startsWith('sm-parallel-initial'))).toEqual([])
  })

  it('a second state machine for an entity', () => {
    const m = orderMachine()
    const second = node('state-machine', 'Order payment')
    const s = stateOf([...m.nodes, second], m.relations)
    expect(checkAddRelation(s, rel(second, m.order, 'lifecycle-of'))).toMatch(/Entity "Order" has a state machine already \("Order lifecycle"\)/)
    const customer = node('entity', 'Customer', undefined, { kind: 'aggregate-root' })
    expect(checkAddRelation(stateOf([...m.nodes, customer], m.relations), rel(m.machine, customer, 'lifecycle-of'))).toMatch(/is the lifecycle of "Order" already/)
    expect(checkAddRelation(stateOf([...m.nodes, second, customer], m.relations), rel(second, customer, 'lifecycle-of'))).toBeNull()
  })
})

describe('requirements while in a state', () => {
  it('read "While the <entity> is <state>" from the state they point at, in place of the precondition text', () => {
    const m = orderMachine()
    const req = node('requirement', 'Hold stock', undefined, { ears_type: 'state-driven', action: 'hold the stock', precondition_state: m.pending.id })
    const all = byId([...m.nodes, req])
    const rels = byId(m.relations)
    expect(requirementStatePhrase(req, all, rels)).toBe('the Order is Pending')
    expect(composeEarsSentence(req as unknown as Record<string, unknown>, 'the shop', requirementStatePhrase(req, all, rels)).sentence)
      .toBe('While the Order is Pending, the shop shall hold the stock.')
    // Without the machine's entity it names the state alone.
    expect(requirementStatePhrase(req, all, byId(m.relations.filter((r) => r.relationType !== 'lifecycle-of')))).toBe('in Pending')
    // The reference takes the place of the text (the wizard writes one);
    // no reference, no phrase.
    expect(composeEarsSentence({ ...req, precondition: 'the shop is open' } as unknown as Record<string, unknown>, 'the shop', 'the Order is Pending').sentence)
      .toBe('While the Order is Pending, the shop shall hold the stock.')
    expect(requirementStatePhrase({ ...req, precondition_state: undefined } as unknown as C4Node, all, rels)).toBe('')
    // The reference must point at a state.
    const wrong = { ...req, precondition_state: m.order.id } as unknown as C4Node
    expect(validateModel(byId([...m.nodes, wrong]), rels, mm).map((i) => i.id)).toEqual([`bad-ref:${req.id}:precondition_state:${m.order.id}`])
  })
})
