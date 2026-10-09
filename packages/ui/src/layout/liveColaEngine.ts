/**
 * The live WebCoLa engine. LiveColaLayout (liveColaLayout.ts) runs it in a
 * Web Worker (liveCola.worker.ts), or on the main thread where workers are
 * not available.
 *
 * Live (dynamic) WebCoLa layout — exact same pattern as the official
 * "smallgroups" example:
 *   https://ialab.it.monash.edu/webcola/examples/smallgroups.html
 *
 * Key: d3adaptor(d3) with .start() (keepRunning=true) starts a d3.timer
 * that calls tick() each frame. When stress < threshold the timer stops.
 * User drag calls resume() to restart the timer.
 */

import { d3adaptor, Layout, InputNode, Group, Link, Rectangle, computeGroupBounds } from 'webcola'
import { dispatch } from 'd3-dispatch'
import { timer } from 'd3-timer'
import { drag as d3drag } from 'd3-drag'
import { C4Node, C4Relation } from '@radical/common/c4'
import { drawnSize, effectiveWidth, effectiveHeight, isVisible } from '@radical/layout/geometry'
import { alongAxis, type Alignment } from '@radical/layout/constraints'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ColaNode extends InputNode {
  x: number
  y: number
  width: number
  height: number
  /** Real (non-inflated) dimensions for position conversion */
  realWidth: number
  realHeight: number
  c4id: string
  fixed?: number
  px?: number
  py?: number
}

interface C4Group extends Group {
  c4id: string
  /** Visual shrink applied when emitting bounds (collision uses full padding,
   * but we render a smaller box so sibling group borders don't touch). */
  visualShrink?: number
}

/** An alignment WebCoLa cannot hold itself because a member is a group:
 *  the tick handler projects it (projectGroupAlignments). */
type AlignedMember = { id: string; node?: ColaNode; group?: C4Group }

interface GroupAlignment {
  axis: 'x' | 'y'
  members: AlignedMember[]
  /** Where the line runs: the members' mean when the layout is built, then
   *  wherever a dragged member takes it, or a group the whole line is
   *  inside (shiftMember). Fixed otherwise, so the physics cannot drag the
   *  whole line along a step at a time. */
  line?: number
  /** Nesting depth of the shallowest member: outer lines project first. */
  depth: number
}

/** An ordered alignment with a group member: the tick handler keeps each
 *  member after the previous one along `along` (projectGroupAlignments). */
interface GroupOrder {
  along: 'x' | 'y'
  members: AlignedMember[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Walk parent chain to compute absolute top-left from relative positions. */
/** Parent types that can hold other parents; every other parent is a flat group. */
const NESTING_TYPES: ReadonlySet<string> = new Set(['system', 'domain', 'group'])

function toAbsoluteTopLeft(n: C4Node, all: Record<string, C4Node>): { x: number; y: number } {
  let x = n.x
  let y = n.y
  let cur = n
  while (cur.parentId) {
    const parent = all[cur.parentId]
    if (!parent) break
    x += parent.x
    y += parent.y
    cur = parent
  }
  return { x, y }
}

// ─── Pace ────────────────────────────────────────────────────────────────────

/** A tick that arrives this long after the previous one marks a heavy graph
 *  (physics plus rendering no longer fit a frame). */
const HEAVY_TICK_MS = 40
/** On a heavy graph, render one tick in this many: the physics then settles
 *  about twice as fast (measured on 450 nodes), at a lower visual frame rate. */
const HEAVY_RENDER_EVERY = 3
/** Settled: no node moved more than SETTLE_PX for SETTLE_TICKS ticks in a row.
 *  WebCoLa's own test (alpha < threshold) never passes once groups are
 *  projected, so nested views used to move (and re-render) forever. */
const SETTLE_PX = 0.5
const SETTLE_TICKS = 15
/** With an alignment that has a group member, a run stops after this long
 *  even when nodes still move: those alignments are projected after each
 *  WebCoLa step, outside its solver, and on a large nested model the two can
 *  keep pulling against each other (seen on the repo's own architecture
 *  model, grids of groups inside a column of groups). The run ends on a
 *  projected step, so the alignments hold. */
const MAX_PROJECTED_RUN_MS = 4000

// ─── Public interface ────────────────────────────────────────────────────────

export type LiveColaPositions = Record<string, { x: number; y: number; width?: number; height?: number }>

export interface LiveColaModel {
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  /** User alignments that hold on the canvas (resolveAlignments). */
  alignments?: Alignment[]
  /** Elements the physics leaves where they stand (PinConstraint). */
  pinned?: string[]
}

/**
 * How a drag moves the diagram. 'calm': only the dragged element moves, with
 * the elements it is aligned with (along the line's cross axis, so the line
 * holds); on drop, elements it now covers are pushed clear, nothing else
 * moves. 'push': the physics runs during the drag and the rest of the
 * diagram makes room.
 */
export type DragMode = 'calm' | 'push'

/** A calm drop pushes what it covers until the drawn boxes are this far apart. */
const CALM_GAP = 24
/** At most this many pushes per calm drop: dense or blocked spots stop
 *  there, overlaps left as they are. */
const CALM_MAX_PUSHES = 400

export interface LiveColaCallbacks {
  getModel: () => LiveColaModel
  /** Only the nodes that moved or resized since they were last reported. */
  applyPositions: (positions: LiveColaPositions) => void
  /** The layout came to rest (after its last applyPositions). */
  onSettled?: () => void
}

/** A node is reported again once it moved or resized by more than this. */
const REPORT_PX = 0.5

/** From this many nodes the physics is local only. Relaxing the whole graph
 *  takes minutes (about 95 s on 450 nodes) and spreads it over tens of
 *  thousands of pixels, so: rebuilds (open, view switch, undo, Smart Layout)
 *  keep the positions they get; new nodes and drags move only their nearest
 *  LOCAL_DRAG_SIZE nodes by relation and containment steps (hubs would
 *  otherwise pull in most of the graph within two steps); the rest stays
 *  frozen until the layout rests. Arranging the whole diagram is Smart
 *  Layout's job. Smaller diagrams relax as a whole. */
export const LOCAL_PHYSICS_MIN_NODES = 150
const LOCAL_DRAG_SIZE = 40
/** cola's `fixed` is a bit mask (2 = dragged); this bit marks frozen nodes. */
const FROZEN = 8
/** And this one pinned nodes (PinConstraint): held like frozen ones, for good. */
const PINNED = 16

type Box = { x: number; X: number; y: number; Y: number }

/** A calm drag in progress (DragMode). */
interface CalmDrag {
  id: string
  /** Other selected elements dragged along with it. */
  with: string[]
  /** The dragged element's absolute top-left on the canvas when grabbed. */
  from: { x: number; y: number }
  /** How far it has moved since. */
  delta: { x: number; y: number }
  /** Leaves that move, from where, on which axes. */
  follow: Map<ColaNode, { x: number; y: number; mx: boolean; my: boolean }>
  /** Elements aligned with the dragged one: they move with it. */
  partners: string[]
  /** It has moved: React Flow starts a drag on a mere click too. */
  moving: boolean
}

export interface LiveColaEngineOptions {
  /** Render only some ticks of a heavy graph (HEAVY_RENDER_EVERY). For the
   *  main thread, where physics and rendering share the frame; a worker
   *  leaves the frame to rendering, so it reports every tick. */
  paceRenders?: boolean
}

export class LiveColaEngine {
  private cola: any = null
  private colaNodes: ColaNode[] = []
  private colaGroups: C4Group[] = []
  private idToNode = new Map<string, ColaNode>()
  private idToGroup = new Map<string, C4Group>()
  private callbacks: LiveColaCallbacks
  private _running = false
  private _bulkDone = false
  private _grabbedId: string | null = null
  private allNodes: Record<string, C4Node> = {}
  /**
   * One-shot seed positions consumed by the next rebuild(). Used when a
   * caller wants a re-appearing node (e.g. children of a just-expanded
   * parent) to start at a specific absolute centre coordinate, overriding
   * the default "spawn near connected neighbours" heuristic. Entries are
   * cleared after they are applied.
   */
  private seedPositions = new Map<string, { x: number; y: number }>()
  /** Pace bookkeeping (see HEAVY_TICK_MS and SETTLE_PX). */
  private lastTickAt = 0
  /** When the run started, or a drag began or ended (MAX_PROJECTED_RUN_MS). */
  private runStartedAt = 0
  private skippedRenders = 0
  private quietTicks = 0
  private prevCentres = new Map<ColaNode, { x: number; y: number }>()
  /** c4 id → ids one relation or containment step away (rebuilt with the layout). */
  private neighbours = new Map<string, Set<string>>()
  private frozen = false
  /** c4 id → the other members of its alignments (rebuilt with the layout). */
  private alignedWith = new Map<string, Set<string>>()
  private groupAlignments: GroupAlignment[] = []
  private groupOrders: GroupOrder[] = []
  /** Positions last handed to applyPositions, to report only changes. */
  private reported = new Map<string, { x: number; y: number; width?: number; height?: number }>()
  /** Absolute top-left last reported per element (calm drags, emitPositions). */
  private reportedAbs = new Map<string, { x: number; y: number }>()
  /** The canvas's alignments as last built. */
  private alignments: Alignment[] = []
  /** Pinned elements: the model's (LiveColaModel.pinned) and those dropped since. */
  private pinnedIds = new Set<string>()
  /** Alignment members that hold a pinned leaf: their line runs through them. */
  private pinnedMembers = new Set<string>()
  /** Group (or '' for the canvas) → the elements directly in it, as laid out. */
  private childrenOf = new Map<string, string[]>()
  /** Position of each cola node in colaNodes (WebCoLa's solver arrays). */
  private nodeIndexOf = new Map<ColaNode, number>()
  private calm: CalmDrag | null = null
  /** A push drag's start, to tell a drag from a click on release. */
  private pushFrom: { x: number; y: number; moved: boolean } | null = null

  private readonly paceRenders: boolean

  constructor(callbacks: LiveColaCallbacks, options: LiveColaEngineOptions = {}) {
    this.callbacks = callbacks
    this.paceRenders = options.paceRenders ?? false
  }

  /**
   * Provide an absolute-centre seed position for a node, applied on the next
   * rebuild() if the node was not present in the previous cola pass (i.e.
   * a re-appearing child after expand). No-op once consumed.
   */
  seedPosition(id: string, x: number, y: number): void {
    this.seedPositions.set(id, { x, y })
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Start the live layout.
   * @param skipBulk When true, the cola model is initialised from the
   *   current c4Nodes positions WITHOUT running bulk synchronous
   *   iterations (i.e. `rebuild(false)`). Use this when the diagram was
   *   loaded from disk and already has correct positions — running the
   *   110-iteration bulk pass would rearrange everything and overwrite
   *   the persisted layout.
   */
  start(skipBulk = false): void {
    if (this._running) return
    this._running = true
    if (this._bulkDone && this.cola) {
      // Resume an existing layout WITHOUT calling cola.resume(): that
      // method sets alpha=0.1 which immediately runs a synchronous
      // convergence (kick) and visibly shifts nodes. We just re-arm
      // _running so the live tick handler resumes emitting positions
      // when cola is woken up by a drag (liveGrab/liveDrag → dragStart
      // + resume in webcola).
      // No-op otherwise — cola sits idle and positions stay put.
    } else {
      // First start: bulk-arrange only when we don't have saved positions.
      // When skipBulk=true (loaded from disk), we seed from c4Nodes and
      // run 0 initial iterations so cola accepts the stored positions as-is.
      this.rebuild(!skipBulk)
      this._bulkDone = true
    }
  }

  stop(): void {
    this._running = false
    // Halt the d3.timer but keep this.cola + node/group caches intact so
    // a subsequent start() can resume() instead of doing a full rebuild
    // (which would re-seed positions and visibly shift the diagram).
    if (this.cola) {
      try { this.cola.stop() } catch { /* noop */ }
    }
    this._grabbedId = null
  }

  get running(): boolean {
    return this._running
  }

  invalidate(): void {
    if (this._running) this.rebuild(false)
  }

  /**
   * Like invalidate(), but discards cola's cached positions first so the
   * next rebuild seeds itself from the current c4Nodes coordinates instead
   * of carrying over stale ones. Use this whenever the store's positions
   * were replaced wholesale (view switch, milestone load, file load, etc.).
   */
  reset(): void {
    // Drop cached positions; rebuild() will fall back to toAbsoluteTopLeft
    // (which reads from c4Nodes) for every node.
    this.colaNodes = []
    this.idToNode.clear()
    this.colaGroups = []
    this.idToGroup.clear()
    // The positions are new: so are the lines the alignments run along.
    this.groupAlignments = []
    if (this._running) this.rebuild(false)
  }

  // ─── Grab / drag / release ─────────────────────────────────────────────────
  // Replicates exactly what cola.drag does in d3v4adaptor:
  //   start → Layout.dragStart(d); resume()
  //   drag  → Layout.drag(d, pos); resume()
  //   end   → Layout.dragEnd(d)
  //
  // For group nodes (parents), we drag all descendant leaf nodes together.

  /** Collect all leaf ColaNodes that belong to a group (recursively). */
  private groupLeaves(groupId: string): ColaNode[] {
    const g = this.idToGroup.get(groupId)
    if (!g) return []
    const result: ColaNode[] = []
    // Direct leaves
    if (g.leaves) {
      for (const leaf of g.leaves as any[]) {
        const cn = typeof leaf === 'number' ? this.colaNodes[leaf] : leaf
        if (cn) result.push(cn)
      }
    }
    // Recurse into child groups
    if (g.groups) {
      for (const child of g.groups as any[]) {
        const childGroup = typeof child === 'number' ? this.colaGroups[child] : child
        if (childGroup) {
          const childId = (childGroup as C4Group).c4id
          if (childId) result.push(...this.groupLeaves(childId))
        }
      }
    }
    return result
  }

  private _dragStartPositions = new Map<string, { x: number; y: number }>()

  /**
   * A drag starts. `rfX`/`rfY` are React Flow's position (relative to the
   * parent); `abs`, the absolute top-left on the canvas, is what a calm drag
   * follows, since a parent that grows moves the relative one. `withIds`:
   * other selected elements React Flow drags along (calm drags move them too).
   */
  grab(nodeId: string, rfX: number, rfY: number, mode: DragMode = 'push', abs?: { x: number; y: number }, withIds: string[] = []): void {
    this._grabbedId = nodeId
    this.resetPace()
    if (mode === 'calm') {
      // Held while the physics may still run, until it moves (calmDrag).
      for (const leaf of this.leavesOf(nodeId)) Layout.dragStart(leaf)
      this.calm = this.calmDrag(nodeId, withIds, abs ?? { x: rfX, y: rfY }, { x: 0, y: 0 })
      return
    }
    for (const leaf of this.leavesOf(nodeId)) leaf.fixed = (leaf.fixed ?? 0) & ~PINNED
    this.calm = null
    this.pushFrom = { x: rfX, y: rfY, moved: false }
    if (this.colaNodes.length >= LOCAL_PHYSICS_MIN_NODES) this.freezeAllBut(nodeId)
    const cn = this.idToNode.get(nodeId)
    if (cn) {
      Layout.dragStart(cn)
    } else {
      // It's a group — drag all descendant leaves
      const leaves = this.groupLeaves(nodeId)
      this._dragStartPositions.clear()
      for (const leaf of leaves) {
        this._dragStartPositions.set(leaf.c4id, { x: leaf.x, y: leaf.y })
        Layout.dragStart(leaf)
      }
    }
    this.cola?.resume()
  }

  drag(nodeId: string, rfX: number, rfY: number, abs?: { x: number; y: number }): void {
    if (this.calm) {
      if (this.calm.id !== nodeId) return
      const at = abs ?? { x: rfX, y: rfY }
      this.calm.delta = { x: at.x - this.calm.from.x, y: at.y - this.calm.from.y }
      if (!this.calm.moving) {
        if (Math.abs(this.calm.delta.x) < REPORT_PX && Math.abs(this.calm.delta.y) < REPORT_PX) return
        // It moves: the rest of the diagram stands still from here on. A
        // drag moves a pinned element too; the drop pins it again.
        this.cola?.stop()
        this.unfreeze()
        for (const id of [this.calm.id, ...this.calm.with]) {
          for (const leaf of this.leavesOf(id)) {
            Layout.dragEnd(leaf)
            leaf.fixed = (leaf.fixed ?? 0) & ~PINNED
          }
        }
        // From where everything stands now: the physics may have moved
        // the others since the grab.
        const fresh = this.calmDrag(this.calm.id, this.calm.with, this.calm.from, { x: 0, y: 0 })
        if (!fresh) return
        this.calm = { ...fresh, delta: this.calm.delta, moving: true }
      }
      this.applyCalm(this.calm)
      this.refreshBounds()
      this.keepOrders([this.calm.id, ...this.calm.with])
      this.emitPositions()
      return
    }
    if (this.pushFrom && (Math.abs(rfX - this.pushFrom.x) > REPORT_PX || Math.abs(rfY - this.pushFrom.y) > REPORT_PX)) this.pushFrom.moved = true
    const cn = this.idToNode.get(nodeId)
    if (cn) {
      // Convert RF relative top-left → cola absolute center. React Flow
      // draws the real size; cn.width/height include the overlap margin.
      // Use cola group bounds (not store positions) for consistency
      const abs = this.rfToAbsCenter(nodeId, rfX, rfY, cn.realWidth, cn.realHeight)
      Layout.drag(cn, abs)
    } else {
      // Group drag: compute delta from group bounds and move all leaves
      const g = this.idToGroup.get(nodeId)
      if (g) {
        const b = (g as any).bounds
        if (b && this._dragStartPositions.size > 0) {
          // Get the first leaf's start position to compute delta
          const firstLeaf = this.groupLeaves(nodeId)[0]
          if (firstLeaf) {
            const startPos = this._dragStartPositions.get(firstLeaf.c4id)
            if (startPos) {
              // The group's bounds.x is the left edge; rfX is the new top-left from ReactFlow
              // Compute delta from the original group bounds position
              const c4n = this.allNodes[nodeId]
              let absX = rfX, absY = rfY
              if (c4n?.parentId) {
                const pg = this.idToGroup.get(c4n.parentId)
                if (pg) {
                  const pb = (pg as any).bounds
                  if (pb) { absX += pb.x; absY += pb.y }
                }
              }
              const dx = absX - (b.x ?? 0)
              const dy = absY - (b.y ?? 0)
              for (const leaf of this.groupLeaves(nodeId)) {
                const sp = this._dragStartPositions.get(leaf.c4id)
                if (sp) {
                  Layout.drag(leaf, { x: sp.x + dx, y: sp.y + dy })
                }
              }
            }
          }
        }
      }
    }
    this.cola?.resume()
  }

  release(nodeId: string): void {
    this._grabbedId = null
    this.runStartedAt = 0
    const calm = this.calm
    this.calm = null
    if (calm && !calm.moving) {
      // A click: as it was.
      for (const leaf of this.leavesOf(calm.id)) Layout.dragEnd(leaf)
      this.applyPins()
      return
    }
    if (calm) {
      const moved = calm.id === nodeId ? [nodeId, ...calm.with] : [nodeId]
      for (const id of moved) this.pin(id)
      if (calm.id === nodeId) this.clearOverlaps([...moved, ...calm.partners])
      this.emitPositions()
      this.callbacks.onSettled?.()
      return
    }
    const cn = this.idToNode.get(nodeId)
    if (cn) {
      Layout.dragEnd(cn)
    } else {
      for (const leaf of this.groupLeaves(nodeId)) {
        Layout.dragEnd(leaf)
      }
      this._dragStartPositions.clear()
    }
    if (this.pushFrom?.moved) this.pin(nodeId)
    else this.applyPins()
    this.pushFrom = null
  }

  // ─── Calm drags and pins ───────────────────────────────────────────────────

  /** The cola leaves that make up an element: itself, or a group's. */
  private leavesOf(id: string): ColaNode[] {
    const cn = this.idToNode.get(id)
    return cn ? [cn] : this.groupLeaves(id)
  }

  /** Keeps an element where it stands from now on (PINNED). */
  private pin(id: string): void {
    this.pinnedIds.add(id)
    for (const leaf of this.leavesOf(id)) {
      leaf.fixed = (leaf.fixed ?? 0) | PINNED
      leaf.px = leaf.x
      leaf.py = leaf.y
    }
    this.findPinnedMembers()
  }

  /** Sets PINNED on the leaves of the pinned elements, and only those. */
  private applyPins(): void {
    for (const cn of this.colaNodes) cn.fixed = (cn.fixed ?? 0) & ~PINNED
    for (const id of this.pinnedIds) {
      for (const leaf of this.leavesOf(id)) {
        leaf.fixed = (leaf.fixed ?? 0) | PINNED
        leaf.px = leaf.x
        leaf.py = leaf.y
      }
    }
    this.findPinnedMembers()
  }

  private findPinnedMembers(): void {
    this.pinnedMembers.clear()
    for (const a of this.groupAlignments) {
      for (const m of a.members) {
        if (this.leavesOf(m.id).some((leaf) => (leaf.fixed ?? 0) & PINNED)) this.pinnedMembers.add(m.id)
      }
    }
  }

  /** A calm drag of `id` (and `withIds`), grabbed at `from` and moved by
   *  `delta` so far. */
  private calmDrag(id: string, withIds: string[], from: { x: number; y: number }, delta: { x: number; y: number }): CalmDrag | null {
    if (!this.idToNode.has(id) && !this.idToGroup.has(id)) return null
    const follow: CalmDrag['follow'] = new Map()
    const add = (member: string, mx: boolean, my: boolean): void => {
      for (const leaf of this.leavesOf(member)) {
        const f = follow.get(leaf) ?? { x: leaf.x, y: leaf.y, mx: false, my: false }
        f.mx ||= mx
        f.my ||= my
        follow.set(leaf, f)
      }
    }
    const moved = [id, ...withIds.filter((w) => w !== id && (this.idToNode.has(w) || this.idToGroup.has(w)))]
    for (const m of moved) add(m, true, true)
    // A row moves up and down with its dragged member, a column sideways;
    // along the line the others stay.
    const partners: string[] = []
    for (const a of this.alignments) {
      if (!a.ids.some((m) => moved.includes(m))) continue
      for (const other of a.ids) {
        if (moved.includes(other) || partners.includes(other)) continue
        add(other, a.axis === 'x', a.axis === 'y')
        partners.push(other)
      }
    }
    // Rebuilt during the drag: the leaves already moved by `delta`.
    for (const f of follow.values()) {
      if (f.mx) f.x -= delta.x
      if (f.my) f.y -= delta.y
    }
    return { id, with: moved.slice(1), from, delta, follow, partners, moving: delta.x !== 0 || delta.y !== 0 }
  }

  private applyCalm(c: CalmDrag): void {
    for (const [cn, f] of c.follow) {
      this.placeLeaf(cn, f.mx ? f.x + c.delta.x : cn.x, f.my ? f.y + c.delta.y : cn.y)
    }
  }

  /**
   * Ordered lines through the dragged elements: one dragged up to (or past)
   * the next one pushes it ahead along the line, and that one the next, as
   * the physics does; they are not pulled back when it turns round.
   */
  private keepOrders(moved: string[]): void {
    for (const a of this.alignments) {
      const along = alongAxis(a)
      const lo = (b: Box): number => (along === 'x' ? b.x : b.y)
      const hi = (b: Box): number => (along === 'x' ? b.X : b.Y)
      for (const chain of a.orders) {
        const k = chain.findIndex((id) => moved.includes(id))
        if (k < 0) continue
        for (let j = k + 1; j < chain.length && !moved.includes(chain[j]); j++) {
          const prev = this.boxOf(chain[j - 1])
          const b = this.boxOf(chain[j])
          if (!prev || !b) break
          const need = hi(prev) + CALM_GAP - lo(b)
          if (need <= 0) break
          this.translate(chain[j], along, need)
        }
        for (let j = k - 1; j >= 0 && !moved.includes(chain[j]); j--) {
          const next = this.boxOf(chain[j + 1])
          const b = this.boxOf(chain[j])
          if (!next || !b) break
          const need = hi(b) + CALM_GAP - lo(next)
          if (need <= 0) break
          this.translate(chain[j], along, -need)
        }
      }
    }
  }

  /** Moves a leaf's centre, in WebCoLa's solver state and lock too. */
  private placeLeaf(cn: ColaNode, x: number, y: number): void {
    const descent = (this.cola as { _descent?: { x: number[][] } } | null)?._descent?.x
    const i = this.nodeIndexOf.get(cn) ?? -1
    if (cn.px !== undefined) cn.px += x - cn.x
    if (cn.py !== undefined) cn.py += y - cn.y
    cn.x = x
    cn.y = y
    if (descent && i >= 0) { descent[0][i] = x; descent[1][i] = y }
  }

  /** Group boxes from where the leaves stand, as WebCoLa computes them. */
  private refreshBounds(): void {
    for (const cn of this.colaNodes) {
      ;(cn as any).bounds = new Rectangle(cn.x - cn.width / 2, cn.x + cn.width / 2, cn.y - cn.height / 2, cn.y + cn.height / 2)
    }
    for (const g of this.colaGroups) {
      if (!(g as any).parent) computeGroupBounds(g as any)
    }
  }

  /** An element's box as the canvas draws it: a leaf from its top-left at
   *  its drawn size (drawnSize), which may differ from the one laid out. */
  private boxOf(id: string): Box | undefined {
    const cn = this.idToNode.get(id)
    if (cn) {
      const drawn = drawnSize(this.allNodes[id], false)
      const x = cn.x - cn.realWidth / 2
      const y = cn.y - cn.realHeight / 2
      return { x, X: x + drawn.width, y, Y: y + drawn.height }
    }
    const g = this.idToGroup.get(id)
    const b = (g as any)?.bounds
    if (!b || !Number.isFinite(b.x)) return undefined
    const s = g!.visualShrink ?? 0
    return { x: b.x + s, X: b.X - s, y: b.y + s, Y: b.Y - s }
  }

  /** The group an element is laid out in, or '' for the canvas. */
  private levelOf(id: string): string {
    for (let p = this.allNodes[id]?.parentId; p; p = this.allNodes[p]?.parentId) {
      if (this.idToGroup.has(p)) return p
    }
    return ''
  }

  /**
   * After a calm drop: pushes the elements the moved ones now cover (drawn
   * boxes closer than CALM_GAP) out of the way, whole and in one step, and
   * whatever those cover in turn; a group that grew pushes its own
   * neighbours the same way. Nothing else moves. A pinned element is pushed
   * too and stays pinned where it lands: the pin keeps the physics off it,
   * not the user's drop. An aligned one moves only along its line; one a
   * line holds on both axes stays, and the element that covers it moves off
   * it instead.
   */
  private clearOverlaps(seeds: string[]): void {
    this.refreshBounds()
    const pending = new Map<string, Set<string>>()
    const push = (id: string): void => {
      const level = this.levelOf(id)
      const set = pending.get(level) ?? new Set<string>()
      set.add(id)
      pending.set(level, set)
    }
    for (const id of seeds) if (this.boxOf(id)) push(id)
    const depth = (id: string): number => {
      let d = 0
      for (let p: string = id; p; p = this.levelOf(p)) d++
      return d
    }
    let budget = CALM_MAX_PUSHES
    while (pending.size && budget > 0) {
      const level = [...pending.keys()].sort((a, b) => depth(b) - depth(a))[0]
      const movers = pending.get(level)!
      pending.delete(level)
      const queue = [...movers]
      while (queue.length && budget > 0) {
        const a = queue.shift()!
        const A = this.boxOf(a)
        if (!A) continue
        for (const b of this.childrenOf.get(level) ?? []) {
          if (b === a || movers.has(b)) continue
          const B = this.boxOf(b)
          if (!B) continue
          const ox = Math.min(A.X, B.X) - Math.max(A.x, B.x) + CALM_GAP
          const oy = Math.min(A.Y, B.Y) - Math.max(A.y, B.y) + CALM_GAP
          if (ox <= 0 || oy <= 0) continue
          const preferred = ox <= oy ? 'x' : 'y'
          const axis = this.pushAxis(b, preferred)
          if (axis) {
            const away = axis === 'x' ? (B.x + B.X) - (A.x + A.X) : (B.y + B.Y) - (A.y + A.Y)
            this.translate(b, axis, (away >= 0 ? 1 : -1) * (axis === 'x' ? ox : oy))
            queue.push(b)
          } else {
            // Lines hold b on both axes: a moves off it, then looks again.
            const back = this.pushAxis(a, preferred)
            if (!back) continue
            const away = back === 'x' ? (A.x + A.X) - (B.x + B.X) : (A.y + A.Y) - (B.y + B.Y)
            this.translate(a, back, (away >= 0 ? 1 : -1) * (back === 'x' ? ox : oy))
            queue.push(a)
            budget--
            break
          }
          if (--budget <= 0) break
        }
      }
      // The group grew or moved with what is in it: it pushes its neighbours.
      if (level) {
        this.refreshBounds()
        push(level)
      }
    }
    this.refreshBounds()
  }

  /** The axis `id` may be pushed along, `preferred` if it can, or none. */
  private pushAxis(id: string, preferred: 'x' | 'y'): 'x' | 'y' | null {
    // A line through it, or through an element inside it to one outside,
    // holds it on the line's axis.
    const inside = (x: string): boolean => x === id || this.isInside(x, id)
    let lockX = false
    let lockY = false
    for (const a of this.alignments) {
      if (!a.ids.some(inside) || a.ids.every(inside)) continue
      if (a.axis === 'x') lockX = true
      else lockY = true
    }
    const free = (axis: 'x' | 'y'): boolean => (axis === 'x' ? !lockX : !lockY)
    if (free(preferred)) return preferred
    const other = preferred === 'x' ? 'y' : 'x'
    return free(other) ? other : null
  }

  /** Moves an element, and all inside it, by `d` on `axis`. */
  private translate(id: string, axis: 'x' | 'y', d: number): void {
    for (const leaf of this.leavesOf(id)) {
      this.placeLeaf(leaf, axis === 'x' ? leaf.x + d : leaf.x, axis === 'y' ? leaf.y + d : leaf.y)
    }
    const g = this.idToGroup.get(id)
    if (g) this.shiftBounds(g, axis, d)
  }

  /** Freezes every node but the LOCAL_DRAG_SIZE nearest to each of `ids`. */
  private freezeAllBut(...ids: string[]): void {
    const near = new Set<string>(ids)
    for (const id of ids) {
      const local = new Set<string>([id])
      const queue = [id]
      while (queue.length && local.size < LOCAL_DRAG_SIZE) {
        for (const n of this.neighbours.get(queue.shift()!) ?? []) {
          if (local.size >= LOCAL_DRAG_SIZE) break
          if (!local.has(n)) { local.add(n); queue.push(n) }
        }
      }
      for (const n of local) near.add(n)
      // A dragged group moves its leaves, so they count as near too.
      for (const leaf of this.groupLeaves(id)) near.add(leaf.c4id)
    }
    // Aligned elements follow the moved ones wherever they are, and so do
    // those aligned with a group a moved one is inside (the group moves and
    // grows with it), and theirs in turn: a frozen member would be put back
    // after every projection onto its line, and the line would flip
    // between the two places for good.
    const queue = [...near]
    const seen = new Set<string>()
    while (queue.length) {
      for (let cur: string | undefined = queue.pop(); cur && !seen.has(cur); cur = this.allNodes[cur]?.parentId) {
        seen.add(cur)
        for (const other of this.alignedWith.get(cur) ?? []) {
          for (const id of [other, ...this.groupLeaves(other).map((leaf) => leaf.c4id)]) {
            if (!near.has(id)) { near.add(id); queue.push(id) }
          }
        }
      }
    }
    for (const cn of this.colaNodes) {
      if (near.has(cn.c4id)) continue
      cn.fixed = (cn.fixed ?? 0) | FROZEN
      cn.px = cn.x
      cn.py = cn.y
    }
    this.frozen = true
  }

  /** Puts frozen and pinned nodes back exactly: cola's locks are springs,
   *  and overlap projection moves locked nodes too, so they would drift. */
  private pinFrozen(): void {
    if (!this.frozen && !this.pinnedIds.size) return
    const x = (this.cola as { _descent?: { x: number[][] } } | null)?._descent?.x
    this.colaNodes.forEach((cn, i) => {
      if (!((cn.fixed ?? 0) & (FROZEN | PINNED)) || cn.px === undefined || cn.py === undefined) return
      cn.x = cn.px
      cn.y = cn.py
      if (x) { x[0][i] = cn.px; x[1][i] = cn.py }
    })
  }

  private unfreeze(): void {
    if (!this.frozen) return
    for (const cn of this.colaNodes) cn.fixed = (cn.fixed ?? 0) & ~FROZEN
    this.frozen = false
  }

  // ─── Coordinate conversion (RF ↔ cola) ─────────────────────────────────────

  /** Convert ReactFlow relative top-left to cola absolute center. */
  private rfToAbsCenter(
    nodeId: string, rfX: number, rfY: number, w: number, h: number
  ): { x: number; y: number } {
    let absX = rfX
    let absY = rfY
    // Walk up parent chain using cola group bounds for absolute offset
    const c4n = this.allNodes[nodeId]
    if (c4n?.parentId) {
      const pg = this.idToGroup.get(c4n.parentId)
      if (pg) {
        const b = (pg as any).bounds
        if (b) { absX += b.x; absY += b.y }
      }
    }
    return { x: absX + w / 2, y: absY + h / 2 }
  }

  // ─── Build / rebuild ───────────────────────────────────────────────────────

  private resetPace(): void {
    this.lastTickAt = 0
    this.runStartedAt = 0
    this.skippedRenders = 0
    this.quietTicks = 0
    this.prevCentres.clear()
  }

  /** True once no node has moved more than SETTLE_PX for SETTLE_TICKS ticks. */
  private settled(): boolean {
    let moved = 0
    for (const cn of this.colaNodes) {
      const prev = this.prevCentres.get(cn)
      if (prev) moved = Math.max(moved, Math.abs(cn.x - prev.x), Math.abs(cn.y - prev.y))
      else moved = Infinity
      this.prevCentres.set(cn, { x: cn.x, y: cn.y })
    }
    this.quietTicks = moved <= SETTLE_PX ? this.quietTicks + 1 : 0
    if (this._grabbedId) return false
    if (this.quietTicks >= SETTLE_TICKS) return true
    if (!this.groupAlignments.length && !this.groupOrders.length) return false
    const now = performance.now()
    if (!this.runStartedAt) this.runStartedAt = now
    return now - this.runStartedAt >= MAX_PROJECTED_RUN_MS
  }

  private rebuild(firstRun: boolean = false): void {
    if (this.cola) this.cola.stop()
    this.resetPace()
    // The store may hold other positions now (view switch, undo, load):
    // report everything once.
    this.reported.clear()
    this.reportedAbs.clear()

    const { nodes, relations, alignments = [], pinned = [] } = this.callbacks.getModel()
    this.allNodes = nodes
    this.alignments = alignments
    this.pinnedIds = new Set(pinned)

    const visibleNodes = Object.values(nodes).filter((n) => isVisible(n, nodes))
    if (visibleNodes.length === 0) {
      this.cola = null
      return
    }

    // Which visible nodes are parents (have visible children)?
    const parentIds = new Set<string>()
    for (const n of visibleNodes) {
      if (n.parentId && nodes[n.parentId] && !nodes[n.parentId].collapsed) {
        parentIds.add(n.parentId)
      }
    }

    // Preserve existing cola positions across rebuilds
    const prevPos = new Map<string, { x: number; y: number }>()
    for (const cn of this.colaNodes) {
      prevPos.set(cn.c4id, { x: cn.x, y: cn.y })
    }

    this.colaNodes = []
    this.idToNode.clear()
    this.colaGroups = []
    this.idToGroup.clear()

    // ── Leaf nodes → cola nodes ─────────────────────────────────────────
    const leafNodes = visibleNodes.filter((n) => !parentIds.has(n.id))

    // Build a quick relation index so brand-new nodes can spawn near a
    // connected neighbour (instead of materialising at the origin and
    // flying across the canvas to find their place).
    const neighbourIds = new Map<string, string[]>()
    for (const rel of Object.values(relations)) {
      if (!neighbourIds.has(rel.sourceId)) neighbourIds.set(rel.sourceId, [])
      if (!neighbourIds.has(rel.targetId)) neighbourIds.set(rel.targetId, [])
      neighbourIds.get(rel.sourceId)!.push(rel.targetId)
      neighbourIds.get(rel.targetId)!.push(rel.sourceId)
    }

    for (const n of leafNodes) {
      const w = effectiveWidth(n)
      const h = effectiveHeight(n)

      const prev = prevPos.get(n.id)
      const seed = this.seedPositions.get(n.id)
      let cx: number, cy: number
      if (prev) {
        cx = prev.x
        cy = prev.y
      } else if (seed) {
        // Caller-provided seed (e.g. expand: children spawn at parent's
        // centre so cola can fan them outward instead of teleporting them
        // to a neighbour-average and animating from there).
        cx = seed.x
        cy = seed.y
        this.seedPositions.delete(n.id)
      } else {
        // New node: try to position near average of its connected
        // neighbours' previous cola positions; fall back to its store
        // position (toAbsoluteTopLeft) when no neighbours have positions.
        const neigh = neighbourIds.get(n.id) ?? []
        let sx = 0, sy = 0, count = 0
        for (const nid of neigh) {
          const p = prevPos.get(nid)
          if (p) { sx += p.x; sy += p.y; count++ }
        }
        if (count > 0) {
          // Offset slightly so it doesn't overlap exactly with a neighbour
          cx = sx / count + (Math.random() - 0.5) * 40
          cy = sy / count + (Math.random() - 0.5) * 40
        } else {
          const abs = toAbsoluteTopLeft(n, nodes)
          cx = abs.x + w / 2
          cy = abs.y + h / 2
        }
      }

      // Inflate dimensions by a margin so avoidOverlaps keeps unlinked
      // siblings apart too (not just nodes connected by links).
      const margin = 80
      const cn: ColaNode = { c4id: n.id, x: cx, y: cy, width: w + margin, height: h + margin, realWidth: w, realHeight: h }
      this.colaNodes.push(cn)
      this.idToNode.set(n.id, cn)
    }

    // ── Links ───────────────────────────────────────────────────────────
    // Neighbourhoods for local drags: relations (between visible ends) and containment.
    this.neighbours.clear()
    this.frozen = false
    const link = (a: string, b: string) => {
      if (!this.neighbours.has(a)) this.neighbours.set(a, new Set())
      if (!this.neighbours.has(b)) this.neighbours.set(b, new Set())
      this.neighbours.get(a)!.add(b)
      this.neighbours.get(b)!.add(a)
    }
    for (const n of visibleNodes) if (n.parentId) link(n.id, n.parentId)
    const colaLinks: Link<ColaNode>[] = []
    for (const rel of Object.values(relations)) {
      const src = this.findLeaf(rel.sourceId, visibleNodes)
      const tgt = this.findLeaf(rel.targetId, visibleNodes)
      if (src && tgt && src !== tgt) {
        colaLinks.push({ source: src, target: tgt })
        link(src.c4id, tgt.c4id)
      }
    }

    // ── Build index maps for groups ─────────────────────────────────────
    // webcola requires group leaves/groups as INDICES (numbers), not objects.
    // When leaves are numbers, groups() converts them to objects AND sets
    // .parent = g, which is required for correct rootGroup computation.
    const nodeIndex = new Map<string, number>()
    this.nodeIndexOf.clear()
    this.colaNodes.forEach((cn, i) => { nodeIndex.set(cn.c4id, i); this.nodeIndexOf.set(cn, i) })

    // ── Groups bottom-up (leaf-containers like 'container' first) ──
    // First pass: every parent that cannot nest another parent — a container,
    // a web app, a blueprint — groups its leaf children. Systems, domains and
    // groups nest, so the second pass builds them from their child groups.
    for (const n of visibleNodes) {
      if (!parentIds.has(n.id)) continue
      if (NESTING_TYPES.has(n.type)) continue
      const leafIndices = leafNodes
        .filter((c) => c.parentId === n.id)
        .map((c) => nodeIndex.get(c.id))
        .filter((i) => i !== undefined) as number[]
      if (leafIndices.length > 0) {
        const PAD = 80
        const VIS = 16
        const g: C4Group = { c4id: n.id, leaves: leafIndices as any, padding: PAD, visualShrink: PAD - VIS }
        this.colaGroups.push(g)
        this.idToGroup.set(n.id, g)
      }
    }

    // Build group index map (container groups have been added above)
    const groupIndex = new Map<string, number>()
    this.colaGroups.forEach((g, i) => groupIndex.set(g.c4id, i))

    // ── Outer containers (system / domain / group) bottom-up by depth ───
    // Systems, domains, and groups can nest. Each parent's group references
    // its children's group indices, so children must be added to colaGroups
    // BEFORE their parent. Sort by ancestor depth descending — deepest first.
    const depthCache = new Map<string, number>()
    const visibleNodeMap = new Map(visibleNodes.map(n => [n.id, n] as const))
    const depthOf = (id: string): number => {
      const cached = depthCache.get(id)
      if (cached !== undefined) return cached
      const n = visibleNodeMap.get(id)
      const d = n?.parentId ? depthOf(n.parentId) + 1 : 0
      depthCache.set(id, d)
      return d
    }
    const outerContainerNodes = visibleNodes
      .filter(n => parentIds.has(n.id) && NESTING_TYPES.has(n.type))
      .sort((a, b) => depthOf(b.id) - depthOf(a.id))

    for (const n of outerContainerNodes) {
      const childLeafIndices: number[] = []
      const childGroupIndices: number[] = []
      for (const c of visibleNodes.filter((v) => v.parentId === n.id)) {
        const gi = groupIndex.get(c.id)
        if (gi !== undefined) childGroupIndices.push(gi)
        else {
          const ni = nodeIndex.get(c.id)
          if (ni !== undefined) childLeafIndices.push(ni)
        }
      }
      if (childLeafIndices.length + childGroupIndices.length > 0) {
        // Padding scales with nesting depth so deeply-nested systems still
        // have visual breathing room without exploding outer systems.
        const d = depthOf(n.id)
        const PAD = Math.max(60, 100 - d * 12)
        const VIS = Math.max(12, 20 - d * 2)
        const g: C4Group = {
          c4id: n.id,
          leaves: childLeafIndices.length > 0 ? childLeafIndices as any : undefined,
          groups: childGroupIndices.length > 0 ? childGroupIndices as any : undefined,
          padding: PAD,
          visualShrink: PAD - VIS,
        }
        this.colaGroups.push(g)
        groupIndex.set(n.id, this.colaGroups.length - 1)
        this.idToGroup.set(n.id, g)
      }
    }

    // What each group lays out directly (calm drops push among these).
    this.childrenOf.clear()
    for (const n of visibleNodes) {
      if (!this.idToNode.has(n.id) && !this.idToGroup.has(n.id)) continue
      const level = this.levelOf(n.id)
      const list = this.childrenOf.get(level) ?? []
      list.push(n.id)
      this.childrenOf.set(level, list)
    }

    // ── Create d3adaptor — EXACTLY like smallgroups ──────────────────────
    //
    //   var cola = cola.d3adaptor(d3)
    //       .linkDistance(100)
    //       .avoidOverlaps(true)
    //       .handleDisconnected(false)
    //       .size([width, height]);
    //   cola.nodes(graph.nodes).links(graph.links).groups(graph.groups).start();
    //   cola.on("tick", function () { … });

    const d3Context = { dispatch, timer, drag: d3drag, event: null as any }
    const layout = d3adaptor(d3Context as any)

    layout
      .nodes(this.colaNodes)
      .links(colaLinks)
      .groups(this.colaGroups)
      .size([1800, 1200])
      .avoidOverlaps(true)
      .handleDisconnected(false)
      .linkDistance((link: any) => {
        // ── A: Hierarchical link distance ────────────────────────────────
        // Distance varies by C4 semantics so the physics produces layouts
        // closer to what the radical layout would give:
        //   • siblings inside the same parent          → short  (tight cluster)
        //   • person → system (entry edges)            → long   (push persons up)
        //   • internal ↔ external                      → longer (push externals away)
        //   • internal ↔ internal across systems       → medium
        const s = link.source as ColaNode
        const t = link.target as ColaNode
        const sn = this.allNodes[s.c4id]
        const tn = this.allNodes[t.c4id]
        const baseAvg = Math.max(
          (s.width + t.width) / 2,
          (s.height + t.height) / 2
        )
        if (sn && tn) {
          // Same direct parent: containers inside a system, components inside container
          if (sn.parentId && sn.parentId === tn.parentId) {
            return baseAvg + 40
          }
          const isPerson = sn.type === 'person' || tn.type === 'person'
          const sExt = !!sn.external
          const tExt = !!tn.external
          // External crosses internal boundary → push apart
          if (sExt !== tExt && !isPerson) return baseAvg + 160
          // Person → system (entry edge)
          if (isPerson) return baseAvg + 120
        }
        return baseAvg + 100
      })

    // ── E: Layer separation constraints ──────────────────────────────────
    // Lock the C4 ordering during continuous physics so the radical layout
    // doesn't get scrambled. Only constrain ROOT-LEVEL nodes (children of a
    // group are positioned by their group bounds — adding constraints to
    // them fights avoidOverlaps inside the group).
    //
    //   persons      → strictly above   internals + externals
    //   internals    → strictly left of externals
    //
    // Using cola separation constraints: right.axis - left.axis >= gap
    // Coordinates are CENTERS of inflated rects, so gap accounts for both
    // halves plus desired padding.
    const PERSON_GAP_PX = 80
    const EXT_GAP_PX = 100
    const personIdx: number[] = []
    const internalIdx: number[] = []
    const externalIdx: number[] = []
    this.colaNodes.forEach((cn, i) => {
      const n = this.allNodes[cn.c4id]
      if (!n || n.parentId) return
      if (n.type === 'person') personIdx.push(i)
      else if (n.external) externalIdx.push(i)
      else internalIdx.push(i)
    })
    const constraints: Array<
      | { type: 'separation'; axis: 'x' | 'y'; left: number; right: number; gap: number }
      | { type: 'alignment'; axis: 'x' | 'y'; offsets: Array<{ node: number; offset: number }> }
    > = []
    const halfH = (i: number): number => this.colaNodes[i].height / 2
    const halfW = (i: number): number => this.colaNodes[i].width / 2
    for (const p of personIdx) {
      for (const s of [...internalIdx, ...externalIdx]) {
        constraints.push({
          type: 'separation',
          axis: 'y',
          left: p,
          right: s,
          gap: halfH(p) + halfH(s) + PERSON_GAP_PX,
        })
      }
    }
    for (const i of internalIdx) {
      for (const e of externalIdx) {
        constraints.push({
          type: 'separation',
          axis: 'x',
          left: i,
          right: e,
          gap: halfW(i) + halfW(e) + EXT_GAP_PX,
        })
      }
    }
    // ── F: User alignments ───────────────────────────────────────────────
    // Leaves only: WebCoLa holds them in its own projection, together with
    // overlap removal. An alignment with a group member is projected by the
    // tick handler instead (WebCoLa constraints cannot reference groups).
    this.alignedWith.clear()
    // A line keeps where it ran across rebuilds (an expand, a new node):
    // re-anchoring at the members' new mean would jump it.
    const lineKey = (axis: string, ids: string[]): string => `${axis}:${[...ids].sort().join(',')}`
    const lines = new Map(this.groupAlignments.map((g) => [lineKey(g.axis, g.members.map((m) => m.id)), g.line]))
    this.groupAlignments = []
    this.groupOrders = []
    const member = (id: string): AlignedMember => ({ id, node: this.idToNode.get(id), group: this.idToGroup.get(id) })
    for (const a of alignments) {
      // An ordered line keeps each member after the previous one. Leaves:
      // WebCoLa separation constraints, at the distance overlap removal
      // keeps anyway, so a dragged member pushes the next one ahead of it
      // instead of passing it. With a group: the tick handler.
      const along = alongAxis(a)
      for (const ids of a.orders) {
        const chain = ids.map(member).filter((m) => m.node || m.group)
        if (chain.length < 2) continue
        if (!chain.every((m) => m.node)) { this.groupOrders.push({ along, members: chain }); continue }
        for (let k = 0; k + 1 < chain.length; k++) {
          const left = chain[k].node!
          const right = chain[k + 1].node!
          const half = (cn: ColaNode): number => (along === 'x' ? cn.width : cn.height) / 2
          constraints.push({ type: 'separation', axis: along, left: nodeIndex.get(left.c4id)!, right: nodeIndex.get(right.c4id)!, gap: half(left) + half(right) })
        }
      }
      const members = a.ids.map(member).filter((m) => m.node || m.group)
      if (members.length < 2) continue
      for (const m of members) {
        const set = this.alignedWith.get(m.id) ?? new Set<string>()
        for (const other of members) if (other.id !== m.id) set.add(other.id)
        this.alignedWith.set(m.id, set)
      }
      if (members.every((m) => m.node)) {
        // Line up the boxes as drawn: a leaf may be drawn smaller than the
        // box it takes here (drawnSize), from the same top-left corner.
        const offset = (m: typeof members[number]): number => {
          const drawn = drawnSize(this.allNodes[m.id], false)
          return a.axis === 'x' ? (m.node!.realWidth - drawn.width) / 2 : (m.node!.realHeight - drawn.height) / 2
        }
        // WebCoLa places each member at the first one's position + offset.
        const first = offset(members[0])
        constraints.push({
          type: 'alignment',
          axis: a.axis,
          offsets: members.map((m) => ({ node: nodeIndex.get(m.id)!, offset: offset(m) - first })),
        })
      } else {
        this.groupAlignments.push({
          axis: a.axis,
          members,
          line: lines.get(lineKey(a.axis, members.map((m) => m.id))),
          depth: Math.min(...members.map((m) => depthOf(m.id))),
        })
      }
    }
    // An outer line moves whole groups, and the lines inside them with them
    // (shiftMember); the inner lines then project within.
    this.groupAlignments.sort((a, b) => a.depth - b.depth)
    this.applyPins()

    if (constraints.length > 0) {
      ;(layout as any).constraints(constraints)
    }

    layout.on('tick', () => {
      if (!this._running) return
      this.projectGroupAlignments()
      this.pinFrozen()
      const now = performance.now()
      const heavy = this.lastTickAt > 0 && now - this.lastTickAt > HEAVY_TICK_MS
      this.lastTickAt = now
      if (this.settled()) {
        // Stop the timer; a drag wakes it again (grab/drag → resume()) and
        // a model change rebuilds the layout.
        this.cola?.stop()
        this.resetPace()
        this.emitPositions()
        this.unfreeze()
        this.callbacks.onSettled?.()
        return
      }
      if (this.paceRenders && heavy && ++this.skippedRenders < HEAVY_RENDER_EVERY) return
      this.skippedRenders = 0
      this.emitPositions()
    })

    // First start: heavy bulk iterations to settle the diagram quickly so
    // the user doesn't watch the layout slowly assemble from scratch.
    // Subsequent rebuilds (model edits): NO bulk iterations — let the live
    // d3.timer evolve positions tick-by-tick so changes animate smoothly
    // from current positions to the new equilibrium. Persisting prevPos
    // across rebuilds means newly-added nodes start near their neighbours
    // instead of jumping in from the origin.
    // Large diagrams: no bulk arrangement and no global relaxation. Only nodes
    // that are new since the previous build (added, or shown by an expand)
    // move, with their surroundings; with none, the timer does not start.
    const local = this.colaNodes.length >= LOCAL_PHYSICS_MIN_NODES
    const fresh = local && prevPos.size > 0 ? leafNodes.filter((n) => !prevPos.has(n.id)).map((n) => n.id) : []
    if (fresh.length) this.freezeAllBut(...fresh)
    try {
      if (firstRun && !local) {
        ;(layout as any).start(30, 30, 50, 0, true, true)
      } else {
        ;(layout as any).start(0, 0, 0, 0, !local || fresh.length > 0, false)
      }
    } catch (err) {
      console.error('[cola] start() failed:', err)
    }

    this.cola = layout
    // Nothing to move on a large diagram: it is at rest as built.
    if (local && !fresh.length) this.callbacks.onSettled?.()

    // Restore grab state if rebuild happened during drag
    if (this._grabbedId) {
      for (const leaf of this.leavesOf(this._grabbedId)) leaf.fixed = (leaf.fixed ?? 0) & ~PINNED
      const cn = this.idToNode.get(this._grabbedId)
      if (cn && !this.calm?.moving) cn.fixed = (cn.fixed ?? 0) | 2
    }
    if (this.calm?.moving) this.calm = this.calmDrag(this.calm.id, this.calm.with, this.calm.from, this.calm.delta)
  }

  /** Centre of an alignment member on `axis` as drawn: a leaf's (drawnSize),
   *  a group's box. */
  private memberCentre(m: AlignedMember, axis: 'x' | 'y'): number | undefined {
    if (m.node) {
      const drawn = drawnSize(this.allNodes[m.id], false)
      return axis === 'x'
        ? m.node.x - (m.node.realWidth - drawn.width) / 2
        : m.node.y - (m.node.realHeight - drawn.height) / 2
    }
    const b = (m.group as any)?.bounds
    if (!b) return undefined
    return axis === 'x' ? (b.x + b.X) / 2 : (b.y + b.Y) / 2
  }

  /** True when the grabbed node is this member or inside it. */
  private holdsGrabbed(id: string): boolean {
    for (let cur: string | undefined = this._grabbedId ?? undefined; cur; cur = this.allNodes[cur]?.parentId) {
      if (cur === id) return true
    }
    return false
  }

  /** Moves cola nodes by `d` on `axis`, in WebCoLa's solver state too. */
  private shiftNodes(nodes: ColaNode[], axis: 'x' | 'y', d: number): void {
    const x = (this.cola as { _descent?: { x: number[][] } } | null)?._descent?.x
    const row = axis === 'x' ? 0 : 1
    for (const cn of nodes) {
      cn[axis] += d
      const i = this.colaNodes.indexOf(cn)
      if (x && i >= 0) x[row][i] += d
    }
  }

  /** Moves a group's computed box, and its sub-groups' boxes, by `d`. */
  private shiftBounds(g: C4Group, axis: 'x' | 'y', d: number): void {
    const b = (g as any).bounds
    if (b) {
      if (axis === 'x') { b.x += d; b.X += d } else { b.y += d; b.Y += d }
    }
    for (const child of (g.groups ?? []) as any[]) {
      const cg = typeof child === 'number' ? this.colaGroups[child] : child
      if (cg) this.shiftBounds(cg as C4Group, axis, d)
    }
  }

  /**
   * Holds alignments that have a group member, after each WebCoLa step:
   * every member moves onto the members' mean line, or onto the line of the
   * member being dragged, which the others then follow.
   */
  private projectGroupAlignments(): void {
    for (const a of this.groupAlignments) {
      const centres = a.members.map((m) => this.memberCentre(m, a.axis))
      if (centres.some((c) => c === undefined)) continue
      let held = a.members.findIndex((m) => this.holdsGrabbed(m.id))
      // A pinned member stays: the line runs through it.
      if (held < 0) held = a.members.findIndex((m) => this.pinnedMembers.has(m.id))
      if (held >= 0) a.line = centres[held]!
      else a.line ??= (centres as number[]).reduce((sum, c) => sum + c, 0) / centres.length
      const target = a.line
      a.members.forEach((m, i) => {
        const d = target - centres[i]!
        if (i === held || Math.abs(d) < 0.01) return
        this.shiftMember(m, a.axis, d)
      })
      // Keep the members clear of each other along the line, in the order
      // they stand: left to themselves, WebCoLa would separate two that
      // overlap across the line, which the alignment then undoes, step
      // after step.
      const along = a.axis === 'y' ? 'x' : 'y'
      const standing = a.members
        .map((m) => ({ m, c: this.memberCentre(m, along) ?? 0 }))
        .sort((p, q) => p.c - q.c)
        .map((p) => p.m)
      this.pushApart(standing, along)
    }
    // Ordered lines: the same, in the order asked for.
    for (const o of this.groupOrders) this.pushApart(o.members, o.along)
  }

  /** Pushes each member clear of the previous one along `along`; when the
   *  later one is being dragged, the earlier one gives way instead. */
  private pushApart(members: AlignedMember[], along: 'x' | 'y'): void {
    for (let k = 0; k + 1 < members.length; k++) {
      const prev = members[k]
      const next = members[k + 1]
      const a = this.memberCentre(prev, along)
      const b = this.memberCentre(next, along)
      if (a === undefined || b === undefined) continue
      const deficit = (this.memberExtent(prev, along) + this.memberExtent(next, along)) / 2 - (b - a)
      if (deficit <= 0.01) continue
      if (this.holdsGrabbed(next.id) || (this.pinnedMembers.has(next.id) && !this.pinnedMembers.has(prev.id))) this.shiftMember(prev, along, -deficit)
      else this.shiftMember(next, along, deficit)
    }
  }

  private shiftMember(m: AlignedMember, axis: 'x' | 'y', d: number): void {
    if (m.node) {
      this.shiftNodes([m.node], axis, d)
    } else if (m.group) {
      this.shiftNodes(this.groupLeaves(m.id), axis, d)
      this.shiftBounds(m.group, axis, d)
      // Lines that run inside the group move with it: left where they were,
      // they would pull their members back out of the place the group was
      // moved to, and the group's own line would move it again, every tick.
      for (const a of this.groupAlignments) {
        if (a.axis === axis && a.line !== undefined && a.members.every((x) => this.isInside(x.id, m.id))) a.line += d
      }
    }
  }

  /** True when `id` is a descendant of `ancestorId`. */
  private isInside(id: string, ancestorId: string): boolean {
    for (let cur = this.allNodes[id]?.parentId; cur; cur = this.allNodes[cur]?.parentId) {
      if (cur === ancestorId) return true
    }
    return false
  }

  /** Room a member takes along `axis`, as overlap removal sees it. */
  private memberExtent(m: AlignedMember, axis: 'x' | 'y'): number {
    if (m.node) return axis === 'x' ? m.node.width : m.node.height
    const b = (m.group as any)?.bounds
    if (!b) return 0
    return axis === 'x' ? b.X - b.x : b.Y - b.y
  }

  /**
   * Resolve a relation endpoint to a ColaNode.
   * If the node is directly a cola leaf, return it.
   * If the node is hidden (parent collapsed), walk UP the parent chain
   * until we find a visible cola leaf (the collapsed ancestor).
   */
  private findLeaf(nodeId: string, _visible: C4Node[]): ColaNode | undefined {
    // Direct match — node is a cola leaf
    const direct = this.idToNode.get(nodeId)
    if (direct) return direct

    // Walk UP the parent chain to find a collapsed ancestor that is a cola leaf
    let cur = this.allNodes[nodeId]
    while (cur?.parentId) {
      const parent = this.allNodes[cur.parentId]
      if (!parent) break
      const pLeaf = this.idToNode.get(parent.id)
      if (pLeaf) return pLeaf
      cur = parent
    }
    return undefined
  }

  // ─── Emit positions to store ───────────────────────────────────────────────
  // Reads absolute positions from cola nodes/groups, converts to RF-relative.

  private emitPositions(): void {
    // 1. Collect absolute top-left positions from cola
    const abs: Record<string, { x: number; y: number; width?: number; height?: number }> = {}

    // While the user is dragging a parent (group), ReactFlow moves the
    // parent + its children visually on its own. If we also emit cola
    // positions for them, RF gets two competing position sources every
    // tick and the parent flickers. So compute the set of ids to skip:
    // the grabbed node itself + (if it's a group) all its descendants.
    const skip = new Set<string>()
    for (const grabbedId of this._grabbedId ? [this._grabbedId, ...(this.calm?.with ?? [])] : []) {
      skip.add(grabbedId)
      const grabbedGroup = this.idToGroup.get(grabbedId)
      if (grabbedGroup) {
        const collect = (gid: string) => {
          const g = this.idToGroup.get(gid)
          if (!g) return
          if (g.leaves) {
            for (const leaf of g.leaves as any[]) {
              const cn = typeof leaf === 'number' ? this.colaNodes[leaf] : leaf
              if (cn?.c4id) skip.add(cn.c4id)
            }
          }
          if (g.groups) {
            for (const child of g.groups as any[]) {
              const childGroup = typeof child === 'number' ? this.colaGroups[child] : child
              const childId = (childGroup as C4Group)?.c4id
              if (childId) { skip.add(childId); collect(childId) }
            }
          }
        }
        collect(grabbedId)
      }
    }

    for (const cn of this.colaNodes) {
      if (skip.has(cn.c4id)) continue
      abs[cn.c4id] = { x: cn.x - cn.realWidth / 2, y: cn.y - cn.realHeight / 2 }
    }
    for (const g of this.colaGroups) {
      if (skip.has(g.c4id)) continue
      const b = (g as any).bounds
      if (b) {
        // Shrink the rendered box vs collision box so sibling groups don't
        // share borders. Collision uses bounds at full `padding`; we render
        // at `padding - visualShrink` ≈ a small visible inner padding.
        const s = g.visualShrink ?? 0
        abs[g.c4id] = {
          x: b.x + s,
          y: b.y + s,
          width: (b.X - b.x) - 2 * s,
          height: (b.Y - b.y) - 2 * s,
        }
      }
    }

    // 2. Convert to RF-relative (subtract parent's absolute position)
    const result: Record<string, { x: number; y: number; width?: number; height?: number }> = {}
    for (const [id, pos] of Object.entries(abs)) {
      const c4n = this.allNodes[id]
      if (c4n?.parentId && abs[c4n.parentId]) {
        const p = abs[c4n.parentId]
        result[id] = { x: pos.x - p.x, y: pos.y - p.y, width: pos.width, height: pos.height }
      } else {
        result[id] = pos
      }
    }

    // A calm drag of a leaf whose parent moved (grew left or up): React Flow
    // keeps the leaf's position relative to the parent until the pointer
    // moves again, so report it relative to the parent's new place.
    const grabbed = this.calm && this._grabbedId ? this.idToNode.get(this._grabbedId) : undefined
    const grabbedParent = grabbed ? this.allNodes[grabbed.c4id]?.parentId : undefined
    if (grabbed && grabbedParent && abs[grabbedParent]) {
      const before = this.reportedAbs.get(grabbedParent)
      const p = abs[grabbedParent]
      if (!before || Math.abs(before.x - p.x) > REPORT_PX || Math.abs(before.y - p.y) > REPORT_PX) {
        result[grabbed.c4id] = { x: grabbed.x - grabbed.realWidth / 2 - p.x, y: grabbed.y - grabbed.realHeight / 2 - p.y }
      }
    }
    for (const [id, pos] of Object.entries(abs)) this.reportedAbs.set(id, { x: pos.x, y: pos.y })

    // Report only what moved: with hundreds of nodes most are still, and
    // every reported node costs the main thread a React Flow update.
    const changed: typeof result = {}
    let any = false
    for (const [id, pos] of Object.entries(result)) {
      const last = this.reported.get(id)
      if (last
        && Math.abs(last.x - pos.x) <= REPORT_PX && Math.abs(last.y - pos.y) <= REPORT_PX
        && Math.abs((last.width ?? 0) - (pos.width ?? 0)) <= REPORT_PX
        && Math.abs((last.height ?? 0) - (pos.height ?? 0)) <= REPORT_PX) continue
      this.reported.set(id, pos)
      changed[id] = pos
      any = true
    }
    if (any) this.callbacks.applyPositions(changed)
  }
}

