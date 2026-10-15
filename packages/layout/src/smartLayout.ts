/**
 * Smart Layout — planarity-aware ensemble with simulated-annealing refinement.
 *
 * Theoretical background
 * ──────────────────────
 * A drawing has zero crossings iff the underlying graph is **planar**
 * (Kuratowski/Wagner). Real architecture diagrams rarely are, so we
 * minimise the *crossing number* — proven NP-hard (Garey & Johnson 1983).
 * The state-of-the-art practical attack is:
 *
 *   1. Run several **structurally different** layout families in parallel
 *      (Sugiyama-layered, force-directed, stress-majorisation, tree).
 *      Each excels on a different graph topology — layered for hierarchies,
 *      stress for sparse near-planar graphs (Gansner et al. 2005), force
 *      for symmetric clusters, tree for arborescences.
 *
 *   2. Score every result by a **geometric crossing oracle** (the project's
 *      `computeLayoutMetrics` already counts straight-line crossings and
 *      edge↔node overdraw — Cohen-Sutherland clipping in `crossingOpt.ts`).
 *
 *   3. Refine the winner with **Davidson-Harel simulated annealing**
 *      (Davidson & Harel 1996) — perturb root-level positions by Gaussian
 *      noise, accept by Metropolis criterion. SA escapes local minima that
 *      greedy sibling-swap cannot.
 *
 *   4. Report a **planarity score** (skewness proxy = crossing-edge ratio)
 *      and the picked algorithm so the user sees why a layout looks the
 *      way it does.
 *
 * References
 *   • Davidson, R., Harel, D. (1996). "Drawing graphs nicely using
 *     simulated annealing". ACM ToG 15(4).
 *   • Gansner, E.R., Koren, Y., North, S. (2005). "Graph drawing by
 *     stress majorization". Graph Drawing 2004.
 *   • Eades, P. (1984). "A heuristic for graph drawing". Congressus
 *     Numerantium 42.
 *   • Sugiyama, K., Tagawa, S., Toda, M. (1981). "Methods for visual
 *     understanding of hierarchical system structures". IEEE SMC.
 *   • Eclipse Layout Kernel (ELK) — algorithms layered/stress/force/mrtree.
 */

import type { LayoutOptions } from 'elkjs'
import { Position } from './side'
import type { C4Node, C4Relation, EdgeStyle, PositionMap } from '@radical/common/c4'
import { computeRoutedEdge, ObstacleGrid, separateParallelSegments, type RoutingObstacle } from './edgeRouting'
import { labelOverlaps, placeEdgeLabels, type LabelEdge, type LabelObstacle } from './edgeLabels'
import { allocatePorts } from './portAllocator'
import type { Metamodel } from '@radical/common/metamodel'
import { applyRadicalLayout } from './radicalLayout'
import { minimizeCrossings, computeLayoutMetrics, type LayoutMetrics } from './crossingOpt'
import { ELK_ROOT_SPACING, ELK_CHILD_SPACING } from './elkSpacingBase'
import { compoundPadding, projectToVisibleGraph } from './geometry'
import { finalizeLayout as finalizeUnconstrained, ROOT_GAP, CHILD_GAP } from './layoutFinalize'
import { alignmentError, enforceAlignments, type Alignment } from './constraints'
import { labelGaps, labelNeed, labelSizeOf, pairKey, type PairGap } from './labelRoom'
import { relaxLayout } from './liveColaEngine'
import { resizeParentsBottomUp } from './viewInput'

/** finalizeLayout (with room for relation labels) plus the user's
 *  alignments, so every stage scores and refines what the canvas will keep. */
function finalizeLayout(
  nodes: Record<string, C4Node>, relations: Record<string, C4Relation>,
  positions: PositionMap, alignments: readonly Alignment[],
): PositionMap {
  return enforceAlignments(nodes, finalizeUnconstrained(nodes, positions, labelGaps(nodes, relations)), alignments)
}

/** labelGaps by layout-graph node index, for the annealer. */
function pairGapsOf(g: LayoutGraph, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): (a: number, b: number) => PairGap | undefined {
  const gaps = labelGaps(nodes, relations)
  return (a, b) => gaps.get(pairKey(g.ids[a], g.ids[b]))
}
import { bestIndex, bestIndexKeepingCurrent, rankByQuality } from './ranking'
import {
  anneal, buildLayoutGraph, createRng, graphSeed, FunctionEnergy, ProxyEnergy,
  type AnnealOptions, type Bounds, type LayoutGraph, type Rng,
} from './annealing'
import {
  W_CROSS, W_OVERDRAW, W_STUBLOOP, W_LONG, W_LMEAN, W_LMAX, W_LEAF, W_ASPECT, W_COMPACT, W_SYMMETRY, W_LABEL,
  LEN_MEAN_KNEE, LEN_MAX_KNEE, overlapCost, aspectPenalty,
  edgeScale, pairScale, LEAF_COMPACTNESS_FROM_NODES,
  CORRIDOR_CELL, CORRIDOR_FREE, CORRIDOR_END_CLEAR, W_CORRIDOR, SHALLOW_CROSSING_DEG, CROWDED_ANGLE_DEG, W_LABEL_COLLISION,
  SIDE_FREE, W_SIDE_LOAD, W_SPACE_IMBALANCE,
} from './scoreWeights'

// ─── Composite aesthetic score ────────────────────────────────────────────
//
// Davidson-Harel (1996) cost function adapted to architecture diagrams.
// Components, each normalised so the weights (scoreWeights.ts) are
// commensurable:
//
//   crossings        — Bézier-sampled edge crossings, as rendered
//   overdraws        — edge passing through unrelated node bbox
//   nodeOverlap      — overlap area between non-nested pairs, scaled to
//                       mean node area
//   edgeLengthExcess — edges far longer than the median
//   edgeLengthMean   — mean edge length in node sizes
//   edgeLengthMax    — longest edge in node sizes
//   leafCentrality   — low-degree nodes sitting near the centre of mass
//   aspectPenalty    — bounding-box aspect ratio deviation from sqrt(2)
//   compactness      — bounding-box area / sum of node areas
//   symmetry         — distance from a mirror-symmetric arrangement
//   labelCrowding    — labelled relations whose ends leave no room for the label
//   corridorCrowding — relations squeezed through one narrow place

export interface CompositeScore {
  crossings: number
  renderedCrossings: number
  overdraws: number
  renderedOverdraws: number
  stubLoopPenalty: number
  nodeOverlap: number
  edgeLengthExcess: number
  /** Mean edge length expressed in units of mean node dimension. ~3 = tight, >6 = sprawling. */
  edgeLengthMean: number
  /** Longest edge in node-size units. >8 means a single edge spans the canvas. */
  edgeLengthMax: number
  /** Σ over leaf nodes of (1 − distance-from-centroid / max-radius)².
   *  Penalises low-degree nodes sitting near the centre of mass. */
  leafCentrality: number
  aspectPenalty: number
  compactness: number
  symmetryDeficit: number
  /** Σ over labelled relations of (missing share of the room its label needs)². */
  labelCrowding: number
  /** Σ over CORRIDOR_CELL squares of (relations through it, away from their
   *  ends, past CORRIDOR_FREE)². */
  corridorCrowding: number
  /** Rendered crossings at an angle under SHALLOW_CROSSING_DEG. */
  shallowCrossings: number
  /** Pairs of relations leaving one element less than CROWDED_ANGLE_DEG apart. */
  crowdedAngles: number
  /** Standard deviation of the edge lengths, in mean node sizes. */
  edgeLengthSd: number
  /** Relation labels, placed as the canvas places them, that cover another
   *  label or an element (pairs); 0 when the relations are not routed. */
  labelCollisions: number
  /** Σ over element sides of (relations on the side past SIDE_FREE)². */
  sideLoad: number
  /** Σ over containers of 4+ elements (and the canvas) of the largest minus
   *  the smallest share of their elements in one quadrant. */
  spaceImbalance: number
  composite: number
}

function buildAbsCenters(
  nodes: Record<string, C4Node>,
): Record<string, { x: number; y: number; w: number; h: number; cx: number; cy: number }> {
  const memo: Record<string, { x: number; y: number }> = {}
  const absXY = (id: string): { x: number; y: number } => {
    if (memo[id]) return memo[id]
    const n = nodes[id]
    if (!n) return { x: 0, y: 0 }
    if (!n.parentId) memo[id] = { x: n.x, y: n.y }
    else {
      const p = absXY(n.parentId)
      memo[id] = { x: p.x + n.x, y: p.y + n.y }
    }
    return memo[id]
  }
  const out: Record<string, { x: number; y: number; w: number; h: number; cx: number; cy: number }> = {}
  for (const n of Object.values(nodes)) {
    const a = absXY(n.id)
    out[n.id] = {
      x: a.x, y: a.y, w: n.width, h: n.height,
      cx: a.x + n.width / 2, cy: a.y + n.height / 2,
    }
  }
  return out
}

function buildAncestors(nodes: Record<string, C4Node>): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {}
  for (const n of Object.values(nodes)) {
    const set = new Set<string>()
    let cur: C4Node | undefined = n
    while (cur?.parentId) {
      set.add(cur.parentId)
      cur = nodes[cur.parentId]
    }
    out[n.id] = set
  }
  return out
}



function segmentsCross(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const d1 = (cx - ax) * (by - ay) - (cy - ay) * (bx - ax)
  const d2 = (dx - ax) * (by - ay) - (dy - ay) * (bx - ax)
  const d3 = (ax - cx) * (dy - cy) - (ay - cy) * (dx - cx)
  const d4 = (bx - cx) * (dy - cy) - (by - cy) * (dx - cx)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
         ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

function pointInBox(
  px: number, py: number,
  bx: number, by: number, bw: number, bh: number,
  pad = 0,
): boolean {
  return px >= bx - pad && px <= bx + bw + pad
      && py >= by - pad && py <= by + bh + pad
}

interface RenderMetrics {
  renderedCrossings: number
  renderedOverdraws: number
  stubLoopPenalty: number
  corridorCrowding: number
  shallowCrossings: number
  crowdedAngles: number
  labelCollisions: number
  sideLoad: number
}

/**
 * Labels placed as the canvas places them (placeEdgeLabels, avoiding the
 * leaves and the headers of compound nodes), counted where they still cover
 * another label or an element. A layout that packs its elements close left
 * the labels nowhere to go, and nothing in the score saw it.
 */
function labelCollisions(
  polys: readonly RenderedEdge[],
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  abs: Record<string, { x: number; y: number; w: number; h: number }>,
): number {
  const labelled: LabelEdge[] = []
  for (const p of polys) {
    const r = relations[p.id]
    const size = r ? labelSizeOf(r, nodes) : null
    if (!size) continue
    labelled.push({ id: p.id, points: p.samples, anchor: p.samples[Math.floor(p.samples.length / 2)], size })
  }
  if (labelled.length === 0) return 0
  const parents = new Set<string>()
  for (const id of Object.keys(abs)) { const parent = nodes[id]?.parentId; if (parent && abs[parent]) parents.add(parent) }
  const obstacles: LabelObstacle[] = []
  const covered: RoutingObstacle[] = []
  for (const [id, r] of Object.entries(abs)) {
    if (parents.has(id)) {
      const header = { x: r.x, y: r.y, w: r.w, h: Math.min(r.h, 60) }
      obstacles.push({ ...header, weight: 2 })
      covered.push(header)
    } else {
      obstacles.push({ x: r.x, y: r.y, w: r.w, h: r.h }, { x: r.x, y: r.y, w: r.w, h: Math.min(r.h, 40), weight: 1 })
      covered.push({ x: r.x, y: r.y, w: r.w, h: r.h })
    }
  }
  const { labelLabel, labelNode } = labelOverlaps(labelled, placeEdgeLabels(labelled, obstacles), covered)
  return labelLabel + labelNode
}
/** Pairs of relations leaving one element less than CROWDED_ANGLE_DEG
 *  apart, each taken in the direction from its end to a quarter of the way
 *  along the curve (the side normal alone makes every relation leaving one
 *  side parallel). */
function crowdedAngles(polys: readonly RenderedEdge[]): number {
  const directions = new Map<string, number[]>()
  const add = (id: string, from: { x: number; y: number }, to: { x: number; y: number }) => {
    const list = directions.get(id) ?? []
    list.push(Math.atan2(to.y - from.y, to.x - from.x))
    directions.set(id, list)
  }
  for (const p of polys) {
    const s = p.samples, q = Math.max(1, Math.floor(s.length / 4))
    add(p.sId, s[0], s[q])
    add(p.tId, s[s.length - 1], s[s.length - 1 - q])
  }
  const limit = CROWDED_ANGLE_DEG * Math.PI / 180
  let crowded = 0
  for (const list of directions.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        let d = Math.abs(list[i] - list[j]) % (2 * Math.PI)
        if (d > Math.PI) d = 2 * Math.PI - d
        if (d < limit) crowded++
      }
    }
  }
  return crowded
}

/** Σ over CORRIDOR_CELL squares of (relations through it, away from their
 *  ends, past CORRIDOR_FREE)²: see CORRIDOR_CELL in scoreWeights.ts. */
function corridorCrowding(polys: readonly RenderedEdge[]): number {
  const cells = new Map<number, number>()
  const lastIn = new Map<number, number>()
  const step = CORRIDOR_CELL / 4
  polys.forEach((p, e) => {
    const start = p.samples[0], end = p.samples[p.samples.length - 1]
    for (let i = 1; i < p.samples.length; i++) {
      const a = p.samples[i - 1], b = p.samples[i]
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step))
      for (let k = i === 1 ? 0 : 1; k <= n; k++) {
        const x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n
        if (Math.hypot(x - start.x, y - start.y) < CORRIDOR_END_CLEAR || Math.hypot(x - end.x, y - end.y) < CORRIDOR_END_CLEAR) continue
        const key = Math.floor(x / CORRIDOR_CELL) * 1_048_576 + Math.floor(y / CORRIDOR_CELL)
        if (lastIn.get(key) === e) continue
        lastIn.set(key, e)
        cells.set(key, (cells.get(key) ?? 0) + 1)
      }
    }
  })
  let crowding = 0
  for (const count of cells.values()) if (count > CORRIDOR_FREE) crowding += (count - CORRIDOR_FREE) ** 2
  return crowding
}

/** One relation as the canvas draws it: from its ports (allocatePorts),
 *  direct or around elements, in the view's style, as a polyline, with its
 *  bounding box. */
export interface RenderedEdge {
  id: string
  samples: { x: number; y: number }[]
  sId: string
  tId: string
  minX: number; minY: number; maxX: number; maxY: number
}

/** The relations as drawn, and how far their ends loop back (stubs that
 *  leave a node away from the other end). */
/** Relations up to which the ranking score routes them around elements as
 *  the canvas does (A* per blocked relation); above, and in the annealer's
 *  energy, they are drawn direct, from their spread ports. At 300 the
 *  metamodel diagram (133 relations) took twice as long to lay out. */
export const ROUTED_SCORE_MAX_EDGES = 120

function renderEdges(
  relations: Record<string, C4Relation>,
  abs: Record<string, { x: number; y: number; w: number; h: number; cx: number; cy: number }>,
  style: EdgeStyle = 'curved',
  ancestors?: Record<string, Set<string>>,
  routed = false,
): { polys: RenderedEdge[]; stubLoopPenalty: number; sideLoad: number } {
  const edges = Object.values(relations).filter((r) => abs[r.sourceId] && abs[r.targetId])
  // 16 segments per edge — captures Bézier curvature with enough resolution
  // to detect when a curve grazes a narrow node (e.g. a Database cylinder).
  // 8 was occasionally letting overdraw through.
  const SAMPLES = 16
  let stubLoopPenalty = 0

  // The ports the canvas gives the relations: the side each leaves and
  // enters, and where along it (relations on one side are spread along it).
  const views = new Map(Object.entries(abs).map(([id, n]) => [id, { id, positionAbsolute: { x: n.x, y: n.y }, width: n.w, height: n.h }]))
  const ports = allocatePorts(views, edges.map((e) => ({ id: e.id, source: e.sourceId, target: e.targetId })))

  // Elements a relation goes around: all but its ends, their ancestors
  // (it crosses their borders) and their descendants (inside them).
  const grid = routed && ancestors
    ? new ObstacleGrid(Object.entries(abs).map(([id, n]) => ({ id, rect: { x: n.x, y: n.y, w: n.w, h: n.h } })))
    : null
  const obstaclesFor = (sId: string, tId: string) => grid
    ? grid.without((it) => it.id === sId || it.id === tId || !!ancestors![sId]?.has(it.id) || !!ancestors![tId]?.has(it.id)
        || !!ancestors![it.id]?.has(sId) || !!ancestors![it.id]?.has(tId))
    : []

  // Relations per side of each element.
  const onSide = new Map<string, number>()
  for (const [id, port] of ports) {
    const r = relations[id]
    for (const key of [`${r.sourceId}|${port.sourceSide}`, `${r.targetId}|${port.targetSide}`]) onSide.set(key, (onSide.get(key) ?? 0) + 1)
  }
  let sideLoad = 0
  for (const count of onSide.values()) if (count > SIDE_FREE) sideLoad += (count - SIDE_FREE) ** 2

  const lines = new Map<string, { e: C4Relation; points: { x: number; y: number }[] }>()
  for (const e of edges) {
    const port = ports.get(e.id)
    if (!port) continue
    const sp = port.sourcePoint, tp = port.targetPoint
    const sn = normalOf(port.sourceSide), tn = normalOf(port.targetSide)
    const dist = Math.hypot(tp.x - sp.x, tp.y - sp.y)
    // Stub-loop penalty: exit normal vs source→target direction.
    // dot < 0 means the curve initially shoots *away* from the target.
    if (dist > 0) {
      const ux = (tp.x - sp.x) / dist, uy = (tp.y - sp.y) / dist
      const dotS = sn.x * ux + sn.y * uy           // source-side
      const dotT = -(tn.x * ux + tn.y * uy)        // target-side (incoming)
      // Convert dot ∈ [-1, 1] to penalty: only negative values count,
      // and squared so a sharp loop is much worse than a gentle backstep.
      if (dotS < 0) stubLoopPenalty += dotS * dotS
      if (dotT < 0) stubLoopPenalty += dotT * dotT
    }
    // As the canvas draws it in this style: direct, or around elements.
    const route = computeRoutedEdge(sp.x, sp.y, port.sourceSide, tp.x, tp.y, port.targetSide, obstaclesFor(e.sourceId, e.targetId), undefined, style)
    lines.set(e.id, { e, points: route.points })
  }
  if (style === 'orthogonal') {
    const moved = separateParallelSegments(new Map([...lines].map(([id, l]) => [id, l.points])))
    for (const [id, points] of moved) lines.get(id)!.points = points
  }

  const polys: RenderedEdge[] = []
  for (const { e, points } of lines.values()) {
    const samples = style === 'orthogonal' || points.length < SAMPLES ? resample(points, SAMPLES) : points
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const pt of samples) {
      if (pt.x < minX) minX = pt.x
      if (pt.y < minY) minY = pt.y
      if (pt.x > maxX) maxX = pt.x
      if (pt.y > maxY) maxY = pt.y
    }
    polys.push({ id: e.id, samples, sId: e.sourceId, tId: e.targetId, minX, minY, maxX, maxY })
  }

  return { polys, stubLoopPenalty, sideLoad }
}

/** Σ over containers of four or more elements, and the canvas, of the
 *  largest minus the smallest share of their elements (by centre) in one
 *  quadrant of the container (below its header). */
function spaceImbalanceOf(
  nodes: Record<string, C4Node>,
  abs: Record<string, { x: number; y: number; w: number; h: number; cx: number; cy: number }>,
): number {
  const groups = new Map<string, string[]>()
  for (const id of Object.keys(abs)) {
    const parent = nodes[id]?.parentId
    const key = parent && abs[parent] ? parent : ''
    const list = groups.get(key) ?? []
    list.push(id)
    groups.set(key, list)
  }
  let total = 0
  for (const [parent, ids] of groups) {
    if (ids.length < 4) continue
    let x0: number, y0: number, x1: number, y1: number
    if (parent) {
      const p = abs[parent]
      x0 = p.x; x1 = p.x + p.w; y0 = p.y + Math.min(60, p.h / 3); y1 = p.y + p.h
    } else {
      x0 = Math.min(...ids.map((id) => abs[id].x)); x1 = Math.max(...ids.map((id) => abs[id].x + abs[id].w))
      y0 = Math.min(...ids.map((id) => abs[id].y)); y1 = Math.max(...ids.map((id) => abs[id].y + abs[id].h))
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
    const quadrants = [0, 0, 0, 0]
    for (const id of ids) quadrants[(abs[id].cx < cx ? 0 : 1) + (abs[id].cy < cy ? 0 : 2)]++
    total += (Math.max(...quadrants) - Math.min(...quadrants)) / ids.length
  }
  return total
}

/** The outward unit normal of a side. */
function normalOf(side: Position): { x: number; y: number } {
  switch (side) {
    case Position.Left: return { x: -1, y: 0 }
    case Position.Right: return { x: 1, y: 0 }
    case Position.Top: return { x: 0, y: -1 }
    case Position.Bottom: return { x: 0, y: 1 }
  }
}

/** The relations of a laid-out diagram as the canvas draws them. */
export function renderedEdges(nodes: Record<string, C4Node>, relations: Record<string, C4Relation>, style: EdgeStyle = 'curved'): RenderedEdge[] {
  return renderEdges(relations, buildAbsCenters(nodes), style, buildAncestors(nodes), Object.keys(relations).length <= ROUTED_SCORE_MAX_EDGES).polys
}

/** `count` + 1 points evenly along the polyline, its corners kept. */
function resample(pts: { x: number; y: number }[], count: number): { x: number; y: number }[] {
  const lengths = [0]
  for (let i = 1; i < pts.length; i++) lengths.push(lengths[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  const total = lengths[lengths.length - 1]
  if (total === 0 || pts.length < 2) return pts
  const out = new Map<number, { x: number; y: number }>()
  for (let k = 0; k <= count; k++) {
    const at = total * k / count
    let i = 1
    while (i < pts.length - 1 && lengths[i] < at) i++
    const seg = lengths[i] - lengths[i - 1]
    const u = seg > 0 ? (at - lengths[i - 1]) / seg : 0
    out.set(at, { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * u })
  }
  for (let i = 1; i < pts.length - 1; i++) out.set(lengths[i], pts[i])
  return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => p)
}

function computeRenderAwareEdgeMetrics(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  abs: Record<string, { x: number; y: number; w: number; h: number; cx: number; cy: number }>,
  ancestors: Record<string, Set<string>>,
  style: EdgeStyle = 'curved',
  routed = false,
): RenderMetrics {
  const { polys, stubLoopPenalty, sideLoad } = renderEdges(relations, abs, style, ancestors, routed)

  // Crossings on actual sampled polylines.
  let renderedCrossings = 0
  let shallowCrossings = 0
  const shallowLimit = SHALLOW_CROSSING_DEG * Math.PI / 180
  for (let i = 0; i < polys.length; i++) {
    const A = polys[i]
    for (let j = i + 1; j < polys.length; j++) {
      const B = polys[j]
      // Edges sharing an endpoint trivially "meet" — don't count those.
      if (A.sId === B.sId || A.sId === B.tId || A.tId === B.sId || A.tId === B.tId) continue
      if (A.maxX < B.minX || B.maxX < A.minX || A.maxY < B.minY || B.maxY < A.minY) continue
      let crossed = false
      // Inner double loop — break early once we found one crossing per pair.
      // (One "crossing" between two edges is the same visual artefact whether
      //  the polylines tangentially intersect 1 or 3 times.)
      for (let a = 0; a < A.samples.length - 1 && !crossed; a++) {
        const p = A.samples[a], q = A.samples[a + 1]
        for (let b = 0; b < B.samples.length - 1; b++) {
          const r = B.samples[b], s = B.samples[b + 1]
          if (segmentsCross(p.x, p.y, q.x, q.y, r.x, r.y, s.x, s.y)) {
            crossed = true
            let angle = Math.abs(Math.atan2(q.y - p.y, q.x - p.x) - Math.atan2(s.y - r.y, s.x - r.x)) % Math.PI
            if (angle > Math.PI / 2) angle = Math.PI - angle
            if (angle < shallowLimit) shallowCrossings++
            break
          }
        }
      }
      if (crossed) renderedCrossings++
    }
  }

  // Overdraws: sample points landing in unrelated bboxes, counted once per
  // (edge, node). The first/last sample sits on the source/target border.
  // Ancestors and descendants of either endpoint are not obstacles — the
  // renderer excludes them the same way.
  const ids = Object.keys(abs)
  let renderedOverdraws = 0
  for (const P of polys) {
    for (const id of ids) {
      if (id === P.sId || id === P.tId) continue
      if (ancestors[P.sId]?.has(id) || ancestors[P.tId]?.has(id)) continue
      if (ancestors[id]?.has(P.sId) || ancestors[id]?.has(P.tId)) continue
      const r = abs[id]
      if (r.x > P.maxX || r.x + r.w < P.minX || r.y > P.maxY || r.y + r.h < P.minY) continue
      for (let i = 1; i < P.samples.length - 1; i++) {
        const pt = P.samples[i]
        if (pointInBox(pt.x, pt.y, r.x, r.y, r.w, r.h, -2)) {
          renderedOverdraws++
          break
        }
      }
    }
  }

  return { renderedCrossings, renderedOverdraws, stubLoopPenalty, corridorCrowding: corridorCrowding(polys), shallowCrossings, crowdedAngles: crowdedAngles(polys), labelCollisions: routed ? labelCollisions(polys, nodes, relations, abs) : 0, sideLoad }
}

export function computeCompositeScore(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  style: EdgeStyle = 'curved',
): CompositeScore {
  const base = computeLayoutMetrics(nodes, relations)
  // The relations as drawn, around elements too (up to ROUTED_SCORE_MAX_EDGES).
  const routed = Object.keys(relations).length <= ROUTED_SCORE_MAX_EDGES
  return { ...scoreParts(nodes, relations, style, routed), crossings: base.crossings, overdraws: base.overdraws }
}

/** Composite cost only — what the polishing annealer minimises. */
export function compositeEnergy(nodes: Record<string, C4Node>, relations: Record<string, C4Relation>, style: EdgeStyle = 'curved'): number {
  return scoreParts(nodes, relations, style).composite
}

function scoreParts(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  style: EdgeStyle = 'curved',
  routed = false,
): Omit<CompositeScore, 'crossings' | 'overdraws'> {
  const abs = buildAbsCenters(nodes)
  const ancestors = buildAncestors(nodes)
  const ids = Object.keys(abs)

  // ── 0. Render-aware edge metrics (Bézier-sampled, matches what user sees) ─
  const render = computeRenderAwareEdgeMetrics(nodes, relations, abs, ancestors, style, routed)


  // ── 1. Pairwise sibling node overlap (area, normalised to mean area) ──
  let overlapArea = 0
  let totalArea = 0
  for (const r of Object.values(abs)) totalArea += r.w * r.h
  const meanArea = totalArea / Math.max(ids.length, 1)
  for (let i = 0; i < ids.length; i++) {
    const a = abs[ids[i]]
    for (let j = i + 1; j < ids.length; j++) {
      const b = abs[ids[j]]
      // Skip ancestor/descendant pairs — a child is *expected* to overlap its parent.
      if (ancestors[ids[i]]?.has(ids[j])) continue
      if (ancestors[ids[j]]?.has(ids[i])) continue
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      if (ox > 0 && oy > 0) overlapArea += ox * oy
    }
  }
  const nodeOverlap = meanArea > 0 ? overlapArea / meanArea : 0

  // ── 2. Edge-length excess: edges far longer than median count ──────────
  const edges = Object.values(relations).filter((r) => abs[r.sourceId] && abs[r.targetId])
  const lengths = edges.map((r) => {
    const a = abs[r.sourceId]
    const b = abs[r.targetId]
    return Math.hypot(a.cx - b.cx, a.cy - b.cy)
  }).sort((x, y) => x - y)
  const median = lengths.length > 0 ? lengths[Math.floor(lengths.length / 2)] : 0
  let lengthExcess = 0
  if (median > 0) {
    for (const len of lengths) {
      const ratio = len / median
      if (ratio > 1.8) lengthExcess += (ratio - 1.8) ** 2
    }
  }

  // ── 2b. Mean edge length normalised to mean node dimension ───────────
  // Davidson-Harel uses total edge length as a primary cost. The
  // "excess" metric above only catches outliers, so a uniformly-spread
  // layout (every edge 3× too long) scores zero there. This catches it.
  let meanDimForLen = 0
  for (const r of Object.values(abs)) meanDimForLen += (r.w + r.h) / 2
  meanDimForLen = ids.length > 0 ? meanDimForLen / ids.length : 1
  const meanLen = lengths.length > 0
    ? lengths.reduce((s, l) => s + l, 0) / lengths.length
    : 0
  // Express mean edge length in "node sizes". Below 3 is tight (good),
  // above 5 is spread, above 8 is bad. Quadratic above the threshold.
  const lenInNodes = meanDimForLen > 0 ? meanLen / meanDimForLen : 0
  const lenVar = lengths.length > 0 ? lengths.reduce((sum, l) => sum + (l - meanLen) ** 2, 0) / lengths.length : 0
  const edgeLengthSd = meanDimForLen > 0 ? Math.sqrt(lenVar) / meanDimForLen : 0
  const edgeLengthMean = Math.max(0, lenInNodes - LEN_MEAN_KNEE) ** 2

  // ── 2d. Edge-length MAX in node sizes ─────────────────────────────────
  // Mean is misleading when many short intra-container edges drag it down
  // while a handful of cross-system verticals span the whole canvas (the
  // failure mode in the tall-layout screenshot). Penalise the longest
  // edge separately, with a knee at 8 node-sizes.
  const maxLen = lengths.length > 0 ? lengths[lengths.length - 1] : 0
  const maxInNodes = meanDimForLen > 0 ? maxLen / meanDimForLen : 0
  const edgeLengthMax = Math.max(0, maxInNodes - LEN_MAX_KNEE) ** 2

  // ── 2c. Leaf centrality ─ low-degree nodes should sit on the periphery ─
  // Compute degree from relations. Compound-children of a low-degree leaf
  // do *not* inherit its degree; this is intentional — a Container with no
  // outside edges but full of components is internally rich, not a leaf.
  const degree: Record<string, number> = {}
  for (const id of ids) degree[id] = 0
  for (const r of Object.values(relations)) {
    if (degree[r.sourceId] !== undefined) degree[r.sourceId]++
    if (degree[r.targetId] !== undefined) degree[r.targetId]++
  }
  // Centroid + max radius for normalisation.
  let cmX = 0, cmY = 0
  for (const id of ids) { cmX += abs[id].cx; cmY += abs[id].cy }
  cmX /= Math.max(ids.length, 1); cmY /= Math.max(ids.length, 1)
  let maxR = 0
  for (const id of ids) {
    const dx = abs[id].cx - cmX, dy = abs[id].cy - cmY
    const d = Math.hypot(dx, dy)
    if (d > maxR) maxR = d
  }
  let leafCentrality = 0
  if (maxR > 0) {
    for (const id of ids) {
      const deg = degree[id]
      // Only score "truly external" leaves — degree 1 or 2.
      if (deg < 1 || deg > 2) continue
      // Skip nodes that are children of a compound — they sit where their
      // parent puts them, not where the algorithm chose.
      if (nodes[id]?.parentId) continue
      const dx = abs[id].cx - cmX, dy = abs[id].cy - cmY
      const d = Math.hypot(dx, dy)
      // 1.0 at centre, 0.0 on the periphery. Square so it really hurts
      // when External-System sits between two clusters.
      const central = 1 - d / maxR
      // Higher penalty for degree-1 (pure leaves like Person actor).
      const degWeight = deg === 1 ? 1.0 : 0.5
      leafCentrality += degWeight * central * central
    }
  }

  // ── 3. Aspect ratio penalty (favour ~sqrt(2)) ──────────────────────────
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const r of Object.values(abs)) {
    if (r.x < minX) minX = r.x
    if (r.y < minY) minY = r.y
    if (r.x + r.w > maxX) maxX = r.x + r.w
    if (r.y + r.h > maxY) maxY = r.y + r.h
  }
  const bbW = maxX - minX, bbH = maxY - minY
  // Cubic, not quadratic — a 2.5:1 portrait layout scored ≈ 1.2 squared,
  // basically negligible; cubed × W_ASPECT it finally outweighs the swap
  // between a tall single-column layout and a square one.
  const aspect = aspectPenalty(bbW, bbH)

  // ── 4. Compactness: bbox area / sum of node areas ─────────────────────
  // A large model counts its leaf elements only (LEAF_COMPACTNESS_FROM_NODES).
  let areaOfNodes = totalArea
  if (ids.length >= LEAF_COMPACTNESS_FROM_NODES) {
    const parents = new Set<string>()
    for (const id of ids) { const p = nodes[id]?.parentId; if (p && abs[p]) parents.add(p) }
    areaOfNodes = 0
    for (const id of ids) if (!parents.has(id)) areaOfNodes += abs[id].w * abs[id].h
  }
  let compactness = 0
  if (bbW > 0 && bbH > 0 && areaOfNodes > 0) {
    const ratio = (bbW * bbH) / areaOfNodes
    // Below 4 is excellent (near-tight packing). Above 12 is sprawling.
    compactness = Math.max(0, ratio - 4)
  }

  const symDeficit = symmetryDeficitFn(abs, ids)
  // Normalise symmetry to mean node dimension so it scales sensibly.
  let meanDim = 0
  for (const r of Object.values(abs)) meanDim += (r.w + r.h) / 2
  meanDim = ids.length > 0 ? meanDim / ids.length : 1
  const symNorm = meanDim > 0 ? symDeficit / meanDim : 0

  // ── 6. Label room: a relation's label sits between its ends; ends closer
  // than the label needs (along the axis they are apart on) leave it
  // nowhere but over a node. 0 when there is room, 1 when the ends touch.
  let labelCrowding = 0
  for (const r of edges) {
    const size = labelSizeOf(r, nodes)
    if (!size) continue
    if (ancestors[r.sourceId]?.has(r.targetId) || ancestors[r.targetId]?.has(r.sourceId)) continue
    const a = abs[r.sourceId], b = abs[r.targetId]
    const need = labelNeed(size)
    const gapX = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w)
    const gapY = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h)
    const missing = Math.min(1, Math.max(0, 1 - Math.max(gapX / need.x, gapY / need.y)))
    labelCrowding += missing * missing
  }

  const spaceImbalance = spaceImbalanceOf(nodes, abs)
  const perEdge = edgeScale(edges.length)
  const perPair = pairScale(edges.length)
  const composite =
      render.renderedCrossings * W_CROSS * perPair
    + render.renderedOverdraws * W_OVERDRAW * perEdge
    + render.stubLoopPenalty   * W_STUBLOOP * perEdge
    + overlapCost(nodeOverlap)
    + lengthExcess             * W_LONG * perEdge
    + edgeLengthMean           * W_LMEAN
    + edgeLengthMax            * W_LMAX
    + leafCentrality           * W_LEAF
    + aspect                   * W_ASPECT
    + compactness              * W_COMPACT
    + symNorm                  * W_SYMMETRY
    + labelCrowding            * W_LABEL * perEdge
    + render.corridorCrowding  * W_CORRIDOR * perEdge
    + render.labelCollisions   * W_LABEL_COLLISION * perEdge
    + render.sideLoad          * W_SIDE_LOAD * perEdge
    + spaceImbalance           * W_SPACE_IMBALANCE

  return {
    renderedCrossings: render.renderedCrossings,
    renderedOverdraws: render.renderedOverdraws,
    stubLoopPenalty: render.stubLoopPenalty,
    nodeOverlap,
    edgeLengthExcess: lengthExcess,
    edgeLengthMean,
    edgeLengthMax,
    leafCentrality,
    aspectPenalty: aspect,
    compactness,
    symmetryDeficit: symNorm,
    labelCrowding,
    corridorCrowding: render.corridorCrowding,
    shallowCrossings: render.shallowCrossings,
    crowdedAngles: render.crowdedAngles,
    edgeLengthSd,
    labelCollisions: render.labelCollisions,
    sideLoad: render.sideLoad,
    spaceImbalance,
    composite,
  }
}

// Renamed inner function to avoid collision with the (now-exported) field name.
function symmetryDeficitFn(
  abs: Record<string, { cx: number; cy: number }>,
  ids: string[],
): number {
  if (ids.length < 4) return 0
  let cx = 0, cy = 0
  for (const id of ids) { cx += abs[id].cx; cy += abs[id].cy }
  cx /= ids.length; cy /= ids.length
  const computeAxis = (flipX: boolean): number => {
    let total = 0
    let count = 0
    for (const id of ids) {
      const a = abs[id]
      const ra = flipX
        ? { x: 2 * cx - a.cx, y: a.cy }
        : { x: a.cx, y: 2 * cy - a.cy }
      let best = Infinity
      for (const id2 of ids) {
        if (id2 === id) continue
        const b = abs[id2]
        const d = Math.hypot(ra.x - b.cx, ra.y - b.cy)
        if (d < best) best = d
      }
      total += best
      count++
    }
    return count > 0 ? total / count : 0
  }
  return Math.min(computeAxis(true), computeAxis(false))
}


// ─── Shared spacing baseline ──────────────────────────────────────────────
//
// Numeric spacing comes from elkSpacingBase.ts (shared with elkLayout.ts) —
// only the fields specific to the ensemble's own padding/thoroughness/
// crossing-minimisation profile are kept here.

const COMMON_SPACING: LayoutOptions = {
  ...ELK_ROOT_SPACING,
  'elk.layered.unnecessaryBendpoints': 'true',
  'elk.layered.compaction.postCompaction.strategy': 'EDGE_LENGTH',
  'elk.padding': '[top=40, right=30, bottom=30, left=30]',
  'elk.separateConnectedComponents': 'true',
  'elk.layered.thoroughness': '50',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.crossingMinimization.greedySwitch.type': 'TWO_SIDED',
}

const CHILD_PAD = compoundPadding('container')
const CHILD_SPACING: LayoutOptions = {
  ...COMMON_SPACING,
  ...ELK_CHILD_SPACING,
  // Same header room finalizeLayout gives every compound, so ELK plans
  // for the size the container will actually have.
  'elk.padding': `[top=${CHILD_PAD.top}, right=${CHILD_PAD.side}, bottom=${CHILD_PAD.bottom}, left=${CHILD_PAD.side}]`,
}

function elkLayered(
  direction: 'DOWN' | 'RIGHT',
  placement: 'BRANDES_KOEPF' | 'NETWORK_SIMPLEX',
  modelOrder: boolean,
  layering: 'NETWORK_SIMPLEX' | 'LONGEST_PATH' | 'COFFMAN_GRAHAM' | 'MIN_WIDTH' = 'NETWORK_SIMPLEX',
): LayoutOptions {
  return {
    ...COMMON_SPACING,
    'elk.algorithm': 'layered',
    'elk.direction': direction,
    'elk.layered.layering.strategy': layering,
    'elk.layered.nodePlacement.strategy': placement,
    'elk.layered.considerModelOrder.strategy': modelOrder ? 'NODES_AND_EDGES' : 'NONE',
    // Let ELK shape the bounding box (matches our composite aspectPenalty).
    'elk.aspectRatio': '1.4',
  }
}

function elkLayeredChild(
  direction: 'DOWN' | 'RIGHT',
  placement: 'BRANDES_KOEPF' | 'NETWORK_SIMPLEX',
): LayoutOptions {
  return {
    ...CHILD_SPACING,
    'elk.algorithm': 'layered',
    'elk.direction': direction,
    'elk.layered.nodePlacement.strategy': placement,
    'elk.layered.considerModelOrder.strategy': 'NONE',
  }
}

/**
 * Stress-majorisation layout (Gansner et al. 2005). Treats every edge as
 * a spring whose ideal length is its graph-theoretic distance, then
 * minimises a stress functional. Excellent for sparse near-planar graphs
 * — often produces zero crossings on series-parallel structures.
 */
function elkStress(): LayoutOptions {
  return {
    'elk.algorithm': 'stress',
    'elk.stress.desiredEdgeLength': '180',
    'elk.stress.epsilon': '0.0001',
    'elk.stress.iterationLimit': '600',
    'elk.spacing.nodeNode': '60',
    'elk.padding': '[top=40, right=30, bottom=30, left=30]',
    'elk.separateConnectedComponents': 'true',
    'elk.spacing.componentComponent': '80',
  }
}

/**
 * Eades-style force-directed layout. Nodes repel by Coulomb, edges
 * attract by Hooke. Uncovers symmetric / clustered topologies that
 * Sugiyama linearises into a flat row.
 */
function elkForce(): LayoutOptions {
  return {
    'elk.algorithm': 'force',
    'elk.force.iterations': '400',
    'elk.force.repulsivePower': '0',
    'elk.force.temperature': '0.001',
    'elk.spacing.nodeNode': '70',
    'elk.padding': '[top=40, right=30, bottom=30, left=30]',
    'elk.separateConnectedComponents': 'true',
    'elk.spacing.componentComponent': '80',
  }
}

/**
 * Mr.Tree — multi-rooted tree layout, Reingold-Tilford-ish. Wins outright
 * when the relation graph is an arborescence (≥ 90 % of edges form a
 * spanning tree). On general graphs it produces garbage, so the ensemble
 * will reject it via crossing count.
 */
function elkMrTree(): LayoutOptions {
  return {
    'elk.algorithm': 'mrtree',
    'elk.spacing.nodeNode': '60',
    'elk.padding': '[top=40, right=30, bottom=30, left=30]',
    'elk.separateConnectedComponents': 'true',
    'elk.spacing.componentComponent': '80',
  }
}

// ─── Metamodel-derived containment rank ───────────────────────────────────

function maxContainmentDepth(mm?: Metamodel): number {
  if (!mm) return 1
  const types = Object.values(mm.nodeTypes)
  if (types.length === 0) return 0
  const depthOf = (id: string, seen: Set<string>): number => {
    if (seen.has(id)) return 0
    seen.add(id)
    const t = mm.nodeTypes[id]
    if (!t) return 0
    const parents = t.allowedParents ?? []
    if (parents.length === 0) return 0
    let max = 0
    for (const p of parents) {
      const d = depthOf(p, seen) + 1
      if (d > max) max = d
    }
    return max
  }
  let max = 0
  for (const t of types) {
    const d = depthOf(t.id, new Set())
    if (d > max) max = d
  }
  return max
}

// ─── Planarity / skewness proxy ───────────────────────────────────────────
//
// True planarity testing (Boyer-Myrvold, O(n)) and exact skewness are
// expensive and not actionable for the user. We surface a fast geometric
// proxy: the *crossing-edge ratio* — fraction of edges that participate
// in ≥ 1 crossing in the current straight-line drawing. For a planar
// drawing this is 0; for K5 it is 1.0. This is what the user actually
// perceives as "messy".

export interface PlanarityScore {
  /** Number of edges that cross at least one other edge. */
  crossingEdges: number
  /** Total edges considered (those whose endpoints are positioned). */
  totalEdges: number
  /** crossingEdges / totalEdges, ∈ [0, 1]. */
  ratio: number
  /** Verdict label ('planar' | 'near-planar' | 'tangled'). */
  verdict: 'planar' | 'near-planar' | 'tangled'
}

function computePlanarityScore(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
): PlanarityScore {
  const memo: Record<string, { x: number; y: number }> = {}
  const absXY = (id: string): { x: number; y: number } => {
    if (memo[id]) return memo[id]
    const n = nodes[id]
    if (!n) return { x: 0, y: 0 }
    if (!n.parentId) memo[id] = { x: n.x, y: n.y }
    else {
      const p = absXY(n.parentId)
      memo[id] = { x: p.x + n.x, y: p.y + n.y }
    }
    return memo[id]
  }
  const abs: Record<string, { cx: number; cy: number }> = {}
  for (const n of Object.values(nodes)) {
    const a = absXY(n.id)
    abs[n.id] = { cx: a.x + n.width / 2, cy: a.y + n.height / 2 }
  }

  const ccw = (
    ax: number, ay: number,
    bx: number, by: number,
    cx: number, cy: number,
  ): boolean => (cy - ay) * (bx - ax) > (by - ay) * (cx - ax)

  const edges = Object.values(relations).filter((r) => abs[r.sourceId] && abs[r.targetId])
  const crossed = new Set<string>()

  for (let i = 0; i < edges.length; i++) {
    const a = edges[i]
    const a1 = abs[a.sourceId]
    const a2 = abs[a.targetId]
    for (let j = i + 1; j < edges.length; j++) {
      const b = edges[j]
      if (a.sourceId === b.sourceId || a.sourceId === b.targetId
       || a.targetId === b.sourceId || a.targetId === b.targetId) continue
      const b1 = abs[b.sourceId]
      const b2 = abs[b.targetId]
      const cross =
        ccw(a1.cx, a1.cy, b1.cx, b1.cy, b2.cx, b2.cy) !==
          ccw(a2.cx, a2.cy, b1.cx, b1.cy, b2.cx, b2.cy) &&
        ccw(a1.cx, a1.cy, a2.cx, a2.cy, b1.cx, b1.cy) !==
          ccw(a1.cx, a1.cy, a2.cx, a2.cy, b2.cx, b2.cy)
      if (cross) {
        crossed.add(a.id)
        crossed.add(b.id)
      }
    }
  }

  const total = edges.length
  const ratio = total === 0 ? 0 : crossed.size / total
  const verdict: PlanarityScore['verdict'] =
    crossed.size === 0 ? 'planar' : ratio < 0.15 ? 'near-planar' : 'tangled'

  return { crossingEdges: crossed.size, totalEdges: total, ratio, verdict }
}

// ─── Simulated-annealing refinement ───────────────────────────────────────
//
// Davidson-Harel 1996 (engine in annealing.ts). After the ensemble ranks
// the candidates, three phases refine the winner:
//
//   A. root nodes, cheap incremental proxy energy, run on the top two
//      candidates — whichever ends in the better basin continues;
//   B. the children of every compound, same proxy, confined to the parent
//      so containers don't balloon and collide with their neighbours;
//   C. root nodes again, full render-aware composite, gentle polish.
//
// Budgets are counted in estimated work (pairwise geometry tests), not
// milliseconds, so the same diagram always gets the same layout on any
// machine. They are sized to roughly 0.3–0.5 s per phase on a large
// diagram; the deadlines sit well above that and only cap pathological
// inputs or very slow machines.

interface SARefinement {
  positions: PositionMap
  before: number
  after: number
  iterations: number
}

/** Phase A work per candidate, in pairwise tests. */
const PHASE_A_WORK = 4e6
/** Phase B work shared by all compounds, in pairwise tests. */
const PHASE_B_WORK = 5e6
/** Phase C work, in units of E² + E·n + n² (one full composite score). */
const PHASE_C_WORK = 3e6
/** How far (as a fraction of the parent's size) phase B lets children reshape it. */
const COMPOUND_SLACK = 0.5
const PHASE_A_DEADLINE_MS = 3000
const PHASE_B_DEADLINE_MS = 1500
const PHASE_C_DEADLINE_MS = 1500

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/**
 * Sweeps per restart that fit `work` pairwise tests. A proxy probe moving
 * one member re-tests its subtree's nodes and incident edges against every
 * edge and node: ≈ (E + n) · (|subtree| + |incident edges|).
 */
function sweepsFor(
  g: LayoutGraph, group: number[], work: number, restarts: number, min: number, max: number,
): number {
  let moved = 0
  for (const i of group) {
    const sub = g.subtree[i]
    moved += sub.length
    for (const k of sub) moved += g.incident[k].length
  }
  const probeCost = (g.E + g.n) * (moved / group.length) + group.length
  const probes = work / probeCost
  return clamp(Math.round(probes / (restarts * (group.length + 1))), min, max)
}

function readPositions(g: LayoutGraph): PositionMap {
  const out: PositionMap = {}
  for (let i = 0; i < g.n; i++) {
    out[g.ids[i]] = { x: g.relX[i], y: g.relY[i], width: g.w[i], height: g.h[i] }
  }
  return out
}

function rootsOf(g: LayoutGraph): number[] {
  const roots: number[] = []
  for (let i = 0; i < g.n; i++) if (g.parent[i] === -1) roots.push(i)
  return roots
}

function refineRoots(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  positions: PositionMap,
  rng: Rng,
  deadline: number,
): SARefinement {
  const g = buildLayoutGraph(projectPositions(nodes, positions), relations)
  const group = rootsOf(g)
  const restarts = 4
  const res = anneal(new ProxyEnergy(g), g, group, {
    rng, restarts,
    sweeps: sweepsFor(g, group, PHASE_A_WORK, restarts, 12, 150),
    stepFactor: 0.06, tempFactor: 1, calibrationSamples: 24,
    gap: ROOT_GAP, pairGap: pairGapsOf(g, nodes, relations), deadline,
  })
  return { positions: readPositions(g), before: res.before, after: res.after, iterations: res.evaluations }
}

function refineCompounds(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  positions: PositionMap,
  rng: Rng,
  deadline: number,
): SARefinement {
  const work = projectPositions(nodes, positions)
  const g = buildLayoutGraph(work, relations)
  const ev = new ProxyEnergy(g)
  const before = ev.energy()
  const pairGap = pairGapsOf(g, nodes, relations)

  const groups = new Map<number, number[]>()
  for (let i = 0; i < g.n; i++) {
    const p = g.parent[i]
    if (p === -1) continue
    const list = groups.get(p)
    if (list) list.push(i)
    else groups.set(p, [i])
  }
  const depth = (i: number): number => {
    let d = 0
    for (let p = g.parent[i]; p !== -1; p = g.parent[p]) d++
    return d
  }
  const parents = [...groups.keys()].sort((a, b) => depth(b) - depth(a) || a - b)

  let iterations = 0
  const restarts = 2
  const compounds = parents.filter((p) => groups.get(p)!.length >= 2).length
  for (const p of parents) {
    const group = groups.get(p)!
    if (group.length < 2) continue
    // Children may reshape their parent by up to half its size (the parent
    // is refitted and roots re-separated afterwards) but not wander off.
    const pad = compoundPadding(work[g.ids[p]].type)
    const slackX = g.w[p] * COMPOUND_SLACK
    const slackY = g.h[p] * COMPOUND_SLACK
    const bounds: Bounds = {
      minX: pad.side - slackX,
      minY: pad.top,
      maxX: g.w[p] - pad.side + slackX,
      maxY: g.h[p] - pad.bottom + slackY,
    }
    const res = anneal(ev, g, group, {
      rng, restarts,
      sweeps: sweepsFor(g, group, PHASE_B_WORK / compounds, restarts, 6, 100),
      stepFactor: 0.08, tempFactor: 1, calibrationSamples: 12,
      gap: CHILD_GAP, pairGap, bounds, deadline,
    })
    iterations += res.evaluations
  }
  return { positions: readPositions(g), before, after: ev.energy(), iterations }
}

function polishRoots(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  positions: PositionMap,
  rng: Rng,
  deadline: number,
  style: EdgeStyle = 'curved',
): SARefinement {
  const work = projectPositions(nodes, positions)
  const g = buildLayoutGraph(work, relations)
  const group = rootsOf(g)
  // Every probe is a full render-aware re-score, so size the run by cost.
  const probeCost = g.E * g.E + g.E * g.n + g.n * g.n + 1
  const probes = clamp(Math.round(PHASE_C_WORK / probeCost), 30, 4000)
  const opts: AnnealOptions = {
    rng, restarts: 1,
    sweeps: clamp(Math.round(probes / (group.length + 1)), 2, 200),
    stepFactor: 0.02, tempFactor: 0.25, calibrationSamples: 6,
    gap: ROOT_GAP, pairGap: pairGapsOf(g, nodes, relations), deadline,
  }
  const res = anneal(new FunctionEnergy(g, work, relations, (n, r) => compositeEnergy(n, r, style)), g, group, opts)
  return { positions: readPositions(g), before: res.before, after: res.after, iterations: res.evaluations }
}

/**
 * Yields control back to the event loop between phases so progress
 * messages are delivered and, on the in-thread fallback, the UI can paint.
 */
function yieldToUI(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _sched = (globalThis as any).scheduler
  if (_sched != null && typeof _sched.yield === 'function') {
    return _sched.yield() as Promise<void>
  }
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}

// ─── Candidate runner ─────────────────────────────────────────────────────

export interface SmartLayoutCandidate {
  name: string
  metrics: LayoutMetrics
  /** Full composite breakdown — used for ranking + diagnostics. */
  score: CompositeScore
  positions: PositionMap
}

export interface SmartLayoutResult {
  winner: SmartLayoutCandidate
  candidates: SmartLayoutCandidate[]
  /** Metrics of the input layout (before any change) — for the UI badge. */
  baseline: LayoutMetrics
  /** Planarity verdict of the winning layout. */
  planarity: PlanarityScore
  /** Composite cost of the refined candidate before and after annealing. */
  refinement: { before: number; after: number; iterations: number }
  /** True when nothing Smart Layout produced beat the layout it was given. */
  keptCurrent: boolean
}

function projectPositions(nodes: Record<string, C4Node>, positions: PositionMap): Record<string, C4Node> {
  const out: Record<string, C4Node> = {}
  for (const [id, n] of Object.entries(nodes)) {
    const p = positions[id]
    out[id] = p
      ? { ...n, x: p.x, y: p.y, width: p.width ?? n.width, height: p.height ?? n.height }
      : { ...n }
  }
  return out
}

/** A candidate layout straight out of its engine, before any post-processing. */
export interface RawCandidate {
  name: string
  positions: PositionMap
}

/** Run one engine; failures and empty results drop the candidate. */
async function generateCandidate(
  name: string,
  run: () => Promise<PositionMap> | PositionMap,
): Promise<RawCandidate | null> {
  try {
    const positions = await run()
    return Object.keys(positions).length === 0 ? null : { name, positions }
  } catch (err) {
    console.warn(`[smartLayout] candidate ${name} failed:`, err)
    return null
  }
}

/**
 * Score one raw candidate after geometric crossing minimisation, so all
 * candidates compete fairly, and after finalising (sibling swaps can collide
 * boxes of different sizes), so the score describes what would be rendered.
 */
function scoreCandidate(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  candidate: RawCandidate,
  alignments: readonly Alignment[],
  style: EdgeStyle = 'curved',
): SmartLayoutCandidate | null {
  try {
    const raw: PositionMap = { ...candidate.positions }
    const swap = minimizeCrossings(projectPositions(nodes, raw), relations)
    for (const [id, p] of Object.entries(swap)) {
      const prev = raw[id]
      if (prev) raw[id] = { ...prev, x: p.x, y: p.y }
    }
    const positions = finalizeLayout(nodes, relations, raw, alignments)
    const projected = projectPositions(nodes, positions)
    const metrics = computeLayoutMetrics(projected, relations)
    const score = computeCompositeScore(projected, relations, style)
    return { name: candidate.name, positions, metrics, score }
  } catch (err) {
    console.warn(`[smartLayout] candidate ${candidate.name} failed:`, err)
    return null
  }
}

/**
 * What the live physics makes of a layout, as one more candidate. The canvas
 * used to relax every small diagram after a layout, whatever Smart Layout
 * had chosen: mostly for the worse on C4 diagrams, for the better where the
 * engines spread many unrelated root elements wide. Scored here like the
 * others, that relaxation is kept only when it wins, and the canvas leaves
 * the result alone. Null for a diagram too large to relax, or when the
 * physics does not keep the alignments.
 */
function relaxedCandidate(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  from: SmartLayoutCandidate,
  alignments: readonly Alignment[],
  style: EdgeStyle = 'curved',
): SmartLayoutCandidate | null {
  try {
    const moved = relaxLayout({ nodes: projectPositions(nodes, from.positions), relations, alignments: [...alignments] })
    if (!moved) return null
    const positions: PositionMap = { ...from.positions }
    for (const [id, p] of Object.entries(moved)) {
      if (nodes[id]) positions[id] = { ...positions[id], ...p }
    }
    const projected = projectPositions(nodes, positions)
    // The frames the physics leaves are not the ones the candidate gets when
    // it is applied: each container is fitted to its children then. Scored
    // with the physics' frames, the winner on the sample's All elements
    // scored better than what was saved, and every later run "improved" on
    // it again without moving anything. Fit them here, as applying does.
    resizeParentsBottomUp(projected, { viewFilter: undefined, viewCollapsedSet: new Set<string>(), expandedSet: undefined })
    for (const [id, n] of Object.entries(projected)) {
      if (!positions[id] || nodes[id].collapsed) continue
      if (positions[id].width !== n.width || positions[id].height !== n.height) {
        positions[id] = { ...positions[id], width: n.width, height: n.height }
      }
    }
    if (alignmentError(projected, {}, alignments) > 1) return null
    return {
      name: `${from.name} · relaxed`,
      positions,
      metrics: computeLayoutMetrics(projected, relations),
      score: computeCompositeScore(projected, relations, style),
    }
  } catch (err) {
    console.warn('[smartLayout] relaxed candidate failed:', err)
    return null
  }
}

/** Result when no candidate survived: leave the diagram as it is. */
function unchangedResult(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  style: EdgeStyle = 'curved',
): SmartLayoutResult {
  const baseline = computeLayoutMetrics(nodes, relations)
  const score = computeCompositeScore(nodes, relations, style)
  return {
    baseline,
    winner: { name: 'baseline', metrics: baseline, score, positions: {} },
    candidates: [],
    planarity: computePlanarityScore(nodes, relations),
    refinement: { before: score.composite, after: score.composite, iterations: 0 },
    keptCurrent: true,
  }
}

/**
 * Result of the ELK candidate-generation phase.
 *
 * `done: true`  — all candidates failed; `result` is a baseline fallback and
 *                 the worker phase should be skipped.
 * `done: false` — raw candidates are ready; pass `nodes / relations / raw`
 *                 to `runSmartLayoutWorkerPhase` (normally in the Web
 *                 Worker). `nodes` and `relations` are the visible
 *                 projection of the input — the worker phase must use them,
 *                 not the raw input.
 */
export type ELKPhaseResult =
  | { done: true; result: SmartLayoutResult }
  | {
      done: false
      nodes: Record<string, C4Node>
      relations: Record<string, C4Relation>
      raw: RawCandidate[]
    }

/**
 * In-run progress, reported so the UI can show that Smart Layout is actually
 * trying multiple algorithms rather than just spinning opaquely.
 */
export type SmartLayoutProgress =
  | { phase: 'candidates' | 'ranking'; done: number; total: number }
  | { phase: 'refining-a' | 'refining-b' | 'refining-c' | 'relaxing' }

export type SmartLayoutOnProgress = (progress: SmartLayoutProgress) => void

/**
 * ELK candidate-generation phase — always runs on the main thread.
 *
 * elk-worker.min.js is a standalone Web Worker script and cannot be imported
 * inside another worker, so this phase must never be called from inside the
 * Smart Layout worker. It only runs the engines; everything CPU-heavy that
 * follows (crossing minimisation, scoring, annealing) belongs to
 * `runSmartLayoutWorkerPhase`, off the main thread.
 */
export async function runSmartLayoutELKPhase(
  inputNodes: Record<string, C4Node>,
  inputRelations: Record<string, C4Relation>,
  metamodel?: Metamodel,
  onProgress?: SmartLayoutOnProgress,
): Promise<ELKPhaseResult> {
  const { nodes, relations } = projectToVisibleGraph(inputNodes, inputRelations)
  // Dynamic import so ELK (with its elk-worker.min.js CJS dependency) is NOT
  // bundled into the Web Worker chunk — it's code-split and fetched only when
  // this function is called from the main thread.
  const { applyElkLayout } = await import('./elkLayout')
  const depth = maxContainmentDepth(metamodel)
  const mmDirection: 'DOWN' | 'RIGHT' = depth >= 2 ? 'RIGHT' : 'DOWN'

  // Twelve structurally different candidates. stress / force / mrtree may
  // degrade on compound graphs — generateCandidate swallows failures so the
  // remaining set still wins.
  const engines: [name: string, run: () => Promise<PositionMap> | PositionMap][] = [
    [
      'Layered TB · Brandes-Köpf · model-order',
      () => applyElkLayout(nodes, relations, {
        rootOptions: elkLayered('DOWN', 'BRANDES_KOEPF', true),
        childOptions: elkLayeredChild('RIGHT', 'BRANDES_KOEPF'),
      }),
    ],
    [
      'Layered LR · Brandes-Köpf · model-order',
      () => applyElkLayout(nodes, relations, {
        rootOptions: elkLayered('RIGHT', 'BRANDES_KOEPF', true),
        childOptions: elkLayeredChild('DOWN', 'BRANDES_KOEPF'),
      }),
    ],
    [
      'Layered TB · NetworkSimplex',
      () => applyElkLayout(nodes, relations, {
        rootOptions: elkLayered('DOWN', 'NETWORK_SIMPLEX', false),
        childOptions: elkLayeredChild('RIGHT', 'NETWORK_SIMPLEX'),
      }),
    ],
    [
      'Layered TB · Longest-Path · Brandes-Köpf',
      () => applyElkLayout(nodes, relations, {
        rootOptions: elkLayered('DOWN', 'BRANDES_KOEPF', true, 'LONGEST_PATH'),
        childOptions: elkLayeredChild('RIGHT', 'BRANDES_KOEPF'),
      }),
    ],
    [
      'Layered TB · MinWidth · Brandes-Köpf',
      () => applyElkLayout(nodes, relations, {
        rootOptions: elkLayered('DOWN', 'BRANDES_KOEPF', true, 'MIN_WIDTH'),
        childOptions: elkLayeredChild('RIGHT', 'BRANDES_KOEPF'),
      }),
    ],
    [
      `Metamodel-aware (root ${mmDirection}, Brandes-Köpf)`,
      () => applyElkLayout(nodes, relations, {
        rootOptions: elkLayered(mmDirection, 'BRANDES_KOEPF', true),
        childOptions: elkLayeredChild(mmDirection === 'DOWN' ? 'RIGHT' : 'DOWN', 'BRANDES_KOEPF'),
      }),
    ],
    [
      'Layered TB · packed groups',
      () => applyElkLayout(nodes, relations, {
        rootOptions: elkLayered('DOWN', 'BRANDES_KOEPF', true),
        childOptions: elkLayeredChild('RIGHT', 'BRANDES_KOEPF'),
        packSparseGroups: true,
      }),
    ],
    [
      'Layered LR · packed groups',
      () => applyElkLayout(nodes, relations, {
        rootOptions: elkLayered('RIGHT', 'BRANDES_KOEPF', true),
        childOptions: elkLayeredChild('DOWN', 'BRANDES_KOEPF'),
        packSparseGroups: true,
      }),
    ],
    [
      'Stress majorisation (Gansner)',
      () => applyElkLayout(nodes, relations, {
        rootOptions: elkStress(),
        childOptions: elkLayeredChild('RIGHT', 'BRANDES_KOEPF'),
      }),
    ],
    [
      'Force-directed (Eades)',
      () => applyElkLayout(nodes, relations, {
        rootOptions: elkForce(),
        childOptions: elkLayeredChild('RIGHT', 'BRANDES_KOEPF'),
      }),
    ],
    [
      'Mr.Tree (Reingold-Tilford)',
      () => applyElkLayout(nodes, relations, {
        rootOptions: elkMrTree(),
        childOptions: elkLayeredChild('RIGHT', 'BRANDES_KOEPF'),
      }),
    ],
    [
      'Radical (semantic C4)',
      () => applyRadicalLayout(nodes, relations),
    ],
  ]

  // Engines run one at a time with a yield in between: bundled ELK runs a
  // whole layout synchronously on this (main) thread, so queueing all twelve at
  // once would freeze the UI for their combined time. One at a time, the
  // longest freeze is a single layout and "N/12 algorithms tried" advances live.
  const total = engines.length
  const raw: RawCandidate[] = []
  onProgress?.({ phase: 'candidates', done: 0, total })
  for (let i = 0; i < total; i++) {
    const [name, run] = engines[i]
    const candidate = await generateCandidate(name, run)
    if (candidate) raw.push(candidate)
    onProgress?.({ phase: 'candidates', done: i + 1, total })
    await yieldToUI()
  }
  if (raw.length === 0) return { done: true, result: unchangedResult(nodes, relations) }
  return { done: false, nodes, relations, raw }
}

export interface SmartLayoutOptions {
  /** The structure-derived seed by default; a "try another arrangement"
   *  action would pass a different one. */
  seed?: number
  /** User alignments (resolveAlignments) every candidate must keep. */
  alignments?: readonly Alignment[]
  /** How the canvas draws relations, so they are scored as they are seen. */
  edgeStyle?: EdgeStyle
}

export async function runSmartLayoutCore(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  metamodel?: Metamodel,
  onProgress?: SmartLayoutOnProgress,
  options: SmartLayoutOptions = {},
): Promise<SmartLayoutResult> {
  const elkResult = await runSmartLayoutELKPhase(nodes, relations, metamodel, onProgress)
  if (elkResult.done) return elkResult.result
  return runSmartLayoutWorkerPhase(elkResult.nodes, elkResult.relations, elkResult.raw, onProgress, options)
}

/**
 * Everything after the engines have run: rank the raw candidates (crossing
 * minimisation, finalising, scoring), then refine the winner with annealing
 * phases A / B / C.
 *
 * Separated from runSmartLayoutCore so that it can be executed in a Web
 * Worker that does NOT include ELK (elk-worker.min.js is a standalone worker
 * script that cannot be imported inside another worker). Only the engines
 * run on the main thread; all of this runs off it.
 *
 * `nodes` / `relations` must be the visible projection returned by the ELK
 * phase. `seed` overrides the structure-derived seed (a "try another
 * arrangement" action would pass a different one).
 */
export async function runSmartLayoutWorkerPhase(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  raw: RawCandidate[],
  onProgress?: SmartLayoutOnProgress,
  options: SmartLayoutOptions = {},
): Promise<SmartLayoutResult> {
  const alignments = options.alignments ?? []
  const style = options.edgeStyle ?? 'curved'
  const baseline = computeLayoutMetrics(nodes, relations)

  // Every candidate scored on every criterion; which wins is decided by
  // their aggregated quality among each other (ranking.ts).
  const valid: SmartLayoutCandidate[] = []
  onProgress?.({ phase: 'ranking', done: 0, total: raw.length })
  for (let i = 0; i < raw.length; i++) {
    const scored = scoreCandidate(nodes, relations, raw[i], alignments, style)
    if (scored) valid.push(scored)
    onProgress?.({ phase: 'ranking', done: i + 1, total: raw.length })
    await yieldToUI()
  }
  if (valid.length === 0) return unchangedResult(nodes, relations, style)
  // Best first, by aggregated quality among them (ranking.ts).
  valid.splice(0, valid.length, ...rankByQuality(valid))

  const rng = createRng(options.seed ?? graphSeed(nodes, relations))

  // Phase A multi-start: refine the top-K candidates independently and
  // continue with whichever scores better as it would be rendered (the
  // proxy energy only approximates that).
  onProgress?.({ phase: 'refining-a' })
  const deadlineA = now() + PHASE_A_DEADLINE_MS
  let best: { from: SmartLayoutCandidate; run: SARefinement; positions: PositionMap; composite: number } | null = null
  let iterationsA = 0
  for (let k = 0; k < Math.min(2, valid.length); k++) {
    const run = refineRoots(nodes, relations, valid[k].positions, rng, deadlineA)
    iterationsA += run.iterations
    const positions = finalizeLayout(nodes, relations, run.positions, alignments)
    const composite = compositeEnergy(projectPositions(nodes, positions), relations, style)
    if (!best || composite < best.composite) best = { from: valid[k], run, positions, composite }
  }
  const refinedFrom = best!.from
  await yieldToUI()

  onProgress?.({ phase: 'refining-b' })
  const phaseB = refineCompounds(nodes, relations, best!.positions, rng, now() + PHASE_B_DEADLINE_MS)
  await yieldToUI()

  onProgress?.({ phase: 'refining-c' })
  const phaseC = polishRoots(nodes, relations, finalizeLayout(nodes, relations, phaseB.positions, alignments), rng, now() + PHASE_C_DEADLINE_MS, style)
  const finalPositions = finalizeLayout(nodes, relations, phaseC.positions, alignments)
  const refined = projectPositions(nodes, finalPositions)

  // Never hand back something worse than we already had: the refined
  // layout competes with every candidate, the physics' relaxation of the
  // best and the layout the user is looking at right now, all ranked
  // together (ranking.ts).
  const refinedCandidate: SmartLayoutCandidate = {
    name: refinedFrom.name,
    positions: finalPositions,
    metrics: computeLayoutMetrics(refined, relations),
    score: computeCompositeScore(refined, relations, style),
  }
  const firstPick = valid[bestIndex([refinedCandidate.score, ...valid.map((c) => c.score)]) - 1] ?? refinedCandidate

  onProgress?.({ phase: 'relaxing' })
  await yieldToUI()
  const relaxed = relaxedCandidate(nodes, relations, firstPick, alignments, style)
  if (relaxed) valid.push(relaxed)
  valid.splice(0, valid.length, ...rankByQuality(valid))

  const currentScore = computeCompositeScore(nodes, relations, style)
  // The layout on screen competes only while it keeps the alignments (a
  // rule just added may not hold there yet).
  const currentCompetes = alignmentError(nodes, {}, alignments) <= 1
  const contenders = [refinedCandidate, ...valid]
  const scores = contenders.map((c) => c.score)
  if (currentCompetes) scores.push(currentScore)
  const pick = currentCompetes ? bestIndexKeepingCurrent(scores) : bestIndex(scores)
  const keptCurrent = currentCompetes && pick === contenders.length
  let winner = keptCurrent ? refinedCandidate : contenders[pick]
  if (keptCurrent) {
    const positions: PositionMap = {}
    for (const n of Object.values(nodes)) positions[n.id] = { x: n.x, y: n.y, width: n.width, height: n.height }
    winner = { name: 'Current layout', positions, metrics: baseline, score: currentScore }
  }

  return {
    baseline,
    winner,
    candidates: valid,
    planarity: computePlanarityScore(projectPositions(nodes, winner.positions), relations),
    refinement: {
      before: refinedFrom.score.composite,
      after: winner.score.composite,
      iterations: iterationsA + phaseB.iterations + phaseC.iterations,
    },
    keptCurrent,
  }
}
