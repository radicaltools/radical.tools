/**
 * Simulated-annealing refinement for Smart Layout (Davidson & Harel 1996).
 *
 * A "group" is a set of siblings — the root nodes, or the children of one
 * compound. Each move translates one sibling (its subtree follows) or swaps
 * two siblings, and is accepted by the Metropolis criterion.
 *
 * Design points:
 *   - **Deterministic.** Randomness comes from a seeded PRNG and budgets are
 *     counted in sweeps, not milliseconds, so the same diagram always gets
 *     the same layout (a wall-clock deadline only guards pathological cases).
 *   - **Overlap is a hard constraint.** A move may not create or worsen an
 *     overlap between siblings (with a clearance gap); a soft penalty let the
 *     annealer trade crossings for boxes stacked on top of each other.
 *   - **Step size and temperature are separate.** The step σ is in pixels,
 *     the temperature is in energy units and is calibrated from sampled
 *     uphill moves so that an average uphill move starts at ~50 % acceptance.
 *   - **Incremental energy.** ProxyEnergy re-evaluates only the edges and
 *     node pairs touched by a move instead of the whole diagram.
 */
import type { C4Node, C4Relation } from '@radical/common/c4'
import {
  W_CROSS, W_OVERDRAW, W_LMEAN, W_LMAX, W_ASPECT,
  LEN_MEAN_KNEE, LEN_MAX_KNEE, overlapCost, aspectPenalty,
} from './scoreWeights'

// ─── Seeded randomness ────────────────────────────────────────────────────

export type Rng = () => number

/** mulberry32 — small, fast and plenty for layout perturbations. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * FNV-1a over the diagram's structure — same diagram, same seed. Compound
 * sizes are left out: layout refits them, and re-running Smart Layout on
 * its own result must see the same seed.
 */
export function graphSeed(nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): number {
  let h = 0x811c9dc5
  const mix = (s: string): void => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
  }
  const compounds = new Set<string>()
  for (const n of Object.values(nodes)) if (n.parentId && nodes[n.parentId]) compounds.add(n.parentId)
  for (const id of Object.keys(nodes).sort()) {
    const n = nodes[id]
    const size = compounds.has(id) ? '' : `${n.width}|${n.height}`
    mix(`${id}|${n.parentId ?? ''}|${size};`)
  }
  for (const id of Object.keys(relations).sort()) {
    const r = relations[id]
    mix(`${r.sourceId}>${r.targetId};`)
  }
  return h >>> 0
}

/** Box-Muller — N(0, 1). */
export function gaussian(rng: Rng): number {
  let u = 0, v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// ─── Indexed graph ────────────────────────────────────────────────────────

export interface LayoutGraph {
  n: number
  ids: string[]
  indexOf: Map<string, number>
  parent: Int32Array
  /** Parents before children. */
  order: Int32Array
  w: Float64Array
  h: Float64Array
  /** Current parent-relative positions; the annealer writes its result back here. */
  relX: Float64Array
  relY: Float64Array
  /** Node itself plus all descendants. */
  subtree: Int32Array[]
  /** n×n: 1 when the pair is the same node or ancestor/descendant. */
  related: Uint8Array
  src: Int32Array
  tgt: Int32Array
  E: number
  incident: Int32Array[]
  meanArea: number
  meanDim: number
}

export function buildLayoutGraph(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
): LayoutGraph {
  const ids = Object.keys(nodes)
  const n = ids.length
  const indexOf = new Map<string, number>()
  ids.forEach((id, i) => indexOf.set(id, i))

  const parent = new Int32Array(n).fill(-1)
  const w = new Float64Array(n), h = new Float64Array(n)
  const relX = new Float64Array(n), relY = new Float64Array(n)
  const kids: number[][] = Array.from({ length: n }, () => [])
  let area = 0, dim = 0
  for (let i = 0; i < n; i++) {
    const node = nodes[ids[i]]
    const p = node.parentId !== undefined ? indexOf.get(node.parentId) : undefined
    if (p !== undefined) { parent[i] = p; kids[p].push(i) }
    w[i] = node.width
    h[i] = node.height
    relX[i] = node.x
    relY[i] = node.y
    area += node.width * node.height
    dim += (node.width + node.height) / 2
  }

  const order: number[] = []
  const subtree: Int32Array[] = new Array(n)
  const collect = (i: number, out: number[]): void => {
    out.push(i)
    for (const c of kids[i]) collect(c, out)
  }
  for (let i = 0; i < n; i++) {
    const out: number[] = []
    collect(i, out)
    subtree[i] = Int32Array.from(out)
    if (parent[i] === -1) order.push(...out)
  }

  const related = new Uint8Array(n * n)
  for (let i = 0; i < n; i++) {
    related[i * n + i] = 1
    for (let a = parent[i]; a !== -1; a = parent[a]) {
      related[i * n + a] = 1
      related[a * n + i] = 1
    }
  }

  const src: number[] = [], tgt: number[] = []
  const incidentLists: number[][] = Array.from({ length: n }, () => [])
  for (const r of Object.values(relations)) {
    const s = indexOf.get(r.sourceId), t = indexOf.get(r.targetId)
    if (s === undefined || t === undefined || s === t) continue
    const e = src.length
    src.push(s)
    tgt.push(t)
    incidentLists[s].push(e)
    incidentLists[t].push(e)
  }

  return {
    n, ids, indexOf, parent, order: Int32Array.from(order),
    w, h, relX, relY, subtree, related,
    src: Int32Array.from(src), tgt: Int32Array.from(tgt), E: src.length,
    incident: incidentLists.map((l) => Int32Array.from(l)),
    meanArea: n > 0 ? area / n : 0,
    meanDim: n > 0 ? dim / n : 1,
  }
}

// ─── Energy evaluators ────────────────────────────────────────────────────

export interface Move { node: number; dx: number; dy: number }

/**
 * An energy the annealer can probe. `apply` translates the listed nodes
 * (with their subtrees) and returns the energy afterwards; the move stays
 * pending until `commit` or `revert`.
 */
export interface Evaluator {
  energy(): number
  apply(moves: readonly Move[]): number
  commit(): void
  revert(): void
}

// Segment primitives: strict orientation test, rect shrunk by 1 px so a
// segment grazing a border doesn't count (mirrors crossingOpt.ts).
function segCross(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const o1 = (dy - cy) * (bx - cx) - (by - cy) * (dx - cx) > 0
  const o2 = (dy - cy) * (ax - cx) - (ay - cy) * (dx - cx) > 0
  if (o1 === o2) return false
  const o3 = (by - ay) * (cx - ax) - (cy - ay) * (bx - ax) > 0
  const o4 = (by - ay) * (dx - ax) - (dy - ay) * (bx - ax) > 0
  return o3 !== o4
}

function segHitsRect(
  px: number, py: number, qx: number, qy: number,
  rx: number, ry: number, rw: number, rh: number,
): boolean {
  const x0 = rx + 1, y0 = ry + 1
  const x1 = rx + rw - 1, y1 = ry + rh - 1
  if (x1 <= x0 || y1 <= y0) return false
  if (px > x0 && px < x1 && py > y0 && py < y1) return true
  if (qx > x0 && qx < x1 && qy > y0 && qy < y1) return true
  let t0 = 0, t1 = 1
  const ddx = qx - px, ddy = qy - py
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0
    const t = q / p
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t }
    else { if (t < t0) return false; if (t < t1) t1 = t }
    return true
  }
  return clip(-ddx, px - x0) && clip(ddx, x1 - px) && clip(-ddy, py - y0) && clip(ddy, y1 - py)
}

/**
 * Cheap stand-in for the render-aware score: straight centre-to-centre
 * edges, sibling overlap, edge lengths and bounding-box aspect ratio.
 *
 * Totals are maintained incrementally: a move only re-counts the crossing
 * pairs, edge/node overdraw pairs and node overlap pairs it can change.
 * Nodes related to an edge's endpoints (ancestors *and* descendants) are
 * never obstacles for it — the renderer excludes them the same way.
 */
export class ProxyEnergy implements Evaluator {
  private readonly g: LayoutGraph
  private readonly ax: Float64Array
  private readonly ay: Float64Array
  private readonly len: Float64Array
  private crossings = 0
  private overdraws = 0
  private overlapArea = 0
  private totalLen = 0
  private cur = 0

  private readonly nodeMark: Int32Array
  private readonly edgeMark: Int32Array
  private epoch = 0
  private readonly S: number[] = []
  private readonly M: number[] = []
  private pending: {
    moves: readonly Move[]
    crossings: number; overdraws: number; overlapArea: number; totalLen: number; energy: number
    oldLen: number[]
  } | null = null

  constructor(g: LayoutGraph) {
    this.g = g
    this.ax = new Float64Array(g.n)
    this.ay = new Float64Array(g.n)
    for (const i of g.order) {
      const p = g.parent[i]
      this.ax[i] = g.relX[i] + (p === -1 ? 0 : this.ax[p])
      this.ay[i] = g.relY[i] + (p === -1 ? 0 : this.ay[p])
    }
    this.len = new Float64Array(g.E)
    this.nodeMark = new Int32Array(g.n)
    this.edgeMark = new Int32Array(g.E)
    this.recomputeTotals()
  }

  energy(): number { return this.cur }

  /** Full O(E² + E·n + n²) recount — used once up front and by tests. */
  recomputeTotals(): void {
    const { n, E } = this.g
    let c = 0, o = 0, a = 0, total = 0
    for (let e = 0; e < E; e++) {
      for (let f = e + 1; f < E; f++) if (this.edgesCross(e, f)) c++
      for (let k = 0; k < n; k++) if (this.edgeHitsNode(e, k)) o++
      this.len[e] = this.edgeLength(e)
      total += this.len[e]
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) a += this.overlapOf(i, j)
    this.crossings = c
    this.overdraws = o
    this.overlapArea = a
    this.totalLen = total
    this.cur = this.totalEnergy()
  }

  apply(moves: readonly Move[]): number {
    const g = this.g
    const ep = ++this.epoch
    const S = this.S, M = this.M
    S.length = 0
    M.length = 0
    for (const m of moves) {
      for (const k of g.subtree[m.node]) {
        if (this.nodeMark[k] !== ep) { this.nodeMark[k] = ep; S.push(k) }
      }
    }
    for (const k of S) {
      for (const e of g.incident[k]) {
        if (this.edgeMark[e] !== ep) { this.edgeMark[e] = ep; M.push(e) }
      }
    }

    const [c0, o0, a0] = this.localCounts()
    this.shift(moves, 1)
    const [c1, o1, a1] = this.localCounts()

    const oldLen: number[] = new Array(M.length)
    let totalLen = this.totalLen
    for (let i = 0; i < M.length; i++) {
      const e = M[i]
      oldLen[i] = this.len[e]
      this.len[e] = this.edgeLength(e)
      totalLen += this.len[e] - oldLen[i]
    }

    this.pending = {
      moves,
      crossings: this.crossings, overdraws: this.overdraws,
      overlapArea: this.overlapArea, totalLen: this.totalLen, energy: this.cur,
      oldLen,
    }
    this.crossings += c1 - c0
    this.overdraws += o1 - o0
    this.overlapArea += a1 - a0
    this.totalLen = totalLen
    this.cur = this.totalEnergy()
    return this.cur
  }

  commit(): void { this.pending = null }

  revert(): void {
    const p = this.pending
    if (!p) return
    this.shift(p.moves, -1)
    for (let i = 0; i < this.M.length; i++) this.len[this.M[i]] = p.oldLen[i]
    this.crossings = p.crossings
    this.overdraws = p.overdraws
    this.overlapArea = p.overlapArea
    this.totalLen = p.totalLen
    this.cur = p.energy
    this.pending = null
  }

  private shift(moves: readonly Move[], sign: 1 | -1): void {
    for (const m of moves) {
      const dx = m.dx * sign, dy = m.dy * sign
      for (const k of this.g.subtree[m.node]) { this.ax[k] += dx; this.ay[k] += dy }
    }
  }

  /**
   * Counts over every pair a pending move can affect: edge pairs with at
   * least one moved edge, (edge, node) pairs with a moved edge or node, and
   * node pairs with at least one moved node. Each pair is visited exactly
   * once, and the visited set depends only on the marks — so counting
   * before and after the shift yields an exact delta.
   */
  private localCounts(): [number, number, number] {
    const { n, E } = this.g
    const ep = this.epoch
    let c = 0, o = 0, a = 0
    for (const e of this.M) {
      for (let f = 0; f < E; f++) {
        if (f === e || (this.edgeMark[f] === ep && f < e)) continue
        if (this.edgesCross(e, f)) c++
      }
      for (let k = 0; k < n; k++) if (this.edgeHitsNode(e, k)) o++
    }
    for (let f = 0; f < E; f++) {
      if (this.edgeMark[f] === ep) continue
      for (const k of this.S) if (this.edgeHitsNode(f, k)) o++
    }
    for (const i of this.S) {
      for (let j = 0; j < n; j++) {
        if (j === i || (this.nodeMark[j] === ep && j < i)) continue
        a += this.overlapOf(i, j)
      }
    }
    return [c, o, a]
  }

  private edgesCross(e: number, f: number): boolean {
    const { src, tgt, w, h } = this.g
    const a = src[e], b = tgt[e], c = src[f], d = tgt[f]
    if (a === c || a === d || b === c || b === d) return false
    const { ax, ay } = this
    return segCross(
      ax[a] + w[a] / 2, ay[a] + h[a] / 2, ax[b] + w[b] / 2, ay[b] + h[b] / 2,
      ax[c] + w[c] / 2, ay[c] + h[c] / 2, ax[d] + w[d] / 2, ay[d] + h[d] / 2,
    )
  }

  private edgeHitsNode(e: number, k: number): boolean {
    const { src, tgt, w, h, related, n } = this.g
    const s = src[e], t = tgt[e]
    if (related[k * n + s] || related[k * n + t]) return false
    const { ax, ay } = this
    return segHitsRect(
      ax[s] + w[s] / 2, ay[s] + h[s] / 2, ax[t] + w[t] / 2, ay[t] + h[t] / 2,
      ax[k], ay[k], w[k], h[k],
    )
  }

  private overlapOf(i: number, j: number): number {
    const { w, h, related, n } = this.g
    if (related[i * n + j]) return 0
    const { ax, ay } = this
    const ox = Math.min(ax[i] + w[i], ax[j] + w[j]) - Math.max(ax[i], ax[j])
    if (ox <= 0) return 0
    const oy = Math.min(ay[i] + h[i], ay[j] + h[j]) - Math.max(ay[i], ay[j])
    return oy > 0 ? ox * oy : 0
  }

  private edgeLength(e: number): number {
    const { src, tgt, w, h } = this.g
    const s = src[e], t = tgt[e]
    const dx = this.ax[s] + w[s] / 2 - (this.ax[t] + w[t] / 2)
    const dy = this.ay[s] + h[s] / 2 - (this.ay[t] + h[t] / 2)
    return Math.sqrt(dx * dx + dy * dy)
  }

  private totalEnergy(): number {
    const { n, E, w, h, meanArea, meanDim } = this.g
    let maxLen = 0
    for (let e = 0; e < E; e++) if (this.len[e] > maxLen) maxLen = this.len[e]
    const meanInNodes = E > 0 && meanDim > 0 ? this.totalLen / E / meanDim : 0
    const maxInNodes = meanDim > 0 ? maxLen / meanDim : 0

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (let i = 0; i < n; i++) {
      if (this.ax[i] < minX) minX = this.ax[i]
      if (this.ay[i] < minY) minY = this.ay[i]
      if (this.ax[i] + w[i] > maxX) maxX = this.ax[i] + w[i]
      if (this.ay[i] + h[i] > maxY) maxY = this.ay[i] + h[i]
    }

    return this.crossings * W_CROSS
      + this.overdraws * W_OVERDRAW
      + overlapCost(meanArea > 0 ? this.overlapArea / meanArea : 0)
      + Math.max(0, meanInNodes - LEN_MEAN_KNEE) ** 2 * W_LMEAN
      + Math.max(0, maxInNodes - LEN_MAX_KNEE) ** 2 * W_LMAX
      + aspectPenalty(maxX - minX, maxY - minY) * W_ASPECT
  }
}

/**
 * Wraps a whole-diagram scoring function (the render-aware composite) as an
 * Evaluator. Every probe is a full re-score, so it is only used for short
 * polishing runs.
 */
export class FunctionEnergy implements Evaluator {
  private cur: number
  private pending: { moves: readonly Move[]; energy: number } | null = null

  constructor(
    private readonly g: LayoutGraph,
    private readonly work: Record<string, C4Node>,
    private readonly relations: Record<string, C4Relation>,
    private readonly fn: (nodes: Record<string, C4Node>, relations: Record<string, C4Relation>) => number,
  ) {
    this.cur = fn(work, relations)
  }

  energy(): number { return this.cur }

  apply(moves: readonly Move[]): number {
    this.shift(moves, 1)
    this.pending = { moves, energy: this.cur }
    this.cur = this.fn(this.work, this.relations)
    return this.cur
  }

  commit(): void { this.pending = null }

  revert(): void {
    if (!this.pending) return
    this.shift(this.pending.moves, -1)
    this.cur = this.pending.energy
    this.pending = null
  }

  private shift(moves: readonly Move[], sign: 1 | -1): void {
    for (const m of moves) {
      const node = this.work[this.g.ids[m.node]]
      node.x += m.dx * sign
      node.y += m.dy * sign
    }
  }
}

// ─── Annealer ─────────────────────────────────────────────────────────────

/** Parent-relative box the group's members must stay inside. */
export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

export interface AnnealOptions {
  rng: Rng
  restarts: number
  /** Sweeps per restart; one sweep = one translation per member + one swap. */
  sweeps: number
  /** Initial step σ as a fraction of the group's bounding-box span. */
  stepFactor: number
  /** Scales the calibrated starting temperature (< 1 = gentler). */
  tempFactor: number
  /** Probe moves used to calibrate the starting temperature. */
  calibrationSamples: number
  /** Minimum clear space between siblings. */
  gap: number
  bounds?: Bounds
  /** performance.now()-style timestamp after which the run stops early. */
  deadline: number
}

export interface AnnealResult {
  before: number
  after: number
  evaluations: number
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/** Fraction of the initial step/temperature left at the end of a restart. */
const FINAL_FRACTION = 0.03
/** Sweeps without a new best before the one reheat of a restart. */
const STAGNATION_LIMIT = 12

/**
 * Anneal the positions of `group` (sibling node indices). On return the
 * evaluator and `g.relX/relY` hold the best arrangement found.
 */
export function anneal(ev: Evaluator, g: LayoutGraph, group: number[], opts: AnnealOptions): AnnealResult {
  const G = group.length
  const before = ev.energy()
  if (G < 2) return { before, after: before, evaluations: 0 }

  const { rng, gap, bounds } = opts
  const gx = Float64Array.from(group, (i) => g.relX[i])
  const gy = Float64Array.from(group, (i) => g.relY[i])
  const gw = Float64Array.from(group, (i) => g.w[i])
  const gh = Float64Array.from(group, (i) => g.h[i])

  let cur = before
  let best = before
  const bestX = gx.slice(), bestY = gy.slice()
  let evaluations = 0

  const overlapWithOthers = (k: number, x: number, y: number): number => {
    let sum = 0
    for (let m = 0; m < G; m++) {
      if (m === k) continue
      const ox = Math.min(x + gw[k], gx[m] + gw[m]) - Math.max(x, gx[m]) + gap
      if (ox <= 0) continue
      const oy = Math.min(y + gh[k], gy[m] + gh[m]) - Math.max(y, gy[m]) + gap
      if (oy > 0) sum += ox * oy
    }
    return sum
  }
  const inBounds = (k: number, x: number, y: number): boolean =>
    !bounds || (x >= bounds.minX && y >= bounds.minY && x + gw[k] <= bounds.maxX && y + gh[k] <= bounds.maxY)

  // A move may not leave the bounds (unless already outside) and may not
  // create or worsen overlap with any sibling.
  const translationAllowed = (k: number, x: number, y: number): boolean => {
    if (!inBounds(k, x, y) && inBounds(k, gx[k], gy[k])) return false
    const after = overlapWithOthers(k, x, y)
    return after === 0 || after < overlapWithOthers(k, gx[k], gy[k])
  }
  const swapAllowed = (a: number, b: number): boolean => {
    const overlapBefore = overlapWithOthers(a, gx[a], gy[a]) + overlapWithOthers(b, gx[b], gy[b])
    const wasInside = inBounds(a, gx[a], gy[a]) && inBounds(b, gx[b], gy[b])
    const ax = gx[a], ay = gy[a]
    gx[a] = gx[b]; gy[a] = gy[b]; gx[b] = ax; gy[b] = ay
    const overlapAfter = overlapWithOthers(a, gx[a], gy[a]) + overlapWithOthers(b, gx[b], gy[b])
    const inside = inBounds(a, gx[a], gy[a]) && inBounds(b, gx[b], gy[b])
    gx[b] = gx[a]; gy[b] = gy[a]; gx[a] = ax; gy[a] = ay
    return (inside || !wasInside) && (overlapAfter === 0 || overlapAfter < overlapBefore)
  }

  const moves: Move[] = []
  const ks: number[] = []
  const probe = (): number => {
    evaluations++
    return ev.apply(moves.slice())
  }
  const settle = (): void => {
    ev.commit()
    for (let i = 0; i < ks.length; i++) { gx[ks[i]] += moves[i].dx; gy[ks[i]] += moves[i].dy }
  }
  const setMove = (...entries: [k: number, dx: number, dy: number][]): void => {
    moves.length = 0
    ks.length = 0
    for (const [k, dx, dy] of entries) { moves.push({ node: group[k], dx, dy }); ks.push(k) }
  }
  const tryMove = (T: number): void => {
    const e = probe()
    const dE = e - cur
    if (dE <= 0 || rng() < Math.exp(-dE / T)) {
      settle()
      cur = e
      if (cur < best) { best = cur; bestX.set(gx); bestY.set(gy) }
    } else {
      ev.revert()
    }
  }
  const jumpTo = (tx: Float64Array, ty: Float64Array): void => {
    const entries: [number, number, number][] = []
    for (let k = 0; k < G; k++) {
      if (tx[k] !== gx[k] || ty[k] !== gy[k]) entries.push([k, tx[k] - gx[k], ty[k] - gy[k]])
    }
    if (entries.length === 0) return
    setMove(...entries)
    cur = probe()
    settle()
  }

  // Temperature such that an average sampled uphill move is accepted with p ≈ ½.
  const calibrate = (sigma: number): number => {
    let sum = 0, count = 0
    for (let s = 0; s < opts.calibrationSamples; s++) {
      const k = Math.floor(rng() * G)
      const dx = gaussian(rng) * sigma, dy = gaussian(rng) * sigma
      if (!translationAllowed(k, gx[k] + dx, gy[k] + dy)) continue
      setMove([k, dx, dy])
      const e = probe()
      ev.revert()
      if (e > cur) { sum += e - cur; count++ }
    }
    return count > 0 ? sum / count / Math.LN2 : 1
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let k = 0; k < G; k++) {
    minX = Math.min(minX, gx[k]); minY = Math.min(minY, gy[k])
    maxX = Math.max(maxX, gx[k] + gw[k]); maxY = Math.max(maxY, gy[k] + gh[k])
  }
  const span = Math.max(maxX - minX, maxY - minY, 200)
  const cooling = Math.pow(FINAL_FRACTION, 1 / Math.max(1, opts.sweeps))

  run: for (let restart = 0; restart < opts.restarts; restart++) {
    if (now() > opts.deadline) break
    if (restart > 0) jumpTo(bestX, bestY)
    // Later restarts take bigger steps to leave the best basin found so far.
    const sigma0 = span * opts.stepFactor * (1 + 0.5 * restart)
    const T0 = calibrate(sigma0) * opts.tempFactor
    let f = 1
    let stagnant = 0
    let reheated = false

    for (let sweep = 0; sweep < opts.sweeps; sweep++) {
      if (now() > opts.deadline) break run
      const sigma = sigma0 * f
      const T = Math.max(T0 * f, 1e-9)
      const bestBefore = best

      for (let k = 0; k < G; k++) {
        const dx = gaussian(rng) * sigma, dy = gaussian(rng) * sigma
        if (!translationAllowed(k, gx[k] + dx, gy[k] + dy)) continue
        setMove([k, dx, dy])
        tryMove(T)
      }

      // One swap per sweep — the big jump translation alone rarely makes.
      // Of three random partners take the nearest: far swaps almost always lose.
      const a = Math.floor(rng() * G)
      let b = -1
      let bestDist = Infinity
      for (let trial = 0; trial < 3; trial++) {
        let c = Math.floor(rng() * G)
        if (c === a) c = (c + 1) % G
        const d = (gx[c] - gx[a]) ** 2 + (gy[c] - gy[a]) ** 2
        if (d < bestDist) { bestDist = d; b = c }
      }
      if (b !== -1 && swapAllowed(a, b)) {
        setMove([a, gx[b] - gx[a], gy[b] - gy[a]], [b, gx[a] - gx[b], gy[a] - gy[b]])
        tryMove(T * 0.5)
      }

      if (best < bestBefore) {
        stagnant = 0
      } else if (++stagnant >= STAGNATION_LIMIT && !reheated && sweep < (opts.sweeps * 2) / 3) {
        // Davidson-Harel "kick": trapped in a basin — reheat once instead of cooling on.
        f = 0.6
        reheated = true
        stagnant = 0
        continue
      }
      f *= cooling
    }
  }

  jumpTo(bestX, bestY)
  for (let k = 0; k < G; k++) { g.relX[group[k]] = gx[k]; g.relY[group[k]] = gy[k] }
  return { before, after: best, evaluations }
}
