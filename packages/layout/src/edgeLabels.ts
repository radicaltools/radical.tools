/**
 * Edge label placement.
 *
 * Each edge used to put its label at the middle of its own path, knowing
 * nothing about the other labels or the nodes, so labels of parallel or
 * crossing edges landed on each other and labels of short edges covered the
 * nodes they connect. placeEdgeLabels places every label of a canvas at
 * once: for each edge it tries a few spots along the path (and beside it)
 * and keeps the one that covers the fewest nodes, labels and other edges,
 * preferring the middle when it is free.
 *
 * Headless and deterministic: the canvas calls it once per layout state, and
 * metrics and tests call it on plain rects and polylines.
 */
import type { Pt, RoutingObstacle } from './edgeRouting'
import { transitionLabel } from '@radical/common/metamodel'
import type { C4Node, C4Relation } from '@radical/common/c4'

// ── Label size ────────────────────────────────────────────────────────

export interface LabelSize {
  w: number
  h: number
}

export interface LabelTextLine {
  text: string
  fontSize: number
  /** The rows it may take; longer text is cut with an ellipsis. */
  maxRows?: number
  /** Drawn in italics (a technology, a type's name in a label's stead). */
  italic?: boolean
  /** Kept on one row (cut with an ellipsis), its whole width counted. */
  nowrap?: boolean
}

/** The box a label is drawn in (border-box sizing). */
export interface LabelBoxStyle {
  maxWidth: number
  padX: number
  padY: number
  border: number
  lineHeight: number
}

/** The font the canvas draws labels in: the UI font (index.css), set on the
 *  label (RelationEdge) so that the two cannot drift apart. */
export const LABEL_FONT_FAMILY = "Inter, 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"

/** The CSS font of a label line, as the canvas draws it and measures it. */
export function labelFont(fontSize: number, italic = false): string {
  return `${italic ? 'italic ' : ''}${fontSize}px ${LABEL_FONT_FAMILY}`
}

/** The width of `text` in `font` (labelFont), in px. */
export type TextMeasure = (text: string, fontSize: number, italic: boolean) => number

/** Advance widths of the printable ASCII characters (space to tilde) in the
 *  UI font as Chromium draws it on macOS (the system font, whose spacing
 *  changes with its size), in thousandths of an em at 12 and 10 px, upright
 *  and italic: the measure where no canvas can measure (Node: the MCP
 *  server, tests). Other characters take OTHER_ADVANCE, wide ones (CJK and
 *  the like) an em. */
const ADVANCE: Record<10 | 12, { upright: number[]; italic: number[] }> = {
  12: {
    upright: [
      281, 311, 478, 630, 630, 925, 711, 297, 382, 382, 472, 630, 297, 472, 297, 305, 630, 464, 604, 627, 644, 618, 637, 569,
      639, 637, 297, 297, 630, 630, 630, 513, 918, 674, 657, 716, 727, 596, 572, 747, 742, 268, 538, 659, 568, 874, 742, 771,
      635, 771, 653, 637, 634, 737, 674, 968, 679, 655, 662, 382, 305, 382, 630, 583, 500, 552, 614, 560, 614, 571, 362, 609,
      588, 247, 247, 543, 253, 870, 583, 591, 610, 609, 381, 523, 363, 583, 542, 774, 524, 543, 539, 382, 259, 382, 630,
    ],
    italic: [
      282, 311, 437, 633, 648, 918, 711, 253, 382, 382, 459, 648, 297, 472, 297, 362, 630, 466, 604, 627, 644, 619, 637, 570,
      639, 638, 297, 297, 648, 648, 648, 513, 918, 674, 657, 714, 726, 595, 571, 745, 743, 269, 538, 659, 568, 875, 742, 771,
      637, 771, 653, 623, 630, 744, 674, 968, 678, 656, 662, 382, 362, 382, 459, 447, 500, 550, 615, 554, 618, 574, 362, 609,
      594, 252, 252, 530, 252, 870, 585, 592, 612, 611, 386, 514, 363, 583, 542, 774, 527, 543, 539, 382, 362, 382, 648,
    ],
  },
  10: {
    upright: [
      293, 323, 489, 642, 642, 937, 723, 309, 394, 394, 483, 642, 309, 483, 309, 316, 642, 476, 615, 639, 655, 630, 648, 581,
      650, 648, 309, 309, 642, 642, 642, 524, 930, 686, 669, 728, 738, 607, 584, 758, 754, 279, 550, 670, 580, 886, 754, 783,
      647, 783, 665, 649, 646, 749, 686, 979, 690, 667, 673, 394, 316, 394, 642, 595, 512, 563, 626, 571, 626, 583, 374, 621,
      600, 259, 258, 555, 265, 882, 595, 603, 622, 621, 393, 535, 375, 595, 554, 786, 536, 555, 551, 394, 271, 394, 642,
    ],
    italic: [
      294, 322, 449, 645, 660, 930, 723, 265, 394, 394, 471, 660, 309, 483, 309, 374, 642, 478, 616, 639, 655, 630, 649, 582,
      650, 649, 309, 309, 660, 660, 660, 524, 930, 686, 669, 726, 737, 607, 583, 756, 755, 280, 550, 670, 580, 887, 754, 783,
      648, 783, 665, 635, 642, 756, 686, 979, 690, 668, 673, 394, 374, 394, 471, 459, 512, 562, 626, 566, 629, 586, 374, 621,
      605, 264, 264, 542, 264, 882, 597, 604, 624, 623, 398, 525, 375, 595, 554, 786, 539, 555, 551, 394, 374, 394, 660,
    ],
  },
}
const OTHER_ADVANCE = 600

/** The width of `text` from the advance table of the nearest size, in px. */
export const tableMeasure: TextMeasure = (text, fontSize, italic) => {
  const sized = ADVANCE[fontSize < 11 ? 10 : 12]
  const table = italic ? sized.italic : sized.upright
  let w = 0
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    w += c >= 32 && c < 127 ? table[c - 32] : c >= 0x2e80 ? 1000 : OTHER_ADVANCE
  }
  return w * fontSize / 1000
}

interface Measuring { font: string; measureText(text: string): { width: number } }
type Offscreen = new (w: number, h: number) => { getContext(kind: '2d'): Measuring | null }

/** Widths measured by a canvas, by font and text. */
const measured = new Map<string, number>()
let canvas: Measuring | null | undefined

/** The width of `text` as the browser draws it, where one runs the code (the
 *  canvas, the Tidy worker): measured on an OffscreenCanvas in the label's
 *  font, so the size is the drawn one whatever font the platform falls back
 *  on. Elsewhere, the advance table. */
export const measureText: TextMeasure = (text, fontSize, italic) => {
  if (canvas === undefined) {
    const Canvas = (globalThis as { OffscreenCanvas?: Offscreen }).OffscreenCanvas
    try { canvas = Canvas ? new Canvas(1, 1).getContext('2d') : null } catch { canvas = null }
  }
  if (!canvas) return tableMeasure(text, fontSize, italic)
  const font = labelFont(fontSize, italic)
  const key = `${font}|${text}`
  let w = measured.get(key)
  if (w === undefined) {
    if (measured.size > 20_000) measured.clear()
    canvas.font = font
    w = canvas.measureText(text).width
    measured.set(key, w)
  }
  return w
}

/**
 * The size a label box takes, as the canvas draws it: each line is wrapped
 * word by word at the box's inner width (a word wider than that is broken,
 * as overflow-wrap: anywhere does), up to its rows. The box is as wide as
 * its widest line while every line fits on one row, and as wide as it may
 * be once one does not (a shrink-to-fit box with a max-width).
 */
export function estimateLabelSize(lines: LabelTextLine[], style: LabelBoxStyle, measure: TextMeasure = measureText): LabelSize {
  const inner = style.maxWidth - 2 * style.padX - 2 * style.border
  let width = 0
  let height = 0
  for (const line of lines) {
    const italic = !!line.italic
    const words = line.text.split(/\s+/).filter(Boolean)
    const whole = measure(words.join(' '), line.fontSize, italic)
    let rows = 0
    if (line.nowrap || whole <= inner) {
      width = Math.max(width, whole)
      rows = words.length > 0 ? 1 : 0
    } else {
      width = inner
      let row = ''
      for (const word of words) {
        const next = row ? `${row} ${word}` : word
        if (!row || measure(next, line.fontSize, italic) <= inner) {
          row = next
        } else {
          rows++
          row = word
        }
        // A word wider than the box takes rows of its own.
        const w = measure(word, line.fontSize, italic)
        if (row === word && w > inner) rows += Math.ceil(w / inner) - 1
      }
      if (row) rows++
    }
    if (line.maxRows) rows = Math.min(rows, line.maxRows)
    height += rows * line.fontSize * style.lineHeight
  }
  return {
    w: Math.min(inner, width) + 2 * style.padX + 2 * style.border,
    h: height + 2 * style.padY + 2 * style.border,
  }
}

/** The box the canvas draws a relation's label in (RelationEdge). */
export const RELATION_LABEL_BOX: LabelBoxStyle & { fontSize: number; techFontSize: number; nameRows: number } = {
  maxWidth: 160, padX: 6, padY: 2, border: 1, lineHeight: 1.3, fontSize: 12, techFontSize: 10, nameRows: 2,
}

/** What a relation shows in its label: its name (or type), then its technology. */
export interface RelationLabelText {
  label?: string
  relationType?: string
  /** How the type reads, shown in its stead (C4EdgeRFData.typeName). */
  typeName?: string
  technology?: string
}

/** The lines of a relation's label, the name on at most two rows and the
 *  technology on one (cut with an ellipsis, whole while the relation is
 *  active on the canvas); none when it has no label. A rolled-up line's
 *  label holds its relations' names joined with line breaks: each is a
 *  name of its own, as RelationEdge draws them. With the
 *  model's nodes, a transition without a label shows `event [guard] /
 *  actions ^raised` (its events by name), and nothing when it is a
 *  completion transition. */
export function relationLabelLines(r: RelationLabelText, nodes?: Record<string, C4Node>): LabelTextLine[] {
  const lines: LabelTextLine[] = []
  const name = r.label
    || (r.relationType === 'transition' ? (nodes ? transitionLabel(r as C4Relation, nodes) : '') : r.typeName ?? r.relationType)
  // A type's name stands in italics for a relation without a name.
  const italic = !r.label && r.relationType !== 'transition'
  if (name) for (const text of name.split('\n')) lines.push({ text, fontSize: RELATION_LABEL_BOX.fontSize, maxRows: RELATION_LABEL_BOX.nameRows, italic })
  if (r.technology) lines.push({ text: `[${r.technology}]`, fontSize: RELATION_LABEL_BOX.techFontSize, maxRows: 1, italic: true, nowrap: true })
  return lines
}

/** The size of a relation's label box, or null when it has no label. */
export function relationLabelSize(r: RelationLabelText, nodes?: Record<string, C4Node>, measure?: TextMeasure): LabelSize | null {
  const lines = relationLabelLines(r, nodes)
  return lines.length > 0 ? estimateLabelSize(lines, RELATION_LABEL_BOX, measure) : null
}

// ── Placement ─────────────────────────────────────────────────────────

export interface LabelEdge {
  id: string
  /** The drawn path as a polyline from source to target. */
  points: Pt[]
  /** The default centre (the middle of the path); kept whenever it is free. */
  anchor: Pt
  size: LabelSize
}

/** Spots along the path, as fractions of its length, nearest the middle
 *  first. The ends are left out: the arrowhead and the nodes are there. */
const FRACTIONS = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.2, 0.8, 0.14, 0.86]

/** Cost of a label covering its whole area with a node or another label. */
const W_NODE = 8
const W_LABEL = 8
/** Cost per sample of another edge under the label (it hides that piece). */
const W_LINE = 0.03
/** Distance to sample other edges at, in px. */
const LINE_STEP = 10
/** Cost of moving the label from the middle, per fraction of the path. */
const W_SHIFT = 1
/** Cost of putting the label beside the path rather than on it. */
const W_SIDE = 0.35
/** Gap between a label put beside the path and the path. */
const SIDE_GAP = 4
/** Gap kept between two labels. */
const LABEL_GAP = 3

interface Rect { x: number; y: number; w: number; h: number }

/** A rect a label should not cover. `weight` (default 1) scales the cost:
 *  covering a node's name is worse than covering the rest of it. */
export interface LabelObstacle extends RoutingObstacle {
  weight?: number
}

interface Candidate { x: number; y: number; penalty: number }

/** Buckets of a uniform grid, for the few things near a label. */
class Buckets<T> {
  private readonly cells = new Map<number, T[]>()
  constructor(private readonly size = 200) {}

  private key(cx: number, cy: number): number {
    return cx * 1_048_576 + cy
  }

  add(r: Rect, item: T): void {
    for (let cx = Math.floor(r.x / this.size); cx <= Math.floor((r.x + r.w) / this.size); cx++) {
      for (let cy = Math.floor(r.y / this.size); cy <= Math.floor((r.y + r.h) / this.size); cy++) {
        const list = this.cells.get(this.key(cx, cy))
        if (list) list.push(item)
        else this.cells.set(this.key(cx, cy), [item])
      }
    }
  }

  remove(r: Rect, item: T): void {
    for (let cx = Math.floor(r.x / this.size); cx <= Math.floor((r.x + r.w) / this.size); cx++) {
      for (let cy = Math.floor(r.y / this.size); cy <= Math.floor((r.y + r.h) / this.size); cy++) {
        const list = this.cells.get(this.key(cx, cy))
        const i = list ? list.indexOf(item) : -1
        if (i >= 0) list!.splice(i, 1)
      }
    }
  }

  /** Items in the cells the rect touches (an item may come more than once). */
  near(r: Rect, visit: (item: T) => void): void {
    for (let cx = Math.floor(r.x / this.size); cx <= Math.floor((r.x + r.w) / this.size); cx++) {
      for (let cy = Math.floor(r.y / this.size); cy <= Math.floor((r.y + r.h) / this.size); cy++) {
        for (const item of this.cells.get(this.key(cx, cy)) ?? []) visit(item)
      }
    }
  }
}

/**
 * Samples of every edge path on a uniform grid, kept flat (edge, x, y per
 * sample) since a large canvas has hundreds of thousands of them. A sample is
 * a point, so it sits in exactly one cell and is never visited twice.
 */
class LineSamples {
  private readonly cells = new Map<number, number[]>()
  constructor(private readonly size = 50) {}

  private key(cx: number, cy: number): number {
    return cx * 1_048_576 + cy
  }

  add(edge: number, x: number, y: number): void {
    const key = this.key(Math.floor(x / this.size), Math.floor(y / this.size))
    const list = this.cells.get(key)
    if (list) list.push(edge, x, y)
    else this.cells.set(key, [edge, x, y])
  }

  /** How many samples of edges other than `edge` lie inside `r`. */
  countInside(r: Rect, edge: number): number {
    let count = 0
    const x1 = r.x + r.w
    const y1 = r.y + r.h
    for (let cx = Math.floor(r.x / this.size); cx <= Math.floor(x1 / this.size); cx++) {
      for (let cy = Math.floor(r.y / this.size); cy <= Math.floor(y1 / this.size); cy++) {
        const list = this.cells.get(this.key(cx, cy))
        if (!list) continue
        for (let k = 0; k < list.length; k += 3) {
          if (list[k] === edge) continue
          const x = list[k + 1]
          const y = list[k + 2]
          if (x >= r.x && x <= x1 && y >= r.y && y <= y1) count++
        }
      }
    }
    return count
  }
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

function rectAt(c: Pt, size: LabelSize): Rect {
  return { x: c.x - size.w / 2, y: c.y - size.h / 2, w: size.w, h: size.h }
}

/** Cumulative arc lengths of a polyline (lengths[0] = 0). */
function arcLengths(points: Pt[]): number[] {
  const lengths = [0]
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  }
  return lengths
}

/** The point at `fraction` of the polyline's length and the unit direction there. */
function pointAt(points: Pt[], lengths: number[], fraction: number): { p: Pt; dir: Pt } {
  const total = lengths[lengths.length - 1]
  const at = total * fraction
  let i = 1
  while (i < points.length - 1 && lengths[i] < at) i++
  const a = points[i - 1]
  const b = points[i]
  const seg = lengths[i] - lengths[i - 1]
  const t = seg > 0 ? (at - lengths[i - 1]) / seg : 0
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, dir: { x: (b.x - a.x) / len, y: (b.y - a.y) / len } }
}

/** Candidate centres for one label, cheapest penalty first. */
function candidates(edge: LabelEdge, lengths: number[]): Candidate[] {
  const out: Candidate[] = []
  const usable = edge.points.length >= 2 && lengths[lengths.length - 1] > 0
  for (const f of FRACTIONS) {
    if (!usable && f !== 0.5) continue
    const shift = Math.abs(f - 0.5) * W_SHIFT
    const { p, dir } = usable ? pointAt(edge.points, lengths, f) : { p: edge.anchor, dir: { x: 1, y: 0 } }
    const centre = f === 0.5 ? edge.anchor : p
    out.push({ x: centre.x, y: centre.y, penalty: shift })
    if (!usable) continue
    // Beside the path: the normal, far enough for the box to clear the line.
    const n = { x: -dir.y, y: dir.x }
    const d = Math.abs(n.x) * edge.size.w / 2 + Math.abs(n.y) * edge.size.h / 2 + SIDE_GAP
    out.push({ x: centre.x + n.x * d, y: centre.y + n.y * d, penalty: shift + W_SIDE })
    out.push({ x: centre.x - n.x * d, y: centre.y - n.y * d, penalty: shift + W_SIDE })
  }
  return out.sort((a, b) => a.penalty - b.penalty)
}

/**
 * Label centres for `edges`, keyed by edge id. `obstacles` are the rects a
 * label should not cover: the nodes, including an edge's own ends (for a
 * compound node, only its header, where its name is), weighted by how bad
 * covering them is. Edges whose label fits at its anchor keep the anchor.
 */
export function placeEdgeLabels(edges: LabelEdge[], obstacles: LabelObstacle[]): Map<string, Pt> {
  // Obstacles and labels by index; a stamp per index marks the ones one
  // cost() call has counted already (a rect can lie in several cells).
  const nodes = new Buckets<number>()
  obstacles.forEach((o, k) => nodes.add(o, k))
  const nodeSeen = new Int32Array(obstacles.length)
  const labelSeen = new Int32Array(edges.length)
  let stamp = 0

  // Samples of every path, so a label knows which lines it would hide.
  // The same points pointAt gives at s / steps, walking each path once.
  const lines = new LineSamples()
  const lengths = edges.map((e) => arcLengths(e.points))
  edges.forEach((edge, i) => {
    const pts = edge.points
    const len = lengths[i]
    const total = len[len.length - 1]
    if (pts.length < 2 || total === 0) return
    const steps = Math.max(1, Math.ceil(total / LINE_STEP))
    let seg = 1
    for (let s = 0; s <= steps; s++) {
      const at = total * (s / steps)
      while (seg < pts.length - 1 && len[seg] < at) seg++
      const a = pts[seg - 1]
      const b = pts[seg]
      const segLen = len[seg] - len[seg - 1]
      const t = segLen > 0 ? (at - len[seg - 1]) / segLen : 0
      lines.add(i, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)
    }
  })

  const labels = new Buckets<{ edge: number; rect: Rect }>()
  const placed: Array<{ edge: number; rect: Rect } | undefined> = []
  const options = edges.map((e, i) => candidates(e, lengths[i]))

  const cost = (i: number, c: Candidate): number => {
    const rect = rectAt(c, edges[i].size)
    const area = rect.w * rect.h || 1
    let covered = 0
    const call = ++stamp
    nodes.near(rect, (k) => {
      if (nodeSeen[k] === call) return
      nodeSeen[k] = call
      const o = obstacles[k]
      covered += overlapArea(rect, o) * W_NODE * (o.weight ?? 1)
    })
    const padded = { x: rect.x - LABEL_GAP, y: rect.y - LABEL_GAP, w: rect.w + 2 * LABEL_GAP, h: rect.h + 2 * LABEL_GAP }
    labels.near(padded, (l) => {
      if (l.edge === i || labelSeen[l.edge] === call) return
      labelSeen[l.edge] = call
      covered += overlapArea(padded, l.rect) * W_LABEL
    })
    return covered / area + lines.countInside(rect, i) * W_LINE
  }

  const place = (i: number): void => {
    let best = options[i][0]
    let bestCost = Infinity
    for (const c of options[i]) {
      // Sorted by penalty: once a spot is free, no later one can beat it.
      if (c.penalty >= bestCost) break
      const total = c.penalty + cost(i, c)
      if (total < bestCost) {
        best = c
        bestCost = total
      }
    }
    const entry = { edge: i, rect: rectAt(best, edges[i].size) }
    placed[i] = entry
    labels.add(entry.rect, entry)
  }

  // Short edges have the fewest good spots: they choose first. A second
  // pass lets each label reconsider now that it knows all the others.
  const order = edges.map((_, i) => i).sort((a, b) =>
    lengths[a][lengths[a].length - 1] - lengths[b][lengths[b].length - 1] || (edges[a].id < edges[b].id ? -1 : 1))
  for (const i of order) place(i)
  for (const i of order) {
    labels.remove(placed[i]!.rect, placed[i]!)
    place(i)
  }

  const result = new Map<string, Pt>()
  edges.forEach((edge, i) => {
    const r = placed[i]!.rect
    result.set(edge.id, { x: r.x + r.w / 2, y: r.y + r.h / 2 })
  })
  return result
}

/** Pairs of labels that overlap, and label–obstacle overlaps, for metrics. */
export function labelOverlaps(
  edges: LabelEdge[],
  centres: Map<string, Pt>,
  obstacles: RoutingObstacle[],
): { labelLabel: number; labelNode: number } {
  const rects = edges.map((e) => rectAt(centres.get(e.id) ?? e.anchor, e.size))
  let labelLabel = 0
  let labelNode = 0
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) if (overlapArea(rects[i], rects[j]) > 0) labelLabel++
    for (const o of obstacles) if (overlapArea(rects[i], o) > 0) labelNode++
  }
  return { labelLabel, labelNode }
}
