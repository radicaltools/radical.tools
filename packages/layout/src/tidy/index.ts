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
import { type Alignment, alignmentError, alongAxis, enforceAlignments } from '../constraints'
import { computeCompositeScore, computePlanarityScore, projectPositions, type SmartLayoutResult } from '../smartLayout'
import { type Box, Layout } from './layout'
import { applyRadicalLayout } from '../radicalLayout'
import { type CostIndex, type CostParts, STRAIGHT_TOLERANCE, buildIndex, costRows, formatPart, linesOf, localCost, siblingsNear, totalCost, updateIndex } from './cost'
import { candidateMoves, compactMoves, gatherMoves, untangleMoves, type Move } from './moves'
export { type CostParts, PART_LABELS, costRows, formatPart } from './cost'

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
  /** True when the budget (or a stop) ended the tidying before it was done. */
  budgetOut: boolean
  /** The work done, as a budget counts it. */
  work: number
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
  /** Containers the view draws only to hold what it shows (viewFrames): tight round it, as the canvas draws them. */
  frames?: readonly string[]
  /** Tidy round these elements only: they and what they relate to move, nothing else. */
  around?: readonly string[]
  /** Called after each move taken. */
  onProgress?: (done: number, description: string) => void
  /** Asked before each round: true stops the tidying with what was done. */
  shouldStop?: () => boolean
  /** Stop after this much work, with what was done. Work is moves judged, each
   *  counted as many times as the view has elements (judging one takes longer on
   *  a larger view); not time, so a view gets the same layout on any machine. */
  budget?: number
}

export const TIDY_NAME = 'Tidy'
/** The budget Studio and the MCP server give a run (TidyOptions.budget): on the
 *  sample's whole-model view (283 elements, 10 000 moves judged) about 770 moves,
 *  some ten seconds in a browser; a view of 30 elements is tidied to the end.
 *  A view that needs more is tidied again. */
export const TIDY_BUDGET = 2_830_000
const MAX_STEPS = 400
/** Two moves ahead: this many of the best rejected moves are tried, those within this much of paying off. */
const LOOKAHEAD_WIDTH = 6
/** A move is taken when it gains more than this. */
const MIN_GAIN = 0.001
/** Two moves ahead are taken when together they gain more than this: two moves for a sliver
 *  are a dance, and one run's dance is the next run's work. */
const PAIR_GAIN = 0.001
const LOOKAHEAD_REACH = 20
/** The whole cost is measured every this many moves, to hand over the best layout seen. */
const CHECKPOINT_EVERY = 25
/** A view with this share of its elements on top of each other, or with more elements than
 *  ROUGH_FROM and this many crossings and lines over elements per line, gets a rough layout
 *  first (frames as blocks, layers by flow): moves from there, not from the canvas. A large
 *  view that already reads well is tidied from where it stands, so a second run keeps it. */
const ROUGH_FROM = 120
/** Up to this many siblings of a moved element's type are judged with it (alone in a row or not). */
const KIN_JUDGED = 12
const PILE_SHARE = 0.3
const ROUGH_WHEN_TANGLED = 0.5
/** The closing passes (drawn in, judged afresh, the margin) are repeated until one changes
 *  nothing, at most this many times: what a second run would find, this one takes. */
const MAX_PASSES = 4
/** Tidy run again on its own layout at most this many times (runTidyLayout). */
const MAX_AGAIN = 3
/** The author's rows and columns hold when their centres, as drawn, are this close (constraints.ts). */
const ALIGNED = 0.5
/** A large view's first round takes every move that helps as it comes (first improvement)
 *  instead of judging them all for the single best: hundreds of moves in the time the
 *  best-first round would spend choosing one, so a budget always buys something. */

export function runTidyLayout(
  inputNodes: Record<string, C4Node>,
  inputRelations: Record<string, C4Relation>,
  options: TidyOptions = {},
): TidyLayoutResult {
  const style = options.edgeStyle ?? 'curved'
  const first = tidyOnce(inputNodes, inputRelations, options, 0)
  const { nodes, relations, baseline, lines, before } = first
  const steps = [...first.steps]
  let { positions, work, budgetOut } = first
  // What a second run would find, this one takes: Tidy again from the
  // layout it hands over, as the next Smart Layout would start (a fresh
  // run judges every move afresh, and the margin it gathers into opens
  // moves the closing passes took back as a circle), until a run finds
  // nothing or the budget is spent.
  for (let again = 0; again < MAX_AGAIN && steps.length && !budgetOut; again++) {
    const at: Record<string, C4Node> = { ...inputNodes }
    for (const [id, p] of Object.entries(positions)) {
      const n = at[id]
      if (n) at[id] = { ...n, x: p.x, y: p.y, ...(nodes[id]?.collapsed || p.width === undefined ? {} : { width: p.width, height: p.height }) }
    }
    const done = steps.length
    const next = tidyOnce(at, inputRelations, { ...options, onProgress: options.onProgress && ((n, d) => options.onProgress!(done + n, d)) }, work)
    work = next.work
    budgetOut = next.budgetOut
    if (!next.steps.length) break
    steps.push(...next.steps)
    positions = next.positions
  }
  positions = { ...positions }
  // The whole diagram from the top left, as every layout hands it over;
  // not when something is pinned: it stays where the author put it.
  const roots = Object.keys(positions).filter((id) => !nodes[id].parentId || !nodes[nodes[id].parentId!])
  if (!first.pinned) {
    const minX = Math.min(...roots.map((id) => positions[id].x)), minY = Math.min(...roots.map((id) => positions[id].y))
    for (const id of roots) positions[id] = { ...positions[id], x: positions[id].x - minX, y: positions[id].y - minY }
  }
  const projected = projectPositions(nodes, positions)
  const afterLayout = new Layout(projected, options.metamodel, [], options.frames)
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
    tidy: { steps, before, after, unchanged: steps.length === 0, budgetOut, work },
  }
}

interface Tidied {
  /** The graph as drawn (projectToVisibleGraph), its metrics and lines as the run found them. */
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  baseline: ReturnType<typeof computeLayoutMetrics>
  lines: ReturnType<typeof linesOf>
  steps: TidyStep[]
  before: CostParts
  work: number
  budgetOut: boolean
  positions: PositionMap
  /** Something stayed where the author put it: the layout is not moved to the top left. */
  pinned: boolean
}

/** One run of Tidy, as a person makes it: the moves from the canvas as it
 *  stands, and the layout they lead to (parent-relative, not yet moved to
 *  the top left). `spent`: the work done before it, for the budget. */
function tidyOnce(
  inputNodes: Record<string, C4Node>,
  inputRelations: Record<string, C4Relation>,
  options: TidyOptions,
  spent: number,
): Tidied {
  const style = options.edgeStyle ?? 'curved'
  const { nodes, relations } = projectToVisibleGraph(inputNodes, inputRelations)
  const baseline = computeLayoutMetrics(nodes, relations)
  let work = spent
  const outOfTime = (): boolean => (options.budget !== undefined && work >= options.budget) || !!options.shouldStop?.()
  // Round a few elements: everything else is as good as pinned, but the
  // frames holding what moves still follow it.
  let pinned = options.pinned ?? []
  if (options.around?.length) {
    // What they relate to, one step out: not what that relates to in turn.
    const chosen = new Set<string>(options.around)
    const movable = new Set<string>(chosen)
    for (const r of Object.values(relations)) {
      if (chosen.has(r.sourceId) && nodes[r.targetId]) movable.add(r.targetId)
      if (chosen.has(r.targetId) && nodes[r.sourceId]) movable.add(r.sourceId)
    }
    const free = new Set<string>(movable)
    for (const id of movable) for (let p = nodes[id]?.parentId; p && nodes[p]; p = nodes[p].parentId) free.add(p)
    pinned = [...new Set([...pinned, ...Object.keys(nodes).filter((id) => !free.has(id))])]
  }
  const l = new Layout(nodes, options.metamodel, pinned, options.frames)
  l.edgeStyle = style
  const judgementWork = l.ids().length
  const lines = linesOf(l, relations)
  const before = totalCost(l, lines)
  const steps: TidyStep[] = []
  // A pile, or a large tangled view, as the canvas has it (for the rough layout below).
  const piled = l.ids().filter((id) => l.overlaps(id)).length > PILE_SHARE * l.ids().length
  const tangled = lines.length > 0 && (before.crossings + before.overdraws) > ROUGH_WHEN_TANGLED * lines.length

  // The rows and columns the author set hold from the start, and every move
  // keeps them (keepLines): what Tidy hands over is the layout it judged,
  // so a second run finds it as this one left it. Lined up only where they
  // do not hold as the canvas draws them: the line-up makes room round
  // every box it finds too close, the rest of the view included, and fits
  // frames its own way, so on lines that held it moved what no move took.
  // Nothing pinned, or left out of a Tidy round a selection, is pushed aside.
  const alignments = options.alignments ?? []
  const lineUp = (): void => {
    if (!alignments.length || alignmentError(nodes, l.positions(), alignments) <= ALIGNED) return
    l.setPositions(enforceAlignments(nodes, l.positions(), alignments, new Set(l.ids().filter((id) => l.fixed(id)))))
    l.refit()
  }
  {
    const wasPositions = l.positions()
    lineUp()
    const now = l.positions()
    const moved: PositionMap = {}
    for (const id of Object.keys(now)) if (!same(wasPositions[id], now[id])) moved[id] = now[id]
    if (Object.keys(moved).length) {
      const description = 'The rows and columns set on the view lined up'
      steps.push({ kind: 'align', description, gain: 0, moved })
      options.onProgress?.(steps.length, description)
    }
  }
  const start = { cost: steps.length ? totalCost(l, lines).total : before.total, positions: l.positions(), steps: steps.length }

  // A large view, or a pile, is sketched first: the semantic layered layout
  // puts persons on top, outside systems at the edge, frames as blocks and
  // their children in layers by flow. The moves then start from a sketch
  // instead of tidying a pile one element at a time (which a person would
  // not do either). Not round a selection, nor with pins to keep. A large
  // view still tangled after a run is not sketched again unless the sketch
  // reads better: another run continues from the canvas.
  if (!options.around?.length && !pinned.length && (piled || (l.ids().length > ROUGH_FROM && tangled))) {
    const wasPositions = l.positions()
    l.setPositions(applyRadicalLayout(nodes, relations))
    l.refit()
    lineUp()
    if (!piled && totalCost(l, lines).total >= start.cost) l.setPositions(wasPositions)
    const now = l.positions()
    const moved: PositionMap = {}
    for (const id of Object.keys(now)) if (!same(wasPositions[id], now[id])) moved[id] = now[id]
    if (Object.keys(moved).length) {
      const description = `A rough layout first: ${l.ids().length} elements in layers, frames as blocks`
      steps.push({ kind: 'rough', description, gain: 0, moved })
      options.onProgress?.(steps.length, description)
    }
  }

  // Every layout the moves passed through, by where the boxes stand, with
  // the number of steps that led there. Moves that come back to one went
  // round in a circle (their gains, judged locally, added up to more than
  // the whole changed): the circle is taken back and the round ends.
  const seen = new Map<string, number>()
  const stateKey = (): string => {
    let h1 = 0, h2 = 0
    for (const id of l.ids()) {
      const b = l.box(id)!
      const x = Math.round(b.x), y = Math.round(b.y)
      h1 = (Math.imul(h1, 31) + x) | 0; h1 = (Math.imul(h1, 31) + y) | 0
      h2 = (Math.imul(h2, 37) ^ (x * 7919 + y)) | 0
    }
    return `${h1}:${h2}`
  }
  // Where it started, so moves that come back to it (the loose elements
  // to the margin and back) are seen to have gone round.
  seen.set(stateKey(), steps.length)

  // The members of the author's rows and columns where a move found them;
  // after it, a row a member left follows it (the others moved along that
  // axis, with what they hold), or, where that is not clear of the rest,
  // the member is put back on the row; the move fails when neither is
  // clear or a row is left out of its order.
  const lineIds = [...new Set(alignments.flatMap((a) => a.ids))].filter((id) => l.box(id))
  const lineReach = [...new Set(lineIds.flatMap((id) => [id, ...l.descendants(id), ...ancestors(l, id)]))]
  const held = (): Map<string, Box> | null => (lineIds.length ? l.snapshot(lineIds) : null)
  const keepLines = (was: Map<string, Box> | null): boolean => {
    if (!was) return true
    const offsets = (a: Alignment): { id: string; d: number }[] => {
      const key = a.axis === 'x' ? 'cx' : 'cy'
      return a.ids.filter((id) => was.has(id)).map((id) => ({ id, d: l.box(id)![key] - was.get(id)![key] }))
    }
    const level = (ds: { d: number }[]): boolean => ds.every((m) => Math.abs(m.d - ds[0].d) < 0.01)
    const shift = (a: Alignment, id: string, d: number): void => l.moveBy(id, a.axis === 'x' ? d : 0, a.axis === 'y' ? d : 0)
    const repair = (follow: boolean): boolean => {
      for (let round = 0; round < 3; round++) {
        let off = false
        for (const a of alignments) {
          const ds = offsets(a)
          if (level(ds)) continue
          off = true
          const moved = ds.filter((m) => Math.abs(m.d) >= 0.01)
          if (follow && level(moved)) { for (const m of ds) if (Math.abs(m.d) < 0.01) shift(a, m.id, moved[0].d) }
          else for (const m of moved) shift(a, m.id, -m.d)
        }
        if (!off) break
      }
      for (const a of alignments) {
        if (!level(offsets(a))) return false
        const along = alongAxis(a) === 'x' ? 'cx' : 'cy'
        for (const chain of a.orders) {
          const ids = chain.filter((id) => was.has(id))
          for (let k = 1; k < ids.length; k++) {
            if (was.get(ids[k - 1])![along] < was.get(ids[k])![along] && l.box(ids[k - 1])![along] >= l.box(ids[k])![along]) return false
          }
        }
      }
      return l.allClear(lineIds)
    }
    const moved = l.snapshot(lineReach)
    if (repair(true)) return true
    l.restore(moved)
    return repair(false)
  }

  // First the loose elements out of the way, whatever the cost says: they
  // have no lines for it to see. And again at the end, to the margin the
  // tidied diagram has.
  const take = (moves: Move[]): void => {
    for (const move of moves) {
      const touched = [...new Set([...move.ids.flatMap((id) => [id, ...l.descendants(id), ...ancestors(l, id)]), ...lineReach])]
      const wasPositions = l.positions()
      const was = l.snapshot(touched)
      const lined = held()
      if (!move.apply(l) || !keepLines(lined)) { l.restore(was); continue }
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
      const touched = [...new Set([...move.ids.flatMap((id) => [id, ...l.descendants(id), ...ancestors(l, id)]), ...lineReach])]
      const wasPositions = l.positions()
      const was = l.snapshot(touched)
      const lined = held()
      if (!move.apply(l) || !keepLines(lined)) { l.restore(was); continue }
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
  const keyOf = (m: Move): string => `${m.kind}:${m.ids.join('+')}:${m.description}:${m.variant ?? ''}`
  let index: CostIndex = buildIndex(l, lines)
  // The best layout seen, by the whole cost: a run cut short by its budget,
  // or one whose local judgements added up wrong, hands that over, never
  // anything worse than it started from.
  let best = start
  const checkpoint = (): void => {
    const cost = totalCost(l, lines).total
    if (cost < best.cost) best = { cost, positions: l.positions(), steps: steps.length }
  }
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
    work += judgementWork
    const moved = new Set(move.ids)
    // Tried first, to know what it changes: the cost before and after is
    // then judged on the same elements (the room round where the moved
    // ones were and where they are).
    l.begin()
    const lined = held()
    const done = move.apply(l)
    if (!done) { l.rollback(); return { gain: -Infinity, after: null } }
    settle(l.journalBoxes())
    if (!keepLines(lined)) { l.rollback(); return { gain: -Infinity, after: null } }
    const touched = l.changed()
    // A member put back on its line moved too: its lines are judged with the move.
    for (const id of touched) if (lined?.has(id)) moved.add(id)
    const after = l.snapshot(touched)
    const was = l.journalBoxes()
    const roomy = new Set<string>()
    // The moved elements and the frames round them (refitted, so they moved
    // too): each with the siblings near where it was and where it is.
    const changed = new Set(touched)
    const room = new Set<string>()
    for (const m of moved) for (let x: string | undefined = m; x && (x === m || changed.has(x)); x = l.parentOf(x)) room.add(x)
    for (const m of room) {
      siblingsNear(l, l.parentOf(m), l.box(m)!, roomy); siblingsNear(l, l.parentOf(m), was.get(m) ?? l.box(m)!, roomy)
      // Its kind too, wherever they stand: leaving a row may leave one of them alone.
      const kin = l.peersIn(l.parentOf(m)).filter((o) => l.nodes[o].type === l.nodes[m].type)
      if (kin.length <= KIN_JUDGED) for (const o of kin) roomy.add(o)
    }
    l.rollback()
    // Judged after, then before, on the same lines: the moved elements'
    // and those drawn differently now that their ports shifted.
    l.restore(after)
    const shifted = updateIndex(l, index, touched)
    const costNow = localCost(l, lines, moved, index, roomy, shifted, changed)
    l.restore(was)
    updateIndex(l, index, touched)
    const costWas = localCost(l, lines, moved, index, roomy, shifted, changed)
    return { gain: costWas - costNow, after }
  }
  let looped = false
  const circled = (): boolean => {
    const key = stateKey()
    const back = seen.get(key)
    if (back === undefined) { seen.set(key, steps.length); return false }
    // Back where `back` steps left it; the best layout seen inside the circle, if any, kept.
    if (best.steps > back) { l.setPositions(best.positions); steps.length = best.steps }
    else steps.length = back
    for (const [k, n] of seen) if (n > steps.length) seen.delete(k)
    looped = true
    return true
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
    if (circled()) return
    if (steps.length % CHECKPOINT_EVERY === 0) checkpoint()
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
      for (const move of candidateMoves(l, nodes, relations, lines, touched)) {
        const s = judge(move)
        if (s.after && (!second || s.gain > second.gain)) second = { move, gain: s.gain, after: s.after }
      }
      l.restore(was)
      updateIndex(l, index, was.keys())
      if (second && f.gain + second.gain > PAIR_GAIN) {
        // The pair's gain goes to the move that pays off; the first made way for it.
        stale = null
        commit({ ...first.move, description: `${first.move.description} (making way)` }, f.after, 0)
        if (!looped) commit(second.move, second.after, f.gain + second.gain)
        return true
      }
    }
    return false
  }
  // Candidates are kept from one round to the next; only those round what
  // the last move touched are made (and judged) again.
  let cands: Move[] = []
  const improve = (): void => {
    let misses = 0
    looped = false
    for (let n = 0; n < (options.maxSteps ?? MAX_STEPS); n++) {
      if (outOfTime() || looped) break
      let best: { move: Move; gain: number } | null = null
      const rejected: { move: Move; gain: number }[] = []
      const seen = new Set<string>()
      index = buildIndex(l, lines)
      cands = stale
        ? [...cands.filter((m) => !m.ids.some((id) => stale!.has(id))), ...candidateMoves(l, nodes, relations, lines, stale)]
        : candidateMoves(l, nodes, relations, lines)
      let judged = 0
      if (!stale && l.ids().length > ROUGH_FROM) {
        // A sweep: every move that helps, in the order they come.
        let swept = 0
        for (const move of cands) {
          const j = judge(move)
          if (j.after && j.gain > MIN_GAIN) { commit(move, j.after, j.gain); swept++; n++ }
          if (looped || (++judged % 64 === 0 && outOfTime())) break
        }
        if (outOfTime() || looped) break
        if (swept) { gains.clear(); continue }
      }
      for (const move of cands) {
        const key = keyOf(move)
        seen.add(key)
        let gain = gains.get(key)
        if (gain === undefined || !stale || move.ids.some((id) => stale!.has(id))) {
          gain = judge(move).gain
          gains.set(key, gain)
          if (++judged % 64 === 0 && outOfTime()) break
        }
        if (gain <= MIN_GAIN) { if (gain > -LOOKAHEAD_REACH) rejected.push({ move, gain }); continue }
        if (!best || gain > best.gain) best = { move, gain }
      }
      if (outOfTime()) break
      for (const key of [...gains.keys()]) if (!seen.has(key)) gains.delete(key)
      if (!best) {
        rejected.sort((p, q) => q.gain - p.gain)
        if (twoMoves(rejected.slice(0, LOOKAHEAD_WIDTH))) { n++; continue }
        break
      }
      // Judged again now, in case its cached gain is out of date; a few
      // such misses in a row end the round rather than spin on them.
      const fresh = judge(best.move)
      if (!fresh.after || fresh.gain <= MIN_GAIN) { gains.set(keyOf(best.move), fresh.gain); if (++misses > 8) break; n--; continue }
      misses = 0
      stale = null
      commit(best.move, fresh.after, fresh.gain)
    }
  }
  seen.set(stateKey(), steps.length)
  improve()

  // The closing passes, until one changes nothing: a run that ends with
  // moves still to take hands the next run its work (a drawing in that
  // opened a row, a margin that moved), and Smart Layout run again on its
  // own layout should find nothing left to tidy.
  for (let pass = 0; pass < MAX_PASSES && !outOfTime(); pass++) {
    const at = stateKey()
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
    if (drawnIn.size) {
      stale = new Set(drawnIn)
      for (const id of drawnIn) for (const x of lines) { if (x.a === id) stale.add(x.b); if (x.b === id) stale.add(x.a) }
      improve()
    }
    // A last look at every move, every gain judged afresh rather than kept
    // from earlier rounds: what is left now, a second run would find.
    stale = null
    improve()
    // The loose elements to the margin the diagram has now; that opens moves
    // of its own (a row with one of them), which a second run would take, so
    // they are taken now, as long as the margin keeps moving.
    for (let round = 0; round < 3; round++) {
      const done = steps.length
      gather()
      if (steps.length === done || outOfTime()) break
      stale = null
      improve()
    }
    if (stateKey() === at) break
  }
  checkpoint()
  if (totalCost(l, lines).total > best.cost + 0.01) {
    l.setPositions(best.positions)
    steps.length = best.steps
  }
  // The author's rows and columns held all along; lined up once more
  // where the canvas measures them off, so what is handed over stands
  // where the next run will find it.
  lineUp()
  return { nodes, relations, baseline, lines, steps, before, work, budgetOut: outOfTime(), positions: l.positions(), pinned: pinned.length > 0 }
}

/** What a run did, as Studio's notice and the MCP server's smart_layout tell it: the
 *  moves, and the three parts of the reader's cost that gained most. */
export function tidySummary(tidy: TidyReport): string {
  const arrow = '\u2009\u2192\u2009'
  const gained = costRows(tidy.before, tidy.after)
    .sort((p, q) => (q.before - q.after) * q.weight - (p.before - p.after) * p.weight)
    .filter((p) => p.before - p.after > 0.05).slice(0, 3)
    .map((p) => `${p.label.toLowerCase()} ${formatPart(p.before)}${arrow}${formatPart(p.after)}`)
  const n = tidy.steps.length
  return `${n} move${n === 1 ? '' : 's'}${tidy.budgetOut ? ' (run it again for more)' : ''}${gained.length ? ` — ${gained.join(', ')}` : ''}`
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
