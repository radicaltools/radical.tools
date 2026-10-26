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
import { type LayoutFlow, relationLayoutHint, relationTypeName } from '@radical/common/metamodel'
import type { Layout } from './layout'
import { distributePorts, pickSides } from '../portAllocator'
import { orthogonalConnector, type Pt } from '../edgeRouting'
import { relationLabelSize, tableMeasure, type LabelSize } from '../edgeLabels'
import { Position } from '../side'

export type Ends = { ax: number; ay: number; bx: number; by: number }
/** `mid`: the ends at the middle of the sides the ports are on, where a solitary port lies. A side several lines leave from spreads them (`fan`), so such a line is drawn slanted whatever the elements do; it is judged straight when it would be straight from the middle, as a fan is read: by where the elements stand, and its slant counts half. */
/** `path`: the points the line is drawn through, port to port: two for a curved or straight line, an L or a Z for an orthogonal one. */
export type LineGeom = Ends & { x0: number; y0: number; x1: number; y1: number; mid: Ends; fan: boolean; path: Pt[] }

export const W_CROSSING = 10
export const W_OVERDRAW = 8
export const W_SLANT = 4
/** Per mean element size of line beyond the comfortable distance (the gap and COMFORT): every
 *  line longer than two neighbours need costs, so a person's habit of drawing related elements
 *  in close is part of the judgement, not only of the moves that draw them in. */
export const W_LENGTH = 4
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
/** Per relation label drawn over an element (the ends of its own line too) or over another label. */
export const W_LABEL = 3
/** Per bend of an orthogonal line (an L has one, a Z two). */
export const W_BEND = 2
/** Per near sibling almost in a row or a column with an element (off by less than NEAR): a
 *  line a reader expects and finds broken looks worse than no line at all. */
export const W_NEAR = 2
export const NEAR = 0.4
/** Per element sharing no row and no column with any sibling of its type, when it has some:
 *  people, stores, services, frames of one kind read as a group when they stand in line. */
export const W_KIN = 1.5
/** Per mean element size the side of the box round a frame's children (and round the whole
 *  diagram) exceeds the side they would need packed: empty room. It keeps pulling a diagram
 *  together after nothing crosses any more. */
export const W_COMPACT = 3
/** Per line that runs shorter, border to border, than its label and arrowheads need (half for
 *  a hair short, a whole one when short by an arrowhead's room or more): a label squeezed between two elements, or an arrowhead hidden under one, reads as no
 *  line at all (the author, 2026-10-26: "strzałki się nie mieszczą"). */
export const W_CRAMPED = 8
/** Room at each end of a line beyond its label: the arrowhead and a hair of line. */
export const ARROW_ROOM = 18

/** The weights, by the name of the part they weigh: what bench/tidy-calibrate.mts fits. */
export const WEIGHTS = {
  crossings: W_CROSSING, overdraws: W_OVERDRAW, slanted: W_SLANT, length: W_LENGTH, imbalance: W_IMBALANCE, spread: W_SPREAD, misplaced: W_PLACE,
  againstFlow: W_AGAINST_FLOW, flat: W_FLAT, fans: W_FAN, brushes: W_BRUSH, offGrid: W_GRID, offConvention: W_CONVENTION, uneven: W_EVEN, labels: W_LABEL, bends: W_BEND,
  nearMisses: W_NEAR, kinApart: W_KIN, loose: W_COMPACT, cramped: W_CRAMPED,
}
/** What each part is called where a person reads the report (Why this layout?). */
export const PART_LABELS: Record<keyof typeof WEIGHTS, string> = {
  crossings: 'Crossings', overdraws: 'Lines over elements', slanted: 'Slanted lines', length: 'Line length', loose: 'Empty room',
  nearMisses: 'Almost in line', kinApart: 'Apart from their kind', offGrid: 'In no row or column', uneven: 'Uneven spacing',
  spread: 'Too far or too near', imbalance: 'Off-centre', misplaced: 'Out of place', againstFlow: 'Against the flow',
  flat: 'Across the reading way', fans: 'Bunched lines', brushes: 'Lines brushing elements', offConvention: 'Off convention',
  labels: 'Labels over things', bends: 'Bends', cramped: 'Lines too short for their labels',
}

/** The parts as a person reads them: each with its value before and after and its share of the
 *  cost before, the weightiest first; parts that are nothing either side left out. */
export function costRows(before: CostParts, after: CostParts): { key: keyof typeof WEIGHTS; label: string; before: number; after: number; weight: number }[] {
  return (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[])
    .filter((k) => before[k] > 0.005 || after[k] > 0.005)
    .map((k) => ({ key: k, label: PART_LABELS[k], before: before[k], after: after[k], weight: WEIGHTS[k] }))
    .sort((p, q) => Math.max(q.before, q.after) * q.weight - Math.max(p.before, p.after) * p.weight)
}

/** A part's value as the report shows it: a count whole, a length or a room to one decimal. */
export function formatPart(v: number): string {
  return Math.abs(v - Math.round(v)) < 0.005 ? String(Math.round(v)) : v.toFixed(1)
}

/** The part of a frame a label must not cover: its header, where its name is (edgeGeometry.ts). */
export const FRAME_HEADER = 60
/** Centres this close share a row or a column. */
export const STRAIGHT_TOLERANCE = 2

/** A drawn relation, with which way its type reads (layoutHints.ts) and the size of its label, if it has one. */
export interface Line { id: string; a: string; b: string; flow: LayoutFlow; axis: 'vertical' | 'horizontal' | 'free'; label?: LabelSize }

/** Where a line's label is drawn: a box at the middle of its path. */
export function labelBox(g: LineGeom, size: LabelSize): { x0: number; y0: number; x1: number; y1: number } {
  const { x: mx, y: my } = pathMiddle(g.path)
  return { x0: mx - size.w / 2, y0: my - size.h / 2, x1: mx + size.w / 2, y1: my + size.h / 2 }
}

/** The point halfway along a path, where the canvas puts a label first. */
function pathMiddle(path: Pt[]): Pt {
  let total = 0
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
  let rest = total / 2
  for (let i = 1; i < path.length; i++) {
    const seg = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
    if (rest <= seg && seg > 0) return { x: path[i - 1].x + (path[i].x - path[i - 1].x) * rest / seg, y: path[i - 1].y + (path[i].y - path[i - 1].y) * rest / seg }
    rest -= seg
  }
  return path[path.length - 1]
}

/** How long a line has to run between `dx`, `dy` apart ends for its label (as wide as it
 *  reaches along the line) and an arrowhead at each end to show. */
export function lineNeeds(label: LabelSize | undefined, dx: number, dy: number): number {
  const len = Math.hypot(dx, dy) || 1
  return (label ? Math.abs(dx / len) * label.w + Math.abs(dy / len) * label.h : 0) + 2 * ARROW_ROOM
}

/** The length of a drawn path. */
function pathLength(path: Pt[]): number {
  let total = 0
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
  return total
}

/** Whether a label's box lies over element `id` as the canvas's label
 *  placement sees it (placeEdgeLabels): over a leaf, its line's own ends
 *  too (a label wider than the gap between them covers both names), and
 *  over a frame's header; not over a frame that holds an end of the line,
 *  nor one the canvas does not draw. */
function labelCovers(l: Layout, line: Line, id: string, lb: ReturnType<typeof labelBox>): boolean {
  if (l.holds(id, line.a) || l.holds(id, line.b) || l.isTight(id)) return false
  const r = l.box(id)!
  const h = l.isFrame(id) ? Math.min(r.h, FRAME_HEADER) : r.h
  return r.x < lb.x1 && lb.x0 < r.x + r.w && r.y < lb.y1 && lb.y0 < r.y + h
}

/** The lines between drawn elements neither of which holds the other. */
export function linesOf(l: Layout, relations: Record<string, C4Relation>): Line[] {
  const out: Line[] = []
  for (const id of Object.keys(relations).sort()) {
    const r = relations[id]
    if (!l.box(r.sourceId) || !l.box(r.targetId) || r.sourceId === r.targetId) continue
    if (l.holds(r.sourceId, r.targetId) || l.holds(r.targetId, r.sourceId)) continue
    const hint = relationLayoutHint(r.relationType, l.metamodel)
    // The label as the canvas draws it (relationLabelLines): the name (or
    // the type, as it reads), the technology below. A relation with neither
    // name nor technology shows its type's name, which is not counted yet:
    // Tidy sets elements the sibling gap apart, narrower than most of those
    // names, and would give up its conventions to keep them clear.
    const name = r.label?.trim()
    const typeName = (): string | undefined => r.relationType && l.metamodel ? relationTypeName(l.metamodel, r.relationType, true, { from: l.nodes[r.sourceId].type, to: l.nodes[r.targetId].type }) : undefined
    // Measured by the font's advance table, not the canvas: the same view
    // gets the same layout on any machine and from the MCP server.
    const label = name || r.technology ? relationLabelSize({ ...r, label: name, typeName: typeName() }, l.nodes, tableMeasure) ?? undefined : undefined
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

/** The ports every line is drawn from, kept up to date as elements move.
 *  Studio picks each end's side by the other end (pickSides) and spreads
 *  the ports along a side several lines share (distributePorts); a move
 *  changes the ports of every line on the sides it touches, so those lines
 *  are judged with it. */
interface PortState {
  sides: Map<Line, { s: Position; t: Position }>
  /** `${node}|${side}` → the lines with a port on that side. */
  buckets: Map<string, Set<Line>>
  /** `S:${line id}` / `T:${line id}` → the port. */
  points: Map<string, { x: number; y: number }>
}
const viewOf = (l: Layout, id: string) => { const b = l.box(id)!; return { id, positionAbsolute: { x: b.x, y: b.y }, width: b.w, height: b.h } }
const bucketKey = (node: string, side: Position): string => `${node}|${side}`

function allot(l: Layout, ports: PortState, key: string): void {
  const [node, side] = key.split('|') as [string, Position]
  const lines = ports.buckets.get(key)
  if (!lines?.size) return
  const entries = [...lines].map((q) => {
    const other = q.a === node ? q.b : q.a
    const ob = l.box(other)!
    return { edgeId: `${q.a === node ? 'S' : 'T'}:${q.id}`, otherCenter: { x: ob.cx, y: ob.cy } }
  })
  for (const [k, pt] of distributePorts(viewOf(l, node), side, entries)) ports.points.set(k, pt)
}

function geomFor(l: Layout, ports: PortState, q: Line): LineGeom {
  const a = l.box(q.a)!, b = l.box(q.b)!
  const sides = ports.sides.get(q)
  const sp = ports.points.get(`S:${q.id}`), tp = ports.points.get(`T:${q.id}`)
  const ax = sp?.x ?? a.cx, ay = sp?.y ?? a.cy, bx = tp?.x ?? b.cx, by = tp?.y ?? b.cy
  const middle = (r: { x: number; y: number; w: number; h: number; cx: number; cy: number }, side: Position | undefined): { x: number; y: number } => {
    switch (side) {
      case Position.Left: return { x: r.x, y: r.cy }
      case Position.Right: return { x: r.x + r.w, y: r.cy }
      case Position.Top: return { x: r.cx, y: r.y }
      case Position.Bottom: return { x: r.cx, y: r.y + r.h }
      default: return { x: r.cx, y: r.cy }
    }
  }
  const ma = middle(a, sides?.s), mb = middle(b, sides?.t)
  const fan = !!sides && ((ports.buckets.get(bucketKey(q.a, sides.s))?.size ?? 1) > 1 || (ports.buckets.get(bucketKey(q.b, sides.t))?.size ?? 1) > 1)
  // An orthogonal line runs out of each side and turns between the ports; a curved one is judged on its chord.
  const path: Pt[] = l.edgeStyle === 'orthogonal' && sides ? orthogonalConnector({ x: ax, y: ay }, sides.s, { x: bx, y: by }, sides.t) : [{ x: ax, y: ay }, { x: bx, y: by }]
  const xs = path.map((pt) => pt.x), ys = path.map((pt) => pt.y)
  return { ax, ay, bx, by, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), mid: { ax: ma.x, ay: ma.y, bx: mb.x, by: mb.y }, fan, path }
}

/** The sides of one line, from where its ends stand; true when they changed (buckets updated). */
function placeSides(l: Layout, ports: PortState, q: Line): boolean {
  const { sSide, tSide } = pickSides(viewOf(l, q.a), viewOf(l, q.b))
  const was = ports.sides.get(q)
  if (was && was.s === sSide && was.t === tSide) return false
  if (was) { ports.buckets.get(bucketKey(q.a, was.s))?.delete(q); ports.buckets.get(bucketKey(q.b, was.t))?.delete(q) }
  ports.sides.set(q, { s: sSide, t: tSide })
  for (const k of [bucketKey(q.a, sSide), bucketKey(q.b, tSide)]) { const set = ports.buckets.get(k); if (set) set.add(q); else ports.buckets.set(k, new Set([q])) }
  return true
}

function portsOf(l: Layout, all: Line[]): { ports: PortState; geom: Map<Line, LineGeom> } {
  const ports: PortState = { sides: new Map(), buckets: new Map(), points: new Map() }
  for (const q of all) placeSides(l, ports, q)
  for (const key of ports.buckets.keys()) allot(l, ports, key)
  const geom = new Map<Line, LineGeom>()
  for (const q of all) geom.set(q, geomFor(l, ports, q))
  return { ports, geom }
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
  nearMisses: number; kinApart: number; loose: number; cramped: number
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
    for (const o of l.peersIn(l.parentOf(id))) {
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

/** How far two siblings are from standing in one column (`x`) or one row
 *  (`y`): by their middles, and for a frame also by its top or left edge
 *  (frames of different sizes are lined up by the edge their name is on). */
export function offLine(l: Layout, a: string, b: string, axis: 'x' | 'y'): number {
  const p = l.box(a)!, q = l.box(b)!
  const mid = axis === 'x' ? Math.abs(p.cx - q.cx) : Math.abs(p.cy - q.cy)
  if (!l.isFrame(a) && !l.isFrame(b)) return mid
  return Math.min(mid, axis === 'x' ? Math.abs(p.x - q.x) : Math.abs(p.y - q.y))
}

/** Whether `id` shares a row or a column with some sibling. */
export function inGrid(l: Layout, id: string): boolean {
  const siblings = l.peersIn(l.parentOf(id))
  if (siblings.length < 2) return true
  for (const o of siblings) {
    if (o === id) continue
    if (offLine(l, id, o, 'x') < STRAIGHT_TOLERANCE || offLine(l, id, o, 'y') < STRAIGHT_TOLERANCE) return true
  }
  return false
}

/** The siblings near `id` almost in a row or a column with it, by axis:
 *  off by more than the tolerance and less than NEAR mean sizes, and no
 *  more than two mean sizes apart across. */
export function nearMissesOf(l: Layout, id: string): { o: string; axis: 'x' | 'y' }[] {
  const b = l.box(id)!
  const out: { o: string; axis: 'x' | 'y' }[] = []
  const near = NEAR * l.meanSize, reach = 2 * l.meanSize
  for (const o of l.peersIn(l.parentOf(id))) {
    if (o === id) continue
    const r = l.box(o)!
    const gx = Math.max(0, r.x - (b.x + b.w), b.x - (r.x + r.w)), gy = Math.max(0, r.y - (b.y + b.h), b.y - (r.y + r.h))
    if (gx > reach || gy > reach) continue
    for (const axis of ['x', 'y'] as const) {
      const d = offLine(l, id, o, axis)
      if (d >= STRAIGHT_TOLERANCE && d < near) out.push({ o, axis })
    }
  }
  return out
}

/** The empty room among a frame's children (none: the diagram's top level),
 *  in mean element sizes: how much the side of the box round them exceeds
 *  the side of a square of their area, gaps included. */
export function looseness(l: Layout, parent: string | undefined): number {
  const kids = l.childrenOf(parent)
  if (kids.length < 2) return 0
  const gap = l.gapOf(parent)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, area = 0
  for (const k of kids) {
    const b = l.box(k)!
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h)
    area += (b.w + gap) * (b.h + gap)
  }
  return Math.max(0, Math.sqrt((x1 - x0 + gap) * (y1 - y0 + gap)) - Math.sqrt(area)) / l.meanSize
}

/** The siblings of `id`'s type, when it stands in line with none of them (none: it does, or it has no kin).
 *  `linked`: whether an element has lines; one without is gathered to the margin, neither kin nor judged as one. */
export function kinApartOf(l: Layout, id: string, linked: (id: string) => boolean): string[] {
  if (!linked(id)) return []
  const type = l.nodes[id].type
  const kin = l.peersIn(l.parentOf(id)).filter((o) => o !== id && l.nodes[o].type === type && linked(o))
  if (!kin.length) return []
  for (const o of kin) if (offLine(l, id, o, 'x') < STRAIGHT_TOLERANCE || offLine(l, id, o, 'y') < STRAIGHT_TOLERANCE) return []
  return kin
}

/** How far `id` stands from its nearest sibling, edge to edge beyond the gap, in mean sizes (capped). */
function spreadOf(l: Layout, id: string): number {
  const b = l.box(id)!
  const parent = l.parentOf(id)
  const gap = l.gapOf(parent)
  let nearest = Infinity
  for (const o of l.peersIn(parent)) {
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
  /** The labelled lines by their label's box, which reaches past the line's own (a short line, a long name). */
  labelGrid: Grid<Line>
  boxGrid: Grid<string>
  lineIndex: Map<Line, number>
  /** Where each line is drawn, between its ports. */
  geom: Map<Line, LineGeom>
  ports: PortState
  /** Where each line and box was put in its grid, to take it out when it moves. */
  lineAt: Map<Line, Extent>
  labelAt: Map<Line, Extent>
  boxAt: Map<string, Extent>
  linesOf: Map<string, Line[]>
}

export function geomOf(index: CostIndex, line: Line): LineGeom { return index.geom.get(line)! }

export function buildIndex(l: Layout, all: Line[]): CostIndex {
  const cell = Math.max(100, l.meanSize * 2)
  const lineGrid = new Grid<Line>(cell)
  const lineIndex = new Map<Line, number>()
  const lineAt = new Map<Line, Extent>()
  const labelGrid = new Grid<Line>(cell)
  const labelAt = new Map<Line, Extent>()
  const linesOf = new Map<string, Line[]>()
  const { ports, geom } = portsOf(l, all)
  all.forEach((q, i) => {
    lineIndex.set(q, i)
    const g = geom.get(q)!
    const e: Extent = [g.x0, g.y0, g.x1, g.y1]
    lineGrid.add(q, ...e); lineAt.set(q, e)
    if (q.label) { const lb = labelExtent(g, q.label); labelGrid.add(q, ...lb); labelAt.set(q, lb) }
    for (const end of [q.a, q.b]) { const list = linesOf.get(end); if (list) list.push(q); else linesOf.set(end, [q]) }
  })
  const boxGrid = new Grid<string>(cell)
  const boxAt = new Map<string, Extent>()
  for (const id of l.ids()) { const r = l.box(id)!; const e: Extent = [r.x, r.y, r.x + r.w, r.y + r.h]; boxGrid.add(id, ...e); boxAt.set(id, e) }
  return { all, lineGrid, labelGrid, boxGrid, lineIndex, geom, ports, lineAt, labelAt, boxAt, linesOf }
}

function labelExtent(g: LineGeom, label: LabelSize): Extent {
  const b = labelBox(g, label)
  return [b.x0, b.y0, b.x1, b.y1]
}

/** The index brought up to date for `ids` after they moved (or moved
 *  back): their boxes in the grid, the sides and ports of their lines and
 *  of every line sharing a side with those (a shared side spreads its
 *  ports), and the grid of every line whose drawing changed. Returns the
 *  lines drawn differently now: a move is judged with them. */
export function updateIndex(l: Layout, index: CostIndex, ids: Iterable<string>): Set<Line> {
  const changedLines = new Set<Line>()
  const affected = new Set<Line>()
  for (const id of ids) {
    const r = l.box(id)!
    const e: Extent = [r.x, r.y, r.x + r.w, r.y + r.h]
    const was = index.boxAt.get(id)!
    if (was[0] === e[0] && was[1] === e[1] && was[2] === e[2] && was[3] === e[3]) continue
    index.boxGrid.remove(id, ...was); index.boxGrid.add(id, ...e); index.boxAt.set(id, e)
    for (const q of index.linesOf.get(id) ?? []) affected.add(q)
  }
  if (!affected.size) return changedLines
  const { ports } = index
  const dirty = new Set<string>()
  for (const q of affected) {
    const was = ports.sides.get(q)
    if (was) { dirty.add(bucketKey(q.a, was.s)); dirty.add(bucketKey(q.b, was.t)) }
    placeSides(l, ports, q)
    const now = ports.sides.get(q)!
    dirty.add(bucketKey(q.a, now.s)); dirty.add(bucketKey(q.b, now.t))
  }
  const redraw = new Set<Line>(affected)
  for (const key of dirty) { allot(l, ports, key); for (const q of ports.buckets.get(key) ?? []) redraw.add(q) }
  for (const q of redraw) {
    const g = geomFor(l, ports, q)
    const was = index.geom.get(q)!
    if (was.ax === g.ax && was.ay === g.ay && was.bx === g.bx && was.by === g.by && was.path.length === g.path.length && was.fan === g.fan) continue
    index.geom.set(q, g)
    changedLines.add(q)
    if (q.label) {
      const lb = labelExtent(g, q.label)
      index.labelGrid.remove(q, ...index.labelAt.get(q)!); index.labelGrid.add(q, ...lb); index.labelAt.set(q, lb)
    }
    const e: Extent = [g.x0, g.y0, g.x1, g.y1]
    const at = index.lineAt.get(q)!
    if (at[0] === e[0] && at[1] === e[1] && at[2] === e[2] && at[3] === e[3]) continue
    index.lineGrid.remove(q, ...at); index.lineGrid.add(q, ...e); index.lineAt.set(q, e)
  }
  return changedLines
}

/** The cost of the whole layout. */
export function totalCost(l: Layout, lines: Line[]): CostParts {
  return costOf(l, lines, lines, l.ids(), undefined, buildIndex(l, lines))
}

/** The cost of the lines of `moved` elements and of what lies over or under them. */
export function localCost(l: Layout, lines: Line[], moved: ReadonlySet<string>, index?: CostIndex, roomy?: ReadonlySet<string>, extra?: ReadonlySet<Line>, boxes?: ReadonlySet<string>): number {
  return localCostParts(l, lines, moved, index, roomy, extra, boxes).total
}
/** `roomy`: the elements whose room is judged (the moved ones and the
 *  siblings near where they were and where they are); judged before and
 *  after a move it must be the same set, so the caller may give it. */
/** `extra`: lines drawn differently by the move though their ends did not move (their ports shifted): judged with it. */
/** `boxes`: every box the move changed besides the moved elements' own (satellites, refitted frames): what others' lines and labels now lie over. */
export function localCostParts(l: Layout, lines: Line[], moved: ReadonlySet<string>, index?: CostIndex, roomy?: ReadonlySet<string>, extra?: ReadonlySet<Line>, boxes?: ReadonlySet<string>): CostParts {
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
  if (extra) for (const q of extra) mineSet.add(q)
  const mine = [...mineSet].sort((a, b) => idx.lineIndex.get(a)! - idx.lineIndex.get(b)!)
  const ids = new Set<string>()
  for (const m of moved) { ids.add(m); for (const d of l.descendants(m)) ids.add(d) }
  for (const x of mine) { ids.add(x.a); ids.add(x.b) }
  return costOf(l, lines, mine, [...ids], moved, idx, roomy, boxes)
}

/** The siblings within reach of a box: those whose nearest neighbour it may be. */
export function siblingsNear(l: Layout, parent: string | undefined, b: { x: number; y: number; w: number; h: number }, out: Set<string>): void {
  const reach = 3 * l.meanSize
  for (const s of l.peersIn(parent)) {
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

function costOf(l: Layout, all: Line[], mine: Line[], ids: string[], moved: ReadonlySet<string> | undefined, index: CostIndex, given?: ReadonlySet<string>, boxes?: ReadonlySet<string>): CostParts {
  const parts: CostParts = { crossings: 0, overdraws: 0, slanted: 0, length: 0, imbalance: 0, spread: 0, misplaced: 0, againstFlow: 0, flat: 0, fans: 0, brushes: 0, offGrid: 0, offConvention: 0, uneven: 0, labels: 0, bends: 0, nearMisses: 0, kinApart: 0, loose: 0, cramped: 0, total: 0 }
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
  // A label over an element (its line's own ends too), or over another line's label.
  const labelOver = (p: Line, lb: ReturnType<typeof labelBox>): void => {
    for (const id of boxGrid.near(lb.x0, lb.y0, lb.x1, lb.y1)) if (labelCovers(l, p, id, lb)) parts.labels++
    for (const q of index.labelGrid.near(lb.x0, lb.y0, lb.x1, lb.y1)) {
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
    // A line needs room for its label and arrowheads; past that, and past
    // the comfortable distance, every bit of it costs.
    const needs = lineNeeds(p.label, e.bx - e.ax, e.by - e.ay)
    const short = needs - pathLength(e.path)
    if (short > 1) parts.cramped += 0.5 + 0.5 * Math.min(1, short / ARROW_ROOM)
    parts.length += Math.max(0, Math.hypot(e.ax - e.bx, e.ay - e.by) - Math.max(needs, l.gapOf(l.parentOf(p.a)) + COMFORT * l.meanSize)) / l.meanSize
  }
  // Lines of others, and their labels, drawn over the moved elements and
  // over every other box the move changed (satellites slid along, frames
  // refitted round them).
  if (moved) {
    const over = new Set<string>()
    for (const m of moved) { over.add(m); for (const d of l.descendants(m)) over.add(d) }
    if (boxes) for (const id of boxes) over.add(id)
    for (const id of over) {
      const r = l.box(id)!
      for (const q of lineGrid.near(r.x - brush, r.y - brush, r.x + r.w + brush, r.y + r.h + brush)) {
        if (!mineSet.has(q)) overOrBrush(q, geomOf(index, q), id)
      }
      for (const q of index.labelGrid.near(r.x, r.y, r.x + r.w, r.y + r.h)) {
        if (!mineSet.has(q) && labelCovers(l, q, id, labelBox(geomOf(index, q), q.label!))) parts.labels++
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
  for (const id of roomy) {
    // A tight frame is not seen: what it holds is judged among its peers.
    if (l.isTight(id)) continue
    parts.spread += spreadOf(l, id); if (!inGrid(l, id)) parts.offGrid++; parts.uneven += uneven(l, id)
    parts.nearMisses += nearMissesOf(l, id).length
    if (kinApartOf(l, id, (o) => !!index.linesOf.get(o)?.length).length) parts.kinApart++
  }
  for (const id of ids) { parts.misplaced += misplaced(l, id, index.linesOf.get(id) ?? []); parts.offConvention += offConvention(l, id, index.linesOf.get(id) ?? []) }
  // Empty room in every frame a move changes (and the top level); in all of them for the whole layout.
  const frames = new Set<string | undefined>()
  if (moved) for (const m of moved) { for (let p = l.parentOf(m); p; p = l.parentOf(p)) frames.add(p); frames.add(undefined) }
  else { frames.add(undefined); for (const id of ids) if (l.isFrame(id)) frames.add(id) }
  for (const f of frames) parts.loose += looseness(l, f)
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
