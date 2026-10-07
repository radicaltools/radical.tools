/**
 * User layout constraints (`LayoutConstraint`): which ones hold on a canvas,
 * and a headless pass that makes a layout satisfy them.
 *
 * Only alignments exist so far: the centres of two or more elements share
 * one coordinate — a row (equal centre y) or a column (equal centre x) —
 * and, when the rule is ordered, keep their order along it.
 * Priorities, highest first: the alignment and its order hold, children stay
 * inside their parents, boxes do not overlap. Overlaps are resolved without
 * breaking an alignment: boxes that carry one move together along its axis,
 * and boxes on one row (column) are pushed apart along it, never past each
 * other. An order broken by a layout is restored by handing the members the
 * places they hold, in the order asked for.
 *
 * The live physics keeps the same rules with WebCoLa alignment constraints
 * (packages/ui/src/layout/liveColaEngine.ts); this pass is for everything
 * without physics: Smart Layout's finalisation, a rule just created, the
 * MCP server.
 */
import { C4Node, LayoutConstraint, NODE_SIZES, PositionMap } from '@radical/common/c4'
import { compoundPadding, drawnSize, isVisible } from './geometry'
import { CHILD_GAP, ROOT_GAP } from './layoutFinalize'

/** One alignment as the layout applies it. `axis` is the coordinate the
 *  members' centres share: 'y' keeps them in a row, 'x' in a column.
 *  `orders` are the ordered rules on this line: member ids whose centres
 *  must increase along the other axis (left to right, top to bottom). */
export interface Alignment {
  axis: 'x' | 'y'
  ids: string[]
  orders: string[][]
}

/** The axis along a line: x along a row, y along a column. */
export function alongAxis(a: Pick<Alignment, 'axis'>): 'x' | 'y' {
  return a.axis === 'y' ? 'x' : 'y'
}

/** Alignment is met once members' centres differ by at most this. */
const TOLERANCE = 0.5
/** Ordered members' centres must be at least this far apart along the line. */
const MIN_STEP = 1
const MAX_ROUNDS = 6

type Box = { x: number; y: number; width: number; height: number }

/** The coordinate a constraint's members share. */
export function alignmentAxis(c: LayoutConstraint): 'x' | 'y' {
  return c.axis === 'horizontal' ? 'y' : 'x'
}

function isAncestor(nodes: Record<string, C4Node>, ancestorId: string, id: string): boolean {
  for (let cur = nodes[id]?.parentId; cur; cur = nodes[cur]?.parentId) {
    if (cur === ancestorId) return true
  }
  return false
}

/**
 * The alignments that hold on a canvas showing `nodes`: members that are
 * not drawn (absent, under a collapsed parent) are skipped, a member that
 * contains another member of its rule is skipped, rules on one axis that
 * share a member merge, and rules left with fewer than two members rest.
 */
export function resolveAlignments(
  constraints: readonly LayoutConstraint[] | undefined,
  nodes: Record<string, C4Node>,
): Alignment[] {
  if (!constraints?.length) return []
  const out: Alignment[] = []
  for (const axis of ['x', 'y'] as const) {
    // Union-find over member ids: rules sharing a member become one line.
    const parent = new Map<string, string>()
    const find = (id: string): string => {
      let root = id
      while (parent.get(root) !== root) root = parent.get(root)!
      parent.set(id, root)
      return root
    }
    const order: string[] = []
    const chains: string[][] = []
    for (const c of constraints) {
      if (c.type !== 'align' || alignmentAxis(c) !== axis) continue
      const drawn = [...new Set(c.nodeIds)].filter((id) => nodes[id] && isVisible(nodes[id], nodes))
      const members = drawn.filter((id) => !drawn.some((other) => other !== id && isAncestor(nodes, id, other)))
      if (members.length < 2) continue
      for (const id of members) {
        if (!parent.has(id)) { parent.set(id, id); order.push(id) }
      }
      for (const id of members.slice(1)) parent.set(find(id), find(members[0]))
      if (c.ordered) chains.push(members)
    }
    const lines = new Map<string, string[]>()
    for (const id of order) {
      const root = find(id)
      const line = lines.get(root)
      if (line) line.push(id)
      else lines.set(root, [id])
    }
    for (const [root, ids] of lines) {
      out.push({ axis, ids, orders: chains.filter((chain) => find(chain[0]) === root) })
    }
  }
  return out
}

/** How far a layout is from its alignments, in pixels: the largest spread
 *  of member centres across a line, or of a member behind the one it should
 *  follow. */
export function alignmentError(
  nodes: Record<string, C4Node>,
  positions: PositionMap,
  alignments: readonly Alignment[],
): number {
  const boxes = boxesOf(nodes, positions)
  const parents = parentIdsOf(nodes)
  let worst = 0
  for (const a of alignments) {
    const centres = a.ids.map((id) => centre(nodes, boxes, parents, id, a.axis))
    worst = Math.max(worst, Math.max(...centres) - Math.min(...centres))
    const along = alongAxis(a)
    for (const chain of a.orders) {
      const cs = chain.map((id) => centre(nodes, boxes, parents, id, along))
      for (let k = 0; k + 1 < cs.length; k++) worst = Math.max(worst, cs[k] - cs[k + 1] + MIN_STEP)
    }
  }
  return worst
}


function boxesOf(nodes: Record<string, C4Node>, positions: PositionMap): Record<string, Box> {
  const out: Record<string, Box> = {}
  for (const [id, n] of Object.entries(nodes)) {
    const p = positions[id]
    out[id] = { x: p?.x ?? n.x, y: p?.y ?? n.y, width: p?.width ?? n.width, height: p?.height ?? n.height }
  }
  return out
}

/** Ids of the nodes that have a child in `nodes`. */
function parentIdsOf(nodes: Record<string, C4Node>): Set<string> {
  const out = new Set<string>()
  for (const n of Object.values(nodes)) if (n.parentId && nodes[n.parentId]) out.add(n.parentId)
  return out
}

/** Absolute centre of `id` on `axis` as the canvas draws it (boxes are
 *  parent-relative; a parent's box is what is drawn, a leaf may be drawn
 *  smaller than its box — drawnSize). */
function centre(
  nodes: Record<string, C4Node>, boxes: Record<string, Box>, parents: Set<string>, id: string, axis: 'x' | 'y',
): number {
  const b = boxes[id]
  const drawn = parents.has(id) ? b : drawnSize(nodes[id], false)
  let c = axis === 'x' ? b.x + drawn.width / 2 : b.y + drawn.height / 2
  for (let p = nodes[id]?.parentId; p && boxes[p]; p = nodes[p]?.parentId) c += boxes[p][axis]
  return c
}

/**
 * Makes `positions` (parent-relative, as Smart Layout produces them) satisfy
 * `alignments`. `nodes` is the graph as drawn (projectToVisibleGraph);
 * nodes missing from `positions` start where they are. Returns a box for
 * every node. Without alignments the input is returned as is.
 */
export function enforceAlignments(
  nodes: Record<string, C4Node>,
  positions: PositionMap,
  alignments: readonly Alignment[],
): PositionMap {
  if (!alignments.length) return positions
  const boxes = boxesOf(nodes, positions)
  const parents = parentIdsOf(nodes)

  const parentOf = (id: string): string | undefined => {
    const p = nodes[id]?.parentId
    return p && nodes[p] ? p : undefined
  }
  const byParent = new Map<string | undefined, string[]>()
  for (const id of Object.keys(nodes)) {
    const p = parentOf(id)
    const list = byParent.get(p)
    if (list) list.push(id)
    else byParent.set(p, [id])
  }
  const depth = (id: string): number => {
    let d = 0
    for (let p = parentOf(id); p; p = parentOf(p)) d++
    return d
  }
  const parentIds = [...byParent.keys()].filter((p): p is string => !!p).sort((a, b) => depth(b) - depth(a))

  // Each alignment's members plus all their ancestors: the boxes that carry it.
  const carriers = alignments.map((a) => {
    const set = new Set<string>()
    for (const id of a.ids) for (let cur: string | undefined = id; cur; cur = parentOf(cur)) set.add(cur)
    return set
  })

  const snap = (): void => {
    for (const a of alignments) {
      const centres = a.ids.map((id) => centre(nodes, boxes, parents, id, a.axis))
      const target = centres.reduce((s, c) => s + c, 0) / centres.length
      a.ids.forEach((id, i) => { boxes[id][a.axis] += target - centres[i] })
      // Out of order: the members take the places they hold, in order.
      const along = alongAxis(a)
      for (const chain of a.orders) {
        const cs = chain.map((id) => centre(nodes, boxes, parents, id, along))
        if (cs.every((c, k) => k === 0 || c - cs[k - 1] >= MIN_STEP)) continue
        const slots = [...cs].sort((x, y) => x - y)
        for (let k = 1; k < slots.length; k++) slots[k] = Math.max(slots[k], slots[k - 1] + MIN_STEP)
        chain.forEach((id, k) => { boxes[id][along] += slots[k] - cs[k] })
      }
    }
  }

  /** Refit a parent around its children without moving them on the canvas:
   *  the parent's box moves, the children's relative positions follow. */
  const fit = (pid: string): void => {
    const children = byParent.get(pid) ?? []
    if (!children.length) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const id of children) {
      const b = boxes[id]
      minX = Math.min(minX, b.x)
      minY = Math.min(minY, b.y)
      maxX = Math.max(maxX, b.x + b.width)
      maxY = Math.max(maxY, b.y + b.height)
    }
    const parent = nodes[pid]
    const pad = compoundPadding(parent.type)
    const dx = minX - pad.side
    const dy = minY - pad.top
    const p = boxes[pid]
    p.x += dx
    p.y += dy
    for (const id of children) { boxes[id].x -= dx; boxes[id].y -= dy }
    const min = NODE_SIZES[parent.type as keyof typeof NODE_SIZES] ?? { width: 0, height: 0 }
    p.width = Math.max(maxX - minX + 2 * pad.side, min.width)
    p.height = Math.max(maxY - minY + pad.top + pad.bottom, min.height)
  }

  /** Centre of `id` as drawn, in its parent's frame. */
  const drawnMid = (id: string, axis: 'x' | 'y'): number => {
    const b = boxes[id]
    const drawn = parents.has(id) ? b : drawnSize(nodes[id], false)
    return b[axis] + (axis === 'x' ? drawn.width : drawn.height) / 2
  }

  /** Push siblings apart without breaking an alignment (see file header). */
  const separate = (ids: string[], gap: number): void => {
    const level = new Set(ids)
    // Per axis: boxes that must move together (one alignment, wholly inside
    // this level) and boxes that may not move (an alignment reaching
    // outside this parent).
    const cluster = { x: new Map<string, string[]>(), y: new Map<string, string[]>() }
    const locked = { x: new Set<string>(), y: new Set<string>() }
    alignments.forEach((a, i) => {
      const here = ids.filter((id) => carriers[i].has(id))
      if (!here.length) return
      const inside = a.ids.every((m) => {
        for (let cur: string | undefined = m; cur; cur = parentOf(cur)) if (level.has(cur)) return true
        return false
      })
      if (!inside) { for (const id of here) locked[a.axis].add(id); return }
      const merged = new Set<string>(here)
      for (const id of here) for (const other of cluster[a.axis].get(id) ?? []) merged.add(other)
      const list = [...merged]
      for (const id of list) cluster[a.axis].set(id, list)
    })
    const group = (id: string, axis: 'x' | 'y'): string[] => cluster[axis].get(id) ?? [id]
    const movable = (id: string, axis: 'x' | 'y'): boolean => !group(id, axis).some((m) => locked[axis].has(m))
    const move = (id: string, axis: 'x' | 'y', d: number): void => {
      for (const m of group(id, axis)) boxes[m][axis] += d
    }

    for (let pass = 0; pass < 200; pass++) {
      let moved = false
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = boxes[ids[i]]
          const b = boxes[ids[j]]
          const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) + gap
          if (ox <= 0) continue
          const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) + gap
          if (oy <= 0) continue
          let best: { axis: 'x' | 'y'; depth: number } | null = null
          for (const [axis, depth] of [['x', ox], ['y', oy]] as const) {
            if (group(ids[i], axis).includes(ids[j])) continue
            if (!movable(ids[i], axis) && !movable(ids[j], axis)) continue
            if (!best || depth < best.depth) best = { axis, depth }
          }
          if (!best) continue
          const { axis, depth } = best
          // Siblings share a frame, so drawn centres compare directly; using
          // them keeps the order the canvas shows (and snap() fixed).
          const dir = drawnMid(ids[i], axis) <= drawnMid(ids[j], axis) ? 1 : -1
          const mi = movable(ids[i], axis)
          const mj = movable(ids[j], axis)
          const share = mi && mj ? depth / 2 : depth
          if (mi) move(ids[i], axis, -dir * share)
          if (mj) move(ids[j], axis, dir * share)
          moved = true
        }
      }
      if (!moved) return
    }
  }

  const tidy = (): void => {
    for (const pid of parentIds) {
      separate(byParent.get(pid)!, CHILD_GAP)
      fit(pid)
    }
    separate(byParent.get(undefined) ?? [], ROOT_GAP)
  }

  for (let round = 0; round < MAX_ROUNDS; round++) {
    snap()
    tidy()
    if (alignmentError(nodes, boxes, alignments) <= TOLERANCE) break
  }
  // Rare nested cases (a parent and its own child on different lines) may
  // still be off: alignment wins over tidiness.
  if (alignmentError(nodes, boxes, alignments) > TOLERANCE) {
    snap()
    for (const pid of parentIds) fit(pid)
  }
  return boxes
}
