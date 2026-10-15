/**
 * Edge routing: how a relation is drawn between two sides of two nodes, in
 * the canvas's edge style.
 *
 *  - curved: a cubic Bézier along the sides' normals; around a node in the
 *    way, a smooth curve through the corners of an A* route, pulled tight.
 *  - orthogonal: horizontal and vertical segments with rounded corners; a Z
 *    or an L between the sides, and the A* route around a node in the way.
 *
 * Each style keeps to itself: a curved relation used to turn into right
 * angles wherever a node was in the way, so one diagram mixed curves,
 * straight lines and right angles.
 */
import type { EdgeStyle } from '@radical/common/c4'
import { Position } from './side'

// ── Types ─────────────────────────────────────────────────────────────

export interface RoutingObstacle {
  x: number
  y: number
  w: number
  h: number
}

export interface Pt {
  x: number
  y: number
}

// ── Constants ─────────────────────────────────────────────────────────

const CELL = 15        // grid cell size (px) — finer grid = better obstacle avoidance
const OBS_PAD = 20     // padding around obstacles on the grid (wider = routes further around)
const EXIT_DIST = 20   // extension from node border for A* start/end cell
const TURN_PENALTY = 2 // A* penalty for changing direction (lower = more willing to detour)

// ── Helpers ───────────────────────────────────────────────────────────

function extendPt(x: number, y: number, side: Position, dist: number): Pt {
  switch (side) {
    case Position.Top:    return { x, y: y - dist }
    case Position.Bottom: return { x, y: y + dist }
    case Position.Left:   return { x: x - dist, y }
    case Position.Right:  return { x: x + dist, y }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Is srcSide a vertical exit (Top/Bottom)? */
function isVertical(side: Position): boolean {
  return side === Position.Top || side === Position.Bottom
}

// ── A* Pathfinding ────────────────────────────────────────────────────

function astarSearch(
  sc: number, sr: number, tc: number, tr: number,
  cols: number, rows: number, blocked: Uint8Array,
): [number, number][] | null {
  const total = cols * rows
  const idx = (c: number, r: number) => r * cols + c
  const startI = idx(sc, sr)
  const endI = idx(tc, tr)

  const gScore = new Float32Array(total).fill(Infinity)
  const parent = new Int32Array(total).fill(-1)
  const closed = new Uint8Array(total)
  const dir = new Int8Array(total).fill(-1)

  gScore[startI] = 0

  const heapF: number[] = []
  const heapI: number[] = []

  // A binary heap sifted by moving a hole, not by swapping pairs: the same
  // comparisons in the same order (so the same routes), without allocating
  // a pair per swap or resizing the arrays on every pop, which was most of
  // a routed Smart Layout score.
  function push(f: number, i: number) {
    let pos = heapF.length
    heapF.push(f); heapI.push(i)
    while (pos > 0) {
      const p = (pos - 1) >> 1
      if (f < heapF[p]) {
        heapF[pos] = heapF[p]; heapI[pos] = heapI[p]
        pos = p
      } else break
    }
    heapF[pos] = f; heapI[pos] = i
  }

  function pop(): number {
    const top = heapI[0]
    const lastF = heapF.pop()!, lastI = heapI.pop()!
    const n = heapF.length
    if (n > 0) {
      let pos = 0
      while (true) {
        const l = 2 * pos + 1, r = l + 1
        let s = -1, best = lastF
        if (l < n && heapF[l] < best) { s = l; best = heapF[l] }
        if (r < n && heapF[r] < best) { s = r; best = heapF[r] }
        if (s < 0) break
        heapF[pos] = heapF[s]; heapI[pos] = heapI[s]
        pos = s
      }
      heapF[pos] = lastF; heapI[pos] = lastI
    }
    return top
  }

  const h = (c: number, r: number) => Math.abs(tc - c) + Math.abs(tr - r)
  push(h(sc, sr), startI)

  const DIRS: [number, number, number][] = [[1, 0, 0], [-1, 0, 1], [0, 1, 2], [0, -1, 3]]

  while (heapF.length > 0) {
    const ci = pop()
    if (ci === endI) break
    if (closed[ci]) continue
    closed[ci] = 1

    const cc = ci % cols
    const cr = (ci - cc) / cols
    const cg = gScore[ci]
    const cd = dir[ci]

    for (const [dc, dr, d] of DIRS) {
      const nc = cc + dc
      const nr = cr + dr
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue
      const ni = idx(nc, nr)
      if (closed[ni] || (blocked[ni] && ni !== endI)) continue

      const turn = (cd >= 0 && cd !== d) ? TURN_PENALTY : 0
      const ng = cg + 1 + turn
      if (ng < gScore[ni]) {
        gScore[ni] = ng
        parent[ni] = ci
        dir[ni] = d
        push(ng + h(nc, nr), ni)
      }
    }
  }

  if (gScore[endI] === Infinity) return null

  const path: [number, number][] = []
  let k = endI
  while (k !== -1 && k !== startI) {
    path.push([k % cols, Math.floor(k / cols)])
    k = parent[k]
  }
  path.push([sc, sr])
  path.reverse()
  return path
}

// ── Path processing ───────────────────────────────────────────────────

/** Remove collinear intermediate points */
function simplifyPath(pts: Pt[]): Pt[] {
  if (pts.length <= 2) return pts
  const out = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i], c = pts[i + 1]
    if (!((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)))
      out.push(b)
  }
  out.push(pts[pts.length - 1])
  return out
}

/**
 * Build an orthogonal L-shaped stub from border to the first/last grid point.
 * For vertical exit (Top/Bottom): first go vertically to grid Y, then horizontally.
 * For horizontal exit (Left/Right): first go horizontally to grid X, then vertically.
 */
function stubToGrid(border: Pt, grid: Pt, side: Position): Pt[] {
  if (border.x === grid.x && border.y === grid.y) return []
  if (border.x === grid.x || border.y === grid.y) return [] // already aligned, L not needed
  if (isVertical(side)) {
    return [{ x: border.x, y: grid.y }] // vertical first, then horizontal
  } else {
    return [{ x: grid.x, y: border.y }] // horizontal first, then vertical
  }
}

/** Build SVG path string. If 3+ points, smooth the polyline with a
 * cubic bezier through interior corners; otherwise emit a single bezier
 * curve from first→last with control points pulled along the exit sides. */
function buildSvgPath(pts: Pt[]): string {
  if (pts.length < 2) return ''
  if (pts.length === 2) {
    // Straight line — caller will use buildBezierPath for endpoints
    return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`
  }
  // Catmull-Rom-like smoothing: replace each interior corner with a
  // quadratic-style rounded turn using cubic beziers.
  const RADIUS = 24
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1]
    const cur = pts[i]
    const next = pts[i + 1]
    const d1 = Math.hypot(cur.x - prev.x, cur.y - prev.y)
    const d2 = Math.hypot(next.x - cur.x, next.y - cur.y)
    const r = Math.min(RADIUS, d1 / 2, d2 / 2)
    if (r < 1) { d += `L${cur.x},${cur.y}`; continue }
    const t1 = { x: cur.x - (cur.x - prev.x) * (r / d1), y: cur.y - (cur.y - prev.y) * (r / d1) }
    const t2 = { x: cur.x + (next.x - cur.x) * (r / d2), y: cur.y + (next.y - cur.y) * (r / d2) }
    d += `L${t1.x},${t1.y}Q${cur.x},${cur.y} ${t2.x},${t2.y}`
  }
  const last = pts[pts.length - 1]
  d += `L${last.x},${last.y}`
  return d
}

/**
 * Control-point pull distance: half the endpoint distance, capped so very
 * long edges don't loop wildly and very short ones still get a visible bend.
 */
function controlPointPull(dist: number): number {
  return Math.min(180, Math.max(40, dist * 0.5))
}

/** Cubic-bezier control points pulled along each endpoint's exit normal. */
function bezierControlPoints(s: Pt, sSide: Position, t: Pt, tSide: Position): { c1: Pt; c2: Pt } {
  const pull = controlPointPull(Math.hypot(t.x - s.x, t.y - s.y))
  return { c1: extendPt(s.x, s.y, sSide, pull), c2: extendPt(t.x, t.y, tSide, pull) }
}

/** Build a cubic bezier with control points pulled along the exit sides. */
function buildBezierPath(
  s: Pt, sSide: Position, t: Pt, tSide: Position
): string {
  const { c1, c2 } = bezierControlPoints(s, sSide, t, tSide)
  return `M${s.x},${s.y}C${c1.x},${c1.y} ${c2.x},${c2.y} ${t.x},${t.y}`
}

/** Compute midpoint along polyline by arc length */
function polyMidpoint(pts: Pt[]): Pt {
  if (pts.length < 2) return pts[0] ?? { x: 0, y: 0 }
  let total = 0
  for (let i = 1; i < pts.length; i++)
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  let rem = total / 2
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    if (rem <= seg && seg > 0) {
      const t = rem / seg
      return {
        x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x),
        y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y),
      }
    }
    rem -= seg
  }
  return pts[pts.length - 1]
}

// ── Main export ───────────────────────────────────────────────────────

/**
 * De Casteljau sample of cubic bezier at t∈[0,1].
 */
function cubicAt(
  p0x: number, p0y: number, p1x: number, p1y: number,
  p2x: number, p2y: number, p3x: number, p3y: number,
  t: number,
): Pt {
  const u = 1 - t
  const uu = u * u, uuu = uu * u
  const tt = t * t, ttt = tt * t
  return {
    x: uuu * p0x + 3 * uu * t * p1x + 3 * u * tt * p2x + ttt * p3x,
    y: uuu * p0y + 3 * uu * t * p1y + 3 * u * tt * p2y + ttt * p3y,
  }
}

/** Does the cubic bezier pass through any obstacle rect (with padding)?  */
/** Obstacles a caller can query point by point (e.g. through a spatial
 *  index) instead of handing over a list the hit test scans in full. */
export interface ObstacleSet {
  /** True when (x, y) is within `pad` of an obstacle. */
  hits(x: number, y: number, pad: number): boolean
  /** Every obstacle, for routing around them. */
  all(): RoutingObstacle[]
  /** The obstacles' bounding box (null when there are none), so a route that
   *  routeAround would give up on is skipped without listing them all. */
  bounds?(): ObstacleBounds | null
}

export interface ObstacleBounds { minX: number; minY: number; maxX: number; maxY: number }

/** Cells routeAround allows; past this it gives up and the edge stays direct. */
const MAX_ROUTING_CELLS = 60_000

/** routeAround's grid size for the endpoints and obstacles: the same box. */
function routingCells(s: Pt, t: Pt, obstacles: ObstacleBounds | null): number {
  const margin = OBS_PAD * 2 + EXIT_DIST * 2
  let minX = Math.min(s.x, t.x), minY = Math.min(s.y, t.y)
  let maxX = Math.max(s.x, t.x), maxY = Math.max(s.y, t.y)
  if (obstacles) {
    minX = Math.min(minX, obstacles.minX - OBS_PAD)
    minY = Math.min(minY, obstacles.minY - OBS_PAD)
    maxX = Math.max(maxX, obstacles.maxX + OBS_PAD)
    maxY = Math.max(maxY, obstacles.maxY + OBS_PAD)
  }
  minX -= margin; minY -= margin
  maxX += margin; maxY += margin
  return Math.max(4, Math.ceil((maxX - minX) / CELL)) * Math.max(4, Math.ceil((maxY - minY) / CELL))
}

/** A uniform grid over obstacles, built once and queried by many edges:
 *  each point of a curve's hit test looks at one cell instead of every
 *  obstacle. Items carry their rect plus whatever the caller filters on. */
export class ObstacleGrid<T extends { rect: RoutingObstacle }> {
  private readonly cells = new Map<number, T[]>()
  /** Items by left, top, right and bottom edge, outermost first. */
  private readonly extremes: [T[], T[], T[], T[]]

  /** `pad` bounds the pad a query may use (the hit test uses HIT_PAD). */
  constructor(readonly items: T[], private readonly cell = 256, private readonly pad = 8) {
    this.extremes = [
      [...items].sort((a, b) => a.rect.x - b.rect.x),
      [...items].sort((a, b) => a.rect.y - b.rect.y),
      [...items].sort((a, b) => b.rect.x + b.rect.w - (a.rect.x + a.rect.w)),
      [...items].sort((a, b) => b.rect.y + b.rect.h - (a.rect.y + a.rect.h)),
    ]
    for (const item of items) {
      const r = item.rect
      for (let cx = Math.floor((r.x - pad) / cell); cx <= Math.floor((r.x + r.w + pad) / cell); cx++) {
        for (let cy = Math.floor((r.y - pad) / cell); cy <= Math.floor((r.y + r.h + pad) / cell); cy++) {
          const list = this.cells.get(this.key(cx, cy))
          if (list) list.push(item)
          else this.cells.set(this.key(cx, cy), [item])
        }
      }
    }
  }

  private key(cx: number, cy: number): number {
    return cx * 1_048_576 + cy
  }

  /** The obstacles that are not `excluded`, e.g. an edge's own ends. */
  without(excluded: (item: T) => boolean): ObstacleSet {
    return {
      hits: (x, y, pad) => {
        if (pad > this.pad) throw new Error(`ObstacleGrid: pad ${pad} exceeds the grid's ${this.pad}`)
        for (const item of this.cells.get(this.key(Math.floor(x / this.cell), Math.floor(y / this.cell))) ?? []) {
          const r = item.rect
          if (x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad && !excluded(item)) return true
        }
        return false
      },
      all: () => this.items.filter((item) => !excluded(item)).map((item) => item.rect),
      bounds: () => {
        const [left, top, right, bottom] = this.extremes.map((list) => list.find((item) => !excluded(item)))
        if (!left || !top || !right || !bottom) return null
        return { minX: left.rect.x, minY: top.rect.y, maxX: right.rect.x + right.rect.w, maxY: bottom.rect.y + bottom.rect.h }
      },
    }
  }
}

function bezierHitsObstacles(
  s: Pt, c1: Pt, c2: Pt, t: Pt,
  obstacles: RoutingObstacle[] | ObstacleSet,
  pad: number,
  samples = 16,
): boolean {
  if (!Array.isArray(obstacles)) {
    for (let i = 1; i < samples; i++) {
      const p = cubicAt(s.x, s.y, c1.x, c1.y, c2.x, c2.y, t.x, t.y, i / samples)
      if (obstacles.hits(p.x, p.y, pad)) return true
    }
    return false
  }
  if (obstacles.length === 0) return false
  for (let i = 1; i < samples; i++) {
    const u = i / samples
    const p = cubicAt(s.x, s.y, c1.x, c1.y, c2.x, c2.y, t.x, t.y, u)
    for (let j = 0; j < obstacles.length; j++) {
      const o = obstacles[j]
      if (
        p.x >= o.x - pad && p.x <= o.x + o.w + pad &&
        p.y >= o.y - pad && p.y <= o.y + o.h + pad
      ) return true
    }
  }
  return false
}

/** Run A* on a grid built from obstacles; returns world-space polyline
 *  including the start/end border points, or null if no path was found. */
function routeAround(
  s: Pt, sSide: Position, t: Pt, tSide: Position,
  obstacles: RoutingObstacle[],
): Pt[] | null {
  // Build a bounding box that contains all obstacles + endpoints + margin.
  const margin = OBS_PAD * 2 + EXIT_DIST * 2
  let minX = Math.min(s.x, t.x), minY = Math.min(s.y, t.y)
  let maxX = Math.max(s.x, t.x), maxY = Math.max(s.y, t.y)
  for (const o of obstacles) {
    if (o.x - OBS_PAD < minX) minX = o.x - OBS_PAD
    if (o.y - OBS_PAD < minY) minY = o.y - OBS_PAD
    if (o.x + o.w + OBS_PAD > maxX) maxX = o.x + o.w + OBS_PAD
    if (o.y + o.h + OBS_PAD > maxY) maxY = o.y + o.h + OBS_PAD
  }
  minX -= margin; minY -= margin
  maxX += margin; maxY += margin

  const cols = Math.max(4, Math.ceil((maxX - minX) / CELL))
  const rows = Math.max(4, Math.ceil((maxY - minY) / CELL))
  // Bail out on pathological grids — keeps worst-case cost bounded.
  if (cols * rows > MAX_ROUTING_CELLS) return null

  const blocked = new Uint8Array(cols * rows)
  for (const o of obstacles) {
    const c0 = clamp(Math.floor((o.x - OBS_PAD - minX) / CELL), 0, cols - 1)
    const c1 = clamp(Math.ceil((o.x + o.w + OBS_PAD - minX) / CELL), 0, cols - 1)
    const r0 = clamp(Math.floor((o.y - OBS_PAD - minY) / CELL), 0, rows - 1)
    const r1 = clamp(Math.ceil((o.y + o.h + OBS_PAD - minY) / CELL), 0, rows - 1)
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) blocked[r * cols + c] = 1
    }
  }

  // Compute grid entry/exit points (one cell off the border, along the side normal).
  const sExit = extendPt(s.x, s.y, sSide, EXIT_DIST)
  const tExit = extendPt(t.x, t.y, tSide, EXIT_DIST)
  const sc = clamp(Math.round((sExit.x - minX) / CELL), 0, cols - 1)
  const sr = clamp(Math.round((sExit.y - minY) / CELL), 0, rows - 1)
  const tc = clamp(Math.round((tExit.x - minX) / CELL), 0, cols - 1)
  const tr = clamp(Math.round((tExit.y - minY) / CELL), 0, rows - 1)
  // Force start/end cells passable so we never reject the path because the
  // endpoint sits just inside a node's padding band.
  blocked[sr * cols + sc] = 0
  blocked[tr * cols + tc] = 0

  const cells = astarSearch(sc, sr, tc, tr, cols, rows, blocked)
  if (!cells) return null

  // Convert grid cells back to world coords.
  const grid: Pt[] = cells.map(([c, r]) => ({
    x: minX + c * CELL,
    y: minY + r * CELL,
  }))
  // Stitch border → grid stub → ... → grid stub → border so the polyline
  // exits along the correct side normal at both endpoints.
  const head = stubToGrid(s, grid[0], sSide)
  const tail = stubToGrid(t, grid[grid.length - 1], tSide).reverse()
  return simplifyPath([s, ...head, ...grid, ...tail, t])
}

/** Padding of the direct curve's hit test: smaller than the routing OBS_PAD,
 *  so an edge is re-routed only when its curve clearly goes *through* a node,
 *  not when it grazes the padding zone (otherwise nearly every edge would be). */
const HIT_PAD = 4

/** The box the direct curve stays in (its control points' box), padded for
 *  the hit test: an obstacle outside it cannot make computeRoutedEdge re-route. */
export function directCurveBox(
  sx: number, sy: number, srcSide: Position,
  tx: number, ty: number, tgtSide: Position,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const { c1, c2 } = bezierControlPoints({ x: sx, y: sy }, srcSide, { x: tx, y: ty }, tgtSide)
  return {
    minX: Math.min(sx, tx, c1.x, c2.x) - HIT_PAD, minY: Math.min(sy, ty, c1.y, c2.y) - HIT_PAD,
    maxX: Math.max(sx, tx, c1.x, c2.x) + HIT_PAD, maxY: Math.max(sy, ty, c1.y, c2.y) + HIT_PAD,
  }
}

/** Consecutive duplicate points dropped. */
function withoutRepeats(pts: Pt[]): Pt[] {
  const out: Pt[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) out.push(p)
  }
  return out
}

/**
 * The orthogonal connector between two sides when nothing is in the way:
 * out of each side by EXIT_DIST, then a Z between sides of the same
 * orientation (turning halfway) or an L between a vertical and a
 * horizontal side. Aligned sides give a straight line.
 */
export function orthogonalConnector(s: Pt, sSide: Position, t: Pt, tSide: Position): Pt[] {
  const a = extendPt(s.x, s.y, sSide, EXIT_DIST)
  const b = extendPt(t.x, t.y, tSide, EXIT_DIST)
  let middle: Pt[]
  if (isVertical(sSide) && isVertical(tSide)) {
    const m = (a.y + b.y) / 2
    middle = [{ x: a.x, y: m }, { x: b.x, y: m }]
  } else if (!isVertical(sSide) && !isVertical(tSide)) {
    const m = (a.x + b.x) / 2
    middle = [{ x: m, y: a.y }, { x: m, y: b.y }]
  } else if (isVertical(sSide)) {
    middle = [{ x: a.x, y: b.y }]
  } else {
    middle = [{ x: b.x, y: a.y }]
  }
  return simplifyPath(withoutRepeats([s, a, ...middle, b, t]))
}

/** Does the polyline pass through an obstacle (sampled every 8 px)? The
 *  first and last EXIT_DIST, at the nodes it joins, are not tested. */
function polylineHitsObstacles(pts: Pt[], obstacles: RoutingObstacle[] | ObstacleSet, pad: number): boolean {
  const set = Array.isArray(obstacles) ? null : obstacles
  const list = Array.isArray(obstacles) ? obstacles : null
  if (list && list.length === 0) return false
  const first = pts[0], last = pts[pts.length - 1]
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8))
    for (let k = 0; k <= n; k++) {
      const x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n
      if (Math.hypot(x - first.x, y - first.y) < EXIT_DIST || Math.hypot(x - last.x, y - last.y) < EXIT_DIST) continue
      if (set ? set.hits(x, y, pad) : list!.some((o) => x >= o.x - pad && x <= o.x + o.w + pad && y >= o.y - pad && y <= o.y + o.h + pad)) return true
    }
  }
  return false
}

/** Is the straight segment a–b clear of every obstacle (padded)? */
function segmentClear(a: Pt, b: Pt, obstacles: RoutingObstacle[], pad: number): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8))
  for (let k = 0; k <= n; k++) {
    const x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n
    for (const o of obstacles) if (x >= o.x - pad && x <= o.x + o.w + pad && y >= o.y - pad && y <= o.y + o.h + pad) return false
  }
  return true
}

/** Padding a pulled-tight waypoint keeps from the nodes. */
const TIGHT_PAD = 10

/**
 * The curved style around nodes in the way: the corners of the A* route
 * pulled tight (a corner is dropped while the straight line past it stays
 * clear of the nodes), then a centripetal Catmull-Rom curve through what is
 * left, leaving and entering along the sides' normals.
 *
 * The curve leaves a side exactly as far as the route does (EXIT_DIST), and
 * the route's own stub points there are dropped: leaving further than the
 * route's first corner sent the curve out and back, a hook at every end
 * (38 of 41 routed relations in random scenes). Centripetal, not uniform:
 * a uniform Catmull-Rom overshoots and loops on a sharp turn, which a route
 * coming back past its own node makes. Returns the SVG path and samples.
 */
function curveThrough(s: Pt, sSide: Position, t: Pt, tSide: Position, route: Pt[], obstacles: RoutingObstacle[]): { path: string; points: Pt[] } {
  const sOut = extendPt(s.x, s.y, sSide, EXIT_DIST)
  const tOut = extendPt(t.x, t.y, tSide, EXIT_DIST)
  const offStub = (p: Pt) => Math.hypot(p.x - s.x, p.y - s.y) > EXIT_DIST + CELL && Math.hypot(p.x - t.x, p.y - t.y) > EXIT_DIST + CELL
  const way = withoutRepeats([sOut, ...route.slice(1, -1).filter(offStub), tOut])
  // Pulling tight keeps out of the joined nodes too (see computeRoutedEdge).
  const blocked = [...obstacles, keepOut(s, sSide), keepOut(t, tSide)]
  const tight: Pt[] = [way[0]]
  for (let i = 0; i < way.length - 1;) {
    let j = way.length - 1
    while (j > i + 1 && !segmentClear(way[i], way[j], blocked, TIGHT_PAD)) j--
    tight.push(way[j])
    i = j
  }
  const p = withoutRepeats([s, ...tight, t])
  let path = `M${p[0].x},${p[0].y}`
  const points: Pt[] = [p[0]]
  for (let i = 0; i < p.length - 1; i++) {
    const { c1, c2 } = centripetalControls(p[i - 1] ?? p[i], p[i], p[i + 1], p[i + 2] ?? p[i + 1])
    const p1 = p[i], p2 = p[i + 1]
    path += `C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`
    for (let k = 1; k <= 8; k++) points.push(cubicAt(p1.x, p1.y, c1.x, c1.y, c2.x, c2.y, p2.x, p2.y, k / 8))
  }
  return { path, points }
}

/** A block behind the side at `p`, inside the node the side belongs to. */
function keepOut(p: Pt, side: Position): RoutingObstacle {
  const depth = 60, half = 40
  switch (side) {
    case Position.Top: return { x: p.x - half, y: p.y + 1, w: 2 * half, h: depth }
    case Position.Bottom: return { x: p.x - half, y: p.y - 1 - depth, w: 2 * half, h: depth }
    case Position.Left: return { x: p.x + 1, y: p.y - half, w: depth, h: 2 * half }
    case Position.Right: return { x: p.x - 1 - depth, y: p.y - half, w: depth, h: 2 * half }
  }
}

/** Bézier control points of the centripetal Catmull-Rom segment p1–p2
 *  (Yuksel, Schaefer & Keyser 2011): no cusps and no loops within a segment. */
function centripetalControls(p0: Pt, p1: Pt, p2: Pt, p3: Pt): { c1: Pt; c2: Pt } {
  const d = (a: Pt, b: Pt) => Math.sqrt(Math.hypot(b.x - a.x, b.y - a.y)) || 1e-6
  const d1 = p0 === p1 ? 0 : d(p0, p1), d2 = d(p1, p2), d3 = p2 === p3 ? 0 : d(p2, p3)
  const c1 = d1 === 0 ? { x: p1.x + (p2.x - p1.x) / 3, y: p1.y + (p2.y - p1.y) / 3 } : {
    x: (d1 * d1 * p2.x - d2 * d2 * p0.x + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1.x) / (3 * d1 * (d1 + d2)),
    y: (d1 * d1 * p2.y - d2 * d2 * p0.y + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1.y) / (3 * d1 * (d1 + d2)),
  }
  const c2 = d3 === 0 ? { x: p2.x - (p2.x - p1.x) / 3, y: p2.y - (p2.y - p1.y) / 3 } : {
    x: (d3 * d3 * p1.x - d2 * d2 * p3.x + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2.x) / (3 * d3 * (d3 + d2)),
    y: (d3 * d3 * p1.y - d2 * d2 * p3.y + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2.y) / (3 * d3 * (d3 + d2)),
  }
  return { c1, c2 }
}

export interface RoutedEdge {
  /** SVG path data. */
  path: string
  /** The default label centre: the middle of the curve. */
  labelX: number
  labelY: number
  /** The drawn path as a polyline from source to target (the corners of a
   *  routed path, samples of a direct curve), for placing the label. */
  points: Pt[]
}

/** `obstacles` are tested against the direct curve; when it hits one, the
 *  edge is routed around `allObstacles()` (default: the same list). Callers
 *  with many nodes pass only those inside directCurveBox as `obstacles`, or
 *  an ObstacleSet answering point queries from a spatial index. */
export function computeRoutedEdge(
  sx: number, sy: number, srcSide: Position,
  tx: number, ty: number, tgtSide: Position,
  obstacles: RoutingObstacle[] | ObstacleSet,
  allObstacles?: () => RoutingObstacle[],
  style: EdgeStyle = 'curved',
): RoutedEdge {
  const s = { x: sx, y: sy }
  const t = { x: tx, y: ty }
  const { c1, c2 } = bezierControlPoints(s, srcSide, t, tgtSide)
  const direct = style === 'orthogonal' ? orthogonalConnector(s, srcSide, t, tgtSide) : null

  // The direct line (the Bézier, or the Z / L connector) when no node is in
  // its way; the route around them otherwise, drawn in the same style.
  const hits = direct ? polylineHitsObstacles(direct, obstacles, HIT_PAD) : bezierHitsObstacles(s, c1, c2, t, obstacles, HIT_PAD)
  const plain = (): RoutedEdge => direct ? orthogonalEdge(direct) : bezierEdge(s, c1, c2, t, srcSide, tgtSide)
  if (!hits) return plain()

  // A set that knows its bounds lets a hopeless route (one routeAround would
  // refuse as too big) skip listing every obstacle.
  const set = Array.isArray(obstacles) ? null : obstacles
  const hopeless = !allObstacles && !!set?.bounds && routingCells(s, t, set.bounds()) > MAX_ROUTING_CELLS
  const all = hopeless ? [] : allObstacles ? allObstacles() : set ? set.all() : obstacles as RoutingObstacle[]
  // The nodes the relation joins are not obstacles, so the route could run
  // through one of them and reach its side from behind; a keep-out block
  // behind each side makes it come in from the front.
  const polyline = hopeless ? null : routeAround(s, srcSide, t, tgtSide, [...all, keepOut(s, srcSide), keepOut(t, tgtSide)])
  // Routing failed (grid too big, or unreachable) — the direct line.
  if (!polyline || polyline.length < 2) return plain()
  if (style === 'orthogonal') return orthogonalEdge(polyline)
  const curve = curveThrough(s, srcSide, t, tgtSide, polyline, all)
  const mid = polyMidpoint(curve.points)
  return { path: curve.path, labelX: mid.x, labelY: mid.y, points: curve.points }
}

/**
 * Orthogonal relations that share a stretch of one line are drawn on top of
 * each other, indistinguishable. This spreads every group of inner segments
 * lying on one line and overlapping along it SEGMENT_SPACING apart (less
 * when there are many, to stay within SEGMENT_SPREAD_MAX), ordered by where
 * each turns next so that they do not cross on the way out. The first and
 * last segment of a route, at its ports, stay: the ports are spread along
 * the sides already. Returns new point lists for the routes it changed.
 */
export function separateParallelSegments(routes: Map<string, Pt[]>): Map<string, Pt[]> {
  const out = new Map<string, Pt[]>()
  const pts = (id: string) => {
    let copy = out.get(id)
    if (!copy) { copy = routes.get(id)!.map((p) => ({ ...p })); out.set(id, copy) }
    return copy
  }
  for (const horizontal of [true, false]) {
    // Inner segments on one line: key = the line's coordinate, rounded.
    const lines = new Map<number, Array<{ id: string; i: number; lo: number; hi: number; heading: number }>>()
    for (const [id, route] of routes) {
      const p = out.get(id) ?? route
      for (let i = 1; i < p.length - 2; i++) {
        const a = p[i], b = p[i + 1]
        const on = horizontal ? Math.abs(a.y - b.y) < 0.5 : Math.abs(a.x - b.x) < 0.5
        if (!on) continue
        const at = Math.round(horizontal ? a.y : a.x)
        const lo = Math.min(horizontal ? a.x : a.y, horizontal ? b.x : b.y)
        const hi = Math.max(horizontal ? a.x : a.y, horizontal ? b.x : b.y)
        // Where the route goes before and after the segment, across it.
        const heading = horizontal ? (p[i - 1].y + p[i + 2].y) / 2 - a.y : (p[i - 1].x + p[i + 2].x) / 2 - a.x
        const list = lines.get(at) ?? []
        list.push({ id, i, lo, hi, heading })
        lines.set(at, list)
      }
    }
    for (const list of lines.values()) {
      if (list.length < 2) continue
      list.sort((a, b) => a.lo - b.lo)
      // Clusters of segments overlapping along the line.
      let cluster: typeof list = []
      let reach = -Infinity
      const spread = () => {
        const ids = new Set(cluster.map((c) => c.id))
        if (ids.size > 1) {
          cluster.sort((a, b) => a.heading - b.heading || (a.id < b.id ? -1 : 1))
          const spacing = Math.min(SEGMENT_SPACING, SEGMENT_SPREAD_MAX / (cluster.length - 1))
          cluster.forEach((c, k) => {
            const shift = (k - (cluster.length - 1) / 2) * spacing
            const p = pts(c.id)
            if (horizontal) { p[c.i].y += shift; p[c.i + 1].y += shift } else { p[c.i].x += shift; p[c.i + 1].x += shift }
          })
        }
        cluster = []
      }
      for (const seg of list) {
        if (cluster.length > 0 && seg.lo >= reach - 1) spread()
        cluster.push(seg)
        reach = cluster.length === 1 ? seg.hi : Math.max(reach, seg.hi)
      }
      spread()
    }
  }
  return out
}

/** Gap between orthogonal segments separateParallelSegments spreads apart. */
const SEGMENT_SPACING = 8
/** Widest a group of spread segments gets, however many there are. */
const SEGMENT_SPREAD_MAX = 60

/** An orthogonal route drawn from its points (after separateParallelSegments). */
export function orthogonalRoute(pts: Pt[]): RoutedEdge {
  return orthogonalEdge(pts)
}

/** Horizontal and vertical segments through `pts`, with rounded corners. */
function orthogonalEdge(pts: Pt[]): RoutedEdge {
  const mid = polyMidpoint(pts)
  return { path: buildSvgPath(pts), labelX: mid.x, labelY: mid.y, points: pts }
}

/** Samples of the direct curve in `points`: enough for label placement to
 *  follow it within a few pixels. */
const CURVE_SAMPLES = 24

function bezierEdge(s: Pt, c1: Pt, c2: Pt, t: Pt, srcSide: Position, tgtSide: Position): RoutedEdge {
  const points: Pt[] = []
  for (let i = 0; i <= CURVE_SAMPLES; i++) {
    points.push(cubicAt(s.x, s.y, c1.x, c1.y, c2.x, c2.y, t.x, t.y, i / CURVE_SAMPLES))
  }
  return {
    path: buildBezierPath(s, srcSide, t, tgtSide),
    labelX: 0.125 * s.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * t.x,
    labelY: 0.125 * s.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * t.y,
    points,
  }
}
