/**
 * ELK-based hierarchical layout.
 *
 * Uses the ELK "layered" algorithm (Sugiyama framework) which minimises
 * edge crossings via the LAYER_SWEEP barycenter heuristic.
 *
 * Key implementation detail:
 * ELK requires edges to be placed in the ElkNode that corresponds to the
 * Lowest Common Ancestor (LCA) of their source and target nodes.
 * Cross-hierarchy edges are placed at root.
 *
 * Reference: https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html
 */

import ELK from 'elkjs/lib/elk.bundled.js'
import type { ElkNode, ElkExtendedEdge, LayoutOptions } from 'elkjs'
import { C4Node, C4Relation, PositionMap, COLLAPSED_HEIGHT, COLLAPSED_WIDTH, isContainerType } from '@radical/common/c4'
import { ELK_ROOT_SPACING, ELK_CHILD_SPACING } from './elkSpacingBase'
import { projectToVisibleGraph } from './geometry'

const elk = new ELK()

// ─── ELK layout options ──────────────────────────────────────────────────────
//
// Spacing numbers live in elkSpacingBase.ts, shared with smartLayout.ts's
// ensemble candidates so tuning one propagates to the other instead of
// silently drifting apart.

const LAYERED_OPTIONS: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',

  // SEPARATE_CHILDREN (default): each compound node is laid out independently.
  // Cross-boundary crossing minimisation is handled by our geometric post-process
  // (minimizeCrossings in crossingOpt.ts) — safer than INCLUDE_CHILDREN which
  // crashes ELK's internal scanline constraint calculator with compound graphs.

  // ── Connected-component placement ────────────────────────────────────────
  'elk.separateConnectedComponents': 'true',

  // ── Crossing minimisation ─────────────────────────────────────────────────
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.crossingMinimization.greedySwitch.type': 'TWO_SIDED',
  'elk.layered.thoroughness': '50',
  'elk.layered.considerModelOrder.strategy': 'NONE',

  // ── Node placement ────────────────────────────────────────────────────────
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',

  // ── Spacing ───────────────────────────────────────────────────────────────
  ...ELK_ROOT_SPACING,

  // ── Post-layout ──────────────────────────────────────────────────────────
  'elk.layered.unnecessaryBendpoints': 'true',
  'elk.layered.compaction.postCompaction.strategy': 'EDGE_LENGTH',
  'elk.padding': '[top=120, right=30, bottom=30, left=30]',
}

// Layout options for compound nodes (systems containing containers, or
// containers containing components).  RIGHT direction: children are laid
// out left-to-right in the layered algorithm.
const CHILD_OPTIONS: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.separateConnectedComponents': 'true',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.crossingMinimization.greedySwitch.type': 'TWO_SIDED',
  'elk.layered.thoroughness': '50',
  'elk.layered.considerModelOrder.strategy': 'NONE',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  ...ELK_CHILD_SPACING,
  'elk.layered.unnecessaryBendpoints': 'true',
  'elk.layered.compaction.postCompaction.strategy': 'EDGE_LENGTH',
  'elk.padding': '[top=110, right=20, bottom=20, left=20]',
}

// ─── Ancestor helpers ─────────────────────────────────────────────────────────

function ancestorChain(nodeId: string, nodes: Record<string, C4Node>): string[] {
  const chain: string[] = [nodeId]
  let cur = nodes[nodeId]
  while (cur?.parentId) {
    chain.push(cur.parentId)
    cur = nodes[cur.parentId]
  }
  return chain
}

function lcaContainerId(
  srcId: string,
  tgtId: string,
  nodes: Record<string, C4Node>
): string | undefined {
  if (srcId === tgtId) return nodes[srcId]?.parentId
  const srcSet = new Set(ancestorChain(srcId, nodes))
  for (const id of ancestorChain(tgtId, nodes)) {
    if (srcSet.has(id) && id !== srcId && id !== tgtId) return id
  }
  return undefined
}

// ─── Build ELK graph ─────────────────────────────────────────────────────────

type ElkNodeMap = Record<string, ElkNode>

function buildElkNode(
  n: C4Node,
  allNodes: Record<string, C4Node>,
  elkNodeMap: ElkNodeMap
): ElkNode {
  const isCollapsed = n.collapsed && isContainerType(n.type)
  const width  = isCollapsed ? COLLAPSED_WIDTH[n.type]  : n.width
  const height = isCollapsed ? COLLAPSED_HEIGHT[n.type] : n.height
  const childC4 = isCollapsed ? [] : Object.values(allNodes).filter((c) => c.parentId === n.id)
  const children = childC4.map((c) => buildElkNode(c, allNodes, elkNodeMap))

  const elkNode: ElkNode = {
    id: n.id,
    width,
    height,
    layoutOptions: children.length > 0 ? CHILD_OPTIONS : undefined,
    children,
    edges: [],
  }
  elkNodeMap[n.id] = elkNode
  return elkNode
}

// ─── Parse ELK result ────────────────────────────────────────────────────────

function parseElkResult(node: ElkNode, result: PositionMap): void {
  if (node.id !== 'root' && node.x != null && node.y != null) {
    result[node.id] = { x: node.x, y: node.y, width: node.width, height: node.height }
  }
  for (const child of node.children ?? []) {
    parseElkResult(child, result)
  }
}

// ─── Packed groups ──────────────────────────────────────────────────────────
//
// A group of many elements that are barely linked to each other (the
// requirements and scenarios of a domain, the ADRs of a decision log) laid
// out in layers comes out as long, sparse rows: in radical.tools' own model
// (890 elements) every domain did, and the whole diagram took twenty times
// the area of its elements. Packed as rectangles it takes four times; the
// children are ordered so that linked ones stand next to each other.

/** The proportions (width / height) a packed group aims for. */
const PACKED_ASPECT = 1.6

/** Children from which a sparsely linked group is packed rather than layered. */
const PACK_MIN_CHILDREN = 8
/** Links between its children, per child, up to which a group is sparse. */
const PACK_MAX_LINKS_PER_CHILD = 1

const PACKED_OPTIONS: LayoutOptions = {
  // Box layout, rows filled in the given order (rectpacking moved elements
  // between rows to fill them, which split the linked ones apart).
  'elk.algorithm': 'box',
  'elk.box.packingMode': 'SIMPLE',
  // One block in this order: split into connected components, ELK placed
  // the components and the lone elements apart, each sorted its own way.
  'elk.separateConnectedComponents': 'false',
  'elk.spacing.nodeNode': '40',
  'elk.padding': '[top=110, right=20, bottom=20, left=20]',
}

/** The links between the children of `group` (a relation between anything
 *  inside two different children links those two), by child. */
function childLinks(group: ElkNode, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): Map<string, string[]> {
  const childIds = new Set((group.children ?? []).map((c) => c.id))
  const childOf = (id: string): string | undefined => {
    for (let cur: string | undefined = id; cur && nodes[cur]; cur = nodes[cur].parentId) if (childIds.has(cur)) return cur
    return undefined
  }
  const links = new Map<string, string[]>()
  for (const r of Object.values(relations)) {
    const a = childOf(r.sourceId)
    const b = childOf(r.targetId)
    if (!a || !b || a === b) continue
    links.set(a, [...(links.get(a) ?? []), b])
    links.set(b, [...(links.get(b) ?? []), a])
  }
  return links
}

/** Children by name, each followed by what it is linked to (breadth
 *  first), so packing keeps linked children side by side in reading order. */
function linkedOrder(children: ElkNode[], links: Map<string, string[]>, nodes: Record<string, C4Node>): ElkNode[] {
  const name = (id: string) => (nodes[id]?.label ?? '').toLowerCase()
  const byName = (a: string, b: string) => name(a).localeCompare(name(b)) || (a < b ? -1 : a > b ? 1 : 0)
  children = [...children].sort((a, b) => byName(a.id, b.id))
  for (const list of links.values()) list.sort(byName)
  const byId = new Map(children.map((c) => [c.id, c]))
  const seen = new Set<string>()
  const order: ElkNode[] = []
  for (const start of children) {
    if (seen.has(start.id)) continue
    const queue = [start.id]
    seen.add(start.id)
    while (queue.length) {
      const id = queue.shift()!
      order.push(byId.get(id)!)
      for (const next of links.get(id) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next) }
    }
  }
  return order
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface ElkLayoutOptions {
  rootOptions?: LayoutOptions
  childOptions?: LayoutOptions
  /** Pack groups of many, sparsely linked children as rectangles instead of
   *  laying them out with `childOptions`. */
  packSparseGroups?: boolean
}

export async function applyElkLayout(
  inputNodes: Record<string, C4Node>,
  inputRelations: Record<string, C4Relation>,
  opts?: ElkLayoutOptions,
): Promise<PositionMap> {
  // ELK throws on edges whose endpoints aren't in its graph, which is what
  // an edge to a child of a collapsed container would be.
  const { nodes: c4Nodes, relations: c4Relations } = projectToVisibleGraph(inputNodes, inputRelations)
  const elkNodeMap: ElkNodeMap = {}
  const childOpts = opts?.childOptions ?? CHILD_OPTIONS

  const buildWith = (n: C4Node): ElkNode => {
    const built = buildElkNode(n, c4Nodes, elkNodeMap)
    // Override compound child options if caller supplied custom ones.
    const apply = (node: ElkNode): void => {
      if (node.children && node.children.length > 0) {
        node.layoutOptions = childOpts
        if (opts?.packSparseGroups && node.children.length >= PACK_MIN_CHILDREN) {
          const links = childLinks(node, c4Nodes, c4Relations)
          let count = 0
          for (const list of links.values()) count += list.length
          if (count / 2 <= node.children.length * PACK_MAX_LINKS_PER_CHILD) {
            // Box layout reads the aspect ratio in units of its elements'
            // shape: 200 x 80 elements need 4 for a block of about 1.6.
            const w = node.children.reduce((sum, c) => sum + (c.width ?? 0), 0)
            const h = node.children.reduce((sum, c) => sum + (c.height ?? 0), 0)
            node.layoutOptions = { ...PACKED_OPTIONS, 'elk.aspectRatio': String(PACKED_ASPECT * (h > 0 ? w / h : 1)) }
            node.children = linkedOrder(node.children, links, c4Nodes)
            // Box layout sorts by priority (highest first), not stably.
            const count = node.children.length
            node.children.forEach((c, i) => { c.layoutOptions = { ...c.layoutOptions, 'elk.priority': String(count - i) } })
          }
        }
        for (const c of node.children) apply(c)
      }
    }
    apply(built)
    return built
  }

  const rootChildren = Object.values(c4Nodes)
    .filter((n) => !n.parentId)
    .map(buildWith)

  const root: ElkNode = {
    id: 'root',
    layoutOptions: opts?.rootOptions ?? LAYERED_OPTIONS,
    children: rootChildren,
    edges: [],
  }
  elkNodeMap['root'] = root

  // Place each edge at its LCA container.
  // NOTE: ELK's SEPARATE_CHILDREN mode resolves deep-descendant edge endpoints
  // to direct children for layer-assignment purposes.  Using the raw component
  // ids (e.g. cmp8 inside sys1) is safe for ELK compound-edge routing; the
  // layer assignment at the root level is handled by crossingOpt post-process.
  for (const rel of Object.values(c4Relations)) {
    if (!c4Nodes[rel.sourceId] || !c4Nodes[rel.targetId]) continue
    const lca = lcaContainerId(rel.sourceId, rel.targetId, c4Nodes)
    const container: ElkNode = (lca ? elkNodeMap[lca] : root) ?? root
    const edge: ElkExtendedEdge = { id: rel.id, sources: [rel.sourceId], targets: [rel.targetId] }
    if (!container.edges) container.edges = []
    container.edges.push(edge)
  }

  try {
    const result = await elk.layout(root)
    const positions: PositionMap = {}
    parseElkResult(result, positions)
    return positions
  } catch (err) {
    console.error('[ELK] Layout error:', err)
    return {}
  }
}

// ─── Hierarchical nested-tree layout ────────────────────────────────────────
//
// Top-down layered layout applied at every nesting level (root + every
// compound container). Designed for views dominated by domain objects where
// containment hierarchy is the dominant visual structure: each parent stacks
// its children vertically into clear "rows", producing a nested-tree feel.
//
// We deliberately stay on ELK's "layered" algorithm (not "mrtree") because
// real diagrams almost always contain cross-references between siblings,
// which break mrtree's strict tree assumption and yield poor placements.
// Layered handles arbitrary DAGs and falls back gracefully on cycles.

const TREE_ROOT_OPTIONS: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.separateConnectedComponents': 'true',
  'elk.spacing.componentComponent': '60',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.crossingMinimization.greedySwitch.type': 'TWO_SIDED',
  'elk.layered.thoroughness': '50',
  // Honour input order so siblings stay close to their declared grouping —
  // the dominant cue users associate with "tree" layouts.
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
  'elk.spacing.nodeNode': '50',
  'elk.layered.spacing.nodeNodeBetweenLayers': '70',
  'elk.spacing.edgeNode': '20',
  'elk.spacing.edgeEdge': '10',
  'elk.layered.compaction.postCompaction.strategy': 'LEFT',
  'elk.layered.unnecessaryBendpoints': 'true',
  'elk.padding': '[top=120, right=30, bottom=30, left=30]',
}

const TREE_CHILD_OPTIONS: LayoutOptions = {
  // Children of every compound container also flow top-down — this is what
  // produces the visible "nested tree" look (vs. the default ELK config
  // where compound children flow left-to-right).
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.separateConnectedComponents': 'true',
  'elk.spacing.componentComponent': '30',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.crossingMinimization.greedySwitch.type': 'TWO_SIDED',
  'elk.layered.thoroughness': '50',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
  'elk.spacing.nodeNode': '28',
  'elk.layered.spacing.nodeNodeBetweenLayers': '40',
  'elk.spacing.edgeNode': '12',
  'elk.spacing.edgeEdge': '8',
  'elk.layered.compaction.postCompaction.strategy': 'LEFT',
  'elk.layered.unnecessaryBendpoints': 'true',
  'elk.padding': '[top=110, right=20, bottom=20, left=20]',
}

export async function applyTreeLayout(
  c4Nodes: Record<string, C4Node>,
  c4Relations: Record<string, C4Relation>,
): Promise<PositionMap> {
  return applyElkLayout(c4Nodes, c4Relations, {
    rootOptions: TREE_ROOT_OPTIONS,
    childOptions: TREE_CHILD_OPTIONS,
  })
}

// ─── Layers by distance (an exploration) ────────────────────────────────────
//
// Explore from here lays its view out top-down in layers by distance from
// the element it started from: the start on top, its neighbours a layer
// below, theirs below those. A layer of more elements than a row takes
// wraps into rows, closer together than the layers are. The rows are ELK
// partitions, so a relation's direction does not move an element up or
// down; a container is a frame across the rows of what it holds
// (INCLUDE_CHILDREN lays the nested graph out as one). Within a layer the
// elements keep the order given.

const LAYERS_OPTIONS: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.partitioning.activate': 'true',
  'elk.separateConnectedComponents': 'false',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
  'elk.spacing.edgeNode': '30',
  'elk.spacing.edgeEdge': '15',
}

export interface LayersInput {
  /** The elements drawn, each at the size it is drawn at, with its
   *  containers among them (they are laid out round what they hold). */
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  /** Each element's layer (0 on top); a container's is the least of what
   *  it holds and its own. */
  layerOf: (id: string) => number
  /** The order of the elements within a layer. */
  order: readonly string[]
  /** The room inside a container's frame round what it holds. */
  paddingOf: (n: C4Node) => { top: number; side: number; bottom: number }
  /** The least space between elements of a row, between the rows of a
   *  layer, and between layers (the room a relation's label needs). */
  gap: { inLayer: number; betweenRows: number; betweenLayers: number }
  /** The most elements in one row; a layer with more wraps (none: no limit). */
  maxPerRow?: number
}

/** The places of `input.nodes` in layers by distance; relative to their
 *  parents, with the containers' sizes. Empty when ELK fails. */
export async function applyLayersLayout(input: LayersInput): Promise<PositionMap> {
  const { nodes, relations, layerOf, order, paddingOf, gap } = input
  const rank = new Map(order.map((id, i) => [id, i]))
  const byOrder = (a: C4Node, b: C4Node): number => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity)
  const kids = new Map<string | undefined, C4Node[]>()
  for (const n of Object.values(nodes)) {
    const parent = n.parentId && nodes[n.parentId] ? n.parentId : undefined
    const list = kids.get(parent)
    if (list) list.push(n)
    else kids.set(parent, [n])
  }
  for (const list of kids.values()) list.sort(byOrder)

  // Rows: each layer's elements (not its frames) in order, `maxPerRow` to
  // a row. A row is an ELK partition; a frame is in the first row of what
  // it holds, or of its own layer when that is nearer.
  const layers = [...new Set(Object.values(nodes).map((n) => layerOf(n.id)))].sort((a, b) => a - b)
  const leaves = Object.values(nodes).filter((n) => !kids.get(n.id)?.length).sort(byOrder)
  const per = input.maxPerRow && input.maxPerRow > 0 ? input.maxPerRow : Infinity
  const partition = new Map<string, number>()
  /** Each partition's layer, by its index among the layers. */
  const layerIndexOf: number[] = []
  const firstRowOf = new Map<number, number>()
  for (const [index, layer] of layers.entries()) {
    const inLayer = leaves.filter((n) => layerOf(n.id) === layer)
    firstRowOf.set(layer, layerIndexOf.length)
    const rows = Math.max(1, Math.ceil(inLayer.length / per))
    inLayer.forEach((n, i) => partition.set(n.id, layerIndexOf.length + Math.floor(i / per)))
    for (let r = 0; r < rows; r++) layerIndexOf.push(index)
  }
  const span = new Map<string, { first: number; last: number }>()
  const spanOf = (n: C4Node): { first: number; last: number } => {
    const known = span.get(n.id)
    if (known) return known
    const own = firstRowOf.get(layerOf(n.id)) ?? 0
    let first = partition.get(n.id) ?? own
    let last = first
    for (const c of kids.get(n.id) ?? []) {
      const s = spanOf(c)
      first = Math.min(first, s.first)
      last = Math.max(last, s.last)
    }
    if (kids.get(n.id)?.length) first = Math.min(first, own)
    const out = { first, last }
    span.set(n.id, out)
    return out
  }

  const spacing: LayoutOptions = {
    'elk.spacing.nodeNode': String(gap.inLayer),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(gap.betweenLayers),
  }
  const build = (n: C4Node): ElkNode => {
    const children = (kids.get(n.id) ?? []).map(build)
    const pad = paddingOf(n)
    return {
      id: n.id,
      ...(children.length ? {} : { width: n.width, height: n.height }),
      layoutOptions: {
        'elk.partitioning.partition': String(spanOf(n).first),
        // A frame's graph keeps the same gaps: ELK reads them per graph.
        ...(children.length ? { 'elk.padding': `[top=${pad.top}, right=${pad.side}, bottom=${pad.bottom}, left=${pad.side}]`, ...spacing } : {}),
      },
      children,
    }
  }
  const inside = (a: string, b: string): boolean => {
    for (let p = nodes[b]?.parentId; p; p = nodes[p]?.parentId) if (p === a) return true
    return false
  }
  // Each relation from the nearer end to the farther: layers by distance,
  // not by the relation's direction. One within a row, or between a
  // container and what it holds, places nothing.
  const edges: ElkExtendedEdge[] = []
  for (const r of Object.values(relations)) {
    if (!nodes[r.sourceId] || !nodes[r.targetId] || r.sourceId === r.targetId) continue
    if (inside(r.sourceId, r.targetId) || inside(r.targetId, r.sourceId)) continue
    const a = spanOf(nodes[r.sourceId]).first
    const b = spanOf(nodes[r.targetId]).first
    if (a === b) continue
    edges.push({ id: r.id, sources: [a < b ? r.sourceId : r.targetId], targets: [a < b ? r.targetId : r.sourceId] })
  }
  const root: ElkNode = {
    id: 'root',
    layoutOptions: { ...LAYERS_OPTIONS, ...spacing },
    children: (kids.get(undefined) ?? []).map(build),
    edges,
  }
  let laid: PositionMap
  try {
    const result = await elk.layout(root)
    laid = {}
    parseElkResult(result, laid)
  } catch (err) {
    console.error('[ELK] Layers layout error:', err)
    return {}
  }

  // The rows of a layer stand `betweenRows` apart, layers `betweenLayers`:
  // ELK keeps one gap between partitions, so each row after the first of
  // its layer moves up by the difference, with what lies below it, and a
  // frame shrinks by as much as what it holds moved more than its top.
  const less = Math.max(0, gap.betweenLayers - gap.betweenRows)
  const wrapped: number[] = []
  for (let row = 0, count = 0; row < layerIndexOf.length; row++) {
    if (row > 0 && layerIndexOf[row] === layerIndexOf[row - 1]) count++
    wrapped.push(count)
  }
  if (less === 0 || !wrapped.some(Boolean)) return laid
  const shift = (row: number): number => -less * (wrapped[row] ?? wrapped[wrapped.length - 1] ?? 0)
  const absY = new Map<string, number>()
  const absOf = (id: string): number => {
    const known = absY.get(id)
    if (known !== undefined) return known
    const parent = nodes[id]?.parentId
    const y = (laid[id]?.y ?? 0) + (parent && nodes[parent] ? absOf(parent) : 0)
    absY.set(id, y)
    return y
  }
  const moved = new Map<string, { top: number; height: number }>()
  for (const id of Object.keys(laid)) {
    const n = nodes[id]
    if (!n) continue
    const s = spanOf(n)
    const top = absOf(id) + shift(s.first)
    const height = (laid[id].height ?? n.height) + shift(s.last) - shift(s.first)
    moved.set(id, { top, height })
  }
  const out: PositionMap = {}
  for (const [id, at] of Object.entries(laid)) {
    const m = moved.get(id)
    if (!m) { out[id] = at; continue }
    const parent = nodes[id].parentId
    const parentTop = parent && moved.get(parent) ? moved.get(parent)!.top : 0
    out[id] = { ...at, y: m.top - parentTop, height: kids.get(id)?.length ? m.height : at.height }
  }
  return out
}
