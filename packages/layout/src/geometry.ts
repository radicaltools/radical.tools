/**
 * Shared node-geometry helpers used across the layout algorithms.
 *
 * Previously duplicated (with subtle drift) across colaLayout.ts,
 * liveColaLayout.ts and radicalLayout.ts: the first two fell back to
 * NODE_SIZES when a node's width/height was missing, but radicalLayout's
 * copy didn't — one of the ten Smart Layout ensemble candidates would
 * silently mis-size such a node while the others handled it correctly.
 * Consolidated here so every caller shares one (correct) definition.
 */
import { C4Node, C4Relation, COLLAPSED_HEIGHT, COLLAPSED_WIDTH, NODE_SIZES, isContainerType, landscapeSlot } from '@radical/common/c4'

export function effectiveWidth(n: C4Node): number {
  if (isContainerType(n.type) && n.collapsed) return COLLAPSED_WIDTH[n.type]
  return n.width ?? NODE_SIZES[n.type].width
}

export function effectiveHeight(n: C4Node): number {
  if (isContainerType(n.type) && n.collapsed) return COLLAPSED_HEIGHT[n.type]
  return n.height ?? NODE_SIZES[n.type].height
}

/** Record types the canvas always draws at their type's size. */
const FIXED_SIZE_TYPES: ReadonlySet<string> = new Set(['adr', 'fitness-fn', 'need', 'requirement', 'scenario', 'mockup', 'pseudostate', 'event', 'entity'])

/** True for a record type the canvas always draws at its type's size. */
export function isFixedSizeType(type: string): boolean {
  return FIXED_SIZE_TYPES.has(type)
}

/**
 * The size the canvas draws `n` at, by the rule deriveRFNodes applies:
 * record types at their type's size, a collapsed container or one with no
 * child on the canvas at its collapsed size. The layout engines place the
 * stored size; alignments line up what is drawn.
 */
export function drawnSize(n: C4Node, hasChildren: boolean): { width: number; height: number } {
  if (FIXED_SIZE_TYPES.has(n.type)) return NODE_SIZES[n.type]
  if (isContainerType(n.type) && (n.collapsed || !hasChildren)) {
    return { width: COLLAPSED_WIDTH[n.type], height: COLLAPSED_HEIGHT[n.type] }
  }
  return { width: n.width, height: n.height }
}

/** A node is visible if none of its ancestors are collapsed. */
export function isVisible(node: C4Node, allNodes: Record<string, C4Node>): boolean {
  if (!node.parentId) return true
  const parent = allNodes[node.parentId]
  if (!parent) return true
  if (parent.collapsed) return false
  return isVisible(parent, allNodes)
}

/**
 * Space a compound node keeps around its children: the header plus a
 * two-line label on top, a plain margin on the other sides. Shared by the
 * layout pipeline and the store's fitParentToChildren so the size Smart
 * Layout scores is the size that ends up on the canvas.
 */
export function compoundPadding(type: string): { top: number; side: number; bottom: number } {
  const margin = type === 'container' || type === 'webapp' ? 20 : 30
  return { top: 120, side: margin, bottom: margin }
}

/**
 * The size a compound node takes to wrap its children (boxes in the
 * parent's own coordinates, at their effective size), never smaller than
 * its type's default size. The store's fitParentToChildren measures the
 * children for the active view; fitAncestors measures them headlessly.
 */
export function fittedParentSize(
  parent: C4Node,
  children: Array<{ x: number; y: number; width: number; height: number }>,
): { width: number; height: number } {
  const pad = compoundPadding(parent.type)
  let maxRight = 0
  let maxBottom = 0
  for (const child of children) {
    maxRight = Math.max(maxRight, child.x + child.width)
    maxBottom = Math.max(maxBottom, child.y + child.height)
  }
  return {
    width: Math.max(maxRight + pad.side, NODE_SIZES[parent.type].width),
    height: Math.max(maxBottom + pad.bottom, NODE_SIZES[parent.type].height),
  }
}

/** Refits `startId` (when it is a compound node) and then every ancestor
 *  above it to wrap their children. Mutates `nodes`; collapsed and
 *  childless nodes keep their size. For callers without a canvas. */
export function fitAncestors(nodes: Record<string, C4Node>, startId: string | undefined): void {
  const seen = new Set<string>()
  let cur = startId ? nodes[startId] : undefined
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    const parentId = cur.id
    const children = Object.values(nodes).filter((n) => n.parentId === parentId)
    if (isContainerType(cur.type) && !cur.collapsed && children.length > 0) {
      const size = fittedParentSize(cur, children.map((c) => ({ x: c.x, y: c.y, width: effectiveWidth(c), height: effectiveHeight(c) })))
      cur.width = size.width
      cur.height = size.height
    }
    cur = cur.parentId ? nodes[cur.parentId] : undefined
  }
}

/** Where a new node goes before any layout runs: inside its parent below
 *  the header, right of the last sibling; at the root, right of every root
 *  node. Positions are relative to the parent, like C4Node.x/y. */
export function placeNewNode(nodes: Record<string, C4Node>, parentId: string | undefined): { x: number; y: number } {
  const parent = parentId ? nodes[parentId] : undefined
  const siblings = Object.values(nodes).filter((n) => (n.parentId ?? undefined) === (parent?.id ?? undefined))
  const right = Math.max(...siblings.map((n) => n.x + effectiveWidth(n)))
  if (!parent) return { x: siblings.length ? right + 80 : 0, y: 0 }
  const pad = compoundPadding(parent.type)
  return { x: siblings.length ? right + 20 : pad.side, y: pad.top }
}

/** A place under `parentId` (the root when undefined) clear of the
 *  siblings that `counts` accepts: right of them and top-aligned with them,
 *  or below the parent's header when there are none. Relative to the
 *  parent, like C4Node.x/y. */
export function placeBesideSiblings(
  nodes: Record<string, C4Node>,
  parentId: string | undefined,
  counts: (sibling: C4Node) => boolean = () => true,
): { x: number; y: number } {
  const parent = parentId ? nodes[parentId] : undefined
  const siblings = Object.values(nodes).filter((s) => (s.parentId ?? undefined) === (parent?.id ?? undefined) && counts(s))
  if (siblings.length === 0) {
    const pad = parent ? compoundPadding(parent.type) : { top: 0, side: 0 }
    return { x: pad.side, y: pad.top }
  }
  return {
    x: Math.max(...siblings.map((s) => s.x + effectiveWidth(s))) + (parent ? 20 : 80),
    y: Math.min(...siblings.map((s) => s.y)),
  }
}

/**
 * Gives the nodes a canvas has no place for a place on it. `nodes` hold the
 * canvas's positions for every node it knows (`positions`, its own map); a
 * node added on another canvas is still where that one had it, relative to
 * a parent that is laid out differently here: outside its frame, or on a
 * sibling. Each such node goes right of the siblings the canvas has placed,
 * top-aligned with them, and its ancestors are refit. What is inside a node
 * placed this way keeps its place in it. Only nodes in `shown` (the ones a
 * view lists) are placed, when given. Mutates `nodes`; returns the ids it
 * placed. A canvas with no positions at all has not been laid out and is
 * left as it is.
 */
export function placeUnplaced(
  nodes: Record<string, C4Node>,
  positions: Record<string, unknown> | undefined,
  shown?: Set<string>,
): string[] {
  if (!positions || Object.keys(positions).length === 0) return []
  const known = (id: string): boolean => id in positions
  const depth = (n: C4Node): number => {
    let d = 0
    const seen = new Set<string>([n.id])
    for (let cur = n.parentId ? nodes[n.parentId] : undefined; cur && !seen.has(cur.id); cur = cur.parentId ? nodes[cur.parentId] : undefined) {
      seen.add(cur.id)
      d++
    }
    return d
  }
  const unplaced = Object.values(nodes)
    // Inside a parent that is itself new here, a node moves with it.
    .filter((n) => !known(n.id) && (!shown || shown.has(n.id)) && (!n.parentId || !nodes[n.parentId] || known(n.parentId)))
    // Deepest first: a parent has grown for what is new inside it before
    // its own level is looked at.
    .sort((a, b) => depth(b) - depth(a) || (a.id < b.id ? -1 : 1))
  const waiting = new Set(unplaced.map((n) => n.id))
  for (const node of unplaced) {
    const at = placeBesideSiblings(nodes, node.parentId, (s) => s.id !== node.id && !waiting.has(s.id) && (!shown || shown.has(s.id)))
    node.x = at.x
    node.y = at.y
    waiting.delete(node.id)
    fitAncestors(nodes, node.parentId)
  }
  return unplaced.map((n) => n.id)
}

/**
 * The top-left corner for a box of `size` as near `center` as there is room:
 * clear of every box in `taken` by `gap`. Tried on rings around the centre,
 * nearest first; with no room within reach, right of everything.
 */
export function freeSpotNear(
  taken: ReadonlyArray<{ x: number; y: number; width: number; height: number }>,
  size: { width: number; height: number },
  center: { x: number; y: number },
  gap = 60,
): { x: number; y: number } {
  const fits = (x: number, y: number): boolean => taken.every((b) =>
    x + size.width + gap <= b.x || b.x + b.width + gap <= x || y + size.height + gap <= b.y || b.y + b.height + gap <= y)
  const start = { x: center.x - size.width / 2, y: center.y - size.height / 2 }
  const step = 80
  for (let ring = 0; ring <= 40; ring++) {
    const spots: Array<{ x: number; y: number }> = []
    if (ring === 0) spots.push(start)
    for (let k = -ring; k <= ring && ring > 0; k++) {
      spots.push({ x: start.x + k * step, y: start.y - ring * step }, { x: start.x + k * step, y: start.y + ring * step })
      if (k !== -ring && k !== ring) spots.push({ x: start.x - ring * step, y: start.y + k * step }, { x: start.x + ring * step, y: start.y + k * step })
    }
    spots.sort((a, b) => Math.hypot(a.x - start.x, a.y - start.y) - Math.hypot(b.x - start.x, b.y - start.y))
    for (const s of spots) if (fits(s.x, s.y)) return s
  }
  const right = taken.length ? Math.max(...taken.map((b) => b.x + b.width)) : start.x
  return { x: right + gap, y: start.y }
}

/**
 * The ghosts of removed elements (Changes on branch, a milestone compared)
 * on a canvas: they come with the place the base gave them, relative to a
 * parent that may be laid out differently here (All elements' place on a
 * view), so outside its frame or on a sibling. A ghost keeps its place when
 * that lies inside its parent's frame and clear of the siblings the canvas
 * shows; else it takes the free place inside the frame nearest to it, and
 * when the frame has none, the place below the siblings. At the root it
 * keeps clear of the other root elements. What is inside a ghost moves with
 * it. Only the ghosts move, frames keep their size. `shown`: the nodes the
 * view draws, when it does not draw every one. Returns `nodes`, or a copy
 * with the ghosts moved.
 */
export function placeGhosts(
  nodes: Record<string, C4Node>,
  ghostIds: ReadonlySet<string>,
  shown?: ReadonlySet<string>,
): Record<string, C4Node> {
  const drawn = (id: string): boolean => !!nodes[id] && (!shown || shown.has(id))
  const parents = new Set(Object.values(nodes).filter((n) => drawn(n.id) && n.parentId).map((n) => n.parentId!))
  const box = (n: C4Node) => ({ x: n.x, y: n.y, ...drawnSize(n, parents.has(n.id)) })
  // A ghost inside another one moves with it.
  const ghosts = [...ghostIds].filter((id) => drawn(id) && !(nodes[id].parentId && ghostIds.has(nodes[id].parentId!)))
  let out = nodes
  const placed = new Set<string>()
  for (const id of ghosts) {
    const ghost = out[id]
    // In a container the view does not draw: drawn where the canvas puts it.
    if (ghost.parentId && nodes[ghost.parentId] && !drawn(ghost.parentId)) continue
    const size = drawnSize(ghost, parents.has(id))
    const taken = Object.values(out)
      .filter((s) => s.id !== id && (s.parentId ?? undefined) === (ghost.parentId ?? undefined) && drawn(s.id) && (!ghostIds.has(s.id) || placed.has(s.id)))
      .map(box)
    const parent = ghost.parentId ? out[ghost.parentId] : undefined
    const at = parent ? placeInFrame(parent, size, taken, ghost) : placeAtRoot(size, taken, ghost)
    placed.add(id)
    if (at.x === ghost.x && at.y === ghost.y) continue
    if (out === nodes) out = { ...nodes }
    out[id] = { ...ghost, ...at }
  }
  return out
}

/** Gap between a ghost and the siblings around it, inside a frame. */
const GHOST_GAP = 20

type Box = { x: number; y: number; width: number; height: number }

const clearOf = (taken: Box[], x: number, y: number, size: { width: number; height: number }, gap: number): boolean =>
  taken.every((b) => x + size.width + gap <= b.x || b.x + b.width + gap <= x || y + size.height + gap <= b.y || b.y + b.height + gap <= y)

/** Where a ghost of `size` goes inside `parent`'s frame, nearest to `want`. */
function placeInFrame(parent: C4Node, size: { width: number; height: number }, taken: Box[], want: { x: number; y: number }): { x: number; y: number } {
  const pad = compoundPadding(parent.type)
  const minX = pad.side, maxX = parent.width - pad.side - size.width
  const minY = pad.top, maxY = parent.height - pad.bottom - size.height
  const fits = (x: number, y: number): boolean => x >= minX && x <= maxX && y >= minY && y <= maxY && clearOf(taken, x, y, size, GHOST_GAP)
  if (fits(want.x, want.y)) return { x: want.x, y: want.y }
  // Every 10 px from one edge of the room to the other, the far edge included.
  const steps = (min: number, max: number): number[] => {
    const out: number[] = []
    for (let v = min; v < max; v += 10) out.push(v)
    if (max >= min) out.push(max)
    return out
  }
  let best: { x: number; y: number } | undefined
  let bestDistance = Infinity
  const columns = steps(minX, maxX)
  for (const y of steps(minY, maxY)) {
    for (const x of columns) {
      const distance = Math.hypot(x - want.x, y - want.y)
      if (distance < bestDistance && fits(x, y)) { best = { x, y }; bestDistance = distance }
    }
  }
  if (best) return best
  // No room in the frame: below the siblings, at the left of them.
  if (!taken.length) return { x: minX, y: minY }
  return { x: Math.min(...taken.map((b) => b.x)), y: Math.max(...taken.map((b) => b.y + b.height)) + GHOST_GAP }
}

/** Where a root ghost goes: its place when clear of the other roots, else the nearest free one. */
function placeAtRoot(size: { width: number; height: number }, taken: Box[], want: { x: number; y: number }): { x: number; y: number } {
  if (clearOf(taken, want.x, want.y, size, 0)) return { x: want.x, y: want.y }
  return freeSpotNear(taken, size, { x: want.x + size.width / 2, y: want.y + size.height / 2 })
}

/** Spacing of the cells a batch placer hands out. */
export const BATCH_CELL = { width: 360, height: 280 }
/** Gap between the nodes already on a canvas and a new batch beside them. */
const BATCH_GAP = 120

/**
 * Places a batch of new nodes, one call per node: under each parent, cell by
 * cell of a landscape grid (landscapeSlot) that starts right of the siblings
 * already there, top-aligned with them. A batch so grows the canvas sideways
 * rather than down, and never lands on what an earlier batch placed. Only the
 * siblings in `visible()` count, when it returns a set (the nodes a view
 * shows). Positions are relative to the parent, like C4Node.x/y.
 */
export function createBatchPlacer(
  getNodes: () => Record<string, C4Node>,
  visible: () => Set<string> | undefined = () => undefined,
): (parentId?: string) => { x: number; y: number } {
  const batches = new Map<string, { x: number; y: number; placed: number }>()
  return (parentId) => {
    const key = parentId ?? ''
    let batch = batches.get(key)
    if (!batch) {
      const nodes = getNodes()
      const parent = parentId ? nodes[parentId] : undefined
      const shown = visible()
      const siblings = Object.values(nodes).filter((n) =>
        (n.parentId ?? undefined) === (parent?.id ?? undefined) && (!shown || shown.has(n.id)))
      const pad = parent ? compoundPadding(parent.type) : { top: 0, side: 0 }
      batch = siblings.length
        ? { x: Math.max(...siblings.map((n) => n.x + effectiveWidth(n))) + (parent ? pad.side : BATCH_GAP), y: Math.min(...siblings.map((n) => n.y)), placed: 0 }
        : { x: pad.side, y: pad.top, placed: 0 }
      batches.set(key, batch)
    }
    const { column, row } = landscapeSlot(batch.placed++)
    return { x: batch.x + column * BATCH_CELL.width, y: batch.y + row * BATCH_CELL.height }
  }
}

/**
 * The graph as the canvas draws it: nodes hidden under a collapsed ancestor
 * are dropped, collapsed containers take their collapsed size, and every
 * relation is re-attached to the nearest visible ancestor of each endpoint
 * (the same aggregation deriveRFEdges applies). Relations that collapse
 * into a self-loop or duplicate an earlier source→target pair are dropped.
 *
 * Layout engines must only ever see this projection — ELK rejects edges
 * that reference nodes absent from its graph, and scoring hidden nodes
 * optimises a picture nobody sees.
 */
export function projectToVisibleGraph(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
): { nodes: Record<string, C4Node>; relations: Record<string, C4Relation> } {
  // In id order, like the relations below: every engine, the annealer's
  // seed and the tie-breaks between equal candidates follow the order of
  // this record, and the order a document keeps its nodes in is not part of
  // the diagram (a model read back from a folder has them sorted by id,
  // the same model in the browser's storage as they were created). In
  // document order, the same diagram got another layout after a reload,
  // and another from the MCP server than from Studio.
  const visible: Record<string, C4Node> = {}
  for (const id of Object.keys(nodes).sort()) {
    const n = nodes[id]
    if (!isVisible(n, nodes)) continue
    if (isContainerType(n.type) && n.collapsed) {
      const w = COLLAPSED_WIDTH[n.type]
      const h = COLLAPSED_HEIGHT[n.type]
      visible[n.id] = n.width === w && n.height === h ? n : { ...n, width: w, height: h }
    } else {
      visible[n.id] = n
    }
  }

  const visibleAncestor = (id: string): string | undefined => {
    let cur: C4Node | undefined = nodes[id]
    while (cur && !visible[cur.id]) cur = cur.parentId ? nodes[cur.parentId] : undefined
    return cur?.id
  }

  // As the canvas draws them (deriveRFEdges): a relation between two
  // visible elements is a line of its own, however many join them; the
  // relations rolled up onto a folded container share one line per pair,
  // labelled with all their names, and none is drawn between a node and its
  // own ancestor. Engines and the score see the lines the canvas draws (the
  // score used to merge every pair into one line, and missed the labels of
  // the rest).
  const isAncestor = (a: string, b: string): boolean => {
    for (let cur = nodes[b]?.parentId; cur; cur = nodes[cur]?.parentId) if (cur === a) return true
    return false
  }
  const projected: Record<string, C4Relation> = {}
  const rolledUpLine = new Map<string, string>()
  for (const id of Object.keys(relations).sort()) {
    const r = relations[id]
    const s = visibleAncestor(r.sourceId)
    const t = visibleAncestor(r.targetId)
    if (!s || !t || s === t) continue
    if (s === r.sourceId && t === r.targetId) {
      projected[id] = r
      continue
    }
    if (isAncestor(s, t) || isAncestor(t, s)) continue
    const key = `${s}\u0000${t}`
    const kept = rolledUpLine.get(key)
    if (kept) {
      if (r.label) projected[kept] = { ...projected[kept], label: projected[kept].label ? `${projected[kept].label}\n${r.label}` : r.label }
      continue
    }
    rolledUpLine.set(key, id)
    projected[id] = { ...r, sourceId: s, targetId: t }
  }
  return { nodes: visible, relations: projected }
}
