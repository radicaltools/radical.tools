/**
 * The layout the tidier works on: every drawn element's box in canvas
 * coordinates, moved with what it holds, its frames fitted round their
 * children after each move the way the canvas fits them. Moves are
 * tried and taken back, so a move is a snapshot of the boxes it changes.
 */
import { COLLAPSED_HEIGHT, COLLAPSED_WIDTH, type C4Node, type EdgeStyle, nodeTypeSize, type PositionMap } from '@radical/common/c4'
import { type LayoutRole, type Metamodel, layoutRoleOf } from '@radical/common/metamodel'
import { compoundPadding, effectiveHeight, effectiveWidth } from '../geometry'
import { CHILD_GAP, ROOT_GAP } from '../layoutFinalize'

/** The least room between two related elements Tidy places side by side: a line
 *  between them shows an arrowhead at each end and a one-line label
 *  (24 + 22 + 24 px). The canvas's own gaps (20 px in a frame) left a label
 *  over both elements and no arrowhead (the author, 2026-10-26). */
export const LINE_GAP = 70

export interface Box { x: number; y: number; w: number; h: number; cx: number; cy: number }

/** Boxes stand on a grid this fine (a power of two): sums and differences of
 *  coordinates are then exact, so the same diagram moved elsewhere on the
 *  canvas (Smart Layout hands it over from the top left) is judged exactly
 *  as it was, and a second run finds what the first left, not rounding. */
const QUANTUM = 1 / 1024
const snap = (v: number): number => Math.round(v / QUANTUM) * QUANTUM
const snapped = (b: Box): Box => {
  const x = snap(b.x), y = snap(b.y), w = snap(b.w), h = snap(b.h)
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 }
}

export class Layout {
  private boxes = new Map<string, Box>()
  private children = new Map<string, string[]>()
  private roots: string[] = []
  private allIds: string[] = []
  private ancestorSets = new Map<string, Set<string>>()
  private descendantLists = new Map<string, string[]>()
  private roles = new Map<string, LayoutRole>()
  /** Pinned elements and what they hold: no move touches them. */
  private fixedIds = new Set<string>()
  /** Frames holding a pinned element: fitted round it, never moved (that would carry it along). */
  private holdsFixed = new Set<string>()
  /** While a move is tried: the box each changed element had before it (boxes are replaced, never changed in place). */
  private journal: Map<string, Box> | null = null
  readonly meanSize: number

  /** How the view draws its lines: an orthogonal line is judged along its route (cost.ts). */
  edgeStyle: EdgeStyle = 'curved'

  /** Containers the canvas draws only to hold what a view shows: tight round it, no padding, no header, no size of their own. */
  private tight = new Set<string>()

  constructor(readonly nodes: Record<string, C4Node>, readonly metamodel?: Metamodel | null, pinned: Iterable<string> = [], frames: Iterable<string> = []) {
    for (const id of frames) this.tight.add(id)
    const abs = new Map<string, { x: number; y: number }>()
    const of = (id: string): { x: number; y: number } => {
      const got = abs.get(id)
      if (got) return got
      const n = nodes[id]
      const p = n.parentId && nodes[n.parentId] ? of(n.parentId) : { x: 0, y: 0 }
      const at = { x: snap(p.x + n.x), y: snap(p.y + n.y) }
      abs.set(id, at)
      return at
    }
    let size = 0, leaves = 0
    for (const id of Object.keys(nodes).sort()) {
      const n = nodes[id]
      if (n.parentId && nodes[n.parentId]) this.children.set(n.parentId, [...(this.children.get(n.parentId) ?? []), id])
      const { x, y } = of(id)
      const w = snap(effectiveWidth(n)), h = snap(effectiveHeight(n))
      this.boxes.set(id, { x, y, w, h, cx: x + w / 2, cy: y + h / 2 })
    }
    for (const id of this.boxes.keys()) if (!this.children.has(id)) { const b = this.boxes.get(id)!; size += (b.w + b.h) / 2; leaves++ }
    this.meanSize = leaves ? size / leaves : 100
    // The hierarchy never changes: roots, ids and ancestors once.
    this.allIds = [...this.boxes.keys()]
    this.roots = this.allIds.filter((x) => !this.parentOf(x))
    for (const id of this.allIds) {
      const set = new Set<string>()
      for (let p = this.parentOf(id); p; p = this.parentOf(p)) set.add(p)
      this.ancestorSets.set(id, set)
    }
    for (const id of this.allIds) this.roles.set(id, layoutRoleOf(nodes[id] as C4Node & Record<string, unknown>, metamodel))
    for (const id of pinned) if (this.boxes.has(id)) {
      this.fixedIds.add(id)
      for (const d of this.descendants(id)) this.fixedIds.add(d)
      for (const a of this.ancestorSets.get(id)!) this.holdsFixed.add(a)
    }
    this.fitAll()
  }

  /** Whether no move may take the element: it is pinned, held by one, or holds one. */
  fixed(id: string): boolean { return this.fixedIds.has(id) || this.holdsFixed.has(id) }

  /** What the element is to the layout, from the metamodel (layoutHints.ts). */
  role(id: string): LayoutRole { return this.roles.get(id) ?? 'element' }

  ids(): string[] { return this.allIds }
  box(id: string): Box | undefined { return this.boxes.get(id) }
  isFrame(id: string): boolean { return this.children.has(id) }
  childrenOf(id: string | undefined): string[] {
    if (id) return this.children.get(id) ?? []
    return this.roots
  }
  parentOf(id: string): string | undefined {
    const p = this.nodes[id]?.parentId
    return p && this.boxes.has(p) ? p : undefined
  }
  /** Whether `ancestor` holds `id` at any depth. */
  holds(ancestor: string, id: string): boolean {
    return this.ancestorSets.get(id)?.has(ancestor) ?? false
  }
  descendants(id: string): string[] {
    const hit = this.descendantLists.get(id)
    if (hit) return hit
    const out: string[] = []
    for (const c of this.childrenOf(id)) { out.push(c); out.push(...this.descendants(c)) }
    this.descendantLists.set(id, out)
    return out
  }
  /** The gap between siblings; in a tight frame, the gap of the level it stands on (its children read as that level's). */
  gapOf(parent: string | undefined): number {
    while (parent && this.tight.has(parent)) parent = this.parentOf(parent)
    return parent ? CHILD_GAP : ROOT_GAP
  }
  /** The room an element is given beside one it has a line to: the line's arrowheads and a label. */
  lineGapOf(parent: string | undefined): number {
    return Math.max(LINE_GAP, this.gapOf(parent))
  }
  /** Whether the canvas draws this container only to hold what the view shows (no frame of its own). */
  isTight(id: string): boolean { return this.tight.has(id) }
  private peerLists = new Map<string, string[]>()
  /** What a reader sees side by side at `parent`'s level: its children, with
   *  a tight frame's in its place (it draws no frame of its own); the
   *  children alone when there is no tight frame. */
  peersIn(parent: string | undefined): string[] {
    while (parent && this.tight.has(parent)) parent = this.parentOf(parent)
    if (!this.tight.size) return this.childrenOf(parent)
    const key = parent ?? ''
    const hit = this.peerLists.get(key)
    if (hit) return hit
    const out: string[] = []
    const add = (ids: string[]): void => { for (const c of ids) if (this.tight.has(c)) add(this.childrenOf(c)); else out.push(c) }
    add(this.childrenOf(parent))
    this.peerLists.set(key, out)
    return out
  }

  /** Every box, to take a move back. */
  snapshot(ids: Iterable<string>): Map<string, Box> {
    const out = new Map<string, Box>()
    for (const id of ids) out.set(id, { ...this.boxes.get(id)! })
    return out
  }
  restore(snap: Map<string, Box>): void {
    for (const [id, b] of snap) this.set(id, { ...b })
  }
  private set(id: string, b: Box): void {
    if (this.journal && !this.journal.has(id)) this.journal.set(id, this.boxes.get(id)!)
    this.boxes.set(id, snapped(b))
  }

  /** Changes from here on are noted, so a tried move can be taken back by what it changed alone. */
  begin(): void { this.journal = new Map() }
  /** What changed since `begin`. */
  changed(): string[] { return [...(this.journal?.keys() ?? [])] }
  /** The boxes the changed elements had at `begin`. */
  journalBoxes(): Map<string, Box> { return new Map(this.journal ?? []) }
  /** Every change since `begin` undone. */
  rollback(): void {
    const j = this.journal
    this.journal = null
    if (j) for (const [id, b] of j) this.boxes.set(id, b)
  }

  /** `id` and what it holds moved by (dx, dy); its frames refitted. */
  moveBy(id: string, dx: number, dy: number): void {
    dx = snap(dx); dy = snap(dy)
    for (const x of [id, ...this.descendants(id)]) {
      const b = this.boxes.get(x)!
      this.set(x, { ...b, x: b.x + dx, y: b.y + dy, cx: b.cx + dx, cy: b.cy + dy })
    }
    for (let p = this.parentOf(id); p; p = this.parentOf(p)) this.fit(p)
  }
  moveTo(id: string, x: number, y: number): void {
    const b = this.boxes.get(id)!
    this.moveBy(id, x - b.x, y - b.y)
  }

  /** A frame round its children, with its type's padding; never smaller
   *  than it shows collapsed (as the canvas fits it: not the size it has,
   *  which a wide layout left it with). */
  fit(id: string): void {
    const kids = this.childrenOf(id)
    if (!kids.length) return
    const type = this.nodes[id].type
    const tight = this.tight.has(id)
    const pad = tight ? { side: 0, top: 0, bottom: 0 } : compoundPadding(type)
    const def = this.metamodel?.nodeTypes[type]
    const size = nodeTypeSize(type, this.metamodel)
    const min = tight ? { width: 0, height: 0 } : { width: def?.collapsedWidth ?? COLLAPSED_WIDTH[type] ?? size.width, height: def?.collapsedHeight ?? COLLAPSED_HEIGHT[type] ?? size.height }
    const x0 = Math.min(...kids.map((k) => this.boxes.get(k)!.x)) - pad.side
    const y0 = Math.min(...kids.map((k) => this.boxes.get(k)!.y)) - pad.top
    const x1 = Math.max(...kids.map((k) => this.boxes.get(k)!.x + this.boxes.get(k)!.w)) + pad.side
    const y1 = Math.max(...kids.map((k) => this.boxes.get(k)!.y + this.boxes.get(k)!.h)) + pad.bottom
    const w = Math.max(x1 - x0, min.width), h = Math.max(y1 - y0, min.height)
    const was = this.boxes.get(id)!
    if (was.x === x0 && was.y === y0 && was.w === w && was.h === h) return
    this.set(id, { x: x0, y: y0, w, h, cx: x0 + w / 2, cy: y0 + h / 2 })
  }
  /** Every frame fitted round its children again (after positions were set from outside). */
  refit(): void { this.fitAll() }
  private fitAll(): void {
    const depth = (id: string): number => { let d = 0; for (let p = this.parentOf(id); p; p = this.parentOf(p)) d++; return d }
    for (const id of [...this.children.keys()].sort((a, b) => depth(b) - depth(a))) this.fit(id)
  }

  /** Whether `id` lies clear of its siblings (by its container's gap) and inside its container. */
  clear(id: string): boolean {
    const b = this.boxes.get(id)!
    const parent = this.parentOf(id)
    const gap = this.gapOf(parent)
    for (const o of this.childrenOf(parent)) {
      if (o === id) continue
      const r = this.boxes.get(o)!
      if (b.x < r.x + r.w + gap && r.x < b.x + b.w + gap && b.y < r.y + r.h + gap && r.y < b.y + b.h + gap) return false
    }
    return true
  }
  /** Whether `id` lies on a sibling (overlapping boxes, not merely too close). */
  overlaps(id: string): boolean {
    const b = this.boxes.get(id)!
    for (const o of this.childrenOf(this.parentOf(id))) {
      if (o === id) continue
      const r = this.boxes.get(o)!
      if (b.x < r.x + r.w && r.x < b.x + b.w && b.y < r.y + r.h && r.y < b.y + b.h) return true
    }
    return false
  }
  /** Whether every sibling group is clear: a frame grown by a move may lie on its neighbour. */
  allClear(ids: Iterable<string>): boolean {
    for (const id of ids) {
      for (let x: string | undefined = id; x; x = this.parentOf(x)) if (!this.clear(x)) return false
    }
    return true
  }

  /** The boxes put back as `positions()` gave them (parents before children). */
  setPositions(p: PositionMap): void {
    const depth = (id: string): number => { let d = 0; for (let x = this.parentOf(id); x; x = this.parentOf(x)) d++; return d }
    for (const id of [...this.allIds].sort((a, b) => depth(a) - depth(b))) {
      const q = p[id]
      if (!q) continue
      const parent = this.parentOf(id)
      const pb = parent ? this.boxes.get(parent)! : { x: 0, y: 0 }
      const b = this.boxes.get(id)!
      const w = q.width ?? b.w, h = q.height ?? b.h
      this.set(id, { x: pb.x + q.x, y: pb.y + q.y, w, h, cx: pb.x + q.x + w / 2, cy: pb.y + q.y + h / 2 })
    }
  }

  /** Positions as the canvas keeps them: relative to the parent. */
  positions(): PositionMap {
    const out: PositionMap = {}
    for (const [id, b] of this.boxes) {
      const p = this.parentOf(id)
      const pb = p ? this.boxes.get(p)! : { x: 0, y: 0 }
      out[id] = { x: b.x - pb.x, y: b.y - pb.y, width: b.w, height: b.h }
    }
    return out
  }
}
