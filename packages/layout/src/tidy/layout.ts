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

export interface Box { x: number; y: number; w: number; h: number; cx: number; cy: number }

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
  /** While a move is tried: the box each changed element had before it (boxes are replaced, never changed in place). */
  private journal: Map<string, Box> | null = null
  readonly meanSize: number

  /** How the view draws its lines: an orthogonal line is judged along its route (cost.ts). */
  edgeStyle: EdgeStyle = 'curved'

  constructor(readonly nodes: Record<string, C4Node>, readonly metamodel?: Metamodel | null, pinned: Iterable<string> = []) {
    const abs = new Map<string, { x: number; y: number }>()
    const of = (id: string): { x: number; y: number } => {
      const got = abs.get(id)
      if (got) return got
      const n = nodes[id]
      const p = n.parentId && nodes[n.parentId] ? of(n.parentId) : { x: 0, y: 0 }
      const at = { x: p.x + n.x, y: p.y + n.y }
      abs.set(id, at)
      return at
    }
    let size = 0, leaves = 0
    for (const id of Object.keys(nodes).sort()) {
      const n = nodes[id]
      if (n.parentId && nodes[n.parentId]) this.children.set(n.parentId, [...(this.children.get(n.parentId) ?? []), id])
      const { x, y } = of(id)
      const w = effectiveWidth(n), h = effectiveHeight(n)
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
    for (const id of pinned) if (this.boxes.has(id)) { this.fixedIds.add(id); for (const d of this.descendants(id)) this.fixedIds.add(d) }
    this.fitAll()
  }

  /** Whether the element is pinned (or held by one): it stays where it is. */
  fixed(id: string): boolean { return this.fixedIds.has(id) }

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
  gapOf(parent: string | undefined): number { return parent ? CHILD_GAP : ROOT_GAP }

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
    this.boxes.set(id, b)
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
    const pad = compoundPadding(type)
    const def = this.metamodel?.nodeTypes[type]
    const size = nodeTypeSize(type, this.metamodel)
    const min = { width: def?.collapsedWidth ?? COLLAPSED_WIDTH[type] ?? size.width, height: def?.collapsedHeight ?? COLLAPSED_HEIGHT[type] ?? size.height }
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
