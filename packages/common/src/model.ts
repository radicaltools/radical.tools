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

import { constraintLines, pinnedNodeIds, type AlignConstraint, type C4Node, type C4Relation, type DiagramSequence, type DiagramView, type GridConstraint, type LayoutConstraint } from './c4'
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

/** Constraints without the removed nodes; a rule left with one member goes
 *  (a pin with none). */
function withoutNodes(constraints: LayoutConstraint[], removed: Set<string>): LayoutConstraint[] {
  return constraints
    .map((c) => (c.nodeIds.some((id) => removed.has(id)) ? { ...c, nodeIds: c.nodeIds.filter((id) => !removed.has(id)) } : c))
    .filter((c) => c.nodeIds.length >= (c.type === 'pin' ? 1 : 2))
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

type Axis = AlignConstraint['axis']

const AXIS_NOUN = { horizontal: 'row', vertical: 'column' } as const
const across = (axis: Axis): Axis => (axis === 'horizontal' ? 'vertical' : 'horizontal')

/** Which line along `axis` each node is on (a node on none is its own line). */
function alignmentLines(lines: readonly AlignConstraint[], axis: Axis): (id: string) => string {
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    let root = id
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root)!
    return root
  }
  for (const c of lines) {
    if (c.axis !== axis || !c.nodeIds.length) continue
    for (const id of c.nodeIds.slice(1)) {
      const a = find(id)
      const b = find(c.nodeIds[0])
      if (a !== b) parent.set(a, b)
    }
  }
  return find
}

/** Two elements the ordered lines along `axis` put both before and after
 *  each other, or null when their orders agree. */
function orderConflict(lines: readonly AlignConstraint[], axis: Axis): [string, string] | null {
  const next = new Map<string, Set<string>>()
  for (const c of lines) {
    if (c.axis !== axis || !c.ordered) continue
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

/** Refusals every new rule shares: the canvas and elements exist, at least
 *  two, none inside another. */
function checkMembers(state: ModelState, viewId: string | null, nodeIds: string[]): string | null {
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
  return null
}

/** Refusal when the `added` lines, with the canvas's `others`, contradict
 *  an order or put two elements in one row and one column (they would sit
 *  on top of each other). */
function checkLines(state: ModelState, others: readonly AlignConstraint[], added: readonly AlignConstraint[]): string | null {
  const label = (id: string): string => state.c4Nodes[id]?.label || id
  const all = [...others, ...added]
  for (const axis of ['horizontal', 'vertical'] as const) {
    const conflict = orderConflict(all, axis)
    if (conflict) return `Another ${AXIS_NOUN[axis]} keeps "${label(conflict[1])}" before "${label(conflict[0])}"; this order contradicts it.`
  }
  for (const line of added) {
    if (line.nodeIds.length < 2) continue
    const along = alignmentLines(all, line.axis)
    const cross = alignmentLines(all, across(line.axis))
    const members = Object.keys(state.c4Nodes).filter((id) => along(id) === along(line.nodeIds[0]))
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        if (cross(members[i]) === cross(members[j])) {
          return `"${label(members[i])}" and "${label(members[j])}" would be in one row and one column at once, on top of each other.`
        }
      }
    }
  }
  return null
}

function setConstraints(state: ModelState, viewId: string | null, next: LayoutConstraint[]): void {
  if (viewId) {
    const view = state.views[viewId]
    if (view) view.layoutConstraints = next
  } else {
    state.defaultLayoutConstraints = next
  }
}

/** Refusal for aligning `nodeIds` in a row ('horizontal') or a column; with
 *  `ordered`, in that order (left to right, top to bottom). */
export function checkAddAlignment(
  state: ModelState, viewId: string | null, axis: Axis, nodeIds: string[], ordered = false,
): string | null {
  const refused = checkMembers(state, viewId, nodeIds)
  if (refused) return refused
  const ids = [...new Set(nodeIds)]
  const lines = constraintLines(layoutConstraintsOf(state, viewId))
  const before = alignmentLines(lines, axis)
  if (ids.every((id) => before(id) === before(ids[0]))) {
    // Already on one line: only adding their order is news.
    if (!ordered) return `These elements are already in one ${AXIS_NOUN[axis]}.`
    const key = ids.join('\u0000')
    if (lines.some((c) => c.axis === axis && c.ordered && c.nodeIds.join('\u0000').includes(key))) {
      return `These elements already keep this order in one ${AXIS_NOUN[axis]}.`
    }
  }
  return checkLines(state, lines, [{ id: '', type: 'align', axis, nodeIds: ids, ordered }])
}

/** Adds an alignment (checkAddAlignment passed) to a view or All elements. */
export function insertAlignment(
  state: ModelState, viewId: string | null, id: string, axis: Axis, nodeIds: string[], ordered = false,
): void {
  const constraint: AlignConstraint = { id, type: 'align', axis, nodeIds: [...new Set(nodeIds)], ...(ordered ? { ordered } : {}) }
  setConstraints(state, viewId, [...layoutConstraintsOf(state, viewId), constraint])
}

/** Refusal for keeping `nodeIds` in a grid of `columns` columns, filled
 *  row by row in that order. */
export function checkAddGrid(state: ModelState, viewId: string | null, nodeIds: string[], columns: number): string | null {
  const refused = checkMembers(state, viewId, nodeIds)
  if (refused) return refused
  if (!Number.isInteger(columns) || columns < 1) return 'A grid needs a whole number of columns, at least one.'
  const ids = [...new Set(nodeIds)]
  const existing = layoutConstraintsOf(state, viewId)
  if (existing.some((c) => c.type === 'grid' && c.columns === columns && c.nodeIds.join('\u0000') === ids.join('\u0000'))) {
    return 'These elements are already in this grid.'
  }
  return checkLines(state, constraintLines(existing), constraintLines([{ id: '', type: 'grid', columns, nodeIds: ids }]))
}

/** Adds a grid (checkAddGrid passed) to a view or All elements. */
export function insertGrid(state: ModelState, viewId: string | null, id: string, nodeIds: string[], columns: number): void {
  const constraint: GridConstraint = { id, type: 'grid', columns, nodeIds: [...new Set(nodeIds)] }
  setConstraints(state, viewId, [...layoutConstraintsOf(state, viewId), constraint])
}

/** Refusal for giving grid `id` `columns` columns. */
export function checkGridColumns(state: ModelState, viewId: string | null, id: string, columns: number): string | null {
  const list = layoutConstraintsOf(state, viewId)
  const c = list.find((x) => x.id === id)
  if (!c || c.type !== 'grid') return `No grid "${id}" on this canvas.`
  if (!Number.isInteger(columns) || columns < 1) return 'A grid needs a whole number of columns, at least one.'
  return checkLines(state, constraintLines(list.filter((x) => x.id !== id)), constraintLines([{ ...c, columns }]))
}

/** Gives a grid (checkGridColumns passed) `columns` columns. */
export function setGridColumns(state: ModelState, viewId: string | null, id: string, columns: number): void {
  setConstraints(state, viewId, layoutConstraintsOf(state, viewId).map((c) => (c.id === id && c.type === 'grid' ? { ...c, columns } : c)))
}

/** Refusal for making alignment `id` keep the order of `nodeIds` (its
 *  members, in the order to keep). */
export function checkAlignmentOrder(state: ModelState, viewId: string | null, id: string, nodeIds: string[]): string | null {
  const list = layoutConstraintsOf(state, viewId)
  const c = list.find((x) => x.id === id)
  if (!c || c.type !== 'align') return `No alignment "${id}" on this canvas.`
  return checkLines(state, constraintLines(list.filter((x) => x.id !== id)), [{ ...c, nodeIds, ordered: true }])
}

/** Makes an alignment keep the order of `nodeIds` (checkAlignmentOrder
 *  passed), or stop keeping any order when `nodeIds` is null. */
export function setAlignmentOrder(state: ModelState, viewId: string | null, id: string, nodeIds: string[] | null): void {
  setConstraints(state, viewId, layoutConstraintsOf(state, viewId).map((c) => {
    if (c.id !== id || c.type !== 'align') return c
    if (!nodeIds) {
      const { ordered: _ordered, ...rest } = c
      return rest
    }
    return { ...c, nodeIds: [...nodeIds], ordered: true }
  }))
}

/** Pins (`pinned`) or unpins `nodeIds` on a canvas (see PinConstraint).
 *  False when nothing changed. */
export function setPinned(state: ModelState, viewId: string | null, nodeIds: string[], pinned: boolean, newId: () => string): boolean {
  const list = layoutConstraintsOf(state, viewId)
  const before = pinnedNodeIds(list)
  const ids = pinned
    ? [...before, ...nodeIds.filter((id, i) => !before.includes(id) && nodeIds.indexOf(id) === i)]
    : before.filter((id) => !nodeIds.includes(id))
  if (ids.length === before.length) return false
  const pin = list.find((c) => c.type === 'pin')
  const rest = list.filter((c) => c.type !== 'pin')
  setConstraints(state, viewId, ids.length ? [...rest, { id: pin?.id ?? newId(), type: 'pin', nodeIds: ids }] : rest)
  return true
}

/** Removes a layout constraint. False when the canvas has no such constraint. */
export function deleteLayoutConstraint(state: ModelState, viewId: string | null, id: string): boolean {
  const list = layoutConstraintsOf(state, viewId)
  if (!list.some((c) => c.id === id)) return false
  setConstraints(state, viewId, list.filter((c) => c.id !== id))
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

// ─── Comparing two copies of a model ─────────────────────────────────────────
// One definition of "what changed" for compare_milestones, Studio's milestone
// timeline and the highlight after an outside edit.

/** Layout fields, which a copy also keeps but which are not changes to the system. */
const LAYOUT_KEYS = new Set(['id', 'x', 'y', 'width', 'height', 'collapsed'])

const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** Fields that differ between two versions of an element or relation, layout left out. */
function changedFields(before: object, after: object): string[] {
  const a = before as Record<string, unknown>
  const b = after as Record<string, unknown>
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].filter((key) => !LAYOUT_KEYS.has(key) && !sameValue(a[key], b[key])).sort()
}

export interface ModelCopy {
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
}

export interface ElementChanges {
  added: string[]
  removed: string[]
  changed: Array<{ id: string; fields: string[] }>
}

export interface ModelChanges {
  nodes: ElementChanges
  relations: ElementChanges
}

/** Elements and relations added, removed and changed from `before` to
 *  `after`; a change is any field but the layout (properties included). */
export function compareModels(before: ModelCopy, after: ModelCopy): ModelChanges {
  const diff = <T extends object>(from: Record<string, T>, to: Record<string, T>): ElementChanges => ({
    added: Object.keys(to).filter((id) => !(id in from)),
    removed: Object.keys(from).filter((id) => !(id in to)),
    changed: Object.keys(to)
      // The same object is unchanged: Studio's copies share untouched elements.
      .filter((id) => id in from && from[id] !== to[id])
      .map((id) => ({ id, fields: changedFields(from[id], to[id]) }))
      .filter((change) => change.fields.length > 0),
  })
  return { nodes: diff(before.nodes, after.nodes), relations: diff(before.relations, after.relations) }
}
