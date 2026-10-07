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

// ── Label size ────────────────────────────────────────────────────────

export interface LabelSize {
  w: number
  h: number
}

export interface LabelTextLine {
  text: string
  fontSize: number
}

/** The box a label is drawn in (border-box sizing). */
export interface LabelBoxStyle {
  maxWidth: number
  padX: number
  padY: number
  border: number
  lineHeight: number
}

/** Mean glyph width of the UI font, in em. Slightly generous: a label that
 *  is a little smaller than estimated only gets a little more room. */
const CHAR_EM = 0.56

/**
 * The size a label box takes, estimated from its text: each line is wrapped
 * word by word at the box's inner width. Rendering is not needed, so the
 * same estimate works on the canvas, in workers and in tests.
 */
export function estimateLabelSize(lines: LabelTextLine[], style: LabelBoxStyle): LabelSize {
  const inner = style.maxWidth - 2 * style.padX - 2 * style.border
  let width = 0
  let height = 0
  for (const line of lines) {
    const charW = line.fontSize * CHAR_EM
    let rows = 0
    let row = 0
    for (const word of line.text.split(/\s+/).filter(Boolean)) {
      const w = word.length * charW
      const next = row === 0 ? w : row + charW + w
      if (row > 0 && next > inner) {
        width = Math.max(width, row)
        rows++
        row = w
      } else {
        row = next
      }
    }
    if (row > 0) {
      width = Math.max(width, row)
      rows++
    }
    height += rows * line.fontSize * style.lineHeight
  }
  return {
    w: Math.min(inner, width) + 2 * style.padX + 2 * style.border,
    h: height + 2 * style.padY + 2 * style.border,
  }
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
  const nodes = new Buckets<LabelObstacle>()
  for (const o of obstacles) nodes.add(o, o)

  // Samples of every path, so a label knows which lines it would hide.
  const lines = new Buckets<{ edge: number; p: Pt }>(100)
  const lengths = edges.map((e) => arcLengths(e.points))
  edges.forEach((edge, i) => {
    const total = lengths[i][lengths[i].length - 1]
    if (edge.points.length < 2 || total === 0) return
    const steps = Math.max(1, Math.ceil(total / LINE_STEP))
    for (let s = 0; s <= steps; s++) {
      const { p } = pointAt(edge.points, lengths[i], s / steps)
      lines.add({ x: p.x, y: p.y, w: 0, h: 0 }, { edge: i, p })
    }
  })

  const labels = new Buckets<{ edge: number; rect: Rect }>()
  const placed: Array<{ edge: number; rect: Rect } | undefined> = []
  const options = edges.map((e, i) => candidates(e, lengths[i]))

  const cost = (i: number, c: Candidate): number => {
    const rect = rectAt(c, edges[i].size)
    const area = rect.w * rect.h || 1
    let covered = 0
    const seenNodes = new Set<LabelObstacle>()
    nodes.near(rect, (o) => {
      if (seenNodes.has(o)) return
      seenNodes.add(o)
      covered += overlapArea(rect, o) * W_NODE * (o.weight ?? 1)
    })
    const padded = { x: rect.x - LABEL_GAP, y: rect.y - LABEL_GAP, w: rect.w + 2 * LABEL_GAP, h: rect.h + 2 * LABEL_GAP }
    const seenLabels = new Set<object>()
    labels.near(padded, (l) => {
      if (l.edge === i || seenLabels.has(l)) return
      seenLabels.add(l)
      covered += overlapArea(padded, l.rect) * W_LABEL
    })
    let hidden = 0
    const seenPoints = new Set<object>()
    lines.near(rect, (s) => {
      if (s.edge === i || seenPoints.has(s)) return
      seenPoints.add(s)
      if (s.p.x >= rect.x && s.p.x <= rect.x + rect.w && s.p.y >= rect.y && s.p.y <= rect.y + rect.h) hidden++
    })
    return covered / area + hidden * W_LINE
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
