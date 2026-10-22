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

import { type EdgeStyle, type ViewFilter, type ViewPipeline, type ChainLevel, type ChainWay, addToViewList, constraintLines, isInViewFolder, normalizeViewFolder, viewFolderRenameTarget, viewFolderTree, type ViewFolder, wikiDepthOf, pinnedNodeIds, removeFromViewList, type AlignConstraint, type C4Node, type C4Relation, type DiagramSequence, type DiagramSnapshot, type DiagramView, type GridConstraint, type LayoutConstraint, type NodePosition, COLLAPSED_HEIGHT, COLLAPSED_WIDTH, isContainerType, trimStepBackward } from './c4'
import { readPipeline, viewShownNodes } from './viewPipeline'
import { canBeSubject, sameChain, scopedChain, subjectViewName, viewpointsOf } from './viewpoints'
import {
  builtInC4Metamodel,
  builtInGovernanceMetamodel,
  canAddMoreOfType,
  chainTypeNames,
  GROUP_TYPE,
  hasPlaceUnder,
  inferRelationType,
  isParentAllowed,
  isFinalState,
  isPlacementAllowed,
  isRelationAllowed,
  placeOf,
  relationTypeKeepsAggregates,
  relationTypesFitting,
  initialPseudostateRefusal,
  isInitialPseudostate,
  lifecycleRefusal,
  newPseudostateKind,
  outgoingTransitionCount,
  transitionRefusal,
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
  /** How All elements and views without their own draw relations. */
  defaultEdgeStyle?: EdgeStyle
  /** Where All elements has the nodes while another canvas is shown
   *  (Studio's store; DiagramData.defaultPositions). */
  defaultPositions?: Record<string, NodePosition>
}

type NodeRecord = C4Node & Record<string, unknown>

/** The metamodel a loaded document runs under. Built-in metamodels are
 *  stored by id and replaced with the current preset; a document without
 *  one uses C4. The retired C4 + DDD preset loads as the Radical metamodel,
 *  which holds all of its types unchanged. */
export function documentMetamodel(stored: Metamodel | undefined, nodes?: ReadonlyArray<{ type: string }>): Metamodel {
  if (!stored) {
    // A document saved without a metamodel (a Hub concept downloaded as a
    // file) is C4 unless it holds types only the Radical preset has: opened
    // under C4, its mockups, requirements and ADRs were unknown types.
    const c4 = builtInC4Metamodel()
    return nodes?.some((n) => !c4.nodeTypes[n.type]) ? builtInGovernanceMetamodel() : c4
  }
  // The viewpoints: the preset's, as the document changed them, and its own.
  const preset = stored.id === 'c4-builtin' ? builtInC4Metamodel()
    : stored.id === 'c4-ddd-builtin' || stored.id === 'c4-ddd-governance-builtin' ? builtInGovernanceMetamodel()
    : null
  if (!preset) return stored
  const withViewpoints = withPresetViewpoints(preset, stored)
  // Types the preset lacks (added by hand to the file, or by a program):
  // swapped for the preset, they were unknown types, and the next save
  // wrote them away. The document keeps them, under a custom copy.
  const extraNodeTypes = Object.entries(stored.nodeTypes ?? {}).filter(([id, def]) => !preset.nodeTypes[id] && def && typeof def === 'object')
  const extraRelationTypes = Object.entries(stored.relationTypes ?? {}).filter(([id, def]) => !preset.relationTypes[id] && def && typeof def === 'object')
  if (!extraNodeTypes.length && !extraRelationTypes.length) return withViewpoints
  const custom = forkPresetMetamodel({ ...withViewpoints, id: preset.id }) ?? withViewpoints
  return {
    ...custom,
    nodeTypes: { ...custom.nodeTypes, ...Object.fromEntries(extraNodeTypes) },
    relationTypes: { ...custom.relationTypes, ...Object.fromEntries(extraRelationTypes) },
  }
}

/** The preset with the document's viewpoints: the preset's (but those the
 *  document deleted), each as the document has it if it has it, then the
 *  document's own. A preset that gains a viewpoint brings it to documents
 *  saved before. */
function withPresetViewpoints(preset: Metamodel, stored: Metamodel): Metamodel {
  const own = Array.isArray(stored.viewpoints) ? stored.viewpoints : []
  const removed = new Set(Array.isArray(stored.removedViewpoints) ? stored.removedViewpoints : [])
  if (!own.length && !removed.size) return preset
  const byId = new Map(own.map((v) => [v.id, v]))
  const fromPreset = (preset.viewpoints ?? []).filter((v) => !removed.has(v.id)).map((v) => byId.get(v.id) ?? v)
  const presetIds = new Set((preset.viewpoints ?? []).map((v) => v.id))
  const viewpoints = [...fromPreset, ...own.filter((v) => !presetIds.has(v.id))]
  return { ...preset, viewpoints, ...(removed.size ? { removedViewpoints: [...removed] } : {}) }
}

const PRESET_IDS = new Set(['c4-builtin', 'c4-ddd-governance-builtin'])

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

/** Where a node of `type` was refused, and what it may sit in: the end of
 *  "Cannot place Component inside …". A group that the type may sit in
 *  refuses it for where the group stands. */
const FINAL_HOLDS_NOTHING = 'a final state cannot contain other states.'

function placementError(mm: Metamodel | undefined, type: string, parent: C4Node | undefined, nodes: Record<string, C4Node>): string {
  const allowed = mm?.nodeTypes[type]?.allowedParents
  const parentLabel = parent ? typeLabel(mm, parent.type) : 'the canvas root'
  if (parent && isParentAllowed(mm, type, parent.type) && isFinalState(parent)) {
    return `Final ${parentLabel.toLowerCase()} "${parent.label}": ${FINAL_HOLDS_NOTHING}`
  }
  if (parent && isParentAllowed(mm, type, parent.type)) {
    const place = placeOf(parent, nodes)
    const where = place ? `inside ${typeLabel(mm, place.type)} "${place.label}"` : 'at the top of the model'
    return `${parentLabel} "${parent.label}": the group is ${where}, where a ${typeLabel(mm, type)} has no place. A group holds only what its place allows.`
  }
  const allowedStr = allowed && allowed.length
    ? allowed.map((t) => typeLabel(mm, t)).join(', ')
    : 'the canvas root'
  return `${parentLabel}. Allowed parents: ${allowedStr}.`
}

/** The first element inside the group `node` that would have no place if
 *  the group stood under `newParent`: what a group holds moves with it. */
function misplacedInGroup(state: ModelState, node: C4Node, newParent: C4Node | undefined): C4Node | undefined {
  if (node.type !== GROUP_TYPE) return undefined
  const place = placeOf(newParent, state.c4Nodes)
  const stack = [node.id]
  while (stack.length > 0) {
    const groupId = stack.pop()!
    for (const child of Object.values(state.c4Nodes)) {
      if (child.parentId !== groupId) continue
      if (child.type === GROUP_TYPE) stack.push(child.id)
      else if (!hasPlaceUnder(state.metamodel, child.type, place?.type)) return child
    }
  }
  return undefined
}

function groupContentsError(mm: Metamodel | undefined, group: C4Node, misplaced: C4Node): string {
  return `Cannot move Group "${group.label}" there: its ${typeLabel(mm, misplaced.type)} "${misplaced.label}" would have no place. A group holds only what its place allows.`
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
  // A parent that is gone (a wizard finished after the element it was
  // opened in was undone or deleted) is no root: inserted, the child
  // pointed at nothing and the model could not be drawn again.
  if (node.parentId && !parent) return `Cannot add ${label}: the element it was to go into no longer exists.`
  if (!isPlacementAllowed(mm, node.type, parent, state.c4Nodes)) {
    return `Cannot place ${label} inside ${placementError(mm, node.type, parent, state.c4Nodes)}`
  }
  if (hasStatecharts(mm) && isInitialPseudostate(node as C4Node)) {
    const why = initialPseudostateRefusal(parent, state.c4Nodes)
    if (why) return `Cannot add an initial ${label.toLowerCase()}: ${why}`
  }
  return null
}

/** Whether the metamodel has the statechart types, whose rules
 *  (statechart.ts) the checks apply as validateModel does. */
const hasStatecharts = (mm: Metamodel | undefined): boolean => !!(mm?.nodeTypes.state && mm.relationTypes.transition)

/** Adds the node, and lists it in the active view when there is one. A view
 *  with no nodeIds shows every node, so it already shows the new one —
 *  listing it there would hide all the others. */
export function insertNode(state: ModelState, id: string, node: Omit<C4Node, 'id'>): void {
  const created = { id, ...node } as NodeRecord
  // A pseudostate given no kind is initial where an initial one may go, else
  // a choice (a + row under a machine that has its initial one).
  if (created.type === 'pseudostate' && created.kind === undefined && hasStatecharts(state.metamodel)) {
    created.kind = newPseudostateKind(created.parentId ? state.c4Nodes[created.parentId] : undefined, state.c4Nodes)
  }
  materializeDefaults(created, state.metamodel)
  state.c4Nodes[id] = created
  const view = state.activeViewId ? state.views[state.activeViewId] : undefined
  if (view) addToViewList(view, [id])
}

export function checkNodeUpdate(state: ModelState, id: string, updates: Partial<Omit<C4Node, 'id'>>): string | null {
  const existing = state.c4Nodes[id]
  if (!existing) return null
  if (!('parentId' in updates) && !('type' in updates) && !('kind' in updates)) return null
  const newType = (updates.type as string | undefined) ?? existing.type
  const newParentId = ('parentId' in updates ? (updates.parentId as string | null | undefined) : existing.parentId) ?? undefined
  const parent = newParentId ? state.c4Nodes[newParentId] : undefined
  // A system may lie inside a system: the types alone allow a parent to be
  // given its own child as parent, and the tree then has a loop that every
  // walk up or down it never leaves.
  if ('parentId' in updates && newParentId && (newParentId === id || descendantIds(id, state.c4Nodes).includes(newParentId))) {
    return 'Cannot move a node into itself or one of its descendants.'
  }
  if (!isPlacementAllowed(state.metamodel, newType, parent, state.c4Nodes)) {
    return `Cannot move ${typeLabel(state.metamodel, newType)} "${existing.label}" into ${placementError(state.metamodel, newType, parent, state.c4Nodes)}`
  }
  const misplaced = 'parentId' in updates ? misplacedInGroup(state, { ...existing, type: newType } as C4Node, parent) : undefined
  if (misplaced) return groupContentsError(state.metamodel, existing, misplaced)
  // A state made final keeps its children: it would hold them.
  if (isFinalState({ ...existing, ...updates } as C4Node) && !isFinalState(existing)) {
    const held = Object.values(state.c4Nodes).filter((n) => n.parentId === id).length
    if (held > 0) return `Cannot make ${typeLabel(state.metamodel, newType)} "${existing.label}" final: it holds ${held} element${held === 1 ? '' : 's'}, and ${FINAL_HOLDS_NOTHING}`
    const out = hasStatecharts(state.metamodel) ? outgoingTransitionCount(id, state.c4Relations) : 0
    if (out > 0) return `Cannot make ${typeLabel(state.metamodel, newType)} "${existing.label}" final: ${out} transition${out === 1 ? ' leaves' : 's leave'} it, and a final state cannot have outgoing transitions.`
  }
  // An initial pseudostate, made or moved: one per machine or compound
  // state, none in a parallel state, and nothing points at it.
  const next = { ...existing, ...updates } as C4Node
  if (hasStatecharts(state.metamodel) && isInitialPseudostate(next) && (!isInitialPseudostate(existing) || 'parentId' in updates)) {
    const why = initialPseudostateRefusal(parent, state.c4Nodes, id)
      ?? (Object.values(state.c4Relations).some((r) => r.targetId === id && r.relationType === 'transition') ? 'a transition points at it, and a transition targets the state itself.' : null)
    if (why) return `Cannot ${'parentId' in updates && isInitialPseudostate(existing) ? 'move' : 'make'} ${typeLabel(state.metamodel, newType)} "${existing.label}" ${'parentId' in updates && isInitialPseudostate(existing) ? 'there' : 'initial'}: ${why}`
  }
  // A retyped element keeps its relations: each must be one the metamodel
  // has between the new type and the other end.
  if (newType !== existing.type) {
    for (const rel of Object.values(state.c4Relations)) {
      if (rel.sourceId !== id && rel.targetId !== id) continue
      const other = state.c4Nodes[rel.sourceId === id ? rel.targetId : rel.sourceId]
      if (!other) continue
      const from = rel.sourceId === id ? newType : other.type
      const to = rel.targetId === id ? newType : other.type
      if (!isRelationAllowed(state.metamodel, from, to)) {
        return `Cannot change "${existing.label}" to ${typeLabel(state.metamodel, newType)}: its relation ${rel.sourceId === id ? 'to' : 'from'} "${other.label}" would be ${typeLabel(state.metamodel, from)} → ${typeLabel(state.metamodel, to)}, which the metamodel does not permit. Remove the relation first.`
      }
    }
  }
  return null
}

/** Applies the updates; a retyped node gets its new type's defaults. */
export function patchNode(state: ModelState, id: string, updates: Partial<Omit<C4Node, 'id'>>): void {
  const node = state.c4Nodes[id] as NodeRecord | undefined
  if (!node) return
  const retyped = 'type' in updates && updates.type !== node.type
  if (typeof updates.label === 'string') renameViewsOf(state, id, updates.label)
  Object.assign(node, updates)
  if ('type' in updates) materializeDefaults(node, state.metamodel)
  // Its relations keep a type that fits the new pair (checkNodeUpdate made
  // sure there is one).
  if (retyped) for (const rel of Object.values(state.c4Relations)) if (rel.sourceId === id || rel.targetId === id) refitRelationType(state, rel)
}

/** A view of element `id` named after it is renamed with it to `label`;
 *  one renamed by hand keeps its name. Call before the element takes it. */
export function renameViewsOf(state: ModelState, id: string, label: string): void {
  const before = state.c4Nodes[id]?.label.trim()
  const after = label.trim()
  if (!before || !after || after === before) return
  for (const view of Object.values(state.views)) if (view.subject === id && view.name === before) view.name = after
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
    if (!isPlacementAllowed(state.metamodel, n.type, newParent, state.c4Nodes)) {
      return `Cannot place ${typeLabel(state.metamodel, n.type)} "${n.label}" inside ${placementError(state.metamodel, n.type, newParent, state.c4Nodes)}`
    }
    if (hasStatecharts(state.metamodel) && isInitialPseudostate(n) && (n.parentId ?? null) !== newParentId) {
      const why = initialPseudostateRefusal(newParent, state.c4Nodes, n.id)
      if (why) return `Cannot move ${typeLabel(state.metamodel, n.type)} "${n.label}" there: ${why}`
    }
    const misplaced = misplacedInGroup(state, n, newParent)
    if (misplaced) return groupContentsError(state.metamodel, n, misplaced)
  }
  return null
}

/** The elements the element `id` may be moved into, as the card's and the
 *  wiki's Parent pickers offer them: those checkReparent takes (they listed
 *  parents it then refused: a descendant, a final state, a group with no
 *  place for it), and no external element, which the model leaves as a box
 *  (but the one it is in now). */
export function parentCandidates(state: ModelState, id: string): C4Node[] {
  const node = state.c4Nodes[id]
  if (!node) return []
  return Object.values(state.c4Nodes).filter((n) => n.id !== id
    && (n.id === node.parentId || !n.external)
    && isParentAllowed(state.metamodel, node.type, n.type)
    && (n.id === node.parentId || checkReparent(state, [id], n.id) === null))
}

/** Moves the nodes under `newParentId` (null = the root), keeping each one
 *  where it is on the canvas: positions are relative to the parent, so they
 *  are rebased onto the new parent's absolute position (the canvas shown
 *  then settles it: settleMovedNodes). The other canvases that keep a place
 *  for a moved node (the views' positions, and All elements' while a view
 *  is shown) are rebased the same way where the node then lies inside its
 *  new parent's frame there and on none of its new siblings; where it does
 *  not, its place there is dropped, and that canvas gives it one inside the
 *  parent, beside its siblings, when it shows (placeUnplaced). */
export function reparentNodes(state: ModelState, ids: string[], newParentId: string | null): void {
  const absOf = (id: string | null, positions?: Record<string, NodePosition>): { x: number; y: number } => {
    let x = 0, y = 0
    let cur: C4Node | undefined = id ? state.c4Nodes[id] : undefined
    const seen = new Set<string>()
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id)
      const at = positions?.[cur.id] ?? cur
      x += at.x
      y += at.y
      cur = cur.parentId ? state.c4Nodes[cur.parentId] : undefined
    }
    return { x, y }
  }
  const moving = ids.filter((id) => state.c4Nodes[id] && (state.c4Nodes[id].parentId ?? null) !== newParentId)
  const movingSet = new Set(moving)
  const siblings = Object.values(state.c4Nodes).filter((n) => (n.parentId ?? null) === newParentId && !movingSet.has(n.id))
  // Measure every node against the original tree before changing any parent.
  const canvases = [
    { positions: state.defaultPositions, view: undefined },
    ...Object.values(state.views).map((view) => ({ positions: view.positions, view })),
  ].filter((c): c is { positions: Record<string, NodePosition>; view: DiagramView | undefined } => !!c.positions && moving.some((id) => id in c.positions!))
  const rebased = canvases.map(({ positions, view }) => {
    const parent = newParentId ? positions[newParentId] : undefined
    const target = absOf(newParentId, positions)
    // As the canvas draws it: folded there, at its folded size.
    const drawn = (id: string, at: NodePosition): NodePosition => {
      const n = state.c4Nodes[id]
      const folded = !!n && isContainerType(n.type)
        && ((n.collapsed && !view?.expandedNodeIds?.includes(id)) || !!view?.collapsedNodeIds?.includes(id))
      return folded ? { x: at.x, y: at.y, width: COLLAPSED_WIDTH[n.type], height: COLLAPSED_HEIGHT[n.type] } : at
    }
    const overlaps = (a: NodePosition, b: NodePosition): boolean =>
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
    return moving.filter((id) => id in positions).map((id) => {
      const abs = absOf(id, positions)
      const box = { ...positions[id], x: abs.x - target.x, y: abs.y - target.y }
      // It keeps its place where that lies inside its new parent's frame
      // (anywhere at the root) and on none of its new siblings; in a parent
      // the canvas has no place for, outside its frame or on a sibling, it
      // is placed afresh (beside its siblings, placeUnplaced).
      const at = drawn(id, box)
      const inside = !newParentId || (!!parent && at.x >= 0 && at.y >= 0 && at.x + at.width <= parent.width && at.y + at.height <= parent.height)
      const clear = !siblings.some((s) => s.id in positions && overlaps(at, drawn(s.id, positions[s.id])))
      return { positions, id, box: inside && clear ? box : null }
    })
  }).flat()
  const target = absOf(newParentId)
  const placed = ids.filter((id) => state.c4Nodes[id]).map((id) => ({ id, abs: absOf(id) }))
  for (const { id, abs } of placed) {
    const node = state.c4Nodes[id]
    node.parentId = newParentId ?? undefined
    node.x = abs.x - target.x
    node.y = abs.y - target.y
  }
  for (const { positions, id, box } of rebased) {
    if (box) positions[id] = box
    else delete positions[id]
  }
  leaveAncestorAlignments(state, moving)
}

/** Takes the `moved` elements (and what they hold) out of the rows, columns
 *  and grids they now share with one of their ancestors, on every canvas:
 *  an element cannot be aligned with its own container (checkMembers), and
 *  a grid holding one of its members inside another drew them on top of
 *  each other. A rule left with one member goes. Mutates `state`. */
function leaveAncestorAlignments(state: ModelState, moved: string[]): void {
  if (!moved.length) return
  const inMoved = new Set(moved.flatMap((id) => [id, ...descendantIds(id, state.c4Nodes)]))
  const ancestorsOf = (id: string): string[] => {
    const out: string[] = []
    for (let cur = state.c4Nodes[id]?.parentId; cur && state.c4Nodes[cur] && !out.includes(cur); cur = state.c4Nodes[cur].parentId) out.push(cur)
    return out
  }
  const leave = (constraints: LayoutConstraint[]): LayoutConstraint[] => {
    const out: LayoutConstraint[] = []
    let changed = false
    for (const c of constraints) {
      const members = new Set(c.nodeIds)
      const kept = c.type === 'pin' ? c.nodeIds : c.nodeIds.filter((id) => !inMoved.has(id) || !ancestorsOf(id).some((a) => members.has(a)))
      if (kept.length === c.nodeIds.length) { out.push(c); continue }
      changed = true
      if (kept.length >= 2) out.push({ ...c, nodeIds: kept })
    }
    return changed ? out : constraints
  }
  for (const view of Object.values(state.views)) {
    if (view.layoutConstraints?.length) view.layoutConstraints = leave(view.layoutConstraints)
  }
  if (state.defaultLayoutConstraints?.length) state.defaultLayoutConstraints = leave(state.defaultLayoutConstraints)
}

/** Why a node cannot be removed with its children kept (they move one level
 *  up, into its parent), or null. */
export function checkUnwrap(state: ModelState, id: string): string | null {
  const node = state.c4Nodes[id]
  if (!node) return null
  const mm = state.metamodel
  const grandparent = node.parentId ? state.c4Nodes[node.parentId] : undefined
  for (const child of Object.values(state.c4Nodes)) {
    if (child.parentId !== id) continue
    if (!isPlacementAllowed(mm, child.type, grandparent, state.c4Nodes)) {
      return `Cannot unwrap: ${typeLabel(mm, child.type)} "${child.label}" is not allowed inside ${placementError(mm, child.type, grandparent, state.c4Nodes)}`
    }
    // A group is allowed almost anywhere; what it holds is not.
    const misplaced = misplacedInGroup(state, child, grandparent)
    if (misplaced) {
      return `Cannot unwrap: Group "${child.label}" would be left where its ${typeLabel(mm, misplaced.type)} "${misplaced.label}" has no place. A group holds only what its place allows.`
    }
  }
  return null
}

/** Removes the node, its descendants, their relations and every view
 *  reference to them. Returns the removed node ids. */
export function deleteNode(state: ModelState, id: string): Set<string> {
  const removed = new Set([id, ...descendantIds(id, state.c4Nodes)])
  for (const nid of removed) delete state.c4Nodes[nid]
  const relations = new Set<string>()
  for (const [rid, rel] of Object.entries(state.c4Relations)) {
    if (removed.has(rel.sourceId) || removed.has(rel.targetId)) { delete state.c4Relations[rid]; relations.add(rid) }
  }
  forgetRelationsInSequences(state, relations)
  forgetNodesInViews(state, removed)
  return removed
}

/** Takes the steps of the `removed` relations out of every sequence, each
 *  with its note. Left in, a flow numbered the steps left with gaps, and
 *  nothing said they pointed at nothing. */
export function forgetRelationsInSequences(state: ModelState, removed: Set<string>): void {
  if (!removed.size) return
  for (const sequence of Object.values(state.sequences ?? {})) {
    if (!sequence.relationIds.some((rid) => removed.has(rid))) continue
    const keep = sequence.relationIds.map((rid) => !removed.has(rid))
    const notes = sequence.stepDescriptions?.filter((_, i) => keep[i] ?? true)
    const backward = sequence.stepBackward && trimStepBackward(sequence.stepBackward.filter((_, i) => keep[i] ?? true))
    sequence.relationIds = sequence.relationIds.filter((_, i) => keep[i])
    if (notes) {
      while (notes.length > 0 && !notes[notes.length - 1]) notes.pop()
      sequence.stepDescriptions = notes
    }
    if (backward) sequence.stepBackward = backward
    else delete sequence.stepBackward
  }
}

/** How many steps of sequences deleting `nodeIds` (with what they hold)
 *  and `relationIds` takes out with their relations (the Delete prompt). */
export function sequenceStepsRemovedBy(state: ModelState, nodeIds: string[], relationIds: string[]): number {
  const nodes = new Set(nodeIds.flatMap((id) => [id, ...descendantIds(id, state.c4Nodes)]))
  const relations = new Set(relationIds)
  for (const [rid, rel] of Object.entries(state.c4Relations)) {
    if (nodes.has(rel.sourceId) || nodes.has(rel.targetId)) relations.add(rid)
  }
  return Object.values(state.sequences ?? {}).reduce((n, q) => n + q.relationIds.filter((rid) => relations.has(rid)).length, 0)
}

/** Whether a chain level has a within filter on one of the `removed`. */
function namesRemoved(level: unknown, removed: Set<string>): boolean {
  const filters = (level as { filters?: unknown } | null)?.filters
  return Array.isArray(filters) && filters.some((f) => f?.kind === 'within' && removed.has(f.nodeId))
}

/** Takes the `removed` elements out of every view (its list, folds,
 *  alignments and within filters) and out of All elements' alignments; a
 *  view of one of them goes with it. */
export function forgetNodesInViews(state: ModelState, removed: Set<string>): void {
  for (const view of Object.values(state.views)) {
    removeFromViewList(view, removed)
    // An exploration forgets the level of what is gone, and what added it.
    if (view.explore) {
      const keep = <T,>(record: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(record ?? {}).filter(([id]) => !removed.has(id)))
      view.explore = { ...view.explore, levels: keep(view.explore.levels), addedBy: keep(view.explore.addedBy) }
      if (view.positions && Object.keys(view.positions).some((id) => removed.has(id))) view.positions = keep(view.positions)
    }
    if (view.collapsedNodeIds?.length) view.collapsedNodeIds = view.collapsedNodeIds.filter((nid) => !removed.has(nid))
    if (view.expandedNodeIds?.length) view.expandedNodeIds = view.expandedNodeIds.filter((nid) => !removed.has(nid))
    if (view.layoutConstraints?.length) view.layoutConstraints = withoutNodes(view.layoutConstraints, removed)
    // A filter "inside" an element that is gone kept every element out,
    // and a viewpoint made from the view took it along.
    const levels = (view.pipeline as { levels?: unknown } | undefined)?.levels
    if (Array.isArray(levels) && levels.some((l) => namesRemoved(l, removed))) {
      view.pipeline = {
        ...view.pipeline,
        levels: levels.map((l) => namesRemoved(l, removed) ? { ...l, filters: (l as { filters: ViewFilter[] }).filters.filter((f) => !(f?.kind === 'within' && removed.has(f.nodeId))) } : l),
      } as ViewPipeline
    }
  }
  if (state.defaultLayoutConstraints?.length) {
    state.defaultLayoutConstraints = withoutNodes(state.defaultLayoutConstraints, removed)
  }
  // A view of one element goes with it, and the canvas leaves it when it
  // was the one shown (only then: Studio's exploration is shown and is
  // none of `views`).
  for (const view of Object.values(state.views)) {
    if (!view.subject || !removed.has(view.subject)) continue
    if (state.activeViewId === view.id) state.activeViewId = null
    delete state.views[view.id]
  }
}

/** Constraints without the removed nodes; a rule left with one member goes
 *  (a pin with none). */
function withoutNodes(constraints: LayoutConstraint[], removed: Set<string>): LayoutConstraint[] {
  return constraints
    .map((c) => (c.nodeIds.some((id) => removed.has(id)) ? { ...c, nodeIds: c.nodeIds.filter((id) => !removed.has(id)) } : c))
    .filter((c) => c.nodeIds.length >= (c.type === 'pin' ? 1 : 2))
}

// ── Types in use ─────────────────────────────────────────────────────────────

/** What a milestone holds of the model's types. */
export type MilestoneContent = Pick<DiagramSnapshot, 'name' | 'nodes' | 'relations'>

/** Why a node type cannot be deleted from the metamodel: elements are still
 *  of it, in the model or in one of its `milestones` (opened, or restored to
 *  live, it brought back elements of an unknown type), or the metamodel or
 *  a view names it. Null when none does (built-in types are the caller's to
 *  refuse). */
export function checkRemoveNodeType(state: ModelState, typeId: string, milestones: MilestoneContent[] = []): string | null {
  const used = Object.values(state.c4Nodes).filter((n) => n.type === typeId).length
  if (used) return `${used} ${used === 1 ? 'element is' : 'elements are'} still of type ${typeLabel(state.metamodel, typeId)}: retype or delete ${used === 1 ? 'it' : 'them'} first.`
  return milestoneHoldsType(milestones, typeId, 'node', state.metamodel)
    ?? (state.metamodel ? checkRemoveNodeTypeFromMetamodel(state.metamodel, typeId) : null)
    ?? viewNamesType(state.views, typeId, 'node', state.metamodel)
}

/** Why a type cannot go while a milestone holds elements (or relations) of
 *  it: a milestone keeps what it saved, and its types with it. */
export function milestoneHoldsType(milestones: MilestoneContent[], typeId: string, of: 'node' | 'relation', mm: Metamodel | undefined): string | null {
  for (const m of milestones) {
    const count = of === 'node'
      ? Object.values(m.nodes ?? {}).filter((n) => n.type === typeId).length
      : Object.values(m.relations ?? {}).filter((r) => r.relationType === typeId).length
    if (!count) continue
    const what = of === 'node' ? `${count === 1 ? 'element' : 'elements'} of type ${typeLabel(mm, typeId)}` : `${count === 1 ? 'relation' : 'relations'} of type ${relationTypeName(mm, typeId)}`
    return `the milestone "${m.name}" holds ${count} ${what}: delete the milestone first.`
  }
  return null
}

const relationTypeName = (mm: Metamodel | undefined, typeId: string): string => `"${mm?.relationTypes[typeId]?.label ?? typeId}"`

/** Why a type cannot go while a viewpoint names it: one that makes a view
 *  per element of it, or whose filter chain names it. Left behind, the
 *  viewpoint kept the type, its views were empty, and nothing in Studio
 *  took it out. */
function viewpointNamesType(mm: Metamodel, typeId: string, of: 'node' | 'relation'): string | null {
  const name = of === 'node' ? typeLabel(mm, typeId) : relationTypeName(mm, typeId)
  for (const vp of viewpointsOf(mm)) {
    if (of === 'node' && vp.subject?.types.includes(typeId)) return `the viewpoint "${vp.label}" makes a view per ${name}: change or delete it first.`
    const named = chainTypeNames(vp.pipeline)
    if ((of === 'node' ? named.nodeTypes : named.relationTypes).includes(typeId)) return `the filter of the viewpoint "${vp.label}" names ${name}: change or delete the viewpoint first.`
  }
  return null
}

/** Why a type cannot go while a view's own filter chain names it. */
export function viewNamesType(views: Record<string, DiagramView>, typeId: string, of: 'node' | 'relation', mm: Metamodel | undefined): string | null {
  const name = of === 'node' ? typeLabel(mm, typeId) : relationTypeName(mm, typeId)
  for (const view of Object.values(views ?? {})) {
    const named = chainTypeNames(view.pipeline)
    if ((of === 'node' ? named.nodeTypes : named.relationTypes).includes(typeId)) return `the filter of the view "${view.name}" names ${name}: change it first.`
  }
  return null
}

/**
 * Why the metamodel cannot lose node type `typeId`: a relation type whose
 * pairs all name it would be left with none, which means "any pair" (the
 * MCP server's delete turned such a type into one that connects anything),
 * or a property of a type points at it.
 */
export function checkRemoveNodeTypeFromMetamodel(mm: Metamodel, typeId: string): string | null {
  const label = typeLabel(mm, typeId)
  for (const rel of Object.values(mm.relationTypes)) {
    if (rel.allowedPairs.length > 0 && rel.allowedPairs.every((p) => p.from === typeId || p.to === typeId)) {
      return `relation type "${rel.label}" connects only ${label}: change its pairs, or delete it, first.`
    }
  }
  for (const def of [...Object.values(mm.nodeTypes), ...Object.values(mm.relationTypes)]) {
    if (def.id === typeId) continue
    const ref = (def.properties ?? []).find((p) => p.type === 'ref' && p.refType === typeId)
    if (ref) return `the property "${ref.label}" of "${def.label}" points at ${label}: change or remove it first.`
  }
  return viewpointNamesType(mm, typeId, 'node')
}

/** Why the metamodel cannot lose relation type `typeId`: a viewpoint's
 *  filter chain follows it or tests for it. */
export function checkRemoveRelationTypeFromMetamodel(mm: Metamodel, typeId: string): string | null {
  return viewpointNamesType(mm, typeId, 'relation')
}

/** The metamodel without node type `typeId`, and without what names it: it
 *  is no allowed parent and in no relation pair any more. Studio left both
 *  behind, so the editor showed those entries as another type, and the next
 *  new type took them over. Returns a copy. */
export function metamodelWithoutNodeType(mm: Metamodel, typeId: string): Metamodel {
  const next = JSON.parse(JSON.stringify(mm)) as Metamodel
  delete next.nodeTypes[typeId]
  for (const type of Object.values(next.nodeTypes)) {
    if (type.allowedParents?.includes(typeId)) type.allowedParents = type.allowedParents.filter((t) => t !== typeId)
  }
  for (const rel of Object.values(next.relationTypes)) {
    rel.allowedPairs = rel.allowedPairs.filter((pair) => pair.from !== typeId && pair.to !== typeId)
  }
  return next
}

/** Why the model's metamodel cannot be replaced by `next`: elements or
 *  relations are of types it does not have (they would be left behind as
 *  unknown types, with nothing in the editor to bring the types back), in
 *  the model or in one of its `milestones` (restored to live, it brought
 *  them back), or a view's filter names such a type, as for Delete type. */
export function checkReplaceMetamodel(state: ModelState, next: Metamodel, milestones: MilestoneContent[] = []): string | null {
  const count = (items: string[]): Map<string, number> => {
    const out = new Map<string, number>()
    for (const t of items) out.set(t, (out.get(t) ?? 0) + 1)
    return out
  }
  const nodeTypes = count(Object.values(state.c4Nodes).map((n) => n.type).filter((t) => !next.nodeTypes[t]))
  const relationTypes = count(Object.values(state.c4Relations).flatMap((r) => r.relationType && !next.relationTypes[r.relationType] ? [r.relationType] : []))
  if (nodeTypes.size === 0 && relationTypes.size === 0) {
    const lostNodeTypes = new Set<string>(milestones.flatMap((m) => Object.values(m.nodes ?? {}).map((n): string => n.type)).filter((t) => !next.nodeTypes[t]))
    const lostRelationTypes = new Set(milestones.flatMap((m) => Object.values(m.relations ?? {}).flatMap((r) => r.relationType && !next.relationTypes[r.relationType] ? [r.relationType] : [])))
    for (const t of Object.keys(state.metamodel?.nodeTypes ?? {})) if (!next.nodeTypes[t]) lostNodeTypes.add(t)
    for (const t of Object.keys(state.metamodel?.relationTypes ?? {})) if (!next.relationTypes[t]) lostRelationTypes.add(t)
    for (const t of lostNodeTypes) {
      const why = milestoneHoldsType(milestones, t, 'node', state.metamodel) ?? viewNamesType(state.views, t, 'node', state.metamodel)
      if (why) return `${next.name} has no type ${typeLabel(state.metamodel, t)}, and ${why}`
    }
    for (const t of lostRelationTypes) {
      const why = milestoneHoldsType(milestones, t, 'relation', state.metamodel) ?? viewNamesType(state.views, t, 'relation', state.metamodel)
      if (why) return `${next.name} has no type ${relationTypeName(state.metamodel, t)}, and ${why}`
    }
    return null
  }
  const parts = [
    ...[...nodeTypes].map(([t, n]) => `${n} ${typeLabel(state.metamodel, t)}`),
    ...[...relationTypes].map(([t, n]) => `${n} "${state.metamodel?.relationTypes[t]?.label ?? t}" ${n === 1 ? 'relation' : 'relations'}`),
  ]
  return `${next.name} has no type for what the model holds: ${parts.join(', ')}. Retype or delete them first.`
}

/** Why a relation type cannot be deleted from the metamodel: relations are
 *  still of it, in the model or one of its `milestones`, or a viewpoint or
 *  a view names it. */
export function checkRemoveRelationType(state: ModelState, typeId: string, milestones: MilestoneContent[] = []): string | null {
  const used = Object.values(state.c4Relations).filter((r) => r.relationType === typeId).length
  if (used) return `${used} ${used === 1 ? 'relation is' : 'relations are'} still of type ${relationTypeName(state.metamodel, typeId)}: change or delete ${used === 1 ? 'it' : 'them'} first.`
  return milestoneHoldsType(milestones, typeId, 'relation', state.metamodel)
    ?? (state.metamodel ? checkRemoveRelationTypeFromMetamodel(state.metamodel, typeId) : null)
    ?? viewNamesType(state.views, typeId, 'relation', state.metamodel)
}

// ── Relations ────────────────────────────────────────────────────────────────

export function checkAddRelation(state: ModelState, rel: Omit<C4Relation, 'id'>): string | null {
  return relationRefusal(state, rel)
}

/** checkAddRelation for a new relation, or for the relation `exceptId`
 *  changed into `rel` (its type `kept` stays where it still has the pair). */
function relationRefusal(state: ModelState, rel: Omit<C4Relation, 'id'>, exceptId?: string, kept?: string): string | null {
  const src = state.c4Nodes[rel.sourceId]
  const dst = state.c4Nodes[rel.targetId]
  if (!src || !dst) return null
  if (!isRelationAllowed(state.metamodel, src.type, dst.type)) {
    return `Relation not allowed: ${typeLabel(state.metamodel, src.type)} → ${typeLabel(state.metamodel, dst.type)}. The metamodel does not permit this connection.`
  }
  // A relation that names its type must be one that type has between the two.
  const def = rel.relationType ? state.metamodel?.relationTypes[rel.relationType] : undefined
  if (def && !relationTypeAllows(def, src.type, dst.type)) {
    return `Relation not allowed: "${def.label}" does not connect ${typeLabel(state.metamodel, src.type)} → ${typeLabel(state.metamodel, dst.type)}.`
  }
  // The type it will have (insertRelation and patchRelation infer one).
  const keptDef = kept ? state.metamodel?.relationTypes[kept] : undefined
  const type = rel.relationType ?? (keptDef && relationTypeAllows(keptDef, src.type, dst.type) ? kept : inferRelationType(state.metamodel, src.type, dst.type))
  if (hasStatecharts(state.metamodel)) {
    const why = type === 'transition' ? transitionRefusal(src, dst, state.c4Nodes, state.c4Relations, exceptId)
      : type === 'lifecycle-of' ? lifecycleRefusal(src, dst, state.c4Nodes, state.c4Relations, exceptId)
      : null
    if (why) return `Relation not allowed: ${why}`
  }
  return null
}

function relationTypeAllows(def: { allowedPairs: { from: string; to: string }[] }, from: string, to: string): boolean {
  return def.allowedPairs.length === 0 || def.allowedPairs.some((p) => p.from === from && p.to === to)
}

/** Gives a relation whose type no longer has its pair (an end moved, an end
 *  was retyped) the one type that does, or none when several could. */
function refitRelationType(state: ModelState, rel: C4Relation): void {
  if (!rel.relationType) return
  const src = state.c4Nodes[rel.sourceId]
  const dst = state.c4Nodes[rel.targetId]
  const def = state.metamodel?.relationTypes[rel.relationType]
  if (!src || !dst || !def || relationTypeAllows(def, src.type, dst.type)) return
  const inferred = inferRelationType(state.metamodel, src.type, dst.type)
  if (inferred) rel.relationType = inferred
  else delete rel.relationType
}

/** Adds the relation, inferring its relationType from the metamodel when not given. */
export function insertRelation(state: ModelState, id: string, rel: Omit<C4Relation, 'id'>): void {
  const src = state.c4Nodes[rel.sourceId]
  const dst = state.c4Nodes[rel.targetId]
  const relationType = rel.relationType ?? (src && dst ? inferRelationType(state.metamodel, src.type, dst.type) : undefined)
  state.c4Relations[id] = { id, ...rel, ...(relationType ? { relationType } : {}) }
}

/** Refusal for moving a relation's source or target, or giving it another
 *  type, as for a new relation. A moved end may leave the type it had
 *  behind (patchRelation finds the one that fits); a type given here must
 *  have the pair. */
export function checkPatchRelation(state: ModelState, id: string, updates: Partial<Omit<C4Relation, 'id'>>): string | null {
  const rel = state.c4Relations[id]
  if (!rel) return null
  const retyped = updates.relationType !== undefined && updates.relationType !== rel.relationType
  if (updates.sourceId === undefined && updates.targetId === undefined && !retyped) return null
  return relationRefusal(state, { ...rel, ...updates, relationType: retyped ? updates.relationType : undefined }, id, rel.relationType)
}

/** What moving an end of relation `id` (`updates`) does to its type: none
 *  (`{}`) where the type it has still fits the new pair, the move gives one,
 *  or it has none and at most one fits; else the one type that fits
 *  (`type`), or, where several do, the ones to ask the user about (`ask`),
 *  as for a relation drawn (an Alt-drag). Moved unasked, it was left with
 *  no type, which the validation then flagged. */
export function relationTypeOnMove(state: ModelState, id: string, updates: Partial<Omit<C4Relation, 'id'>>): { type?: string; ask?: string[] } {
  const rel = state.c4Relations[id]
  if (!rel || updates.relationType !== undefined) return {}
  const src = state.c4Nodes[updates.sourceId ?? rel.sourceId]
  const dst = state.c4Nodes[updates.targetId ?? rel.targetId]
  if (!src || !dst || (src.id === rel.sourceId && dst.id === rel.targetId)) return {}
  const def = rel.relationType ? state.metamodel?.relationTypes[rel.relationType] : undefined
  if (def && relationTypeAllows(def, src.type, dst.type) && relationTypeKeepsAggregates(def.id, src, dst)) return {}
  const types = relationTypesFitting(state.metamodel, src.type, dst.type)
    .filter((rt) => relationTypeKeepsAggregates(rt.id, src, dst))
    .map((rt) => rt.id)
  if (types.length > 1) return { ask: types }
  return types.length === 1 && rel.relationType ? { type: types[0] } : {}
}

export function patchRelation(state: ModelState, id: string, updates: Partial<Omit<C4Relation, 'id'>>): void {
  const rel = state.c4Relations[id]
  if (!rel) return
  const moved = (updates.sourceId !== undefined && updates.sourceId !== rel.sourceId)
    || (updates.targetId !== undefined && updates.targetId !== rel.targetId)
  Object.assign(rel, updates)
  // A key given no value is none: the folder writes none of it either.
  for (const [key, value] of Object.entries(updates)) if (value === undefined) delete (rel as unknown as Record<string, unknown>)[key]
  // A moved end can leave the relation type behind; infer it again, as on insert.
  if (moved && updates.relationType === undefined) refitRelationType(state, rel)
}

export function deleteRelation(state: ModelState, id: string): void {
  delete state.c4Relations[id]
  forgetRelationsInSequences(state, new Set([id]))
}

// ── Views ────────────────────────────────────────────────────────────────────

/** A new view of every element, or with `empty` one that lists none yet. */
export function insertView(state: ModelState, id: string, name: string, empty = false): void {
  state.views[id] = { id, name, nodeIds: [], positions: {}, ...(empty ? { empty: true as const } : {}) }
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
  delete view.empty
  return true
}

/** Another kind: the view is of no viewpoint any more. A view of type
 *  Explore turned into another keeps its elements, not how it grew, nor
 *  its places: they are where it drew its elements, flat, and a structure
 *  view nests them in their containers (Studio turns them into a structure
 *  view's places itself). */
export function setViewKind(state: ModelState, viewId: string, kind: DiagramView['kind']): void {
  const view = state.views[viewId]
  if (!view) return
  if (view.kind === 'explore' && kind !== 'explore') {
    delete view.explore
    view.positions = {}
  }
  view.kind = kind
  delete view.viewpoint
  delete view.subject
}

/** Makes the view one of the metamodel's viewpoint `typeId`: the viewpoint's
 *  kind and a copy of its chain, kept to `subjectId` and what lies inside it
 *  for a viewpoint that draws one element (undefined: the element the view
 *  is of, if it still fits; null: none, the whole chain). False if there is
 *  no such view or type, or the element cannot be what the viewpoint draws. */
export function applyViewpoint(state: ModelState, viewId: string, typeId: string, subjectId?: string | null): boolean {
  const view = state.views[viewId]
  const type = viewpointsOf(state.metamodel).find((t) => t.id === typeId)
  if (!view || !type) return false
  // A caller that only syncs views may hold no elements: nothing can be drawn then.
  const nodes = state.c4Nodes ?? {}
  if (subjectId && !canBeSubject(type, nodes[subjectId])) return false
  const wanted = subjectId === undefined ? view.subject : subjectId ?? undefined
  const subject = wanted && canBeSubject(type, nodes[wanted]) ? wanted : undefined
  // A view named after the element it was of takes the new one's name.
  const before = view.subject ? nodes[view.subject] : undefined
  if (subject && subject !== view.subject && before && view.name === before.label.trim()) view.name = nodes[subject].label.trim() || view.name
  view.viewpoint = type.id
  view.kind = type.kind
  if (subject) view.subject = subject
  else delete view.subject
  const chain = scopedChain(type, subject)
  if (chain.levels?.length || chain.sort || chain.edges) view.pipeline = chain
  else delete view.pipeline
  return true
}

// ── Groups of views of one element ──────────────────────────────────────────
// A view of a viewpoint that draws one element (ViewpointDef.subject) is a
// group: it holds a view of each element of the viewpoint's types that is not
// external (partOf, subject), named after it, made when the element is added
// and removed with it. syncViewGroups keeps the groups in step with the model.

/** Whether `view` is a group of views of one element. */
export function isViewGroup(view: DiagramView | undefined, metamodel: Metamodel | undefined): boolean {
  if (!view?.viewpoint || view.subject || view.partOf) return false
  return !!viewpointsOf(metamodel).find((t) => t.id === view.viewpoint)?.subject
}

/** Why the elements of view `viewId` cannot be picked by hand, or null: a
 *  view of a group shows what its element holds, and the group shows its
 *  views. A list of their own hid an element added later, and nothing in
 *  Studio takes one away. */
export function groupViewNodesRefusal(state: Pick<ModelState, 'views' | 'metamodel'>, viewId: string): string | null {
  const view = state.views[viewId]
  if (view?.partOf) return `${view.name} is one of the views of the group ${state.views[view.partOf]?.name ?? view.partOf}: it shows what its element holds, and no element is picked by hand`
  if (isViewGroup(view, state.metamodel)) return `${view!.name} is a group of views per element: each of its views shows what its element holds, and it lists no elements itself`
  return null
}

/** The views of group `groupId`, in the list's order. */
export function viewsOfGroup(views: Record<string, DiagramView>, groupId: string): DiagramView[] {
  return Object.values(views).filter((v) => v.partOf === groupId)
}

/** The views that show element `nodeId`, in model order: what viewShownNodes
 *  says each shows, as the view list counts them, a view of the whole model
 *  among them. A group of views per element lists none itself: its views
 *  stand for it. */
export function viewsShowingNode(nodeId: string, state: Pick<ModelState, 'c4Nodes' | 'c4Relations' | 'views' | 'metamodel'>): DiagramView[] {
  if (!state.c4Nodes[nodeId]) return []
  return Object.values(state.views).filter((v) => {
    if (isViewGroup(v, state.metamodel)) return false
    const shown = viewShownNodes(v, state.c4Nodes, state.c4Relations)
    return shown ? shown.has(nodeId) : true
  })
}

/** What syncViewGroups would do: the views to add (a group and an element),
 *  the ids of the views to remove, of those to move into their group's
 *  folder, of the groups and views of one that list elements of their own
 *  (groupViewNodesRefusal), to show what they hold again, and of the views
 *  whose name is not their element's. All empty when the groups are in
 *  step. */
export function planViewGroups(state: Pick<ModelState, 'c4Nodes' | 'views' | 'metamodel'>): { add: Array<{ groupId: string; subjectId: string }>; remove: string[]; refolder: string[]; unlist: string[]; rename: string[] } {
  const defs = new Map(viewpointsOf(state.metamodel).map((t) => [t.id, t]))
  const add: Array<{ groupId: string; subjectId: string }> = []
  const remove: string[] = []
  const views = Object.values(state.views)
  const groups = new Map(views.filter((v) => isViewGroup(v, state.metamodel)).map((v) => [v.id, v]))
  const members = new Map<string, Set<string>>()
  const refolder: string[] = []
  const rename: string[] = []
  for (const v of views) {
    if (!v.partOf) continue
    const group = groups.get(v.partOf)
    const def = group && defs.get(group.viewpoint!)
    const node = v.subject ? state.c4Nodes[v.subject] : undefined
    // A member of no group, of another viewpoint, of an element gone,
    // external or of another type now, or a second one of the same element.
    const seen = members.get(v.partOf) ?? new Set<string>()
    if (!group || !def || v.viewpoint !== group.viewpoint || !node || node.external || !canBeSubject(def, node) || seen.has(node.id)) { remove.push(v.id); continue }
    seen.add(node.id)
    members.set(v.partOf, seen)
    if ((v.folder ?? '') !== (group.folder ?? '')) refolder.push(v.id)
    // Its name is its element's: nobody renames it by hand.
    if (v.name !== subjectViewName(node, def)) rename.push(v.id)
  }
  const unlist = views.filter((v) => (v.partOf ? !remove.includes(v.id) : groups.has(v.id)) && (v.nodeIds.length > 0 || v.empty)).map((v) => v.id)
  for (const group of groups.values()) {
    const def = defs.get(group.viewpoint!)!
    const has = members.get(group.id) ?? new Set<string>()
    for (const node of Object.values(state.c4Nodes)) {
      if (!node.external && canBeSubject(def, node) && !has.has(node.id)) add.push({ groupId: group.id, subjectId: node.id })
    }
  }
  return { add, remove, refolder, unlist, rename }
}

/** Brings every group of views of one element in step with the model: a
 *  view of each element it should hold (ids from `newId`), none of those it
 *  should not, each in the group's folder. Whether it changed anything. */
export function syncViewGroups(state: ModelState, newId: () => string): boolean {
  const { add, remove, refolder, unlist, rename } = planViewGroups(state)
  for (const id of remove) delete state.views[id]
  for (const id of rename) {
    const view = state.views[id]
    const def = viewpointsOf(state.metamodel).find((t) => t.id === view.viewpoint)!
    view.name = subjectViewName(state.c4Nodes[view.subject!], def)
  }
  for (const id of unlist) {
    state.views[id].nodeIds = []
    delete state.views[id].empty
  }
  for (const { groupId, subjectId } of add) {
    const group = state.views[groupId]
    const def = viewpointsOf(state.metamodel).find((t) => t.id === group.viewpoint)!
    const id = newId()
    insertView(state, id, subjectViewName(state.c4Nodes[subjectId], def))
    applyViewpoint(state, id, def.id, subjectId)
    state.views[id].partOf = groupId
    // A view of one element shows what lies inside it, folded on the model or not.
    state.views[id].expandedNodeIds = [subjectId]
    refolder.push(id)
  }
  for (const id of refolder) {
    const view = state.views[id]
    const folder = view.partOf ? state.views[view.partOf]?.folder : undefined
    if (folder) view.folder = folder
    else delete view.folder
  }
  // Leaves a view of the group only when it was the one shown: Studio's
  // exploration is shown and is none of `views`.
  if (state.activeViewId && remove.includes(state.activeViewId)) state.activeViewId = null
  return add.length > 0 || remove.length > 0 || refolder.length > 0 || unlist.length > 0 || rename.length > 0
}

/** The view keeps its kind and chain for itself, of no viewpoint (and of no
 *  element: a view of one element keeps the chain kept to it). */
export function detachViewpoint(state: ModelState, viewId: string): void {
  const view = state.views[viewId]
  if (!view) return
  delete view.viewpoint
  delete view.subject
}

/** Brings every view of a viewpoint in step with the viewpoint as the
 *  metamodel has it now; a view of a viewpoint the metamodel no longer has keeps
 *  its kind and chain, of no viewpoint. The ids of the views it changed. */
export function syncViewpoints(state: ModelState): string[] {
  const types = viewpointsOf(state.metamodel)
  const changed: string[] = []
  for (const view of Object.values(state.views)) {
    if (!view.viewpoint) continue
    const type = types.find((t) => t.id === view.viewpoint)
    if (!type) {
      delete view.viewpoint
      changed.push(view.id)
    } else {
      const subject = view.subject && canBeSubject(type, state.c4Nodes?.[view.subject]) ? view.subject : undefined
      if ((view.kind ?? 'static') !== type.kind || subject !== view.subject || !sameChain(view.pipeline, scopedChain(type, subject))) {
        applyViewpoint(state, view.id, type.id)
        changed.push(view.id)
      }
    }
  }
  return changed
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

/** How a wiki view writes its pages: Single or Multi page, and how many
 *  levels Multi page writes out as chapters (kept within the view's range). */
export function setWikiPages(state: ModelState, viewId: string, mode: 'single' | 'multi', depth: number): void {
  const view = state.views[viewId]
  if (!view) return
  view.wikiPageMode = mode
  view.wikiDepth = wikiDepthOf({ wikiDepth: depth })
}

export { normalizeViewFolder }

/** Puts a view into a folder of the list of views, or at the top for none. */
export function setViewFolder(state: ModelState, viewId: string, folder: string | null): void {
  const view = state.views[viewId]
  if (!view) return
  const path = normalizeViewFolder(folder)
  if (path) view.folder = path
  else delete view.folder
}

/** Renames a folder of the list of views (its last segment): every view in
 *  it or in a folder below it moves along. Returns the new path, or null
 *  for an empty name, a name with "/" or a folder no view is in. */
export function renameViewFolder(state: ModelState, path: string, name: string): string | null {
  const views = Object.values(state.views)
  const to = viewFolderRenameTarget(views, path, name)
  if (to === null) return null
  const from = normalizeViewFolder(path)
  for (const view of views) {
    if (isInViewFolder(view, from)) view.folder = to + normalizeViewFolder(view.folder).slice(from.length)
  }
  return to
}

/** How a view draws relations; null: the model's default. */
export function setViewEdgeStyle(state: ModelState, viewId: string, style: EdgeStyle | null): void {
  const view = state.views[viewId]
  if (!view) return
  if (style) view.edgeStyle = style
  else delete view.edgeStyle
}

/** A view's pipeline (viewPipeline.ts); one with no step is removed. */
export function setViewPipeline(state: ModelState, viewId: string, raw: ViewPipeline): void {
  const view = state.views[viewId]
  if (!view) return
  const pipeline = readPipeline(raw) ?? {}
  const next: ViewPipeline = {}
  if (pipeline.levels?.length) {
    next.levels = pipeline.levels.map((level, i) => {
      const out: ChainLevel = {
        ways: level.ways.map((way) => {
          const w: ChainWay = {}
          // The first level is the roots: nothing above to hang under.
          if (i > 0 && way.via) w.via = way.via
          if (way.types?.length) w.types = way.types
          return w
        }),
      }
      if (level.filters?.length) {
        // A level's first filter has nothing before it to be joined to.
        const [first, ...rest] = level.filters
        const head = { ...first }
        delete head.join
        out.filters = [head, ...rest]
      }
      return out
    })
  }
  // Any order counts, by name too.
  if (pipeline.sort) next.sort = pipeline.sort
  if (pipeline.edges === 'all') next.edges = 'all'
  if (Object.keys(next).length) view.pipeline = next
  else delete view.pipeline
  // A chain of its own: the view is of no viewpoint any more.
  delete view.viewpoint
  delete view.subject
}

/** How All elements and the views without their own draw relations. */
export function setDefaultEdgeStyle(state: ModelState, style: EdgeStyle): void {
  if (style === 'curved') delete state.defaultEdgeStyle
  else state.defaultEdgeStyle = style
}

/** How the canvas `viewId` (null: All elements) draws relations. */
export function edgeStyleOf(state: Pick<ModelState, 'views' | 'defaultEdgeStyle'>, viewId: string | null): EdgeStyle {
  return (viewId ? state.views[viewId]?.edgeStyle : undefined) ?? state.defaultEdgeStyle ?? 'curved'
}

/** Orders the listed views: they take, in the order given, the places in
 *  the list of views that they held; the other views keep theirs. A folder
 *  stands where its first view does, so this orders folders too. */
export function orderViews(state: ModelState, viewIds: string[]): void {
  const listed = [...new Set(viewIds)].filter((id) => id in state.views)
  const chosen = new Set(listed)
  let next = 0
  const ordered = Object.values(state.views).map((view) => (chosen.has(view.id) ? state.views[listed[next++]] : view))
  state.views = Object.fromEntries(ordered.map((view) => [view.id, view]))
}

/** Moves a folder of the list of views one place up (-1) or down (1) among
 *  the folders beside it, by moving its views in the model's order of
 *  views. Returns false when there is no folder there to swap with. */
export function moveViewFolder(state: ModelState, path: string, direction: -1 | 1): boolean {
  const from = normalizeViewFolder(path)
  if (!from) return false
  const views = Object.values(state.views)
  const cut = from.lastIndexOf('/')
  const parentPath = cut < 0 ? '' : from.slice(0, cut)
  let parent: ViewFolder | undefined = viewFolderTree(views)
  for (const part of parentPath ? parentPath.split('/') : []) parent = parent?.folders.find((f) => f.name === part)
  const siblings = parent?.folders ?? []
  const index = siblings.findIndex((f) => f.path === from)
  const other = siblings[index + direction]
  if (index < 0 || !other) return false
  const [first, second] = direction < 0 ? [from, other.path] : [other.path, from]
  const block = (p: string) => views.filter((view) => isInViewFolder(view, p))
  const moved = [...block(first), ...block(second)]
  // Both blocks go, swapped, where the earlier of them stood.
  const ordered: DiagramView[] = []
  let placed = false
  for (const view of views) {
    if (!isInViewFolder(view, first) && !isInViewFolder(view, second)) ordered.push(view)
    else if (!placed) { ordered.push(...moved); placed = true }
  }
  state.views = Object.fromEntries(ordered.map((view) => [view.id, view]))
  return true
}

/** Shows elements folded (`collapsed`) or open in one view only, over the
 *  element's model-level fold, as a collapse or expand on that view's canvas
 *  records it. */
export function setViewCollapsed(state: ModelState, viewId: string, nodeIds: string[], collapsed: boolean): void {
  const view = state.views[viewId]
  if (!view) return
  const folded = new Set(view.collapsedNodeIds ?? [])
  const opened = new Set(view.expandedNodeIds ?? [])
  for (const id of nodeIds) {
    const node = state.c4Nodes[id]
    if (!node) continue
    if (collapsed) { folded.add(id); opened.delete(id) }
    else {
      folded.delete(id)
      if (node.collapsed) opened.add(id); else opened.delete(id)
    }
  }
  view.collapsedNodeIds = [...folded]
  view.expandedNodeIds = [...opened]
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
  /** The step runs from the relation's target to its source (a response). */
  backward?: boolean
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
  const backward = trimStepBackward(steps.map((step) => step.backward === true))
  if (backward) sequence.stepBackward = backward
  else delete sequence.stepBackward
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

/** A field's value as a comparison sees it: an empty text, an unticked box
 *  and an empty list are no value, as an absent field is. The folder writes
 *  none of them (serializeToMdFolder), so a change undone by hand is no change in
 *  Studio, in `radical diff` and in get_changes alike. A property with a
 *  default has it written on the element (materializeDefaults), so absent
 *  is its unset value too. */
export function modelValue(value: unknown): unknown {
  if (value === undefined || value === '' || value === false) return null
  if (Array.isArray(value) && !value.length) return null
  return value
}

/** Whether two values of a field are the same to a comparison (modelValue). */
export const sameModelValue = (a: unknown, b: unknown): boolean => JSON.stringify(modelValue(a)) === JSON.stringify(modelValue(b))

const sameValue = sameModelValue

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
