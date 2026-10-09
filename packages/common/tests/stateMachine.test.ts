import { describe, it, expect } from 'vitest'
import type { C4Node, C4Relation } from '../src/c4'
import { isContainerType } from '../src/c4'
import { builtInC4Metamodel, builtInGovernanceMetamodel, relationDisplayLabel, validateModel } from '../src/metamodel'

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
  const nodes = [machine, init, pending, paid, packing, packInit, picking, invoicing, shipped, pay, ship, orderPaid]
  const relations = [
    transition(init, pending),
    transition(pending, paid, { event: pay.id, guard: 'amount covers total', actions: 'reserve stock', raises: [orderPaid.id] }),
    transition(packInit, picking),
    transition(paid, shipped, { event: ship.id }),
  ]
  return { nodes, relations, machine, init, pending, paid, packing, picking, invoicing, shipped, pay, ship, orderPaid }
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
    expect(pairsOf('lifecycle-of')).toContain('state-machine->component')
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

  it('stays out of the C4 preset', () => {
    expect(builtInC4Metamodel().nodeTypes.state).toBeUndefined()
  })

  it('labels a transition `event [guard] / actions ^raised` by the events\' names', () => {
    const { nodes, relations, pay } = orderMachine()
    const all = byId(nodes)
    expect(relationDisplayLabel(relations[1], all)).toBe('PaymentReceived [amount covers total] / reserve stock ^OrderPaid')
    expect(relationDisplayLabel(relations[0], all)).toBeUndefined()
    expect(relationDisplayLabel({ ...relations[1], label: 'pay' }, all)).toBe('pay')
    // Renaming the event renames the label: the transition holds its id.
    expect(relationDisplayLabel(relations[1], { ...all, [pay.id]: { ...pay, label: 'Paid' } })).toMatch(/^Paid \[/)
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
    const other = node('state-machine', 'Payment')
    const otherInit = node('pseudostate', 'Start', other.id, { kind: 'initial' })
    const elsewhere = node('state', 'Authorised', other.id)
    const relations = [
      ...m.relations,
      transition(otherInit, elsewhere),
      transition(m.pending, m.shipped, { event: m.ship.id }),
      transition(m.pending, m.pending, { event: m.ship.id }),
      transition(m.pending, m.pending, { event: m.pay.id, guard: 'within 14 days' }),
      transition(m.picking, elsewhere),
    ]
    const issues = issuesOf([...m.nodes, other, otherInit, elsewhere], relations)
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

  it('reaches a state through a transition from an ancestor', () => {
    const m = orderMachine()
    const cancelled = node('state', 'Cancelled', m.machine.id, { kind: 'final' })
    const cancel = node('event', 'Cancel', m.machine.id)
    const relations = [...m.relations, transition(m.paid, cancelled, { event: cancel.id })]
    expect(issuesOf([...m.nodes, cancelled, cancel], relations)).toEqual([])
  })
})
