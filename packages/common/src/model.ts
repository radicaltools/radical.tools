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

import type { C4Node, C4Relation, DiagramView } from './c4'
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
  }
  return removed
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

export function patchRelation(state: ModelState, id: string, updates: Partial<Omit<C4Relation, 'id'>>): void {
  const rel = state.c4Relations[id]
  if (rel) Object.assign(rel, updates)
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
