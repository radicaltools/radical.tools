/**
 * What a reader minds in a diagram, as one number: lines that cross
 * (Purchase 1997: the aesthetic that matters most), lines drawn over
 * elements they do not join, lines that slant where they could run
 * straight (Ware et al. 2002: continuity), lines longer than they need to
 * be, an element off the middle of what it relates to, and room wasted
 * (HOLA, Kieffer et al. 2016: compactness, symmetry); a line that runs
 * upward against the flow (Sugiyama 1981: one direction), two lines that
 * leave an element at nearly the same angle (angular resolution, Purchase
 * 2002), a line that brushes an element it does not join, and an element
 * in no row or column with any sibling (HOLA: gridiness). Overlapping
 * elements are not a cost but a bar: no move may leave two siblings on
 * each other.
 *
 * Costs are local where they can be: a move changes the lines of the
 * elements it moved and what those lines pass over, so judging it needs
 * only those (localCost); the whole layout is summed once, for the report.
 */
import type { C4Relation } from '@radical/common/c4'
import { type LayoutFlow, relationLayoutHint } from '@radical/common/metamodel'
import type { Layout } from './layout'
import { allocatePorts } from '../portAllocator'
import { orthogonalConnector, type Pt } from '../edgeRouting'
import { Position } from '../side'

export type Ends = { ax: number; ay: number; bx: number; by: number }
/** `mid`: the ends at the middle of the sides the ports are on, where a solitary port lies. A side several lines leave from spreads them (`fan`), so such a line is drawn slanted whatever the elements do; it is judged straight when it would be straight from the middle, as a fan is read: by where the elements stand, and its slant counts half. */
/** `path`: the points the line is drawn through, port to port: two for a curved or straight line, an L or a Z for an orthogonal one. */
export type LineGeom = Ends & { x0: number; y0: number; x1: number; y1: number; mid: Ends; fan: boolean; path: Pt[] }

export const W_CROSSING = 10
export const W_OVERDRAW = 8
export const W_SLANT = 4
/** Per mean element size of line beyond one. */
export const W_LENGTH = 2
export const W_IMBALANCE = 1
/** Per mean element size an element's nearest sibling stands off the comfortable distance, too far or too near. */
export const W_SPREAD = 2
/** The comfortable distance between siblings, beyond the gap, in mean element sizes. */
export const COMFORT = 0.25
/** Per element an actor is not above, and per caller an outside system is not below or right of. */
export const W_PLACE = 6
/** A store with one user not level with it on its right; a note with one anchor not level with it on its left (the convention). */
export const W_CONVENTION = 3
/** Per line that runs against its flow: up for a forward relation, down for a reverse one (left and right on the horizontal axis). */
export const W_AGAINST_FLOW = 3
/** Per line that reads along an axis but runs more across it than along it (a flat transition). */
export const W_FLAT = 4
/** Per pair of lines leaving one element less than FAN_ANGLE apart. */
export const W_FAN = 3
export const FAN_ANGLE = Math.PI / 12
/** Per line passing within BRUSH of an element it does not join, in mean element sizes. */
export const W_BRUSH = 2
export const BRUSH = 0.2
/** Per element whose centre shares neither a row nor a column with any sibling. */
export const W_GRID = 1.5
/** Per mean element size the gaps on an element's two sides in its row (or column) differ, capped. */
export const W_EVEN = 1.5
/** Per relation label drawn over an element it does not join, or over another label. */
export const W_LABEL = 3
/** Per bend of an orthogonal line (an L has one, a Z two). */
export const W_BEND = 2

/** The weights, by the name of the part they weigh: what bench/tidy-calibrate.mts fits. */
export const WEIGHTS = {
  crossings: W_CROSSING, overdraws: W_OVERDRAW, slanted: W_SLANT, length: W_LENGTH, imbalance: W_IMBALANCE, spread: W_SPREAD, misplaced: W_PLACE,
  againstFlow: W_AGAINST_FLOW, flat: W_FLAT, fans: W_FAN, brushes: W_BRUSH, offGrid: W_GRID, offConvention: W_CONVENTION, uneven: W_EVEN, labels: W_LABEL, bends: W_BEND,
}
/** A label's box: the canvas draws the name at 17 px, about 0.56 em per character, with room round it. */
export const LABEL_CHAR = 17 * 0.56
export const LABEL_PAD = 16
export const LABEL_HEIGHT = 24
/** Centres this close share a row or a column. */
export const STRAIGHT_TOLERANCE = 2

/** A drawn relation, with which way its type reads (layoutHints.ts) and its label, if any. */
export interface Line { id: string; a: string; b: string; flow: LayoutFlow; axis: 'vertical' | 'horizontal' | 'free'; label?: string }

/** Where a line's label is drawn: a box at its middle. */
export function labelBox(g: LineGeom, label: string): { x0: number; y0: number; x1: number; y1: number } {
  const w = Math.max(40, label.length * LABEL_CHAR + LABEL_PAD), h = LABEL_HEIGHT
  const mx = (g.ax + g.bx) / 2, my = (g.ay + g.by) / 2
  return { x0: mx - w / 2, y0: my - h / 2, x1: mx + w / 2, y1: my + h / 2 }
}

/** The lines between drawn elements neither of which holds the other. */
export function linesOf(l: Layout, relations: Record<string, C4Relation>): Line[] {
  const out: Line[] = []
  for (const id of Object.keys(relations).sort()) {
    const r = relations[id]
    if (!l.box(r.sourceId) || !l.box(r.targetId) || r.sourceId === r.targetId) continue
    if (l.holds(r.sourceId, r.targetId) || l.holds(r.targetId, r.sourceId)) continue
    const hint = relationLayoutHint(r.relationType, l.metamodel)
    const label = r.label?.trim()
    out.push({ id, a: r.sourceId, b: r.targetId, flow: hint.flow, axis: hint.axis ?? 'free', ...(label ? { label } : {}) })
  }
  return out
}

/** Whether a line runs against its flow: a forward relation more up than
 *  across (or, on the horizontal axis, more left than up or down), a reverse
 *  one the other way round. A side relation has no way to run against. */
export function againstFlow(l: Layout, line: Line): boolean {
  if (line.flow === 'side') return false
  const a = l.box(line.a)!, b = l.box(line.b)!
  // From the end that should come first to the one that should follow.
  const [from, to] = line.flow === 'forward' ? [a, b] : [b, a]
  if (line.axis === 'horizontal') {
    const back = from.cx - to.cx
    return back > STRAIGHT_TOLERANCE && back > Math.abs(from.cy - to.cy)
  }
  const rise = from.cy - to.cy
  return rise > STRAIGHT_TOLERANCE && rise > Math.abs(from.cx - to.cx)
}

/** Whether a line that reads along an axis runs more across it than along it. */
export function flat(l: Layout, line: Line): boolean {
  if (line.flow === 'side' || line.axis === 'free') return false
  const a = l.box(line.a)!, b = l.box(line.b)!
  const dx = Math.abs(a.cx - b.cx), dy = Math.abs(a.cy - b.cy)
  return line.axis === 'vertical' ? dy <= dx : dx <= dy
}

/** Whether a line is straight: from the middle of its sides, level or one
 *  above the other (a solitary port lies there; a fan's lines are judged
 *  by where the elements stand, not by the spread of their ports). */
export function isStraight(index: CostIndex, line: Line): boolean {
  const m = geomOf(index, line).mid
  return Math.abs(m.ax - m.bx) < STRAIGHT_TOLERANCE || Math.abs(m.ay - m.by) < STRAIGHT_TOLERANCE
}

/** Where every line is drawn: between the ports Studio draws it from (the
 *  side nearest the other end; ports spread along a side several lines
 *  share), so a line judged straight here is drawn straight there. */
export function portsOf(l: Layout, all: Line[]): Map<Line, LineGeom> {
  const views = new Map<string, { id: string; positionAbsolute: { x: number; y: number }; width: number; height: number }>()
  for (const id of l.ids()) { const b = l.box(id)!; views.set(id, { id, positionAbsolute: { x: b.x, y: b.y }, width: b.w, height: b.h }) }
  const ports = allocatePorts(views, all.map((q) => ({ id: q.id, source: q.a, target: q.b })))
  const onSide = new Map<string, number>()
  for (const q of all) {
    const p = ports.get(q.id)
    if (p) for (const k of [`${q.a}|${p.sourceSide}`, `${q.b}|${p.targetSide}`]) onSide.set(k, (onSide.get(k) ?? 0) + 1)
  }
  const middle = (r: { x: number; y: number; w: number; h: number; cx: number; cy: number }, side: Position | undefined): { x: number; y: number } => {
    switch (side) {
      case Position.Left: return { x: r.x, y: r.cy }
      case Position.Right: return { x: r.x + r.w, y: r.cy }
      case Position.Top: return { x: r.cx, y: r.y }
      case Position.Bottom: return { x: r.cx, y: r.y + r.h }
      default: return { x: r.cx, y: r.cy }
    }
  }
  const out = new Map<Line, LineGeom>()
  for (const q of all) {
    const p = ports.get(q.id)
    const a = l.box(q.a)!, b = l.box(q.b)!
    const ax = p?.sourcePoint.x ?? a.cx, ay = p?.sourcePoint.y ?? a.cy, bx = p?.targetPoint.x ?? b.cx, by = p?.targetPoint.y ?? b.cy
    const ma = middle(a, p?.sourceSide), mb = middle(b, p?.targetSide)
    const fan = !!p && ((onSide.get(`${q.a}|${p.sourceSide}`) ?? 1) > 1 || (onSide.get(`${q.b}|${p.targetSide}`) ?? 1) > 1)
    // An orthogonal line runs out of each side and turns between the ports; a curved one is judged on its chord.
    const path: Pt[] = l.edgeStyle === 'orthogonal' && p ? orthogonalConnector({ x: ax, y: ay }, p.sourceSide, { x: bx, y: by }, p.targetSide) : [{ x: ax, y: ay }, { x: bx, y: by }]
    const xs = path.map((pt) => pt.x), ys = path.map((pt) => pt.y)
    out.set(q, { ax, ay, bx, by, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), mid: { ax: ma.x, ay: ma.y, bx: mb.x, by: mb.y }, fan, path })
  }
  return out
}

/** How far an element's centre lies from the middle of what it relates
 *  to, in mean element sizes, when it has two or more neighbours. */
function imbalance(l: Layout, id: string, lines: Line[]): number {
  const others = lines.map((x) => (x.a === id ? x.b : x.a))
  if (others.length < 2) return 0
  const b = l.box(id)!
  const mx = others.reduce((s, o) => s + l.box(o)!.cx, 0) / others.length
  const my = others.reduce((s, o) => s + l.box(o)!.cy, 0) / others.length
  // Along the axis the neighbours spread on; across it an element is placed by its row or column.
  const spreadX = Math.max(...others.map((o) => l.box(o)!.cx)) - Math.min(...others.map((o) => l.box(o)!.cx))
  const spreadY = Math.max(...others.map((o) => l.box(o)!.cy)) - Math.min(...others.map((o) => l.box(o)!.cy))
  const off = spreadX >= spreadY ? Math.abs(b.cx - mx) : Math.abs(b.cy - my)
  return Math.min(2, off / l.meanSize)
}

export interface CostParts {
  crossings: number; overdraws: number; slanted: number; length: number; imbalance: number; spread: number; misplaced: number
  againstFlow: number; flat: number; fans: number; brushes: number; offGrid: number; offConvention: number; uneven: number; labels: number; bends: number
  total: number
}

/** Pairs of lines leaving `id` less than FAN_ANGLE apart: read as one line. */
function fans(index: CostIndex, id: string, lines: Line[]): number {
  if (lines.length < 2) return 0
  const angles = lines.map((q) => {
    const g = geomOf(index, q)
    return q.a === id ? Math.atan2(g.by - g.ay, g.bx - g.ax) : Math.atan2(g.ay - g.by, g.ax - g.bx)
  }).sort((p, q) => p - q)
  let n = 0
  for (let i = 1; i < angles.length; i++) if (angles[i] - angles[i - 1] < FAN_ANGLE) n++
  if (angles.length > 2 && angles[0] + 2 * Math.PI - angles[angles.length - 1] < FAN_ANGLE) n++
  return n
}

/** How much the gaps on an element's two sides in its row differ, and in
 *  its column, in mean element sizes (capped): people read even spacing
 *  as order. */
export function uneven(l: Layout, id: string): number {
  const b = l.box(id)!
  let out = 0
  for (const axis of ['x', 'y'] as const) {
    let before = -Infinity, after = Infinity
    for (const o of l.childrenOf(l.parentOf(id))) {
      if (o === id) continue
      const r = l.box(o)!
      if (axis === 'x') {
        if (Math.abs(r.cy - b.cy) >= STRAIGHT_TOLERANCE) continue
        if (r.x + r.w <= b.x) before = Math.max(before, r.x + r.w)
        else if (r.x >= b.x + b.w) after = Math.min(after, r.x)
      } else {
        if (Math.abs(r.cx - b.cx) >= STRAIGHT_TOLERANCE) continue
        if (r.y + r.h <= b.y) before = Math.max(before, r.y + r.h)
        else if (r.y >= b.y + b.h) after = Math.min(after, r.y)
      }
    }
    if (before === -Infinity || after === Infinity) continue
    const g1 = axis === 'x' ? b.x - before : b.y - before, g2 = axis === 'x' ? after - (b.x + b.w) : after - (b.y + b.h)
    out += Math.min(2, Math.abs(g1 - g2) / l.meanSize)
  }
  return out
}

/** Whether `id` shares a row or a column with some sibling. */
export function inGrid(l: Layout, id: string): boolean {
  const b = l.box(id)!
  const siblings = l.childrenOf(l.parentOf(id))
  if (siblings.length < 2) return true
  for (const o of siblings) {
    if (o === id) continue
    const r = l.box(o)!
    if (Math.abs(r.cx - b.cx) < STRAIGHT_TOLERANCE || Math.abs(r.cy - b.cy) < STRAIGHT_TOLERANCE) return true
  }
  return false
}

/** How far `id` stands from its nearest sibling, edge to edge beyond the gap, in mean sizes (capped). */
function spreadOf(l: Layout, id: string): number {
  const b = l.box(id)!
  const parent = l.parentOf(id)
  const gap = l.gapOf(parent)
  let nearest = Infinity
  for (const o of l.childrenOf(parent)) {
    if (o === id) continue
    const r = l.box(o)!
    const dx = Math.max(0, r.x - (b.x + b.w), b.x - (r.x + r.w))
    const dy = Math.max(0, r.y - (b.y + b.h), b.y - (r.y + r.h))
    nearest = Math.min(nearest, Math.hypot(dx, dy))
  }
  if (nearest === Infinity) return 0
  return Math.min(3, Math.abs(nearest - gap - COMFORT * l.meanSize) / l.meanSize)
}

/** Where a role belongs: an actor or a start above what it leads to, an
 *  end below what leads to it, an outside system below or right of what
 *  calls it, a broker between the two sides it joins. */
export function misplaced(l: Layout, id: string, lines: Line[]): number {
  const n = l.nodes[id]
  const others = lines.map((x) => (x.a === id ? x.b : x.a))
  if (!others.length) return 0
  const b = l.box(id)!
  const role = l.role(id)
  if (role === 'actor' || role === 'start') return others.filter((o) => l.box(o)!.y < b.y + b.h).length
  if (role === 'end') return others.filter((o) => l.box(o)!.y + l.box(o)!.h > b.y).length
  if (role === 'broker' && others.length === 2) {
    // Off the line between its two sides by more than half an element.
    const p = l.box(others[0])!, q = l.box(others[1])!
    const dx = q.cx - p.cx, dy = q.cy - p.cy
    const len = Math.hypot(dx, dy) || 1
    const t = Math.max(0, Math.min(1, ((b.cx - p.cx) * dx + (b.cy - p.cy) * dy) / (len * len)))
    const off = Math.hypot(b.cx - (p.cx + t * dx), b.cy - (p.cy + t * dy))
    return off > l.meanSize / 2 ? 1 : 0
  }
  if (n.external && !l.parentOf(id)) {
    const below = others.every((o) => l.box(o)!.y + l.box(o)!.h <= b.y)
    const right = others.every((o) => l.box(o)!.x + l.box(o)!.w <= b.x)
    return below || right ? 0 : 1
  }
  return 0
}

/** The anchor a store or a note is pulled out beside: the other end of its
 *  one line, a sibling; for a note, one of a side relation (a requirement
 *  derived from a need is placed by that flow, not beside the need). */
export function anchorOf(l: Layout, id: string, lines: Line[]): string | undefined {
  const role = l.role(id)
  if ((role !== 'store' && role !== 'note') || lines.length !== 1 || l.isFrame(id)) return undefined
  if (role === 'note' && lines[0].flow !== 'side') return undefined
  const anchor = lines[0].a === id ? lines[0].b : lines[0].a
  return l.parentOf(anchor) === l.parentOf(id) ? anchor : undefined
}

/** A store beside its one user, on the right; a note beside its one anchor, on the left: level with it, nothing between. */
export function offConvention(l: Layout, id: string, lines: Line[]): number {
  const anchor = anchorOf(l, id, lines)
  if (!anchor) return 0
  const a = l.box(anchor)!, b = l.box(id)!
  if (Math.abs(a.cy - b.cy) >= STRAIGHT_TOLERANCE) return 1
  return l.role(id) === 'store' ? (b.x > a.x + a.w ? 0 : 1) : (b.x + b.w < a.x ? 0 : 1)
}

/** The grids over the lines and the elements, built once per round of
 *  judging: what did not move stands where it was. */
type Extent = [number, number, number, number]
export interface CostIndex {
  all: Line[]
  lineGrid: Grid<Line>
  boxGrid: Grid<string>
  lineIndex: Map<Line, number>
  /** Where each line is drawn, between its ports. */
  geom: Map<Line, LineGeom>
  /** Where each line and box was put in its grid, to take it out when it moves. */
  lineAt: Map<Line, Extent>
  boxAt: Map<string, Extent>
  linesOf: Map<string, Line[]>
}

export function geomOf(index: CostIndex, line: Line): LineGeom { return index.geom.get(line)! }

export function buildIndex(l: Layout, all: Line[]): CostIndex {
  const cell = Math.max(100, l.meanSize * 2)
  const lineGrid = new Grid<Line>(cell)
  const lineIndex = new Map<Line, number>()
  const lineAt = new Map<Line, Extent>()
  const linesOf = new Map<string, Line[]>()
  const geom = portsOf(l, all)
  all.forEach((q, i) => {
    lineIndex.set(q, i)
    const g = geom.get(q)!
    const e: Extent = [g.x0, g.y0, g.x1, g.y1]
    lineGrid.add(q, ...e); lineAt.set(q, e)
    for (const end of [q.a, q.b]) { const list = linesOf.get(end); if (list) list.push(q); else linesOf.set(end, [q]) }
  })
  const boxGrid = new Grid<string>(cell)
  const boxAt = new Map<string, Extent>()
  for (const id of l.ids()) { const r = l.box(id)!; const e: Extent = [r.x, r.y, r.x + r.w, r.y + r.h]; boxGrid.add(id, ...e); boxAt.set(id, e) }
  return { all, lineGrid, boxGrid, lineIndex, geom, lineAt, boxAt, linesOf }
}

/** The index brought up to date for `ids` after they moved (or moved
 *  back). The ports are allotted again for every line: a side shared by
 *  several lines spreads them, so a line far from what moved may shift
 *  along its side. */
export function updateIndex(l: Layout, index: CostIndex, ids: Iterable<string>): void {
  let moved = false
  for (const id of ids) {
    const r = l.box(id)!
    const e: Extent = [r.x, r.y, r.x + r.w, r.y + r.h]
    const was = index.boxAt.get(id)!
    if (was[0] === e[0] && was[1] === e[1] && was[2] === e[2] && was[3] === e[3]) continue
    index.boxGrid.remove(id, ...was); index.boxGrid.add(id, ...e); index.boxAt.set(id, e)
    moved = true
  }
  if (!moved) return
  index.geom = portsOf(l, index.all)
  for (const q of index.all) {
    const g = index.geom.get(q)!
    const e: Extent = [g.x0, g.y0, g.x1, g.y1]
    const was = index.lineAt.get(q)!
    if (was[0] === e[0] && was[1] === e[1] && was[2] === e[2] && was[3] === e[3]) continue
    index.lineGrid.remove(q, ...was); index.lineGrid.add(q, ...e); index.lineAt.set(q, e)
  }
}

/** The cost of the whole layout. */
export function totalCost(l: Layout, lines: Line[]): CostParts {
  return costOf(l, lines, lines, l.ids(), undefined, buildIndex(l, lines))
}

/** The cost of the lines of `moved` elements and of what lies over or under them. */
export function localCost(l: Layout, lines: Line[], moved: ReadonlySet<string>, index?: CostIndex, roomy?: ReadonlySet<string>): number {
  return localCostParts(l, lines, moved, index, roomy).total
}
/** `roomy`: the elements whose room is judged (the moved ones and the
 *  siblings near where they were and where they are); judged before and
 *  after a move it must be the same set, so the caller may give it. */
export function localCostParts(l: Layout, lines: Line[], moved: ReadonlySet<string>, index?: CostIndex, roomy?: ReadonlySet<string>): CostParts {
  // The lines of what moved, of what it holds, and of the frames holding it (refitted, so their borders moved).
  const idx = index ?? buildIndex(l, lines)
  const own = new Set<string>()
  for (const m of moved) {
    own.add(m)
    for (const d of l.descendants(m)) own.add(d)
    for (let p = l.parentOf(m); p; p = l.parentOf(p)) own.add(p)
  }
  const mineSet = new Set<Line>()
  for (const id of own) for (const q of idx.linesOf.get(id) ?? []) mineSet.add(q)
  const mine = [...mineSet].sort((a, b) => idx.lineIndex.get(a)! - idx.lineIndex.get(b)!)
  const ids = new Set<string>()
  for (const m of moved) { ids.add(m); for (const d of l.descendants(m)) ids.add(d) }
  for (const x of mine) { ids.add(x.a); ids.add(x.b) }
  return costOf(l, lines, mine, [...ids], moved, idx, roomy)
}

/** The siblings within reach of a box: those whose nearest neighbour it may be. */
export function siblingsNear(l: Layout, parent: string | undefined, b: { x: number; y: number; w: number; h: number }, out: Set<string>): void {
  const reach = 3 * l.meanSize
  for (const s of l.childrenOf(parent)) {
    const r = l.box(s)!
    if (r.x < b.x + b.w + reach && b.x < r.x + r.w + reach && r.y < b.y + b.h + reach && b.y < r.y + r.h + reach) out.add(s)
  }
}


/** Which of `items` may touch a box, by a coarse grid over their boxes. */
class Grid<T> {
  private cells = new Map<string, T[]>()
  constructor(private readonly size: number) {}
  private key(cx: number, cy: number): string { return `${cx},${cy}` }
  add(item: T, x0: number, y0: number, x1: number, y1: number): void {
    for (let cx = Math.floor(x0 / this.size); cx <= Math.floor(x1 / this.size); cx++) {
      for (let cy = Math.floor(y0 / this.size); cy <= Math.floor(y1 / this.size); cy++) {
        const k = this.key(cx, cy)
        const list = this.cells.get(k)
        if (list) list.push(item); else this.cells.set(k, [item])
      }
    }
  }
  remove(item: T, x0: number, y0: number, x1: number, y1: number): void {
    for (let cx = Math.floor(x0 / this.size); cx <= Math.floor(x1 / this.size); cx++) {
      for (let cy = Math.floor(y0 / this.size); cy <= Math.floor(y1 / this.size); cy++) {
        const list = this.cells.get(this.key(cx, cy))
        const i = list ? list.indexOf(item) : -1
        if (list && i >= 0) list.splice(i, 1)
      }
    }
  }
  near(x0: number, y0: number, x1: number, y1: number): Set<T> {
    const out = new Set<T>()
    for (let cx = Math.floor(x0 / this.size); cx <= Math.floor(x1 / this.size); cx++) {
      for (let cy = Math.floor(y0 / this.size); cy <= Math.floor(y1 / this.size); cy++) {
        for (const it of this.cells.get(this.key(cx, cy)) ?? []) out.add(it)
      }
    }
    return out
  }
}

function costOf(l: Layout, all: Line[], mine: Line[], ids: string[], moved: ReadonlySet<string> | undefined, index: CostIndex, given?: ReadonlySet<string>): CostParts {
  const parts: CostParts = { crossings: 0, overdraws: 0, slanted: 0, length: 0, imbalance: 0, spread: 0, misplaced: 0, againstFlow: 0, flat: 0, fans: 0, brushes: 0, offGrid: 0, offConvention: 0, uneven: 0, labels: 0, bends: 0, total: 0 }
  const brush = BRUSH * l.meanSize
  const mineSet = new Set(mine)
  // Every line's ends and box (cached while its ends stand), and a coarse
  // grid over the lines and the elements: the pairs a line can cross and
  // the elements it can run over are those in the cells its box covers.
  const { lineGrid, boxGrid, lineIndex } = index
  for (const p of mine) {
    const pi = lineIndex.get(p)!
    const pe = geomOf(index, p)
    for (const q of lineGrid.near(pe.x0, pe.y0, pe.x1, pe.y1)) {
      if (q === p || (mineSet.has(q) && lineIndex.get(q)! < pi)) continue
      if (p.a === q.a || p.a === q.b || p.b === q.a || p.b === q.b) continue
      const qe = geomOf(index, q)
      if (qe.x0 > pe.x1 || qe.x1 < pe.x0 || qe.y0 > pe.y1 || qe.y1 < pe.y0) continue
      if (pathsCross(pe.path, qe.path)) parts.crossings++
    }
  }
  // Over an element: through it, less a hair; brushing it: within BRUSH of it.
  const overBox = (line: Line, e: LineGeom, id: string, by: number): boolean => {
    if (id === line.a || id === line.b || l.holds(id, line.a) || l.holds(id, line.b) || l.holds(line.a, id) || l.holds(line.b, id)) return false
    const r = l.box(id)!
    if (r.x - by > e.x1 || r.x + r.w + by < e.x0 || r.y - by > e.y1 || r.y + r.h + by < e.y0) return false
    for (let i = 1; i < e.path.length; i++) if (segmentHitsRect(e.path[i - 1].x, e.path[i - 1].y, e.path[i].x, e.path[i].y, r.x - by, r.y - by, r.x + r.w + by, r.y + r.h + by)) return true
    return false
  }
  const overOrBrush = (line: Line, e: LineGeom, id: string): void => {
    if (!overBox(line, e, id, brush)) return
    if (overBox(line, e, id, -2)) parts.overdraws++; else parts.brushes++
  }
  // A label over an element it does not join, or over another line's label.
  const labelOver = (p: Line, lb: ReturnType<typeof labelBox>): void => {
    for (const id of boxGrid.near(lb.x0, lb.y0, lb.x1, lb.y1)) {
      if (id === p.a || id === p.b || l.holds(id, p.a) || l.holds(id, p.b)) continue
      const r = l.box(id)!
      if (r.x < lb.x1 && lb.x0 < r.x + r.w && r.y < lb.y1 && lb.y0 < r.y + r.h) parts.labels++
    }
    for (const q of lineGrid.near(lb.x0, lb.y0, lb.x1, lb.y1)) {
      if (q === p || !q.label || (mineSet.has(q) && lineIndex.get(q)! < lineIndex.get(p)!)) continue
      const o = labelBox(geomOf(index, q), q.label)
      if (o.x0 < lb.x1 && lb.x0 < o.x1 && o.y0 < lb.y1 && lb.y0 < o.y1) parts.labels++
    }
  }
  for (const p of mine) {
    const e = geomOf(index, p)
    for (const id of boxGrid.near(e.x0 - brush, e.y0 - brush, e.x1 + brush, e.y1 + brush)) overOrBrush(p, e, id)
    if (p.label) labelOver(p, labelBox(e, p.label))
    parts.bends += Math.max(0, e.path.length - 2)
    if (!isStraight(index, p)) parts.slanted += e.fan ? 0.5 : 1
    if (againstFlow(l, p)) parts.againstFlow++
    if (flat(l, p)) parts.flat++
    parts.length += Math.max(0, Math.hypot(e.ax - e.bx, e.ay - e.by) / l.meanSize - 1)
  }
  // Lines of others drawn over the moved elements.
  if (moved) {
    for (const m of moved) {
      for (const id of [m, ...l.descendants(m)]) {
        const r = l.box(id)!
        for (const q of lineGrid.near(r.x - brush, r.y - brush, r.x + r.w + brush, r.y + r.h + brush)) {
          if (mineSet.has(q)) continue
          const g = geomOf(index, q)
          overOrBrush(q, g, id)
          if (q.label && id !== q.a && id !== q.b && !l.holds(id, q.a) && !l.holds(id, q.b)) {
            const lb = labelBox(g, q.label)
            if (r.x < lb.x1 && lb.x0 < r.x + r.w && r.y < lb.y1 && lb.y0 < r.y + r.h) parts.labels++
          }
        }
      }
    }
  }
  for (const id of ids) {
    const at = index.linesOf.get(id) ?? []
    parts.imbalance += imbalance(l, id, at)
    parts.fans += fans(index, id, at)
  }
  // Room round the moved elements and the siblings near them (whose nearest may have been the moved one).
  const roomy = new Set<string>(ids)
  if (given) for (const id of given) roomy.add(id)
  else if (moved) for (const m of moved) siblingsNear(l, l.parentOf(m), l.box(m)!, roomy)
  for (const id of roomy) { parts.spread += spreadOf(l, id); if (!inGrid(l, id)) parts.offGrid++; parts.uneven += uneven(l, id) }
  for (const id of ids) { parts.misplaced += misplaced(l, id, index.linesOf.get(id) ?? []); parts.offConvention += offConvention(l, id, index.linesOf.get(id) ?? []) }
  parts.total = 0
  for (const k of Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]) parts.total += parts[k] * WEIGHTS[k]
  return parts
}

/** Whether two drawn lines cross anywhere along their paths. */
export function pathsCross(p: Pt[], q: Pt[]): boolean {
  for (let i = 1; i < p.length; i++) for (let j = 1; j < q.length; j++) {
    if (segmentsCross(p[i - 1].x, p[i - 1].y, p[i].x, p[i].y, q[j - 1].x, q[j - 1].y, q[j].x, q[j].y)) return true
  }
  return false
}

export function segmentsCross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): boolean {
  const side = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px))
  return side(ax, ay, bx, by, cx, cy) * side(ax, ay, bx, by, dx, dy) < 0
    && side(cx, cy, dx, dy, ax, ay) * side(cx, cy, dx, dy, bx, by) < 0
}

export function segmentHitsRect(ax: number, ay: number, bx: number, by: number, x0: number, y0: number, x1: number, y1: number): boolean {
  if (x1 <= x0 || y1 <= y0) return false
  if (Math.max(ax, bx) < x0 || Math.min(ax, bx) > x1 || Math.max(ay, by) < y0 || Math.min(ay, by) > y1) return false
  const inside = (x: number, y: number) => x > x0 && x < x1 && y > y0 && y < y1
  if (inside(ax, ay) || inside(bx, by)) return true
  const sides: [number, number, number, number][] = [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]]
  return sides.some(([cx, cy, dx, dy]) => segmentsCross(ax, ay, bx, by, cx, cy, dx, dy))
}
