// ─── Model operations ────────────────────────────────────────────────────────
//
// The rules and edits behind every change to a model, independent of any UI.
// Studio's diagram store calls them inside its immer `set()` and adds its own
// effects (undo, notifications, canvas sync, live layout); createModelFacade
// uses them on a plain object, for tools that edit a model with no UI (the
// MCP server).
//
// check* functions return the user-facing reason a change is refused, or null.
// The mutating functions assume the matching check passed, and work on either
// a plain object or an immer draft.

import type { C4Node, C4Relation, DiagramSequence, DiagramView, LayoutConstraint } from './c4'
import {
  builtInC4Metamodel,
  builtInDddC4Metamodel,
  builtInGovernanceMetamodel,
  canAddMoreOfType,
  inferRelationType,
  isParentAllowed,
  isRelationAllowed,
  type Metamodel,
} from './metamodel'

export interface ModelState {
  c4Nodes: Record<string, C4Node>
  c4Relations: Record<string, C4Relation>
  views: Record<string, DiagramView>
  activeViewId: string | null
  metamodel?: Metamodel
  /** Optional so callers that only check node rules can omit it. */
  sequences?: Record<string, DiagramSequence>
  /** Layout constraints of All elements (DiagramData.defaultLayoutConstraints). */
  defaultLayoutConstraints?: LayoutConstraint[]
}

type NodeRecord = C4Node & Record<string, unknown>

/** The metamodel a loaded document runs under. Built-in metamodels are
 *  stored by id and replaced with the current preset; a document without
 *  one uses C4. */
export function documentMetamodel(stored: Metamodel | undefined): Metamodel {
  if (!stored) return builtInC4Metamodel()
  if (stored.id === 'c4-builtin') return builtInC4Metamodel()
  if (stored.id === 'c4-ddd-builtin') return builtInDddC4Metamodel()
  if (stored.id === 'c4-ddd-governance-builtin') return builtInGovernanceMetamodel()
  return stored
}

const PRESET_IDS = new Set(['c4-builtin', 'c4-ddd-builtin', 'c4-ddd-governance-builtin'])

/** A copy of a built-in preset under a custom id, or null when `mm` is
 *  already custom. Edit the copy: documentMetamodel swaps a preset id back
 *  to the current preset on load, which would drop the edit. */
export function forkPresetMetamodel(mm: Metamodel): Metamodel | null {
  if (!PRESET_IDS.has(mm.id)) return null
  const copy = JSON.parse(JSON.stringify(mm)) as Metamodel
  return { ...copy, id: `${mm.id.replace(/-builtin$/, '')}-custom`, name: `${mm.name} (custom)` }
}

/** Ids of every node below `id` in the containment tree. */
export function descendantIds(id: string, nodes: Record<string, C4Node>): string[] {
  const children = new Map<string, string[]>()
  for (const n of Object.values(nodes)) {
    if (!n.parentId) continue
    const list = children.get(n.parentId)
    if (list) list.push(n.id)
    else children.set(n.parentId, [n.id])
  }
  const out: string[] = []
  const stack = [...(children.get(id) ?? [])]
  while (stack.length) {
    const next = stack.pop()!
    out.push(next)
    stack.push(...(children.get(next) ?? []))
  }
  return out
}

function typeLabel(mm: Metamodel | undefined, type: string): string {
  return mm?.nodeTypes[type]?.label ?? type
}

function placementError(mm: Metamodel | undefined, type: string, parent: C4Node | undefined): string {
  const allowed = mm?.nodeTypes[type]?.allowedParents
  const parentLabel = parent ? typeLabel(mm, parent.type) : 'the canvas root'
  const allowedStr = allowed && allowed.length
    ? allowed.map((t) => typeLabel(mm, t)).join(', ')
    : 'the canvas root'
  return `${parentLabel}. Allowed parents: ${allowedStr}.`
}

/** Metamodel defaults (e.g. requirement ears_type='ubiquitous') become real
 *  fields on the node, so they persist instead of living only in UI fallbacks. */
function materializeDefaults(node: NodeRecord, mm: Metamodel | undefined): void {
  for (const p of mm?.nodeTypes[node.type]?.properties ?? []) {
    if (p.default !== undefined && node[p.key] === undefined) node[p.key] = p.default
  }
}

// ── Nodes ────────────────────────────────────────────────────────────────────

export function checkAddNode(state: ModelState, node: Omit<C4Node, 'id'>): string | null {
  const mm = state.metamodel
  const label = typeLabel(mm, node.type)
  const count = Object.values(state.c4Nodes).filter((n) => n.type === node.type).length
  if (!canAddMoreOfType(mm, node.type, count)) {
    return `Cannot add another ${label}: maximum (${mm?.nodeTypes[node.type]?.cardinality?.max}) reached in the metamodel.`
  }
  const parent = node.parentId ? state.c4Nodes[node.parentId] : undefined
  if (!isParentAllowed(mm, node.type, parent?.type)) {
    return `Cannot place ${label} inside ${placementError(mm, node.type, parent)}`
  }
  return null
}

/** Adds the node, and lists it in the active view when there is one. */
export function insertNode(state: ModelState, id: string, node: Omit<C4Node, 'id'>): void {
  const created = { id, ...node } as NodeRecord
  materializeDefaults(created, state.metamodel)
  state.c4Nodes[id] = created
  const view = state.activeViewId ? state.views[state.activeViewId] : undefined
  if (view) view.nodeIds.push(id)
}

export function checkNodeUpdate(state: ModelState, id: string, updates: Partial<Omit<C4Node, 'id'>>): string | null {
  const existing = state.c4Nodes[id]
  if (!existing) return null
  if (!('parentId' in updates) && !('type' in updates)) return null
  const newType = (updates.type as string | undefined) ?? existing.type
  const newParentId = ('parentId' in updates ? (updates.parentId as string | null | undefined) : existing.parentId) ?? undefined
  const parent = newParentId ? state.c4Nodes[newParentId] : undefined
  if (isParentAllowed(state.metamodel, newType, parent?.type)) return null
  return `Cannot move ${typeLabel(state.metamodel, newType)} "${existing.label}" into ${placementError(state.metamodel, newType, parent)}`
}

/** Applies the updates; a retyped node gets its new type's defaults. */
export function patchNode(state: ModelState, id: string, updates: Partial<Omit<C4Node, 'id'>>): void {
  const node = state.c4Nodes[id] as NodeRecord | undefined
  if (!node) return
  Object.assign(node, updates)
  if ('type' in updates) materializeDefaults(node, state.metamodel)
}

/** Why `ids` cannot move under `newParentId` (null = the root), or null.
 *  The nodes must be siblings, the target must exist and sit outside the
 *  moved subtrees, and every moved type must be allowed inside it. */
export function checkReparent(state: ModelState, ids: string[], newParentId: string | null): string | null {
  const nodes = ids.map((id) => state.c4Nodes[id]).filter((n): n is C4Node => !!n)
  if (nodes.length === 0) return 'Nothing to move: no such node.'
  const oldParentId = nodes[0].parentId ?? null
  if (!nodes.every((n) => (n.parentId ?? null) === oldParentId)) {
    return 'Cannot move: selected nodes have different parents. Select siblings only.'
  }
  const newParent = newParentId ? state.c4Nodes[newParentId] : undefined
  if (newParentId && !newParent) return 'Target parent no longer exists.'
  const moved = new Set(nodes.flatMap((n) => [n.id, ...descendantIds(n.id, state.c4Nodes)]))
  if (newParentId && moved.has(newParentId)) return 'Cannot move a node into itself or one of its descendants.'
  for (const n of nodes) {
    if (!isParentAllowed(state.metamodel, n.type, newParent?.type)) {
      return `Cannot place ${typeLabel(state.metamodel, n.type)} "${n.label}" inside ${placementError(state.metamodel, n.type, newParent)}`
    }
  }
  return null
}

/** Moves the nodes under `newParentId` (null = the root), keeping each one
 *  where it is on the canvas: positions are relative to the parent, so they
 *  are rebased onto the new parent's absolute position. */
export function reparentNodes(state: ModelState, ids: string[], newParentId: string | null): void {
  const absOf = (id: string | null): { x: number; y: number } => {
    let x = 0, y = 0
    let cur: C4Node | undefined = id ? state.c4Nodes[id] : undefined
    const seen = new Set<string>()
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id)
      x += cur.x
      y += cur.y
      cur = cur.parentId ? state.c4Nodes[cur.parentId] : undefined
    }
    return { x, y }
  }
  const target = absOf(newParentId)
  // Measure every node against the original tree before changing any parent.
  const placed = ids.filter((id) => state.c4Nodes[id]).map((id) => ({ id, abs: absOf(id) }))
  for (const { id, abs } of placed) {
    const node = state.c4Nodes[id]
    node.parentId = newParentId ?? undefined
    node.x = abs.x - target.x
    node.y = abs.y - target.y
  }
}

/** Removes the node, its descendants, their relations and every view
 *  reference to them. Returns the removed node ids. */
export function deleteNode(state: ModelState, id: string): Set<string> {
  const removed = new Set([id, ...descendantIds(id, state.c4Nodes)])
  for (const nid of removed) delete state.c4Nodes[nid]
  for (const [rid, rel] of Object.entries(state.c4Relations)) {
    if (removed.has(rel.sourceId) || removed.has(rel.targetId)) delete state.c4Relations[rid]
  }
  for (const view of Object.values(state.views)) {
    view.nodeIds = view.nodeIds.filter((nid) => !removed.has(nid))
    if (view.collapsedNodeIds?.length) view.collapsedNodeIds = view.collapsedNodeIds.filter((nid) => !removed.has(nid))
    if (view.expandedNodeIds?.length) view.expandedNodeIds = view.expandedNodeIds.filter((nid) => !removed.has(nid))
    if (view.layoutConstraints?.length) view.layoutConstraints = withoutNodes(view.layoutConstraints, removed)
  }
  if (state.defaultLayoutConstraints?.length) {
    state.defaultLayoutConstraints = withoutNodes(state.defaultLayoutConstraints, removed)
  }
  return removed
}

/** Constraints without the removed nodes; a rule left with one member goes. */
function withoutNodes(constraints: LayoutConstraint[], removed: Set<string>): LayoutConstraint[] {
  return constraints
    .map((c) => (c.nodeIds.some((id) => removed.has(id)) ? { ...c, nodeIds: c.nodeIds.filter((id) => !removed.has(id)) } : c))
    .filter((c) => c.nodeIds.length >= 2)
}

// ── Relations ────────────────────────────────────────────────────────────────

export function checkAddRelation(state: ModelState, rel: Omit<C4Relation, 'id'>): string | null {
  const src = state.c4Nodes[rel.sourceId]
  const dst = state.c4Nodes[rel.targetId]
  if (!src || !dst || isRelationAllowed(state.metamodel, src.type, dst.type)) return null
  return `Relation not allowed: ${typeLabel(state.metamodel, src.type)} → ${typeLabel(state.metamodel, dst.type)}. The metamodel does not permit this connection.`
}

/** Adds the relation, inferring its relationType from the metamodel when not given. */
export function insertRelation(state: ModelState, id: string, rel: Omit<C4Relation, 'id'>): void {
  const src = state.c4Nodes[rel.sourceId]
  const dst = state.c4Nodes[rel.targetId]
  const relationType = rel.relationType ?? (src && dst ? inferRelationType(state.metamodel, src.type, dst.type) : undefined)
  state.c4Relations[id] = { id, ...rel, ...(relationType ? { relationType } : {}) }
}

/** Refusal for moving a relation's source or target, as for a new relation. */
export function checkPatchRelation(state: ModelState, id: string, updates: Partial<Omit<C4Relation, 'id'>>): string | null {
  const rel = state.c4Relations[id]
  if (!rel || (updates.sourceId === undefined && updates.targetId === undefined)) return null
  return checkAddRelation(state, { ...rel, ...updates })
}

export function patchRelation(state: ModelState, id: string, updates: Partial<Omit<C4Relation, 'id'>>): void {
  const rel = state.c4Relations[id]
  if (!rel) return
  const moved = (updates.sourceId !== undefined && updates.sourceId !== rel.sourceId)
    || (updates.targetId !== undefined && updates.targetId !== rel.targetId)
  Object.assign(rel, updates)
  // A moved end can leave the relation type behind; infer it again, as on insert.
  if (!moved || updates.relationType !== undefined || !rel.relationType) return
  const src = state.c4Nodes[rel.sourceId]
  const dst = state.c4Nodes[rel.targetId]
  const def = state.metamodel?.relationTypes[rel.relationType]
  if (!src || !dst || !def) return
  if (def.allowedPairs.length === 0 || def.allowedPairs.some((p) => p.from === src.type && p.to === dst.type)) return
  const inferred = inferRelationType(state.metamodel, src.type, dst.type)
  if (inferred) rel.relationType = inferred
  else delete rel.relationType
}

export function deleteRelation(state: ModelState, id: string): void {
  delete state.c4Relations[id]
}

// ── Views ────────────────────────────────────────────────────────────────────

export function insertView(state: ModelState, id: string, name: string): void {
  state.views[id] = { id, name, nodeIds: [], positions: {} }
}

/** Keeps known node ids only, deduplicated in order. False if there is no such view. */
export function setViewNodeIds(state: ModelState, viewId: string, nodeIds: string[]): boolean {
  const view = state.views[viewId]
  if (!view) return false
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const id of nodeIds) {
    if (id in state.c4Nodes && !seen.has(id)) { seen.add(id); ordered.push(id) }
  }
  view.nodeIds = ordered
  return true
}

export function setViewKind(state: ModelState, viewId: string, kind: DiagramView['kind']): void {
  const view = state.views[viewId]
  if (view) view.kind = kind
}

export function renameView(state: ModelState, viewId: string, name: string): void {
  const view = state.views[viewId]
  if (view) view.name = name
}

/** Links a dynamic view to a sequence (null unlinks it). */
export function setViewSequence(state: ModelState, viewId: string, sequenceId: string | null): void {
  const view = state.views[viewId]
  if (view) view.sequenceId = sequenceId ?? undefined
}

/** Hides exactly these relations in the view; unknown ids are dropped. */
export function setViewHiddenRelations(state: ModelState, viewId: string, relationIds: string[]): void {
  const view = state.views[viewId]
  if (view) view.hiddenRelationIds = [...new Set(relationIds.filter((id) => id in state.c4Relations))]
}

// ── Layout constraints ───────────────────────────────────────────────────────
// Per canvas: a view's own, or All elements' when viewId is null.

export function layoutConstraintsOf(state: ModelState, viewId: string | null): LayoutConstraint[] {
  return (viewId ? state.views[viewId]?.layoutConstraints : state.defaultLayoutConstraints) ?? []
}

const AXIS_NOUN = { horizontal: 'row', vertical: 'column' } as const

/** Which line along `axis` each node is on (a node on none is its own line). */
function alignmentLines(constraints: LayoutConstraint[], axis: LayoutConstraint['axis']): (id: string) => string {
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    let root = id
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root)!
    return root
  }
  for (const c of constraints) {
    if (c.type !== 'align' || c.axis !== axis || !c.nodeIds.length) continue
    for (const id of c.nodeIds.slice(1)) {
      const a = find(id)
      const b = find(c.nodeIds[0])
      if (a !== b) parent.set(a, b)
    }
  }
  return find
}

/** Two elements the ordered alignments along `axis` put both before and
 *  after each other, or null when their orders agree. */
function orderConflict(constraints: LayoutConstraint[], axis: LayoutConstraint['axis']): [string, string] | null {
  const next = new Map<string, Set<string>>()
  for (const c of constraints) {
    if (c.type !== 'align' || c.axis !== axis || !c.ordered) continue
    for (let i = 0; i + 1 < c.nodeIds.length; i++) {
      const set = next.get(c.nodeIds[i]) ?? new Set<string>()
      set.add(c.nodeIds[i + 1])
      next.set(c.nodeIds[i], set)
    }
  }
  // Depth-first search for a cycle; report its first edge.
  const state = new Map<string, 'open' | 'done'>()
  const visit = (id: string): [string, string] | null => {
    state.set(id, 'open')
    for (const n of next.get(id) ?? []) {
      if (state.get(n) === 'open') return [id, n]
      if (!state.has(n)) {
        const found = visit(n)
        if (found) return found
      }
    }
    state.set(id, 'done')
    return null
  }
  for (const id of next.keys()) {
    if (state.has(id)) continue
    const found = visit(id)
    if (found) return found
  }
  return null
}

/** Refusal for aligning `nodeIds` in a row ('horizontal') or a column; with
 *  `ordered`, in that order (left to right, top to bottom). */
export function checkAddAlignment(
  state: ModelState, viewId: string | null, axis: LayoutConstraint['axis'], nodeIds: string[], ordered = false,
): string | null {
  if (viewId && !state.views[viewId]) return `Unknown view "${viewId}".`
  const ids = [...new Set(nodeIds)]
  const unknown = ids.find((id) => !state.c4Nodes[id])
  if (unknown) return `Unknown element "${unknown}".`
  if (ids.length < 2) return 'Select at least two elements to align.'
  const label = (id: string): string => state.c4Nodes[id].label || id
  for (const id of ids) {
    const inside = descendantIds(id, state.c4Nodes)
    const nested = ids.find((other) => inside.includes(other))
    if (nested) return `"${label(nested)}" is inside "${label(id)}"; an element cannot be aligned with its own container.`
  }
  const existing = layoutConstraintsOf(state, viewId)
  const before = alignmentLines(existing, axis)
  if (ids.every((id) => before(id) === before(ids[0]))) {
    // Already on one line: only adding their order is news.
    if (!ordered) return `These elements are already in one ${AXIS_NOUN[axis]}.`
    const key = ids.join('\u0000')
    if (existing.some((c) => c.axis === axis && c.ordered && c.nodeIds.join('\u0000').includes(key))) {
      return `These elements already keep this order in one ${AXIS_NOUN[axis]}.`
    }
  }
  const conflict = ordered && orderConflict([...existing, { id: '', type: 'align', axis, nodeIds: ids, ordered }], axis)
  if (conflict) return `Another ${AXIS_NOUN[axis]} keeps "${label(conflict[1])}" before "${label(conflict[0])}"; this order contradicts it.`
  // In one row and one column at once, two elements would share a spot.
  const after = alignmentLines([...existing, { id: '', type: 'align', axis, nodeIds: ids }], axis)
  const across = alignmentLines(existing, axis === 'horizontal' ? 'vertical' : 'horizontal')
  const line = Object.keys(state.c4Nodes).filter((id) => after(id) === after(ids[0]))
  for (let i = 0; i < line.length; i++) {
    for (let j = i + 1; j < line.length; j++) {
      if (across(line[i]) === across(line[j])) {
        const other = AXIS_NOUN[axis === 'horizontal' ? 'vertical' : 'horizontal']
        return `"${label(line[i])}" and "${label(line[j])}" are already in one ${other}; in one ${AXIS_NOUN[axis]} as well they would sit on top of each other.`
      }
    }
  }
  return null
}

/** Adds an alignment (checkAddAlignment passed) to a view or All elements. */
export function insertAlignment(
  state: ModelState, viewId: string | null, id: string, axis: LayoutConstraint['axis'], nodeIds: string[], ordered = false,
): void {
  const constraint: LayoutConstraint = { id, type: 'align', axis, nodeIds: [...new Set(nodeIds)], ...(ordered ? { ordered } : {}) }
  if (viewId) {
    const view = state.views[viewId]
    if (view) view.layoutConstraints = [...(view.layoutConstraints ?? []), constraint]
  } else {
    state.defaultLayoutConstraints = [...(state.defaultLayoutConstraints ?? []), constraint]
  }
}

/** Refusal for making alignment `id` keep the order of `nodeIds` (its
 *  members, in the order to keep). */
export function checkAlignmentOrder(state: ModelState, viewId: string | null, id: string, nodeIds: string[]): string | null {
  const list = layoutConstraintsOf(state, viewId)
  const c = list.find((x) => x.id === id)
  if (!c) return `No alignment "${id}" on this canvas.`
  const conflict = orderConflict(list.map((x) => (x.id === id ? { ...x, nodeIds, ordered: true } : x)), c.axis)
  if (!conflict) return null
  const label = (nid: string): string => state.c4Nodes[nid]?.label || nid
  return `Another ${AXIS_NOUN[c.axis]} keeps "${label(conflict[1])}" before "${label(conflict[0])}"; this order contradicts it.`
}

/** Makes an alignment keep the order of `nodeIds` (checkAlignmentOrder
 *  passed), or stop keeping any order when `nodeIds` is null. */
export function setAlignmentOrder(state: ModelState, viewId: string | null, id: string, nodeIds: string[] | null): void {
  const list = layoutConstraintsOf(state, viewId)
  const next = list.map((c) => {
    if (c.id !== id) return c
    if (!nodeIds) {
      const { ordered: _ordered, ...rest } = c
      return rest
    }
    return { ...c, nodeIds: [...nodeIds], ordered: true }
  })
  if (viewId) state.views[viewId].layoutConstraints = next
  else state.defaultLayoutConstraints = next
}

/** Removes a layout constraint. False when the canvas has no such constraint. */
export function deleteLayoutConstraint(state: ModelState, viewId: string | null, id: string): boolean {
  const list = layoutConstraintsOf(state, viewId)
  if (!list.some((c) => c.id === id)) return false
  const next = list.filter((c) => c.id !== id)
  if (viewId) state.views[viewId].layoutConstraints = next
  else state.defaultLayoutConstraints = next
  return true
}

// ── Sequences ────────────────────────────────────────────────────────────────

export interface SequenceStep {
  relationId: string
  description?: string
}

export function insertSequence(state: ModelState, id: string, name: string): void {
  state.sequences ??= {}
  state.sequences[id] = { id, name, relationIds: [] }
}

export function renameSequence(state: ModelState, id: string, name: string): void {
  const sequence = state.sequences?.[id]
  if (sequence) sequence.name = name
}

/** Replaces the steps. A relation may appear more than once; the caller
 *  checks the relation ids exist. */
export function setSequenceSteps(state: ModelState, id: string, steps: SequenceStep[]): void {
  const sequence = state.sequences?.[id]
  if (!sequence) return
  sequence.relationIds = steps.map((step) => step.relationId)
  // Like Studio's step list: descriptions run up to the last described step.
  const last = steps.reduce((end, step, i) => (step.description ? i + 1 : end), 0)
  sequence.stepDescriptions = steps.slice(0, last).map((step) => step.description || undefined)
}

/** Removes the sequence and unlinks the views that showed it. */
export function deleteSequence(state: ModelState, id: string): void {
  if (state.sequences) delete state.sequences[id]
  for (const view of Object.values(state.views)) {
    if (view.sequenceId === id) view.sequenceId = undefined
  }
}

/** The nodes a dynamic view of the sequence shows: every step's endpoints. */
export function sequenceNodeIds(state: ModelState, id: string): string[] {
  const nodes = new Set<string>()
  for (const relationId of state.sequences?.[id]?.relationIds ?? []) {
    const relation = state.c4Relations[relationId]
    if (relation) { nodes.add(relation.sourceId); nodes.add(relation.targetId) }
  }
  return [...nodes]
}
