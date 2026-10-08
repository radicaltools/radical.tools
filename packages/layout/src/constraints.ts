/**
 * User layout constraints (`LayoutConstraint`): which ones hold on a canvas,
 * and a headless pass that makes a layout satisfy them.
 *
 * Rules are alignments: the centres of two or more elements share one
 * coordinate — a row (equal centre y) or a column (equal centre x) — and,
 * when the rule is ordered, keep their order along it. A grid is a set of
 * ordered rows and columns whose lines also keep their order (rank).
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
import { C4Node, GridConstraint, LayoutConstraint, NODE_SIZES, PositionMap, gridCells } from '@radical/common/c4'
import { compoundPadding, drawnSize, isVisible } from './geometry'
import { CHILD_GAP, ROOT_GAP } from './layoutFinalize'

/** One alignment as the layout applies it. `axis` is the coordinate the
 *  members' centres share: 'y' keeps them in a row, 'x' in a column.
 *  `orders` are the ordered rules on this line: member ids whose centres
 *  must increase along the other axis (left to right, top to bottom).
 *  `rank` places the line among others of one grid: lines with the same key
 *  run in `index` order (rows top to bottom, columns left to right). */
export interface Alignment {
  axis: 'x' | 'y'
  ids: string[]
  orders: string[][]
  rank?: { key: string; index: number }
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

/** A rule as the lines it keeps (a grid: its rows and its columns). */
interface Line {
  axis: 'x' | 'y'
  ids: string[]
  ordered: boolean
  rank?: Alignment['rank']
}

function linesOf(c: LayoutConstraint): Line[] {
  if (c.type === 'align') return [{ axis: c.axis === 'horizontal' ? 'y' : 'x', ids: c.nodeIds, ordered: !!c.ordered }]
  if (c.type === 'pin') return []
  const { rows, columns } = gridCells(c)
  return [
    ...rows.map((ids, index): Line => ({ axis: 'y', ids, ordered: true, rank: { key: `${c.id}:rows`, index } })),
    ...columns.map((ids, index): Line => ({ axis: 'x', ids, ordered: true, rank: { key: `${c.id}:columns`, index } })),
  ]
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
    const ranked: Array<{ id: string; rank: NonNullable<Alignment['rank']> }> = []
    for (const line of constraints.flatMap(linesOf)) {
      if (line.axis !== axis) continue
      const drawn = [...new Set(line.ids)].filter((id) => nodes[id] && isVisible(nodes[id], nodes))
      const members = drawn.filter((id) => !drawn.some((other) => other !== id && isAncestor(nodes, id, other)))
      if (members.length < 2) continue
      for (const id of members) {
        if (!parent.has(id)) { parent.set(id, id); order.push(id) }
      }
      for (const id of members.slice(1)) parent.set(find(id), find(members[0]))
      if (line.ordered) chains.push(members)
      if (line.rank) ranked.push({ id: members[0], rank: line.rank })
    }
    const lines = new Map<string, string[]>()
    for (const id of order) {
      const root = find(id)
      const line = lines.get(root)
      if (line) line.push(id)
      else lines.set(root, [id])
    }
    for (const [root, ids] of lines) {
      const rank = ranked.find((r) => find(r.id) === root)?.rank
      out.push({ axis, ids, orders: chains.filter((chain) => find(chain[0]) === root), ...(rank ? { rank } : {}) })
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
  for (const lines of rankedLines(alignments)) {
    const at = lines.map((a) => lineAt(nodes, boxes, parents, a))
    for (let k = 0; k + 1 < at.length; k++) worst = Math.max(worst, at[k] - at[k + 1] + MIN_STEP)
  }
  return worst
}

/** Lines of one grid, rows or columns, in rank order. */
function rankedLines(alignments: readonly Alignment[]): Alignment[][] {
  const byKey = new Map<string, Alignment[]>()
  for (const a of alignments) {
    if (!a.rank) continue
    const list = byKey.get(a.rank.key)
    if (list) list.push(a)
    else byKey.set(a.rank.key, [a])
  }
  return [...byKey.values()].map((list) => list.sort((p, q) => p.rank!.index - q.rank!.index)).filter((list) => list.length > 1)
}

/** Where a line runs: its members' mean centre on its axis. */
function lineAt(nodes: Record<string, C4Node>, boxes: Record<string, Box>, parents: Set<string>, a: Alignment): number {
  return a.ids.reduce((sum, id) => sum + centre(nodes, boxes, parents, id, a.axis), 0) / a.ids.length
}


/**
 * Ids of sibling boxes (one frame: parent-relative, as drawn) in the order
 * they stand: left to right for a row, top to bottom for a column, and in
 * reading order for a grid — boxes whose centres fall within a box's half
 * height of a row's first box join that row, rows top to bottom, each left
 * to right.
 */
export function standingOrder(
  boxes: ReadonlyArray<Box & { id: string }>, layout: 'horizontal' | 'vertical' | 'grid',
): string[] {
  const cx = (b: Box): number => b.x + b.width / 2
  const cy = (b: Box): number => b.y + b.height / 2
  if (layout === 'horizontal') return [...boxes].sort((a, b) => cx(a) - cx(b)).map((b) => b.id)
  if (layout === 'vertical') return [...boxes].sort((a, b) => cy(a) - cy(b)).map((b) => b.id)
  const rows: Array<Array<Box & { id: string }>> = []
  for (const b of [...boxes].sort((p, q) => cy(p) - cy(q))) {
    const row = rows[rows.length - 1]
    if (row && cy(b) - cy(row[0]) <= Math.max(row[0].height, b.height) / 2) row.push(b)
    else rows.push([b])
  }
  return rows.flatMap((row) => row.sort((p, q) => cx(p) - cx(q)).map((b) => b.id))
}

/** Space between a grid's cells when it is laid out. */
const GRID_GAP = 60

/**
 * Lays a grid out in even cells: each column as wide as its widest member,
 * each row as tall as its tallest, `GRID_GAP` apart, from the top-left
 * corner of the members' current extent. `nodes` is the graph as drawn
 * (projectToVisibleGraph); a member not drawn leaves its cell empty.
 * Returns a box for every node, the members moved; run enforceAlignments
 * after it to make room around the grid.
 */
export function arrangeGrid(nodes: Record<string, C4Node>, positions: PositionMap, grid: Pick<GridConstraint, 'columns' | 'nodeIds'>): PositionMap {
  const boxes = boxesOf(nodes, positions)
  const parents = parentIdsOf(nodes)
  const { rows, columns } = gridCells(grid)
  const drawn = (id: string): boolean => !!nodes[id] && isVisible(nodes[id], nodes)
  const size = (id: string): { width: number; height: number } => (parents.has(id) ? boxes[id] : drawnSize(nodes[id], false))
  const widths = columns.map((col) => Math.max(0, ...col.filter(drawn).map((id) => size(id).width)))
  const heights = rows.map((row) => Math.max(0, ...row.filter(drawn).map((id) => size(id).height)))
  const members = grid.nodeIds.filter(drawn)
  if (!members.length) return boxes
  const left = Math.min(...members.map((id) => centre(nodes, boxes, parents, id, 'x') - size(id).width / 2))
  const top = Math.min(...members.map((id) => centre(nodes, boxes, parents, id, 'y') - size(id).height / 2))
  const cols = columns.length
  grid.nodeIds.forEach((id, i) => {
    if (!drawn(id)) return
    const r = Math.floor(i / cols)
    const k = i % cols
    const x = left + widths.slice(0, k).reduce((s, w) => s + w + GRID_GAP, 0) + widths[k] / 2
    const y = top + heights.slice(0, r).reduce((s, h) => s + h + GRID_GAP, 0) + heights[r] / 2
    boxes[id].x += x - centre(nodes, boxes, parents, id, 'x')
    boxes[id].y += y - centre(nodes, boxes, parents, id, 'y')
  })
  return boxes
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
    // A grid's rows (columns) out of order: the rows take the places the
    // rows hold, in order, whole — moving single cells would break them.
    for (const lines of rankedLines(alignments)) {
      const at = lines.map((a) => lineAt(nodes, boxes, parents, a))
      if (at.every((c, k) => k === 0 || c - at[k - 1] >= MIN_STEP)) continue
      const slots = [...at].sort((p, q) => p - q)
      for (let k = 1; k < slots.length; k++) slots[k] = Math.max(slots[k], slots[k - 1] + MIN_STEP)
      lines.forEach((a, k) => { for (const id of a.ids) boxes[id][a.axis] += slots[k] - at[k] })
    }
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
