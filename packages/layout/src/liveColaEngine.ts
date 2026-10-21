/**
 * The live WebCoLa engine. Studio's LiveColaLayout (@radical/ui
 * liveColaLayout.ts) runs it in a Web Worker (liveCola.worker.ts), or on the
 * main thread where workers are not available.
 *
 * Live (dynamic) WebCoLa layout — exact same pattern as the official
 * "smallgroups" example:
 *   https://ialab.it.monash.edu/webcola/examples/smallgroups.html
 *
 * Key: d3adaptor(d3) with .start() (keepRunning=true) starts a d3.timer
 * that calls tick() each frame. When stress < threshold the timer stops.
 * User drag calls resume() to restart the timer.
 *
 * A diagram that has a layout keeps it: the engine moves only what is new
 * (an added element, the children an expand shows), with its surroundings,
 * and what a drag moves. It arranges a whole diagram in two cases only: one
 * that has no layout yet, and relaxLayout(), the candidate Smart Layout
 * tries.
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
/** Parent types that can hold other parents; every other parent is a flat group.
 *  A state machine holds compound states, and a compound state holds states;
 *  a process holds steps, and a step holds steps. */
const NESTING_TYPES: ReadonlySet<string> = new Set(['system', 'domain', 'group', 'state-machine', 'state', 'process', 'step'])

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
/** Every other run stops after this long too, moving or not: what is new
 *  has found its place long before (a few hundred milliseconds after an
 *  add, an expand or a push drag), and a run still going is one that does
 *  not converge. On the sample's All elements an add into a container
 *  freed records related to the governance hubs that then drifted, and
 *  swapped places, for good (21 px a second after 40 s). The diagram
 *  stands where the run ends. */
const MAX_RUN_MS = 8000

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

/** An element related only to open groups is drawn to them until its drawn
 *  box is this far from theirs (holdByGroups): about where a relation
 *  between two leaves keeps them. */
const GROUP_HOLD_GAP = 240
/** Share of the way still to go that such an element covers per step, and
 *  the most it moves in one. */
const GROUP_HOLD_RATE = 0.2
const GROUP_HOLD_STEP = 40

export interface LiveColaCallbacks {
  getModel: () => LiveColaModel
  /** Only the nodes that moved or resized since they were last reported. */
  applyPositions: (positions: LiveColaPositions) => void
  /** The layout came to rest (after its last applyPositions). */
  onSettled?: () => void
}

/** A node is reported again once it moved or resized by more than this. */
const REPORT_PX = 0.5

/** The physics is local: rebuilds (open, view switch, undo, Smart Layout)
 *  keep the positions they get, and new nodes move only their nearest
 *  LOCAL_DRAG_SIZE nodes by relation and containment steps (hubs would
 *  otherwise pull in most of the graph within two steps); the rest stays
 *  frozen until the layout rests. Relaxing a whole diagram moves every
 *  element of one Smart Layout arranged (by hundreds of pixels on a dozen
 *  nodes), and mostly to a layout that scores worse. */
const LOCAL_DRAG_SIZE = 40
/** Below this many nodes the physics may still move a whole diagram: to
 *  arrange one that has no layout yet (the first start), for the candidate
 *  Smart Layout tries (relaxLayout), and during a push drag, which asks for
 *  it. From here up that takes minutes (about 95 s on 450 nodes) and
 *  spreads the diagram over tens of thousands of pixels, so a push drag
 *  is a calm one (grab). */
export const WHOLE_DIAGRAM_MAX_NODES = 150
/** The nearest the physics places a child to the top of its open parent's
 *  frame: the least padding a group shows inside its frame (12), plus half
 *  of the margin overlap removal keeps around a leaf (80), with a little to
 *  spare for rounding. Smart Layout leaves 120 there; once the physics has
 *  moved a container's children, this is what they keep. The canvas must
 *  not draw a child lower than the model says for standing above the
 *  layouts' 120: it would show one place and save another. */
export const LIVE_CHILD_TOP_MIN = 50
/** Steps relaxLayout takes at most. Counted, not timed: the same diagram
 *  gets the same layout on every machine. */
const RELAX_MAX_STEPS = 600
/** cola's `fixed` is a bit mask (2 = dragged); this bit marks frozen nodes. */
const FROZEN = 8
/** And this one pinned nodes (PinConstraint): held like frozen ones, for good. */
const PINNED = 16

type Box = { x: number; X: number; y: number; Y: number }

/**
 * How far `b` moves along `axis` to stand CALM_GAP clear of `a`: away from
 * `a`'s centre, past `a`'s far edge. Not by the overlap alone: a container
 * a drag grew past the whole of `b` (or one dropped inside it) still
 * covered it after that much.
 */
function clearing(a: Box, b: Box, axis: 'x' | 'y'): number {
  const ahead = (axis === 'x' ? a.X - b.x : a.Y - b.y) + CALM_GAP
  const behind = (axis === 'x' ? b.X - a.x : b.Y - a.y) + CALM_GAP
  return ahead <= behind ? ahead : -behind
}

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
   * One-shot seed positions for the next rebuild(). Used when a
   * caller wants a re-appearing node (e.g. children of a just-expanded
   * parent) to start at a specific absolute centre coordinate, overriding
   * the default "spawn near connected neighbours" heuristic. That rebuild
   * clears them all, applied or not.
   */
  private seedPositions = new Map<string, { x: number; y: number }>()
  /** Pace bookkeeping (see HEAVY_TICK_MS and SETTLE_PX). */
  private lastTickAt = 0
  /** When the run started, or a drag began or ended (MAX_RUN_MS, MAX_PROJECTED_RUN_MS). */
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
  /**
   * Open groups still drawn with the frame the model has, and where their
   * leaves stood when the layout was built. A layout leaves more room
   * around a container's children than the bounds here do (120 px above
   * them, where the physics keeps about 60), so reporting every group's own
   * bounds re-framed every open container of a laid-out diagram at the
   * first drag or added element, wherever it was. A group keeps the model's
   * frame until one of its leaves moves against the others (frameOf).
   */
  private keptFrames = new Map<string, { frame: Box; leaves: { node: ColaNode; x: number; y: number }[] }>()
  /** Leaves no link holds, with the open groups they are related to (holdByGroups). */
  private heldByGroups: { leaf: ColaNode; groupIds: string[] }[] = []
  /** The separations WebCoLa keeps, by node index (roomFor). */
  private separations: { axis: 'x' | 'y'; left: number; right: number; gap: number }[] = []
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
  /** Set while relax() steps without a timer: nothing in that run may depend on the clock. */
  private untimed = false

  constructor(callbacks: LiveColaCallbacks, options: LiveColaEngineOptions = {}) {
    this.callbacks = callbacks
    this.paceRenders = options.paceRenders ?? false
  }

  /**
   * Provide an absolute-centre seed position for a node, applied on the next
   * rebuild() if the node was not present in the previous cola pass (i.e.
   * a re-appearing child after expand). That rebuild drops every seed,
   * used or not.
   */
  seedPosition(id: string, x: number, y: number): void {
    this.seedPositions.set(id, { x, y })
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Start the live layout.
   * @param skipBulk True when the diagram has positions (loaded from a
   *   file): they are kept as they are. False for a diagram that has none
   *   yet: below WHOLE_DIAGRAM_MAX_NODES nodes, the first start arranges it.
   */
  start(skipBulk = false): void {
    if (this._running) return
    this._running = true
    if (skipBulk) {
      // Another document, or this one read again: nothing cached holds,
      // nor do seeds given while the layout was stopped.
      this.forget()
      this.seedPositions.clear()
      this.rebuild('rest')
      this._bulkDone = true
    } else if (this._bulkDone && this.cola) {
      // Resume an existing layout WITHOUT calling cola.resume(): that
      // method sets alpha=0.1 which immediately runs a synchronous
      // convergence (kick) and visibly shifts nodes. We just re-arm
      // _running so the live tick handler resumes emitting positions
      // when cola is woken up by a drag (liveGrab/liveDrag → dragStart
      // + resume in webcola).
      // No-op otherwise — cola sits idle and positions stay put.
    } else {
      this.rebuild('first')
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

  /** The model changed (an element added, removed, expanded, collapsed):
   *  what is new finds its place, the rest stays. */
  invalidate(): void {
    if (this._running) this.rebuild('local')
  }

  /**
   * The store's positions were replaced wholesale (view switch, undo,
   * milestone, Smart Layout): they are taken as they are, and nothing moves
   * until an element is added or dragged. `free` names elements that should
   * settle from where they were put (the members of an alignment just
   * made, snapped onto their line): they move, with their surroundings.
   */
  reset(free: string[] = []): void {
    this.forget()
    if (this._running) this.rebuild(free.length ? 'local' : 'rest', free)
  }

  /**
   * Relaxes the whole diagram from the positions it has, in one go (no
   * timer), reporting where everything comes to rest. For relaxLayout.
   * False when the diagram is too large for that.
   */
  relax(): boolean {
    this.forget()
    this._running = true
    this.untimed = true
    this.rebuild('whole')
    const run = this.cola as { tick(): boolean; _alpha: number; _running: boolean } | null
    const small = this.colaNodes.length < WHOLE_DIAGRAM_MAX_NODES
    if (run && small) {
      // What cola.resume() sets, without the timer it starts.
      run._alpha = 0.1
      run._running = true
      for (let step = 0; step < RELAX_MAX_STEPS && this.cola === run && !run.tick(); step++) { /* stepping */ }
      this.emitPositions()
    }
    this.untimed = false
    this._running = false
    return !!run && small
  }

  /**
   * Relaxes the whole diagram from the positions it has, on the timer, so
   * a canvas can show it settle. For a diagram that is laid out and relaxed
   * on purpose every time it is drawn (the metamodel editor's); a model's
   * canvas does not do this (see the top of this file).
   */
  relaxLive(): void {
    this.forget()
    this._running = true
    this.rebuild('whole')
    this.cola?.resume()
  }

  /** Drops cola's cached positions: the next rebuild takes every node's
   *  from the model. */
  private forget(): void {
    this.colaNodes = []
    this.idToNode.clear()
    this.colaGroups = []
    this.idToGroup.clear()
    // The positions are new: so are the lines the alignments run along.
    this.groupAlignments = []
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
    // From WHOLE_DIAGRAM_MAX_NODES up a push drag freed the nodes nearest by
    // relation and froze the rest: those pulled toward frozen ones far away
    // (by thousands of pixels), never came to rest, and lay on top of them.
    // It is a calm drag there: what is held moves, and the drop clears the
    // overlaps it leaves.
    if (mode === 'push' && this.colaNodes.length >= WHOLE_DIAGRAM_MAX_NODES) mode = 'calm'
    if (mode === 'calm') {
      // Held while the physics may still run, until it moves (calmDrag).
      for (const leaf of this.leavesOf(nodeId)) Layout.dragStart(leaf)
      this.calm = this.calmDrag(nodeId, withIds, abs ?? { x: rfX, y: rfY }, { x: 0, y: 0 })
      return
    }
    // The physics starts when it moves (pushStart): a ⌘/Ctrl-click, which
    // React Flow reports as a drag that goes nowhere, woke it, and it
    // rearranged the whole view, saved and with no undo step.
    this.calm = null
    this.pushFrom = { x: rfX, y: rfY, moved: false }
  }

  /** A push drag moves: the held element is freed from its pin and the
   *  physics runs. */
  private pushStart(nodeId: string): void {
    for (const leaf of this.leavesOf(nodeId)) leaf.fixed = (leaf.fixed ?? 0) & ~PINNED
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
      this.followCarriers([this.calm.id, ...this.calm.with])
      this.keepOrders([this.calm.id, ...this.calm.with])
      this.emitPositions()
      return
    }
    if (this.pushFrom && !this.pushFrom.moved) {
      if (Math.abs(rfX - this.pushFrom.x) <= REPORT_PX && Math.abs(rfY - this.pushFrom.y) <= REPORT_PX) return
      this.pushFrom.moved = true
      this.pushStart(nodeId)
    }
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
      if (calm.id === nodeId) {
        this.clearOverlaps([...moved, ...calm.partners])
        // What the drop pushed inside a group on a line grew the group, as
        // the drag did: the line follows it, and every line through a group
        // holds as drawn (a 1 px drag of a component left its container
        // 2.5 px off its row, and the next load snapped the row and refit
        // every container).
        this.followCarriers(moved)
        this.projectGroupAlignments(false)
      }
      this.emitPositions(true)
      this.callbacks.onSettled?.()
      return
    }
    if (this.pushFrom && !this.pushFrom.moved) {
      // A click: nothing was started (pushStart).
      this.pushFrom = null
      return
    }
    const cn = this.idToNode.get(nodeId)
    if (cn) {
      // The drop is where the pointer left it. The solver only pulls a
      // dragged leaf toward the pointer, against everything in its way, and
      // the pin below would hold it wherever that pull had got to.
      if (this.pushFrom?.moved && cn.px !== undefined && cn.py !== undefined) {
        const held = (this.cola as { _descent?: { x: number[][] } } | null)?._descent?.x
        const i = this.nodeIndexOf.get(cn) ?? -1
        cn.x = cn.px
        cn.y = cn.py
        if (held && i >= 0) { held[0][i] = cn.px; held[1][i] = cn.py }
      }
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

  /**
   * Lines through a group that holds a dragged element: the group's box
   * grows and shrinks with it, so its centre moves, and the rest of the line
   * keeps to it as it would if the group itself were dragged. Without this a
   * child's drag pulled its container off the line.
   */
  private followCarriers(moved: string[]): void {
    const inside = (id: string, ancestor: string): boolean => {
      for (let p = this.allNodes[id]?.parentId; p; p = this.allNodes[p]?.parentId) {
        if (p === ancestor) return true
      }
      return false
    }
    const centre = (id: string, axis: 'x' | 'y'): number | undefined => {
      const b = this.boxOf(id)
      if (!b) return undefined
      return axis === 'x' ? (b.x + b.X) / 2 : (b.y + b.Y) / 2
    }
    let shifted = false
    for (const a of this.alignments) {
      // A line through a dragged element moves with it (calmDrag partners).
      if (a.ids.some((m) => moved.includes(m))) continue
      const carrier = a.ids.find((m) => moved.some((id) => inside(id, m)))
      if (!carrier) continue
      const line = centre(carrier, a.axis)
      if (line === undefined) continue
      for (const other of a.ids) {
        if (other === carrier || moved.some((id) => inside(id, other))) continue
        const c = centre(other, a.axis)
        if (c === undefined || Math.abs(line - c) < 0.01) continue
        this.translate(other, a.axis, line - c)
        shifted = true
      }
    }
    if (shifted) this.refreshBounds()
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
    return g ? this.frameOf(g) : undefined
  }

  /**
   * A group's frame as the canvas draws it. The model's, while nothing in
   * the group has moved since the layout was built (keptFrames); moved with
   * the group when all of it moved alike; else the group's bounds here,
   * drawn smaller than the room overlap removal keeps (visualShrink), so
   * that sibling groups do not share a border.
   */
  private frameOf(g: C4Group): Box | undefined {
    const b = (g as any).bounds as Box | undefined
    if (!b || !Number.isFinite(b.x)) return undefined
    const kept = this.keptFrames.get(g.c4id)
    if (kept) {
      // Still as built, or moved as one (a drag of the group, a push)?
      const first = kept.leaves[0]
      const dx = first ? first.node.x - first.x : 0
      const dy = first ? first.node.y - first.y : 0
      const rigid = kept.leaves.every((l) => Math.abs(l.node.x - l.x - dx) <= REPORT_PX && Math.abs(l.node.y - l.y - dy) <= REPORT_PX)
      if (rigid) {
        // However little: a frame left behind by a third of a pixel showed
        // a row through it off its line by that much.
        if (dx !== 0 || dy !== 0) {
          kept.frame = { x: kept.frame.x + dx, X: kept.frame.X + dx, y: kept.frame.y + dy, Y: kept.frame.Y + dy }
          for (const l of kept.leaves) { l.x = l.node.x; l.y = l.node.y }
        }
        return kept.frame
      }
      this.keptFrames.delete(g.c4id)
    }
    const s = g.visualShrink ?? 0
    const box = { x: b.x + s, X: b.X - s, y: b.y + s, Y: b.Y - s }
    // A child group keeps the frame the layout gave it until something in
    // it moves, and that frame may reach past the bounds WebCoLa takes from
    // its leaves (room above its first child): this frame holds it, the
    // child no nearer its top than LIVE_CHILD_TOP_MIN. Framed tighter, a
    // drop inside a sibling left it on this one's header, saved above that,
    // and the canvas drew it lower after a reload than the file said.
    const margin = (g.padding ?? 0) - s
    for (const id of this.childrenOf.get(g.c4id) ?? []) {
      const child = this.idToGroup.get(id)
      const inner = child && this.frameOf(child)
      if (!inner) continue
      box.x = Math.min(box.x, inner.x - margin)
      box.X = Math.max(box.X, inner.X + margin)
      box.y = Math.min(box.y, inner.y - LIVE_CHILD_TOP_MIN)
      box.Y = Math.max(box.Y, inner.Y + margin)
    }
    return box
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
   * it instead. What still covers another when the pushes run out
   * (CALM_MAX_PUSHES) goes beside the rest (clearLeftovers): a drop leaves
   * nothing overlapping.
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
    while (pending.size) {
      const level = [...pending.keys()].sort((a, b) => depth(b) - depth(a))[0]
      const movers = pending.get(level)!
      pending.delete(level)
      const queue = [...movers]
      const moved = new Set(movers)
      while (queue.length && budget > 0) {
        const a = queue.shift()!
        const A = this.boxOf(a)
        if (!A) continue
        for (const b of this.childrenOf.get(level) ?? []) {
          if (b === a || (movers.has(a) && movers.has(b))) continue
          const B = this.boxOf(b)
          if (!B) continue
          const ox = Math.min(A.X, B.X) - Math.max(A.x, B.x) + CALM_GAP
          const oy = Math.min(A.Y, B.Y) - Math.max(A.y, B.y) + CALM_GAP
          if (ox <= 0 || oy <= 0) continue
          const sx = clearing(A, B, 'x')
          const sy = clearing(A, B, 'y')
          const preferred = Math.abs(sx) <= Math.abs(sy) ? 'x' : 'y'
          // One pushed onto a dropped one moves off it again.
          const axis = movers.has(b) ? null : this.pushAxis(b, preferred)
          if (axis) {
            this.translate(b, axis, axis === 'x' ? sx : sy)
            queue.push(b)
            moved.add(b)
          } else {
            // Lines hold b on both axes, or b was dropped: a moves off it,
            // then looks again.
            const back = this.pushAxis(a, preferred)
            if (!back) continue
            this.translate(a, back, -(back === 'x' ? sx : sy))
            queue.push(a)
            moved.add(a)
            budget--
            break
          }
          if (--budget <= 0) break
        }
      }
      this.clearLeftovers(level, movers, moved)
      // The group grew or moved with what is in it: it pushes its neighbours.
      if (level) {
        this.refreshBounds()
        push(level)
      }
    }
    this.refreshBounds()
  }

  /**
   * The end of a calm drop's pushes at one level: an element that moved
   * there and still covers a sibling (the pushes ran out, or went round in
   * circles) goes below all of them, or to their right when a line holds
   * it up and down; of a dropped one and another, the other goes. One that
   * lines hold on both axes stays.
   */
  private clearLeftovers(level: string, movers: Set<string>, moved: Set<string>): void {
    const kids = this.childrenOf.get(level) ?? []
    const covers = (a: Box, b: Box): boolean =>
      Math.min(a.X, b.X) - Math.max(a.x, b.x) > REPORT_PX && Math.min(a.Y, b.Y) - Math.max(a.y, b.y) > REPORT_PX
    const stuck = new Set<string>()
    for (let round = 0; round <= kids.length; round++) {
      let stray: string | undefined
      for (const t of moved) {
        const T = this.boxOf(t)
        if (!T) continue
        for (const k of kids) {
          if (k === t || (movers.has(k) && movers.has(t))) continue
          const K = this.boxOf(k)
          if (!K || !covers(T, K)) continue
          const which = movers.has(t) ? k : t
          if (!stuck.has(which)) { stray = which; break }
        }
        if (stray) break
      }
      if (!stray) return
      const S = this.boxOf(stray)!
      const others = kids.filter((k) => k !== stray).map((k) => this.boxOf(k)).filter((b): b is Box => !!b)
      const axis = this.pushAxis(stray, 'y')
      if (axis === 'y') this.translate(stray, 'y', Math.max(...others.map((b) => b.Y)) + CALM_GAP - S.y)
      else if (axis === 'x') this.translate(stray, 'x', Math.max(...others.map((b) => b.X)) + CALM_GAP - S.x)
      else stuck.add(stray)
      moved.add(stray)
    }
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
    // relax() counts its steps instead (RELAX_MAX_STEPS).
    if (this.untimed) return false
    const now = performance.now()
    if (!this.runStartedAt) this.runStartedAt = now
    const projected = this.groupAlignments.length > 0 || this.groupOrders.length > 0
    return now - this.runStartedAt >= (projected ? MAX_PROJECTED_RUN_MS : MAX_RUN_MS)
  }

  /**
   * Builds the WebCoLa layout from the model. `run` says what may move:
   * 'first' arranges a diagram that has no layout yet (small ones only),
   * 'local' moves the nodes that are new since the previous build and
   * those named in `free`, with their surroundings, 'rest' moves nothing,
   * 'whole' leaves everything free (relax, relaxLive).
   */
  private rebuild(run: 'first' | 'local' | 'rest' | 'whole', free: string[] = []): void {
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
      this.seedPositions.clear()
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
    // The open containers of the build before this one.
    const prevGroups = new Set(this.colaGroups.map((g) => g.c4id))

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
    // Seeds are for this build only. One for a node it does not show (an
    // expand on a view that does not draw the children) would otherwise
    // wait for the next build that shows it, maybe after a reload or on
    // another view, and put the node where it stood back then.
    this.seedPositions.clear()

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

    // ── Outer containers (system / domain / group / state) bottom-up by depth ───
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
    // When the physics arranges a diagram (one with no layout yet, the
    // candidate Smart Layout tries) it imposes this order. On a diagram
    // that has a layout it only keeps the order where the layout has it:
    // imposed there, the first element the physics was free to move was
    // thrown across the diagram to satisfy it (a system dropped after a
    // push drag on a grid with a person in a lower row ended up below the
    // whole grid, 3 400 px away; an actor a layout had put beside its
    // system, above everything).
    const imposing = run === 'first' || run === 'whole'
    const holds = (left: number, right: number, axis: 'x' | 'y', gap: number): boolean =>
      imposing || this.colaNodes[right][axis] - this.colaNodes[left][axis] >= gap - REPORT_PX
    for (const p of personIdx) {
      for (const s of [...internalIdx, ...externalIdx]) {
        const gap = halfH(p) + halfH(s) + PERSON_GAP_PX
        if (holds(p, s, 'y', gap)) constraints.push({ type: 'separation', axis: 'y', left: p, right: s, gap })
      }
    }
    for (const i of internalIdx) {
      for (const e of externalIdx) {
        const gap = halfW(i) + halfW(e) + EXT_GAP_PX
        if (holds(i, e, 'x', gap)) constraints.push({ type: 'separation', axis: 'x', left: i, right: e, gap })
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

    // ── G: Elements only open groups hold ────────────────────────────────
    // A relation that ends on an open group is no link: WebCoLa links
    // leaves, and a group has none of its own. An element whose relations
    // all end that way has nothing keeping it by the diagram, and stays
    // behind when the rest moves; the tick handler holds it (holdByGroups).
    // On the canvas only: inside a group, the group holds it. Not one the
    // user aligned: it stays on its line.
    this.separations = constraints.filter((c) => c.type === 'separation')
    this.heldByGroups = []
    const linked = new Set<ColaNode>(colaLinks.flatMap((l) => [l.source as ColaNode, l.target as ColaNode]))
    const groupsOf = new Map<ColaNode, Set<string>>()
    for (const rel of Object.values(relations)) {
      for (const [id, groupId] of [[rel.sourceId, rel.targetId], [rel.targetId, rel.sourceId]]) {
        const leaf = this.idToNode.get(id)
        if (!leaf || linked.has(leaf) || nodes[id].parentId || this.alignedWith.has(id) || !this.idToGroup.has(groupId)) continue
        if (!groupsOf.has(leaf)) groupsOf.set(leaf, new Set())
        groupsOf.get(leaf)!.add(groupId)
      }
    }
    for (const [leaf, groupIds] of groupsOf) this.heldByGroups.push({ leaf, groupIds: [...groupIds] })

    if (constraints.length > 0) {
      ;(layout as any).constraints(constraints)
    }

    layout.on('tick', () => {
      if (!this._running) return
      this.projectGroupAlignments()
      this.holdByGroups()
      this.pinFrozen()
      const now = performance.now()
      const heavy = this.lastTickAt > 0 && now - this.lastTickAt > HEAVY_TICK_MS
      this.lastTickAt = now
      if (this.settled()) {
        // Stop the timer; a drag wakes it again (grab/drag → resume()) and
        // a model change rebuilds the layout.
        this.cola?.stop()
        this.resetPace()
        // relax() reports where its steps end (RELAX_MAX_STEPS), as before.
        this.emitPositions(!this.untimed)
        this.unfreeze()
        this.callbacks.onSettled?.()
        return
      }
      if (this.paceRenders && heavy && ++this.skippedRenders < HEAVY_RENDER_EVERY) return
      this.skippedRenders = 0
      this.emitPositions()
    })

    // A diagram with no layout yet: heavy bulk iterations, so the user does
    // not watch it assemble from scratch, then the timer relaxes it. Large
    // ones are left to Smart Layout.
    // Otherwise the layout stands. Only nodes that are new since the
    // previous build (added, or shown by an expand) move, with their
    // surroundings; with none, the timer does not start. Keeping prevPos
    // across rebuilds means a new node starts near its neighbours instead
    // of jumping in from the origin.
    const arrange = run === 'first' && this.colaNodes.length < WHOLE_DIAGRAM_MAX_NODES
    // A container that was collapsed since is a box now where it was a frame
    // around others, and is not new: it shrinks where it stands. Taken for
    // a new element, it freed the 40 elements nearest to it, reaching into
    // other containers whose frames and other children stayed fixed (a
    // model nested four levels deep never came to rest after one collapse).
    const fresh = run === 'local' && prevPos.size > 0
      ? leafNodes.filter((n) => !prevPos.has(n.id) && !prevGroups.has(n.id)).map((n) => n.id)
      : []
    for (const id of free) if (this.idToNode.has(id) || this.idToGroup.has(id)) fresh.push(id)
    if (fresh.length) this.freezeAllBut(...fresh)
    // WebCoLa's start spreads the leaves of a row or column it is told to
    // align (Projection's makeFeasible: each at least the previous one's
    // width further along, from centre to centre), once, outside its
    // solver. On a diagram that keeps its layout that moved a row's
    // members on every build, unreported, and the next drag or drop showed
    // them there, out of their container. Such a build starts from where
    // everything stands; the overlaps it may keep are the solver's to undo.
    const standing = !arrange && run !== 'whole' ? this.colaNodes.map((cn) => ({ cn, x: cn.x, y: cn.y })) : []
    try {
      if (arrange) {
        ;(layout as any).start(30, 30, 50, 0, true, true)
      } else {
        ;(layout as any).start(0, 0, 0, 0, fresh.length > 0, false)
      }
    } catch (err) {
      console.error('[cola] start() failed:', err)
    }
    const descent = (layout as unknown as { _descent?: { x: number[][] } })._descent?.x
    for (const [i, { cn, x, y }] of standing.entries()) {
      if (cn.x === x && cn.y === y) continue
      cn.x = x
      cn.y = y
      if (descent) { descent[0][i] = x; descent[1][i] = y }
    }

    this.cola = layout
    // A diagram that has a layout: its open groups keep the frames it has.
    this.keptFrames.clear()
    if (run === 'rest' || run === 'local') {
      this.refreshBounds()
      for (const g of this.colaGroups) {
        const n = nodes[g.c4id]
        const b = (g as any).bounds as Box | undefined
        if (!n || !b || !Number.isFinite(b.x)) continue
        const at = toAbsoluteTopLeft(n, nodes)
        this.keptFrames.set(g.c4id, {
          frame: { x: at.x, X: at.x + n.width, y: at.y, Y: at.y + n.height },
          leaves: this.groupLeaves(g.c4id).map((node) => ({ node, x: node.x, y: node.y })),
        })
      }
    }
    // Nothing to move: it is at rest as built.
    if (!arrange && !fresh.length && run !== 'whole') this.callbacks.onSettled?.()

    // Restore grab state if rebuild happened during drag (a push drag that
    // has not moved has none yet: pushStart)
    if (this._grabbedId && !(this.pushFrom && !this.pushFrom.moved)) {
      for (const leaf of this.leavesOf(this._grabbedId)) leaf.fixed = (leaf.fixed ?? 0) & ~PINNED
      const cn = this.idToNode.get(this._grabbedId)
      if (cn && !this.calm?.moving) cn.fixed = (cn.fixed ?? 0) | 2
    }
    if (this.calm?.moving) this.calm = this.calmDrag(this.calm.id, this.calm.with, this.calm.from, this.calm.delta)
  }

  /** Centre of an alignment member on `axis` as drawn: a leaf's (drawnSize),
   *  a group's box; with `framed`, the group's frame as drawn and saved
   *  (frameOf), which its box here need not be (a frame kept from the
   *  layout, room above a child group). */
  private memberCentre(m: AlignedMember, axis: 'x' | 'y', framed = false): number | undefined {
    if (m.node) {
      const drawn = drawnSize(this.allNodes[m.id], false)
      return axis === 'x'
        ? m.node.x - (m.node.realWidth - drawn.width) / 2
        : m.node.y - (m.node.realHeight - drawn.height) / 2
    }
    const b = framed ? m.group && this.frameOf(m.group) : (m.group as any)?.bounds
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
   * Draws each element that only open groups hold (heldByGroups) toward
   * them, after each WebCoLa step, until it stands GROUP_HOLD_GAP away. It
   * moves through free room only, straight or along what is in its way, so
   * nothing else is pushed and a diagram at rest stays at rest. One that is
   * dragged, pinned or frozen stays where it is.
   */
  private holdByGroups(): void {
    for (const { leaf, groupIds } of this.heldByGroups) {
      if (leaf.fixed) continue
      const box = this.boxOf(leaf.c4id)
      if (!box) continue
      let pullX = 0
      let pullY = 0
      for (const groupId of groupIds) {
        const g = this.boxOf(groupId)
        if (!g) continue
        const dx = g.x > box.X ? g.x - box.X : g.X < box.x ? g.X - box.x : 0
        const dy = g.y > box.Y ? g.y - box.Y : g.Y < box.y ? g.Y - box.y : 0
        const gap = Math.hypot(dx, dy)
        if (gap <= GROUP_HOLD_GAP) continue
        pullX += (dx / gap) * (gap - GROUP_HOLD_GAP)
        pullY += (dy / gap) * (gap - GROUP_HOLD_GAP)
      }
      const pull = Math.hypot(pullX, pullY)
      if (pull < SETTLE_PX) continue
      const step = Math.min(pull * GROUP_HOLD_RATE, GROUP_HOLD_STEP) / pull
      for (const [dx, dy] of [[pullX * step, pullY * step], [pullX * step, 0], [0, pullY * step]]) {
        if (Math.hypot(dx, dy) < SETTLE_PX || !this.roomFor(leaf, leaf.x + dx, leaf.y + dy)) continue
        this.placeLeaf(leaf, leaf.x + dx, leaf.y + dy)
        // WebCoLa ends its run once its own layout has converged, which it
        // may have: it does not know of this move. One more step.
        const run = this.cola as { _alpha?: number } | null
        if (run && !((run._alpha ?? 0) >= 0.1)) run._alpha = 0.1
        break
      }
    }
  }

  /** True when a leaf on the canvas, moved to centre (x, y), keeps clear of
   *  the other elements there and comes no nearer than its separations allow. */
  private roomFor(leaf: ColaNode, x: number, y: number): boolean {
    const i = this.nodeIndexOf.get(leaf)
    for (const c of this.separations) {
      if (c.left !== i && c.right !== i) continue
      const moved = (j: number): number => (j !== i ? this.colaNodes[j][c.axis] : c.axis === 'x' ? x : y)
      const apart = moved(c.right) - moved(c.left)
      if (apart < c.gap && apart < this.colaNodes[c.right][c.axis] - this.colaNodes[c.left][c.axis]) return false
    }
    // Boxes as overlap removal keeps them apart; touching is clear.
    const l = x - leaf.width / 2 + SETTLE_PX
    const r = x + leaf.width / 2 - SETTLE_PX
    const t = y - leaf.height / 2 + SETTLE_PX
    const b = y + leaf.height / 2 - SETTLE_PX
    for (const id of this.childrenOf.get('') ?? []) {
      if (id === leaf.c4id) continue
      const cn = this.idToNode.get(id)
      const o = cn
        ? { x: cn.x - cn.width / 2, X: cn.x + cn.width / 2, y: cn.y - cn.height / 2, Y: cn.y + cn.height / 2 }
        : (this.idToGroup.get(id) as any)?.bounds
      if (o && l < o.X && r > o.x && t < o.Y && b > o.y) return false
    }
    return true
  }

  /**
   * Holds alignments that have a group member, after each WebCoLa step:
   * every member moves onto the members' mean line, or onto the line of the
   * member being dragged, which the others then follow. `apart`: and they
   * are kept clear of each other along it, as overlap removal sees them
   * (not after a calm drop, which moves nothing to make room).
   */
  private projectGroupAlignments(apart = true): void {
    // Frozen leaves where they are held first (the step just taken pulled
    // them on their springs): a group's frame is read from its leaves, and
    // one read off a pulled leaf is no longer the frame the layout gave it.
    if (this.groupAlignments.length) this.pinFrozen()
    for (const a of this.groupAlignments) {
      // The line runs through the frames as drawn: through the groups'
      // boxes here, it showed and saved them off it, and the next load
      // snapped them onto it and refit every container.
      const centres = a.members.map((m) => this.memberCentre(m, a.axis, true))
      if (centres.some((c) => c === undefined)) continue
      let held = a.members.findIndex((m) => this.holdsGrabbed(m.id))
      // A pinned member stays: the line runs through it.
      if (held < 0) held = a.members.findIndex((m) => this.pinnedMembers.has(m.id))
      // After a calm drop the line runs where its members are now: one
      // kept from the physics' last run may be far from there.
      if (held >= 0) a.line = centres[held]!
      else if (!apart || a.line === undefined) a.line = (centres as number[]).reduce((sum, c) => sum + c, 0) / centres.length
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
      if (apart) this.pushApart(standing, along)
    }
    // Ordered lines: the same, in the order asked for.
    if (apart) for (const o of this.groupOrders) this.pushApart(o.members, o.along)
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

  /** `exact`: where a run or a drop ends, every change is reported, however
   *  small. Changes under REPORT_PX left the canvas and the saved file up
   *  to half a pixel off what the layout had: a group just off its row by
   *  that much was snapped onto it, and every container refit, on the next
   *  load. */
  private emitPositions(exact = false): void {
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
      const frame = this.frameOf(g)
      if (frame) abs[g.c4id] = { x: frame.x, y: frame.y, width: frame.X - frame.x, height: frame.Y - frame.y }
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
      const within = exact ? 0 : REPORT_PX
      if (last
        && Math.abs(last.x - pos.x) <= within && Math.abs(last.y - pos.y) <= within
        && Math.abs((last.width ?? 0) - (pos.width ?? 0)) <= within
        && Math.abs((last.height ?? 0) - (pos.height ?? 0)) <= within) continue
      this.reported.set(id, pos)
      changed[id] = pos
      any = true
    }
    if (any) this.callbacks.applyPositions(changed)
  }
}

/**
 * Where the live physics brings a whole diagram from the positions it has:
 * what a canvas showed after every layout while the physics still relaxed
 * small diagrams, and now a candidate Smart Layout scores against its own.
 * Positions are relative to the parent, groups come with their size. Null
 * for a diagram of WHOLE_DIAGRAM_MAX_NODES nodes or more.
 */
export function relaxLayout(model: LiveColaModel): LiveColaPositions | null {
  const positions: LiveColaPositions = {}
  const engine = new LiveColaEngine({
    getModel: () => model,
    applyPositions: (moved) => {
      for (const [id, pos] of Object.entries(moved)) {
        const at = (positions[id] ??= { x: pos.x, y: pos.y })
        at.x = pos.x
        at.y = pos.y
        // A leaf is reported without a size: it keeps the one it has.
        if (pos.width != null) at.width = pos.width
        if (pos.height != null) at.height = pos.height
      }
    },
  })
  return engine.relax() ? positions : null
}
