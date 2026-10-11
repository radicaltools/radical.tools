// ─── Metamodel → graph ─────────────────────────────────────────────────────
//
// Turns a Metamodel into something drawable: one box per node type, grouped
// in a frame per category (C4, Governance, Requirements, … — the Elements
// palette's sections), one "contains" edge per allowed parent and one edge
// per relation type between two node types. Kept free of React so the shape
// rules and the layout can be tested headless.
//
// Every edge runs between the two node types it connects. Readability rules:
//   • A pair allowed in both directions (A→B and B→A) of one relation type is
//     a single two-headed edge, not two parallel ones.
//   • A pair from a type to itself (ADR supersedes ADR, Group inside Group)
//     is not a loop but a chip on the type's box.
//   • When the filter hides some edges, only the types those edges connect
//     are drawn (and laid out) — the picture is about the chosen relations.
//   • With only containment hidden, a type no relation type of the metamodel
//     reaches still shows where it may be placed (Blueprint inside Domain /
//     Group), so it does not float unconnected.
//   • Pairs naming a type that no longer exists are skipped — the Issues
//     panel reports the dangling metamodel, the diagram just stays drawable.

import type { C4Node, C4Relation } from '@radical/common/c4'
import {
  NODE_TYPE_CATEGORIES,
  nodeTypeCategory,
  type Metamodel,
  type NodeTypeDef,
  type RelationTypeDef,
} from '@radical/common/metamodel'
import { runSmartLayoutCore, type SmartLayoutResult } from '@radical/layout/smartLayout'
import { allocatePorts } from '@radical/layout/portAllocator'
import { computeRoutedEdge, type RoutingObstacle } from '@radical/layout/edgeRouting'
import type { Position as Side } from '@radical/layout/side'

export const CONTAINS_EDGE = 'contains'
/** Category frames are layout nodes too; the prefix keeps them apart from type ids. */
export const CATEGORY_ID_PREFIX = 'category:'

export interface MetamodelGraphNode {
  id: string
  def: NodeTypeDef
  /** Category frame id (`CATEGORY_ID_PREFIX` + category id). */
  category: string
  /** The type may be nested inside another node of the same type. */
  nestsInSelf: boolean
  /** Relation types allowed from this type to itself. */
  selfRelations: { id: string; label: string; color: string }[]
  width: number
  height: number
}

export interface MetamodelGraphCategory {
  id: string
  label: string
  /** Node type ids, in metamodel order. */
  members: string[]
}

export interface MetamodelGraphEdge {
  id: string
  /** `'contains'` for containment, otherwise the relation type id. */
  type: string
  /** For containment: the parent. For relations: the source type. */
  source: string
  target: string
  /** Relation allowed both ways between source and target. */
  bidirectional: boolean
  label: string
  color: string
}

export interface MetamodelGraph {
  nodes: MetamodelGraphNode[]
  /** Non-empty categories, in palette order (custom types last). */
  categories: MetamodelGraphCategory[]
  edges: MetamodelGraphEdge[]
  /** Relation types with an empty `allowedPairs` — allowed between any two
   *  types, so they have no edges to draw. */
  anyPairRelations: RelationTypeDef[]
}

export interface MetamodelGraphFilter {
  showContainment: boolean
  /** List each type's properties on its box (taller boxes, longer layout). */
  showProperties: boolean
  /** Relation type ids whose edges are left out. */
  hiddenRelations: ReadonlySet<string>
}

// ── Box geometry (shared with the node renderer so layout sizes match) ─────

export const NODE_WIDTH = 220
export const NODE_HEADER_HEIGHT = 40
export const NODE_ROW_HEIGHT = 18
export const NODE_CHIPS_HEIGHT = 26
export const NODE_PADDING_Y = 8
/** Properties shown on the box before collapsing the rest into "+N more". */
export const MAX_VISIBLE_PROPERTIES = 6
/** Room around a category's types inside its frame (top holds the title). */
export const CATEGORY_PADDING = { top: 36, side: 20, bottom: 20 }

export function visiblePropertyRows(def: NodeTypeDef): number {
  const n = def.properties?.length ?? 0
  if (n === 0) return 1 // "no properties" placeholder row
  return n > MAX_VISIBLE_PROPERTIES ? MAX_VISIBLE_PROPERTIES + 1 : n
}

function nodeHeight(def: NodeTypeDef, hasChips: boolean, showProperties: boolean): number {
  return (
    NODE_HEADER_HEIGHT +
    (showProperties ? NODE_PADDING_Y * 2 + visiblePropertyRows(def) * NODE_ROW_HEIGHT : 0) +
    (hasChips ? NODE_CHIPS_HEIGHT : 0)
  )
}

// ── Colours ────────────────────────────────────────────────────────────────

export const CONTAINS_COLOR = '#94a3b8'

const RELATION_PALETTE = [
  '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899',
  '#84cc16', '#f97316', '#14b8a6', '#a855f7', '#eab308', '#6366f1', '#22c55e',
]

/** A relation type's own `color`, else a stable palette slot by its position
 *  in the metamodel. */
export function relationColor(metamodel: Metamodel, relationId: string): string {
  const def = metamodel.relationTypes[relationId]
  if (def?.color) return def.color
  const idx = Object.keys(metamodel.relationTypes).indexOf(relationId)
  return RELATION_PALETTE[(idx < 0 ? 0 : idx) % RELATION_PALETTE.length]
}

// ── Graph ──────────────────────────────────────────────────────────────────

export function buildMetamodelGraph(
  metamodel: Metamodel,
  filter: MetamodelGraphFilter = { showContainment: true, showProperties: true, hiddenRelations: new Set() },
): MetamodelGraph {
  const types = metamodel.nodeTypes
  const edges: MetamodelGraphEdge[] = []
  const selfRelations = new Map<string, MetamodelGraphNode['selfRelations']>()
  const anyPairRelations: RelationTypeDef[] = []

  // Containment: parent → child.
  const containmentOf = (child: NodeTypeDef): MetamodelGraphEdge[] =>
    [...new Set(child.allowedParents ?? [])]
      .filter((parent) => parent !== child.id && types[parent])
      .map((parent) => ({
        id: `${CONTAINS_EDGE}:${parent}>${child.id}`,
        type: CONTAINS_EDGE,
        source: parent,
        target: child.id,
        bidirectional: false,
        label: 'contains',
        color: CONTAINS_COLOR,
      }))
  if (filter.showContainment) for (const child of Object.values(types)) edges.push(...containmentOf(child))

  for (const rel of Object.values(metamodel.relationTypes)) {
    if (rel.allowedPairs.length === 0) {
      anyPairRelations.push(rel)
      continue
    }
    if (filter.hiddenRelations.has(rel.id)) continue
    const color = relationColor(metamodel, rel.id)
    const byKey = new Map<string, MetamodelGraphEdge>()
    for (const { from, to } of rel.allowedPairs) {
      if (!types[from] || !types[to]) continue
      if (from === to) {
        const list = selfRelations.get(from) ?? []
        if (!list.some((r) => r.id === rel.id)) list.push({ id: rel.id, label: rel.label, color })
        selfRelations.set(from, list)
        continue
      }
      const key = from < to ? `${from}|${to}` : `${to}|${from}`
      const existing = byKey.get(key)
      if (existing) {
        if (existing.source !== from) existing.bidirectional = true
        continue
      }
      const edge: MetamodelGraphEdge = {
        id: `${rel.id}:${from}>${to}`,
        type: rel.id,
        source: from,
        target: to,
        bidirectional: false,
        label: rel.label,
        color,
      }
      byKey.set(key, edge)
      edges.push(edge)
    }
  }

  const drawable = Object.values(metamodel.relationTypes).filter((r) => r.allowedPairs.length > 0)
  const allRelationsShown = drawable.every((r) => !filter.hiddenRelations.has(r.id))
  if (!filter.showContainment && allRelationsShown && drawable.length > 0) {
    const related = new Set(
      Object.values(metamodel.relationTypes).flatMap((r) => r.allowedPairs.flatMap((p) => [p.from, p.to])),
    )
    for (const def of Object.values(types)) if (!related.has(def.id)) edges.push(...containmentOf(def))
  }

  // A narrowed filter keeps only the types its edges (or self-relation chips)
  // connect. With nothing shown at all every type stays, so the canvas is
  // never empty.
  const narrowed = !filter.showContainment || !allRelationsShown
  const shown = new Set(edges.flatMap((e) => [e.source, e.target]))
  for (const id of selfRelations.keys()) shown.add(id)
  if (filter.showContainment)
    for (const def of Object.values(types)) if (def.allowedParents?.includes(def.id)) shown.add(def.id)
  const keep = (id: string): boolean => !narrowed || shown.size === 0 || shown.has(id)

  const nodes = Object.values(types).filter((def) => keep(def.id)).map((def): MetamodelGraphNode => {
    // The "nests" chip is containment too, so it follows the Contains filter.
    const nestsInSelf = filter.showContainment && (def.allowedParents?.includes(def.id) ?? false)
    const selfRels = selfRelations.get(def.id) ?? []
    return {
      id: def.id,
      def,
      category: CATEGORY_ID_PREFIX + nodeTypeCategory(def.id).id,
      nestsInSelf,
      selfRelations: selfRels,
      width: NODE_WIDTH,
      height: nodeHeight(def, nestsInSelf || selfRels.length > 0, filter.showProperties),
    }
  })

  const rank = (catId: string): number => {
    const i = NODE_TYPE_CATEGORIES.findIndex((c) => CATEGORY_ID_PREFIX + c.id === catId)
    return i < 0 ? NODE_TYPE_CATEGORIES.length : i
  }
  const byCategory = new Map<string, MetamodelGraphCategory>()
  for (const n of nodes) {
    const cat = byCategory.get(n.category) ?? { id: n.category, label: nodeTypeCategory(n.id).label, members: [] }
    cat.members.push(n.id)
    byCategory.set(n.category, cat)
  }
  const categories = [...byCategory.values()].sort((a, b) => rank(a.id) - rank(b.id))

  return { nodes, categories, edges, anyPairRelations }
}

// ── Layout ─────────────────────────────────────────────────────────────────
//
// Placement is Smart Layout's, the same ensemble the model canvas uses: each
// category is a group node, each type a leaf inside it, each edge a relation.
// Edges are then routed like the canvas routes them (port allocation per side
// + obstacle-avoiding routing), so the two pictures read the same way.

export interface Point {
  x: number
  y: number
}

export interface Rect extends Point {
  width: number
  height: number
}

export interface EdgeEnd extends Point {
  side: Side
}

export interface EdgeRoute {
  path: string
  source: EdgeEnd
  target: EdgeEnd
  label: Point
}

export interface MetamodelLayout {
  /** Absolute top-left corner per node type id. */
  positions: Record<string, Point>
  /** Absolute frame per category id. */
  frames: Record<string, Rect>
  routes: Record<string, EdgeRoute>
}

/** Runs Smart Layout; Studio passes its Web Worker runner, tests the core. */
export type SmartLayoutRun = (
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
) => Promise<SmartLayoutResult>

export function smartLayoutInput(graph: MetamodelGraph): {
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
} {
  const nodes: Record<string, C4Node> = {}
  for (const c of graph.categories)
    nodes[c.id] = { id: c.id, type: 'group', label: c.label, collapsed: false, x: 0, y: 0, width: NODE_WIDTH, height: NODE_HEADER_HEIGHT }
  // 'component' is a leaf type: Smart Layout keeps the given size instead of
  // treating the box as a (collapsible) container.
  for (const n of graph.nodes)
    nodes[n.id] = {
      id: n.id,
      type: 'component',
      label: n.def.label,
      parentId: n.category,
      collapsed: false,
      x: 0,
      y: 0,
      width: n.width,
      height: n.height,
    }
  const relations: Record<string, C4Relation> = {}
  for (const e of graph.edges) relations[e.id] = { id: e.id, sourceId: e.source, targetId: e.target, relationType: e.type }
  return { nodes, relations }
}

/** The layout model: a group node per category (absolute position) with
 *  the type nodes inside it (positions relative to their group) — the shape
 *  both Smart Layout and the live physics read and write. */
export interface MetamodelLayoutModel {
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
}

/** Fallback when Smart Layout returns nothing: categories side by side, types stacked. */
function stackModel(graph: MetamodelGraph, model: MetamodelLayoutModel): void {
  graph.categories.forEach((c, i) => {
    Object.assign(model.nodes[c.id], { x: i * (NODE_WIDTH + 2 * CATEGORY_PADDING.side + 60), y: 0 })
    let y = CATEGORY_PADDING.top
    for (const id of c.members) {
      Object.assign(model.nodes[id], { x: CATEGORY_PADDING.side, y })
      y += model.nodes[id].height + 24
    }
  })
}

/** Absolute top-left of every type box in the model. */
export function absolutePositions(graph: MetamodelGraph, model: MetamodelLayoutModel): Record<string, Point> {
  const out: Record<string, Point> = {}
  for (const n of graph.nodes) {
    const node = model.nodes[n.id]
    const group = model.nodes[n.category]
    out[n.id] = { x: (group?.x ?? 0) + node.x, y: (group?.y ?? 0) + node.y }
  }
  return out
}

/** Each category's frame: its types' bounding box plus CATEGORY_PADDING. */
function categoryFrames(graph: MetamodelGraph, positions: Record<string, Point>): Record<string, Rect> {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const frames: Record<string, Rect> = {}
  for (const c of graph.categories) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const id of c.members) {
      const p = positions[id]
      const n = byId.get(id)!
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x + n.width)
      maxY = Math.max(maxY, p.y + n.height)
    }
    frames[c.id] = {
      x: minX - CATEGORY_PADDING.side,
      y: minY - CATEGORY_PADDING.top,
      width: maxX - minX + 2 * CATEGORY_PADDING.side,
      height: maxY - minY + CATEGORY_PADDING.top + CATEGORY_PADDING.bottom,
    }
  }
  return frames
}

export function routeMetamodelEdges(graph: MetamodelGraph, positions: Record<string, Point>): Record<string, EdgeRoute> {
  const views = new Map(
    graph.nodes.map((n) => [n.id, { id: n.id, positionAbsolute: positions[n.id] ?? { x: 0, y: 0 }, width: n.width, height: n.height }]),
  )
  const ports = allocatePorts(views, graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })))
  const routes: Record<string, EdgeRoute> = {}
  for (const e of graph.edges) {
    const a = ports.get(e.id)
    if (!a) continue
    // Only type boxes are obstacles; edges cross category frames freely.
    const obstacles: RoutingObstacle[] = []
    for (const v of views.values()) {
      if (v.id === e.source || v.id === e.target) continue
      obstacles.push({ x: v.positionAbsolute.x, y: v.positionAbsolute.y, w: v.width, h: v.height })
    }
    const r = computeRoutedEdge(
      a.sourcePoint.x, a.sourcePoint.y, a.sourceSide,
      a.targetPoint.x, a.targetPoint.y, a.targetSide,
      obstacles,
    )
    routes[e.id] = {
      path: r.path,
      source: { ...a.sourcePoint, side: a.sourceSide },
      target: { ...a.targetPoint, side: a.targetSide },
      label: { x: r.labelX, y: r.labelY },
    }
  }
  return routes
}

/** Runs Smart Layout and returns its result as a layout model. */
export async function smartLayoutModel(
  graph: MetamodelGraph,
  run: SmartLayoutRun = runSmartLayoutCore,
): Promise<MetamodelLayoutModel> {
  const model = smartLayoutInput(graph)
  const placed = (await run(model.nodes, model.relations)).winner.positions
  if (Object.keys(model.nodes).some((id) => !placed[id])) {
    stackModel(graph, model)
    return model
  }
  for (const [id, node] of Object.entries(model.nodes)) {
    const p = placed[id]
    node.x = p.x
    node.y = p.y
    // Group sizes come from Smart Layout; type boxes keep their own.
    if (node.parentId === undefined) {
      if (p.width) node.width = p.width
      if (p.height) node.height = p.height
    }
  }
  return model
}

/** What the diagram draws for a layout model. Frames are drawn tight around
 *  their types rather than at the group size (shrinking cannot make two
 *  frames overlap). */
export function layoutFromModel(graph: MetamodelGraph, model: MetamodelLayoutModel): MetamodelLayout {
  const positions = absolutePositions(graph, model)
  return { positions, frames: categoryFrames(graph, positions), routes: routeMetamodelEdges(graph, positions) }
}

/** Smart Layout's placement, without the live physics that follows it in Studio. */
export async function layoutMetamodelGraph(
  graph: MetamodelGraph,
  run: SmartLayoutRun = runSmartLayoutCore,
): Promise<MetamodelLayout> {
  return layoutFromModel(graph, await smartLayoutModel(graph, run))
}

// ── Adjacency (inspector + focus highlighting) ─────────────────────────────

export interface TypeNeighbourhood {
  parents: string[]
  children: string[]
  /** relation type id → target type ids */
  outgoing: Map<string, string[]>
  /** relation type id → source type ids */
  incoming: Map<string, string[]>
}

export function typeNeighbourhood(metamodel: Metamodel, typeId: string): TypeNeighbourhood {
  const def = metamodel.nodeTypes[typeId]
  const parents = (def?.allowedParents ?? []).filter((p) => metamodel.nodeTypes[p])
  const children = Object.values(metamodel.nodeTypes)
    .filter((t) => t.allowedParents?.includes(typeId))
    .map((t) => t.id)
  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, string[]>()
  const add = (m: Map<string, string[]>, k: string, v: string) => {
    const list = m.get(k) ?? []
    if (!list.includes(v)) list.push(v)
    m.set(k, list)
  }
  for (const rel of Object.values(metamodel.relationTypes)) {
    for (const { from, to } of rel.allowedPairs) {
      if (!metamodel.nodeTypes[from] || !metamodel.nodeTypes[to]) continue
      if (from === typeId) add(outgoing, rel.id, to)
      if (to === typeId) add(incoming, rel.id, from)
    }
  }
  return { parents, children, outgoing, incoming }
}
