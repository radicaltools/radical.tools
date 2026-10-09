// ─── State machine rules ────────────────────────────────────────────────────
//
// Checks a statechart the metamodel cannot express with allowedParents and
// allowedPairs: how a machine and its compound states are entered, what a
// parallel or final state may hold, transitions that leave their machine,
// events no `event` node declares, two unguarded transitions on one event,
// and states no path from the initial state reaches. Semantics follow SCXML:
// entering a compound state enters its initial child, entering a parallel
// state enters every child (region), and being in a state means being in all
// its ancestors. Issues are warnings, like the rest of the soft validation.
// Actions raise events by name as well (`raise OrderPaid`, `send "Order
// paid"`), and those names are checked like a transition's trigger.

import type { C4Node, C4Relation } from '../c4'
import type { Issue } from './validate'

type Props = Record<string, unknown>

const prop = (item: C4Node | C4Relation, key: string): string => {
  const value = (item as unknown as Props)[key]
  return typeof value === 'string' ? value.trim() : ''
}

const stateKind = (n: C4Node): string => prop(n, 'kind') || 'normal'
const pseudoKind = (n: C4Node): string => prop(n, 'kind') || 'initial'
const isState = (n: C4Node | undefined): n is C4Node => n?.type === 'state'
const isPseudo = (n: C4Node | undefined): n is C4Node => n?.type === 'pseudostate'

/** The text a transition shows on its edge: `event [guard] / actions`. */
export function transitionLabel(r: C4Relation): string {
  const event = prop(r, 'event')
  const guard = prop(r, 'guard')
  const actions = prop(r, 'actions')
  return [event, guard && `[${guard}]`, actions && `/ ${actions}`].filter(Boolean).join(' ')
}

/** What a relation shows as its label: its own, else a transition's
 *  `event [guard] / actions`. */
export function relationDisplayLabel(r: C4Relation): string | undefined {
  if (r.label) return r.label
  if (r.relationType === 'transition') return transitionLabel(r) || undefined
  return undefined
}

/** Event names an action text raises: `raise X`, `send X` or `emit X`, where
 *  X is quoted or starts with a capital letter, as event names do. Plain
 *  prose ("send a confirmation email") names no event. */
export function raisedEvents(actions: string): string[] {
  const names: string[] = []
  for (const m of actions.matchAll(/\b(?:raise|send|emit)\s+(?:"([^"]+)"|'([^']+)'|([A-Z][\w.-]*))/g)) {
    names.push((m[1] ?? m[2] ?? m[3]).trim())
  }
  return names
}

export function validateStateMachines(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
): Issue[] {
  const nodeList = Object.values(nodes)
  if (!nodeList.some((n) => n.type === 'state' || n.type === 'pseudostate')) return []

  const issues: Issue[] = []
  const warn = (id: string, message: string, at: { nodeId?: string; relationId?: string }): void => {
    issues.push({ id, severity: 'warning', message, ...at })
  }

  const children = new Map<string, C4Node[]>()
  for (const n of nodeList) {
    if (!n.parentId) continue
    const list = children.get(n.parentId)
    if (list) list.push(n)
    else children.set(n.parentId, [n])
  }
  const childStates = (id: string): C4Node[] => (children.get(id) ?? []).filter(isState)
  const initialsOf = (id: string): C4Node[] =>
    (children.get(id) ?? []).filter((c) => isPseudo(c) && pseudoKind(c) === 'initial')

  /** The state machine a state or pseudostate belongs to. */
  const machineOf = (n: C4Node): string | undefined => {
    let cur: C4Node | undefined = n
    for (let depth = 0; cur && depth < 64; depth++) {
      if (cur.type === 'state-machine') return cur.id
      cur = cur.parentId ? nodes[cur.parentId] : undefined
    }
    return undefined
  }

  const transitions = Object.values(relations).filter((r) =>
    r.relationType === 'transition' && nodes[r.sourceId] && nodes[r.targetId])
  const outgoing = new Map<string, C4Relation[]>()
  const incoming = new Set<string>()
  for (const t of transitions) {
    const list = outgoing.get(t.sourceId)
    if (list) list.push(t)
    else outgoing.set(t.sourceId, [t])
    incoming.add(t.targetId)
  }

  // ── How machines and compound states are entered ────────────────────────
  const regions = nodeList.filter((n) => n.type === 'state-machine' || (isState(n) && stateKind(n) === 'normal'))
  for (const owner of regions) {
    if (childStates(owner.id).length === 0) continue
    const initials = initialsOf(owner.id)
    const what = owner.type === 'state-machine' ? 'State machine' : 'Compound state'
    if (initials.length === 0) {
      warn(`sm-no-initial:${owner.id}`, `${what} "${owner.label}" has child states but no initial pseudostate to enter them.`, { nodeId: owner.id })
    } else if (initials.length > 1) {
      warn(`sm-many-initials:${owner.id}`, `${what} "${owner.label}" has ${initials.length} initial pseudostates; keep one.`, { nodeId: owner.id })
    }
  }

  for (const n of nodeList) {
    if (isPseudo(n) && pseudoKind(n) === 'initial') {
      const out = outgoing.get(n.id) ?? []
      if (out.length !== 1) {
        warn(`sm-initial-out:${n.id}`, `Initial pseudostate in "${n.parentId ? nodes[n.parentId]?.label : ''}" needs exactly one transition, to the default state (it has ${out.length}).`, { nodeId: n.id })
      }
      if (incoming.has(n.id)) {
        warn(`sm-initial-in:${n.id}`, `A transition points at the initial pseudostate in "${n.parentId ? nodes[n.parentId]?.label : ''}"; target the state itself.`, { nodeId: n.id })
      }
    }
    if (!isState(n)) continue
    const kind = stateKind(n)
    if (kind === 'parallel') {
      if (childStates(n.id).length < 2) {
        warn(`sm-parallel-regions:${n.id}`, `Parallel state "${n.label}" needs at least two child states (regions) active at once.`, { nodeId: n.id })
      }
      if (initialsOf(n.id).length > 0) {
        warn(`sm-parallel-initial:${n.id}`, `Parallel state "${n.label}" enters all its regions; it takes no initial pseudostate.`, { nodeId: n.id })
      }
    }
    if (kind === 'final') {
      if ((children.get(n.id) ?? []).length > 0) {
        warn(`sm-final-children:${n.id}`, `Final state "${n.label}" cannot contain other states.`, { nodeId: n.id })
      }
      if ((outgoing.get(n.id) ?? []).length > 0) {
        warn(`sm-final-out:${n.id}`, `Final state "${n.label}" cannot have outgoing transitions.`, { nodeId: n.id })
      }
    }
  }

  // ── Transitions ─────────────────────────────────────────────────────────
  const eventNames = new Set(nodeList.filter((n) => n.type === 'event').map((n) => n.label.trim()))
  for (const t of transitions) {
    const src = nodes[t.sourceId]
    const dst = nodes[t.targetId]
    if (machineOf(src) !== machineOf(dst)) {
      warn(`sm-cross-machine:${t.id}`, `Transition "${src.label}" → "${dst.label}" leaves its state machine.`, { relationId: t.id })
    }
    const event = prop(t, 'event')
    if (event && !eventNames.has(event)) {
      warn(`sm-unknown-event:${t.id}`, `Transition "${src.label}" → "${dst.label}" is triggered by "${event}", which no event node declares.`, { relationId: t.id })
    }
  }

  // Events raised by actions, on transitions and in states.
  for (const t of transitions) {
    for (const name of raisedEvents(prop(t, 'actions'))) {
      if (eventNames.has(name)) continue
      warn(`sm-unknown-raised:${t.id}:${name}`, `Transition "${nodes[t.sourceId].label}" → "${nodes[t.targetId].label}" raises "${name}", which no event node declares.`, { relationId: t.id })
    }
  }
  for (const n of nodeList) {
    if (!isState(n)) continue
    for (const key of ['entry', 'exit', 'do']) {
      for (const name of raisedEvents(prop(n, key))) {
        if (eventNames.has(name)) continue
        warn(`sm-unknown-raised:${n.id}:${name}`, `State "${n.label}" raises "${name}" in its ${key} actions, which no event node declares.`, { nodeId: n.id })
      }
    }
  }

  for (const [sourceId, out] of outgoing) {
    const byEvent = new Map<string, C4Relation[]>()
    for (const t of out) {
      if (prop(t, 'guard')) continue
      const key = prop(t, 'event')
      const list = byEvent.get(key)
      if (list) list.push(t)
      else byEvent.set(key, [t])
    }
    for (const [event, list] of byEvent) {
      if (list.length < 2) continue
      const on = event ? `on "${event}"` : 'without an event'
      warn(`sm-nondeterministic:${sourceId}:${event}`, `"${nodes[sourceId].label}" has ${list.length} unguarded transitions ${on}; only one can fire.`, { nodeId: sourceId })
    }
  }

  // ── Reachability from each machine's initial state ──────────────────────
  for (const machine of nodeList.filter((n) => n.type === 'state-machine')) {
    if (initialsOf(machine.id).length === 0) continue
    const reached = new Set<string>()
    const queue: string[] = [machine.id]
    const visit = (id: string): void => {
      if (!reached.has(id)) { reached.add(id); queue.push(id) }
    }
    while (queue.length > 0) {
      const id = queue.shift()!
      const n = nodes[id]
      if (!n) continue
      // Being in a state means being in its ancestors.
      if (n.parentId && n.parentId !== machine.id && nodes[n.parentId]) visit(n.parentId)
      if (n.type === 'state-machine' || (isState(n) && stateKind(n) === 'normal')) {
        for (const init of initialsOf(id)) visit(init.id)
      } else if (isState(n) && stateKind(n) === 'parallel') {
        for (const region of childStates(id)) visit(region.id)
      }
      for (const t of outgoing.get(id) ?? []) visit(t.targetId)
    }
    const unreached = (id: string): void => {
      for (const child of children.get(id) ?? []) {
        if (isState(child) && !reached.has(child.id)) {
          warn(`sm-unreachable:${child.id}`, `State "${child.label}" cannot be reached from the initial state of "${machine.label}".`, { nodeId: child.id })
          continue
        }
        unreached(child.id)
      }
    }
    unreached(machine.id)
  }

  return issues
}
