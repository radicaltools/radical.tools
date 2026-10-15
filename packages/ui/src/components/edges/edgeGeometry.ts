import type { ReactFlowState } from 'reactflow'
import type { C4EdgeRFData, EdgeStyle } from '@radical/common/c4'
import { computeRoutedEdge, directCurveBox, ObstacleGrid, orthogonalRoute, separateParallelSegments, type ObstacleSet, type Pt, type RoutedEdge, type RoutingObstacle } from '@radical/layout/edgeRouting'
import { placeEdgeLabels, relationLabelSize, RELATION_LABEL_BOX, type LabelEdge, type LabelObstacle } from '@radical/layout/edgeLabels'
import { allocatePorts } from '@radical/layout/portAllocator'
import type { Position } from '@radical/layout/side'

// ─── Shared per frame ────────────────────────────────────────────────────────
// Every edge re-renders when the live layout moves its ends, i.e. every
// frame. Ports, routes and label spots depend on the whole graph, not on the
// edge, so they are computed once per React Flow state and read by all
// edges (they used to be recomputed by each edge: quadratic per frame).

type NodeInternals = ReactFlowState['nodeInternals']
type RFEdges = ReactFlowState['edges']

/** The relation label box; RelationEdge draws it with these numbers. */
export const LABEL_BOX = RELATION_LABEL_BOX

/**
 * How much of the relation labels a zoom shows. The label text is 17px and
 * the technology 14px: below these zooms they are too small to read and
 * only cover the diagram, so the technology goes first, then the whole
 * label. Canvas puts the level on its container as data-edge-labels.
 */
export type EdgeLabelDetail = 'full' | 'name' | 'none'
const TECH_HIDDEN_BELOW = 0.5
const LABEL_HIDDEN_BELOW = 0.3

export function edgeLabelDetail(zoom: number): EdgeLabelDetail {
  return zoom < LABEL_HIDDEN_BELOW ? 'none' : zoom < TECH_HIDDEN_BELOW ? 'name' : 'full'
}

/** Whether the zoom shows relation labels at all. Below it they are not
 *  placed either: placing the labels of a large canvas takes the better
 *  part of a second, and a whole large model fits on screen far below it. */
export function edgeLabelsShownAt(zoom: number): boolean {
  return zoom >= LABEL_HIDDEN_BELOW
}

/** A compound node keeps its name in a header this tall; the rest of it is
 *  space for its children, where labels may go. */
const COMPOUND_HEADER = 60
/** The top of a leaf node, where its type and name are. */
const LEAF_HEADER = 40
/** Covering a node's name costs this much more than covering the rest. */
const HEADER_WEIGHT = 2

/** Padding of a route's box: a node moving this close may change the route. */
const ROUTE_BOX_PAD = 24

let portCache: { nodes: NodeInternals; edges: RFEdges; result: ReturnType<typeof allocatePorts> } | null = null
function portsFor(nodes: NodeInternals, edges: RFEdges): ReturnType<typeof allocatePorts> {
  if (portCache?.nodes !== nodes || portCache.edges !== edges) {
    portCache = { nodes, edges, result: allocatePorts(nodes as any, edges as any) }
  }
  return portCache.result
}

interface ObstacleCandidate { id: string; rect: RoutingObstacle; ancestors: string[]; visible: boolean }
interface ObstacleCandidates {
  nodes: NodeInternals
  byId: Map<string, ObstacleCandidate>
  /** The visible nodes. */
  grid: ObstacleGrid<ObstacleCandidate>
}

let obstacleCache: ObstacleCandidates | null = null
function obstacleCandidates(nodes: NodeInternals): ObstacleCandidates {
  if (obstacleCache?.nodes !== nodes) {
    const visible: ObstacleCandidate[] = []
    const byId = new Map<string, ObstacleCandidate>()
    for (const n of nodes.values()) {
      const ancestors: string[] = []
      for (let cur = n.parentNode ? nodes.get(n.parentNode) : undefined; cur; cur = cur.parentNode ? nodes.get(cur.parentNode) : undefined) {
        ancestors.push(cur.id)
      }
      const c = {
        id: n.id, ancestors, visible: !n.hidden && !!n.width && !!n.height,
        rect: { x: n.positionAbsolute?.x ?? 0, y: n.positionAbsolute?.y ?? 0, w: n.width ?? 0, h: n.height ?? 0 },
      }
      byId.set(n.id, c)
      if (c.visible) visible.push(c)
    }
    obstacleCache = { nodes, byId, grid: new ObstacleGrid(visible) }
  }
  return obstacleCache
}

/** Rects of the nodes that moved, resized, appeared or disappeared between
 *  two states (both the old and the new rect); null when there is no
 *  previous state to compare with. */
function changedRects(before: ObstacleCandidates | null, after: ObstacleCandidates): RoutingObstacle[] | null {
  if (!before) return null
  if (before === after) return []
  const changed: RoutingObstacle[] = []
  const same = (a: RoutingObstacle, b: RoutingObstacle) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h
  for (const [id, c] of after.byId) {
    const old = before.byId.get(id)
    if (old && old.visible === c.visible && (!c.visible || same(old.rect, c.rect))) continue
    if (old?.visible) changed.push(old.rect)
    if (c.visible) changed.push(c.rect)
  }
  for (const [id, old] of before.byId) if (old.visible && !after.byId.has(id)) changed.push(old.rect)
  return changed
}

interface Box { minX: number; minY: number; maxX: number; maxY: number }

function touches(r: RoutingObstacle, b: Box): boolean {
  return r.x <= b.maxX && r.x + r.w >= b.minX && r.y <= b.maxY && r.y + r.h >= b.minY
}

/** Where a route could be changed by a node: around its direct curve and
 *  around the path it took. */
function routeBox(sp: Pt, srcSide: Position, tp: Pt, tgtSide: Position, route: RoutedEdge): Box {
  const b = directCurveBox(sp.x, sp.y, srcSide, tp.x, tp.y, tgtSide)
  for (const p of route.points) {
    b.minX = Math.min(b.minX, p.x); b.minY = Math.min(b.minY, p.y)
    b.maxX = Math.max(b.maxX, p.x); b.maxY = Math.max(b.maxY, p.y)
  }
  return { minX: b.minX - ROUTE_BOX_PAD, minY: b.minY - ROUTE_BOX_PAD, maxX: b.maxX + ROUTE_BOX_PAD, maxY: b.maxY + ROUTE_BOX_PAD }
}

export interface EdgeGeometry {
  sourceSide: Position
  targetSide: Position
  sourcePoint: Pt
  targetPoint: Pt
  path: string
  /** Centre of the label (when the relation has one). */
  label: Pt
}

interface RouteEntry { key: string; route: RoutedEdge; box: Box }

let routeCache = new Map<string, RouteEntry>()
let routedAgainst: ObstacleCandidates | null = null
let geometryCache: { nodes: NodeInternals; edges: RFEdges; moving: boolean; placeLabels: boolean; style: EdgeStyle; result: Map<string, EdgeGeometry> } | null = null
/** The last label placement and what it was placed against: React Flow
 *  hands over new state objects several times while a view opens (node
 *  sizes measured, nodes set), and placing a large canvas's labels again
 *  each time cost seconds when none of their inputs changed. */
let labelCache: { candidates: ObstacleCandidates; routes: Map<string, RouteEntry>; sizes: Map<string, string>; labels: Map<string, Pt> } | null = null

/**
 * Sides, ports, path and label centre of every edge React Flow draws, by
 * edge id. Cached per React Flow state; an edge keeps its route while its
 * ends stay put and no node moves near it, and keeps its geometry object
 * while nothing it draws changed, so an edge re-renders only when it has to.
 * Edges are drawn in `style` (curved or orthogonal).
 * While the live layout moves the nodes (`moving`), edges are plain curves
 * and labels sit at their middle; both are redone at rest. Labels also sit
 * at their middle while they are not shown (`placeLabels` false: zoomed out),
 * and are placed when they are.
 */
export function edgeGeometry(nodes: NodeInternals, edges: RFEdges, moving: boolean, placeLabels = true, style: EdgeStyle = 'curved'): Map<string, EdgeGeometry> {
  if (geometryCache?.nodes === nodes && geometryCache.edges === edges && geometryCache.moving === moving && geometryCache.placeLabels === placeLabels && geometryCache.style === style) return geometryCache.result

  const ports = portsFor(nodes, edges)
  const candidates = obstacleCandidates(nodes)
  const changed = changedRects(routedAgainst, candidates)
  routedAgainst = candidates

  // Obstacles: every visible node except the two ends, their ancestors
  // (the edge crosses their borders) and their descendants (inside them).
  // While the live layout moves the nodes, the edge is the plain curve:
  // routing around obstacles (A*) every frame took a fifth of the frame
  // time on a 150-node canvas, and the route is redone at rest.
  const obstaclesFor = (source: string, target: string): ObstacleSet | RoutingObstacle[] => {
    if (moving) return []
    const excludeIds = new Set<string>([source, target, ...(candidates.byId.get(source)?.ancestors ?? []), ...(candidates.byId.get(target)?.ancestors ?? [])])
    // The curve's hit test asks the grid point by point; the full list is
    // built only when the edge has to route around something.
    return candidates.grid.without((c) =>
      excludeIds.has(c.id) || c.ancestors.includes(source) || c.ancestors.includes(target))
  }

  let routes = new Map<string, RouteEntry>()
  for (const e of edges) {
    const alloc = ports.get(e.id)
    if (!alloc) continue
    const sp = alloc.sourcePoint, tp = alloc.targetPoint
    const key = `${moving ? 'm' : 'r'}|${style}|${sp.x},${sp.y},${alloc.sourceSide}|${tp.x},${tp.y},${alloc.targetSide}`
    const prev = routeCache.get(e.id)
    if (prev && prev.key === key && changed && !changed.some((r) => touches(r, prev.box))) {
      routes.set(e.id, prev)
      continue
    }
    const route = computeRoutedEdge(sp.x, sp.y, alloc.sourceSide, tp.x, tp.y, alloc.targetSide, obstaclesFor(e.source, e.target), undefined, style)
    routes.set(e.id, { key, route, box: routeBox(sp, alloc.sourceSide, tp, alloc.targetSide, route) })
  }
  routeCache = routes
  if (style === 'orthogonal' && !moving) routes = separated(routes)

  const labels = moving || !placeLabels ? new Map<string, Pt>() : labelSpots(edges, routes, candidates, changed)

  const previous = geometryCache?.result
  const result = new Map<string, EdgeGeometry>()
  for (const [id, { route }] of routes) {
    const alloc = ports.get(id)!
    const label = labels.get(id) ?? { x: route.labelX, y: route.labelY }
    const old = previous?.get(id)
    const same = old && old.path === route.path && old.label.x === label.x && old.label.y === label.y
      && old.sourceSide === alloc.sourceSide && old.targetSide === alloc.targetSide
    result.set(id, same ? old : {
      sourceSide: alloc.sourceSide,
      targetSide: alloc.targetSide,
      sourcePoint: alloc.sourcePoint,
      targetPoint: alloc.targetPoint,
      path: route.path,
      label,
    })
  }
  geometryCache = { nodes, edges, moving, placeLabels, style, result }
  return result
}

/** The last spreading of orthogonal routes and what it was made from: the
 *  same routes give the same entries, so label placement can reuse its
 *  result (it compares route entries by identity). */
let separatedCache: { input: Map<string, RouteEntry>; output: Map<string, RouteEntry> } | null = null

/** Orthogonal routes with segments that share a line spread apart
 *  (separateParallelSegments); unchanged entries are passed through. */
function separated(routes: Map<string, RouteEntry>): Map<string, RouteEntry> {
  const last = separatedCache
  if (last && last.input.size === routes.size && [...routes].every(([id, entry]) => last.input.get(id) === entry)) return last.output
  const moved = separateParallelSegments(new Map([...routes].map(([id, entry]) => [id, entry.route.points])))
  const output = new Map<string, RouteEntry>()
  for (const [id, entry] of routes) {
    const points = moved.get(id)
    output.set(id, points ? { ...entry, route: orthogonalRoute(points) } : entry)
  }
  separatedCache = { input: routes, output }
  return output
}

/** Label centres of the edges that have a label, placed together so they
 *  avoid the nodes and each other. */
function labelSpots(edges: RFEdges, routes: Map<string, RouteEntry>, candidates: ObstacleCandidates, changed: RoutingObstacle[] | null): Map<string, Pt> {
  const labelled: LabelEdge[] = []
  const sizes = new Map<string, string>()
  for (const e of edges) {
    const entry = routes.get(e.id)
    if (!entry || e.hidden) continue
    const size = relationLabelSize((e.data ?? {}) as C4EdgeRFData)
    if (!size) continue
    const { route } = entry
    labelled.push({ id: e.id, points: route.points, anchor: { x: route.labelX, y: route.labelY }, size })
    sizes.set(e.id, `${size.w}x${size.h}`)
  }
  if (labelled.length === 0) return new Map()

  // Nothing they are placed against changed: the same labels.
  const last = labelCache
  if (last && changed && changed.length === 0 && sameParents(last.candidates, candidates)
    && last.sizes.size === sizes.size
    && labelled.every((l) => last.routes.get(l.id) === routes.get(l.id) && last.sizes.get(l.id) === sizes.get(l.id))) {
    labelCache = { ...last, candidates, routes }
    return last.labels
  }

  // A label may sit inside a group, but not on its name, nor on a leaf
  // node, least of all on the leaf's name.
  const parents = new Set<string>()
  for (const c of candidates.grid.items) if (c.ancestors[0]) parents.add(c.ancestors[0])
  const obstacles: LabelObstacle[] = []
  for (const { id, rect } of candidates.grid.items) {
    if (parents.has(id)) {
      obstacles.push({ ...rect, h: Math.min(rect.h, COMPOUND_HEADER), weight: HEADER_WEIGHT })
    } else {
      obstacles.push(rect, { ...rect, h: Math.min(rect.h, LEAF_HEADER), weight: HEADER_WEIGHT - 1 })
    }
  }
  const labels = placeEdgeLabels(labelled, obstacles)
  labelCache = { candidates, routes, sizes, labels }
  return labels
}

/** Whether every node has the same parent as before (a label may sit in a
 *  group but not on a leaf, so a new parent changes the obstacles). */
function sameParents(before: ObstacleCandidates, after: ObstacleCandidates): boolean {
  if (before === after) return true
  if (before.byId.size !== after.byId.size) return false
  for (const [id, c] of after.byId) if (before.byId.get(id)?.ancestors[0] !== c.ancestors[0]) return false
  return true
}
