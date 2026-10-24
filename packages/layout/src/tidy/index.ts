/**
 * Tidy: Smart Layout the way a person arranges a diagram. It starts from
 * what is on the canvas and improves it one move at a time (moves.ts),
 * taking the move that helps the reader most (cost.ts) and stopping when
 * none helps; what it did is the explanation (the steps), and Studio can
 * play them one by one. After the people who arrange diagrams by hand in
 * the HOLA study (Kieffer, Dwyer, Marriott, Wybrow 2016: leaves outside,
 * rows and columns, symmetry; fewer crossings, bends and long lines),
 * Dunnart's constraint moves (Dwyer, Marriott, Wybrow 2009) and the
 * aesthetic cost of Davidson and Harel (1996).
 */
import type { C4Node, C4Relation, EdgeStyle, PositionMap } from '@radical/common/c4'
import type { Metamodel } from '@radical/common/metamodel'
import { projectToVisibleGraph } from '../geometry'
import { computeLayoutMetrics } from '../crossingOpt'
import { type Alignment, enforceAlignments } from '../constraints'
import { computeCompositeScore, computePlanarityScore, projectPositions, type SmartLayoutResult } from '../smartLayout'
import { type Box, Layout } from './layout'
import { type CostIndex, type CostParts, STRAIGHT_TOLERANCE, buildIndex, linesOf, localCost, siblingsNear, totalCost, updateIndex } from './cost'
import { candidateMoves, compactMoves, gatherMoves, untangleMoves, type Move } from './moves'

export interface TidyStep {
  kind: Move['kind']
  description: string
  /** What the move gained, in reader's cost. */
  gain: number
  /** The places that changed (parent-relative), frames refitted included. */
  moved: PositionMap
}

export interface TidyReport {
  steps: TidyStep[]
  before: CostParts
  after: CostParts
  /** True when no move helped: the canvas was left as it was. */
  unchanged: boolean
  /** True when the time budget (or a stop) ended the tidying before it was done. */
  budgetOut: boolean
}

export interface TidyLayoutResult extends SmartLayoutResult {
  tidy: TidyReport
}

export interface TidyOptions {
  alignments?: readonly Alignment[]
  edgeStyle?: EdgeStyle
  /** At most this many moves. */
  maxSteps?: number
  /** What the elements are and which way the relations read (layoutHints.ts); none: the built-in preset's hints. */
  metamodel?: Metamodel | null
  /** Elements the author pinned: they stay, with what they hold; the rest moves round them. */
  pinned?: readonly string[]
  /** Tidy round these elements only: they and what they relate to move, nothing else. */
  around?: readonly string[]
  /** Called after each move taken. */
  onProgress?: (done: number, description: string) => void
  /** Asked before each round: true stops the tidying with what was done. */
  shouldStop?: () => boolean
  /** Stop after this many milliseconds, with what was done. */
  budgetMs?: number
}

export const TIDY_NAME = 'Tidy'
const MAX_STEPS = 400
/** Two moves ahead: this many of the best rejected moves are tried, those within this much of paying off. */
const LOOKAHEAD_WIDTH = 6
const LOOKAHEAD_REACH = 20

export function runTidyLayout(
  inputNodes: Record<string, C4Node>,
  inputRelations: Record<string, C4Relation>,
  options: TidyOptions = {},
): TidyLayoutResult {
  const style = options.edgeStyle ?? 'curved'
  const { nodes, relations } = projectToVisibleGraph(inputNodes, inputRelations)
  const baseline = computeLayoutMetrics(nodes, relations)
  const started = Date.now()
  const outOfTime = (): boolean => (options.budgetMs !== undefined && Date.now() - started > options.budgetMs) || !!options.shouldStop?.()
  // Round a few elements: everything else is as good as pinned, but the
  // frames holding what moves still follow it.
  let pinned = options.pinned ?? []
  if (options.around?.length) {
    const movable = new Set<string>(options.around)
    for (const r of Object.values(relations)) {
      if (movable.has(r.sourceId) && nodes[r.targetId]) movable.add(r.targetId)
      else if (movable.has(r.targetId) && nodes[r.sourceId]) movable.add(r.sourceId)
    }
    const free = new Set<string>(movable)
    for (const id of movable) for (let p = nodes[id]?.parentId; p && nodes[p]; p = nodes[p].parentId) free.add(p)
    pinned = [...new Set([...pinned, ...Object.keys(nodes).filter((id) => !free.has(id))])]
  }
  const l = new Layout(nodes, options.metamodel, pinned)
  l.edgeStyle = style
  const lines = linesOf(l, relations)
  const before = totalCost(l, lines)
  const steps: TidyStep[] = []

  // First the loose elements out of the way, whatever the cost says: they
  // have no lines for it to see. And again at the end, to the margin the
  // tidied diagram has.
  const take = (moves: Move[]): void => {
    for (const move of moves) {
      const touched = [...new Set(move.ids.flatMap((id) => [id, ...l.descendants(id), ...ancestors(l, id)]))]
      const wasPositions = l.positions()
      const was = l.snapshot(touched)
      if (!move.apply(l)) { l.restore(was); continue }
      const now = l.positions()
      const moved: PositionMap = {}
      for (const id of Object.keys(now)) if (!same(wasPositions[id], now[id])) moved[id] = now[id]
      if (Object.keys(moved).length) { steps.push({ kind: move.kind, description: move.description, gain: 0, moved }); options.onProgress?.(steps.length, move.description) }
    }
  }
  // A pile first: elements on each other pulled apart, deepest containers first.
  take(untangleMoves(l, nodes))
  const gather = (): void => {
    for (const move of gatherMoves(l, nodes, lines)) {
      const touched = [...new Set(move.ids.flatMap((id) => [id, ...l.descendants(id), ...ancestors(l, id)]))]
      const wasPositions = l.positions()
      const was = l.snapshot(touched)
      if (!move.apply(l)) { l.restore(was); continue }
      const now = l.positions()
      const moved: PositionMap = {}
      for (const id of Object.keys(now)) if (!same(wasPositions[id], now[id])) moved[id] = now[id]
      if (Object.keys(moved).length) { steps.push({ kind: move.kind, description: move.description, gain: 0, moved }); options.onProgress?.(steps.length, move.description) }
    }
  }
  gather()

  // Each candidate's gain is kept from one round to the next and judged
  // again only when the last move touched what it depends on: a move's
  // own elements, their lines' other ends, and the frames round them.
  const gains = new Map<string, number>()
  const keyOf = (m: Move): string => `${m.kind}:${m.ids.join('+')}:${m.description}`
  let index: CostIndex = buildIndex(l, lines)
  // A frame that grew or shrank has a new middle: a note or a store beside
  // it with that one line, level with its old middle (or in a column with
  // it), is kept level, as a person keeps it. Part of the move.
  const settle = (old: Map<string, Box>): void => {
    for (const [id, was] of old) {
      if (!l.isFrame(id)) continue
      const now = l.box(id)!
      const dx = now.cx - was.cx, dy = now.cy - was.cy
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) continue
      for (const q of index.linesOf.get(id) ?? []) {
        const o = q.a === id ? q.b : q.a
        if (old.has(o) || l.fixed(o) || l.isFrame(o) || l.parentOf(o) !== l.parentOf(id) || (index.linesOf.get(o)?.length ?? 0) !== 1) continue
        const ob = l.box(o)!
        if (Math.abs(ob.cy - was.cy) < STRAIGHT_TOLERANCE && dy) { l.moveBy(o, 0, dy); if (!l.allClear([o])) l.moveBy(o, 0, -dy) }
        else if (Math.abs(ob.cx - was.cx) < STRAIGHT_TOLERANCE && dx) { l.moveBy(o, dx, 0); if (!l.allClear([o])) l.moveBy(o, -dx, 0) }
      }
    }
  }
  const judge = (move: Move): { gain: number; after: Map<string, Box> | null } => {
    const moved = new Set(move.ids)
    // Tried first, to know what it changes: the cost before and after is
    // then judged on the same elements (the room round where the moved
    // ones were and where they are).
    l.begin()
    const done = move.apply(l)
    if (!done) { l.rollback(); return { gain: -Infinity, after: null } }
    settle(l.journalBoxes())
    const touched = l.changed()
    const after = l.snapshot(touched)
    const was = l.journalBoxes()
    const roomy = new Set<string>()
    for (const m of moved) { siblingsNear(l, l.parentOf(m), l.box(m)!, roomy); siblingsNear(l, l.parentOf(m), was.get(m) ?? l.box(m)!, roomy) }
    l.rollback()
    const costWas = localCost(l, lines, moved, index, roomy)
    l.restore(after)
    updateIndex(l, index, touched)
    const gain = costWas - localCost(l, lines, moved, index, roomy)
    l.restore(was)
    updateIndex(l, index, touched)
    return { gain, after }
  }
  let stale: Set<string> | null = null
  /** The move taken: its boxes put in place, the step recorded, and what it
   *  touched marked stale (the moved elements, what they relate to, and the
   *  siblings near where they were and where they are). */
  const commit = (move: Move, after: Map<string, Box>, gain: number): void => {
    const wasPositions = l.positions()
    l.restore(after)
    updateIndex(l, index, after.keys())
    const now = l.positions()
    const moved: PositionMap = {}
    for (const id of Object.keys(now)) if (!same(wasPositions[id], now[id])) moved[id] = now[id]
    steps.push({ kind: move.kind, description: move.description, gain, moved })
    options.onProgress?.(steps.length, move.description)
    const touched = stale ?? new Set<string>()
    stale = touched
    const reach = 3 * l.meanSize
    for (const id of Object.keys(moved)) {
      touched.add(id)
      for (const x of index.linesOf.get(id) ?? []) { touched.add(x.a); touched.add(x.b) }
      const nowBox = l.box(id)!
      const before = wasPositions[id]
      const parent = l.parentOf(id)
      const pb = parent ? l.box(parent)! : { x: 0, y: 0 }
      const wasBox = before ? { x: pb.x + before.x, y: pb.y + before.y, w: before.width ?? nowBox.w, h: before.height ?? nowBox.h } : nowBox
      for (const s of l.childrenOf(parent)) {
        const r = l.box(s)!
        const near = (b: { x: number; y: number; w: number; h: number }) =>
          r.x < b.x + b.w + reach && b.x < r.x + r.w + reach && r.y < b.y + b.h + reach && b.y < r.y + r.h + reach
        if (near(nowBox) || near(wasBox)) touched.add(s)
      }
    }
  }
  /** Two moves ahead, when no single move helps: each of the best rejected
   *  moves tried with the best move after it; the pair taken when together
   *  they lower the cost (a move that opens the way for another). */
  const twoMoves = (rejected: { move: Move; gain: number }[]): boolean => {
    for (const first of rejected) {
      const f = judge(first.move)
      if (!f.after) continue
      const touched = new Set<string>(f.after.keys())
      for (const id of [...touched]) for (const x of index.linesOf.get(id) ?? []) { touched.add(x.a); touched.add(x.b) }
      const was = l.snapshot(f.after.keys())
      l.restore(f.after)
      updateIndex(l, index, f.after.keys())
      let second: { move: Move; gain: number; after: Map<string, Box> } | null = null
      for (const move of candidateMoves(l, nodes, relations, lines)) {
        if (!move.ids.some((id) => touched.has(id))) continue
        const s = judge(move)
        if (s.after && (!second || s.gain > second.gain)) second = { move, gain: s.gain, after: s.after }
      }
      l.restore(was)
      updateIndex(l, index, was.keys())
      if (second && f.gain + second.gain > 0.001) {
        // The pair's gain goes to the move that pays off; the first made way for it.
        stale = null
        commit({ ...first.move, description: `${first.move.description} (making way)` }, f.after, 0)
        commit(second.move, second.after, f.gain + second.gain)
        return true
      }
    }
    return false
  }
  const improve = (): void => {
    for (let n = 0; n < (options.maxSteps ?? MAX_STEPS); n++) {
      if (outOfTime()) break
      let best: { move: Move; gain: number } | null = null
      const rejected: { move: Move; gain: number }[] = []
      const seen = new Set<string>()
      index = buildIndex(l, lines)
      const cands = candidateMoves(l, nodes, relations, lines)
      for (const move of cands) {
        const key = keyOf(move)
        seen.add(key)
        let gain = gains.get(key)
        if (gain === undefined || !stale || move.ids.some((id) => stale!.has(id))) {
          gain = judge(move).gain
          gains.set(key, gain)
        }
        if (gain <= 0.001) { if (gain > -LOOKAHEAD_REACH) rejected.push({ move, gain }); continue }
        if (!best || gain > best.gain) best = { move, gain }
      }
      for (const key of [...gains.keys()]) if (!seen.has(key)) gains.delete(key)
      if (!best) {
        rejected.sort((p, q) => q.gain - p.gain)
        if (twoMoves(rejected.slice(0, LOOKAHEAD_WIDTH))) { n++; continue }
        break
      }
      // Judged again now, in case its cached gain is out of date.
      const fresh = judge(best.move)
      if (!fresh.after || fresh.gain <= 0.001) { gains.set(keyOf(best.move), fresh.gain); n--; if (n < -1) break; continue }
      stale = null
      commit(best.move, fresh.after, fresh.gain)
    }
  }
  improve()

  // Drawn in at the end: every move that costs nothing is taken.
  const drawnIn = new Set<string>()
  for (const move of compactMoves(l, nodes, lines)) {
    if (outOfTime()) break
    index = buildIndex(l, lines)
    const fresh = judge(move)
    if (!fresh.after || fresh.gain < -0.001) continue
    const wasPositions = l.positions()
    l.restore(fresh.after)
    const now = l.positions()
    const moved: PositionMap = {}
    for (const id of Object.keys(now)) if (!same(wasPositions[id], now[id])) moved[id] = now[id]
    if (Object.keys(moved).length) { steps.push({ kind: move.kind, description: move.description, gain: Math.max(0, fresh.gain), moved }); options.onProgress?.(steps.length, move.description) }
    for (const id of Object.keys(moved)) { drawnIn.add(id); for (const sb of l.childrenOf(l.parentOf(id))) drawnIn.add(sb) }
  }
  // What the drawing in made possible: judged again where something moved.
  stale = new Set(drawnIn)
  for (const id of drawnIn) for (const x of lines) { if (x.a === id) stale.add(x.b); if (x.b === id) stale.add(x.a) }
  improve()
  gather()
  let positions = l.positions()
  // The whole diagram from the top left, as every layout hands it over;
  // not when something is pinned: it stays where the author put it.
  const roots = l.ids().filter((id) => !l.parentOf(id))
  if (!pinned.length) {
    const minX = Math.min(...roots.map((id) => positions[id].x)), minY = Math.min(...roots.map((id) => positions[id].y))
    for (const id of roots) positions[id] = { ...positions[id], x: positions[id].x - minX, y: positions[id].y - minY }
  }
  positions = enforceAlignments(nodes, positions, options.alignments ?? [])
  const projected = projectPositions(nodes, positions)
  const afterLayout = new Layout(projected, options.metamodel)
  afterLayout.edgeStyle = style
  const after = totalCost(afterLayout, lines)
  const score = computeCompositeScore(projected, relations, style)
  const winner = { name: TIDY_NAME, positions, metrics: computeLayoutMetrics(projected, relations), score }
  return {
    baseline,
    winner,
    candidates: [winner],
    planarity: computePlanarityScore(projected, relations),
    refinement: { before: before.total, after: after.total, iterations: steps.length },
    keptCurrent: steps.length === 0,
    tidy: { steps, before, after, unchanged: steps.length === 0, budgetOut: outOfTime() },
  }
}

function ancestors(l: Layout, id: string): string[] {
  const out: string[] = []
  for (let p = l.parentOf(id); p; p = l.parentOf(p)) out.push(p)
  return out
}

function same(a: PositionMap[string] | undefined, b: PositionMap[string] | undefined): boolean {
  if (!a || !b) return a === b
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01 && Math.abs((a.width ?? 0) - (b.width ?? 0)) < 0.01 && Math.abs((a.height ?? 0) - (b.height ?? 0)) < 0.01
}
