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
  // Never smaller than the frame shows collapsed: its empty default size
  // would leave room round one or two children that reads as missing content.
  return {
    width: Math.max(maxRight + pad.side, COLLAPSED_WIDTH[parent.type] ?? NODE_SIZES[parent.type].width),
    height: Math.max(maxBottom + pad.bottom, COLLAPSED_HEIGHT[parent.type] ?? NODE_SIZES[parent.type].height),
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

/** Where a lone child of `size` stands in a frame of `frame`: centred
 *  across it, and down it below the header (`pad.top`), never nearer an
 *  edge than the padding. */
export function centredIn(frame: { width: number; height: number }, size: { width: number; height: number }, pad: { top: number; side: number; bottom: number }): { x: number; y: number } {
  return {
    x: Math.max(pad.side, Math.round((frame.width - size.width) / 2)),
    y: pad.top + Math.max(0, Math.round((frame.height - pad.top - pad.bottom - size.height) / 2)),
  }
}

/** The gap between the cells of a container's grid of children: room for a
 *  short relation label between two of them (20 px left it squeezed), as
 *  the grid layout keeps (constraints.ts). */
const GRID_GAP = 60

/**
 * Where an element of `size` goes in `parentId`: the first free cell of a
 * grid of the children `counts` accepts, as wide as their widest and as
 * high as their highest, growing wider than tall (landscapeSlot), from
 * where the children start (below the header, inside the padding); in an
 * empty parent, centred in its
 * frame (`frame`, the parent's size where not given) below the header. The
 * children stay where they are: a cell any of them lies on is taken.
 * Sizes are as the canvas draws them.
 */
export function gridSlotIn(
  nodes: Record<string, C4Node>,
  parentId: string,
  size: { width: number; height: number },
  counts: (child: C4Node) => boolean = () => true,
  frame?: { width: number; height: number },
): { x: number; y: number } {
  const parent = nodes[parentId]
  const pad = compoundPadding(parent?.type ?? 'system')
  const kids = Object.values(nodes).filter((c) => c.parentId === parentId && counts(c))
  if (!kids.length) return centredIn(frame ?? { width: parent?.width ?? 0, height: parent?.height ?? 0 }, size, pad)
  const cellW = Math.max(size.width, ...kids.map(effectiveWidth))
  const cellH = Math.max(size.height, ...kids.map(effectiveHeight))
  const taken = kids.map((c) => ({ x: c.x, y: c.y, w: effectiveWidth(c), h: effectiveHeight(c) }))
  // From where the children start (the first may stand centred), so the
  // next goes beside it.
  const left = Math.max(pad.side, Math.min(...kids.map((c) => c.x)))
  const top = Math.max(pad.top, Math.min(...kids.map((c) => c.y)))
  for (let i = 0; i < 10_000; i++) {
    const { column, row } = landscapeSlot(i)
    const box = { x: left + column * (cellW + GRID_GAP), y: top + row * (cellH + GRID_GAP), w: size.width, h: size.height }
    if (!taken.some((t) => boxesOverlap(box, t))) return { x: box.x, y: box.y }
  }
  return placeBesideSiblings(nodes, parentId, counts)
}

/** A box as a canvas draws it. */
export type CanvasBox = { x: number; y: number; w: number; h: number }

/** What a canvas draws (`shown`) and at what size (`boxOf`, in its
 *  parent's frame): Studio's store knows a view's collapsed sets; without
 *  them, modelCanvas. */
export interface CanvasShape {
  shown: (n: C4Node) => boolean
  boxOf: (n: C4Node) => CanvasBox
  /** A container the canvas draws only to hold what it shows (a view's
   *  frame): invisible, it makes no room when it grows. */
  frame?: (n: C4Node) => boolean
}

/** A canvas as the model draws it: the nodes in `shownIds` (every node when
 *  undefined) under no folded ancestor, at their drawn size (drawnSize). */
export function modelCanvas(nodes: Record<string, C4Node>, shownIds?: ReadonlySet<string>, frames?: ReadonlySet<string>): CanvasShape {
  const shown = (n: C4Node): boolean => (!shownIds || shownIds.has(n.id)) && isVisible(n, nodes)
  const parents = new Set(Object.values(nodes).filter(shown).map((n) => n.parentId).filter((id): id is string => !!id))
  const boxOf = (n: C4Node): CanvasBox => {
    const size = drawnSize(n, parents.has(n.id))
    return { x: n.x, y: n.y, w: size.width, h: size.height }
  }
  return frames?.size ? { shown, boxOf, frame: (n) => frames.has(n.id) } : { shown, boxOf }
}

const boxesOverlap = (a: CanvasBox, b: CanvasBox): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** True when `node`, where it stands on the canvas, lies inside its
 *  parent's frame (anywhere at the root) and on none of the siblings the
 *  canvas draws, those `ignore` accepts left out. */
export function liesClearInParent(
  node: C4Node,
  nodes: Record<string, C4Node>,
  canvas: CanvasShape,
  ignore: (sibling: C4Node) => boolean = () => false,
): boolean {
  const box = canvas.boxOf(node)
  const parent = node.parentId ? nodes[node.parentId] : undefined
  if (parent) {
    const frame = canvas.boxOf(parent)
    if (box.x < 0 || box.y < 0 || box.x + box.w > frame.w || box.y + box.h > frame.h) return false
  }
  return !Object.values(nodes).some((s) => s.id !== node.id && (s.parentId ?? undefined) === (node.parentId ?? undefined)
    && canvas.shown(s) && !ignore(s) && boxesOverlap(box, canvas.boxOf(s)))
}

/**
 * The nodes moved into another parent (`ids`, already under it) on one
 * canvas, by the rule for moves: one keeps its place where it lies inside
 * its new parent and clear of its new siblings (liesClearInParent);
 * otherwise it goes inside the parent beside its siblings (gridSlotIn),
 * and at the top to the free place nearest it (freeSpotNear). The parents then fit what they hold, and where
 * one grew its siblings make room for it (makeRoomAround), level by level
 * up the tree, as an expand does. `fit` refits one parent to its children
 * (the store's, which knows the view's folds); headless, fitShown. A moved
 * node the canvas does not draw, under a folded container, goes by the same
 * rule on `opened`, the canvas with its folded ancestors open (an expand
 * draws it where it lies: it kept a place outside the frame it opened to);
 * `fit` leaves a folded parent as it is, and its expand fits it. Mutates
 * `nodes`; returns the ids it placed or pushed.
 */
export function settleMovedNodes(
  nodes: Record<string, C4Node>,
  ids: readonly string[],
  canvas: CanvasShape,
  fit: (parentId: string) => void = (parentId) => fitShown(nodes, parentId, canvas),
  opened?: CanvasShape,
): string[] {
  const touched: string[] = []
  const settle = (moved: string[], on: CanvasShape): void => {
    const waiting = new Set(moved)
    // Placed alone in its parent: centred across it once the parent fits.
    const alone: string[] = []
    for (const id of moved) {
      const node = nodes[id]
      if (!liesClearInParent(node, nodes, on, (s) => waiting.has(s.id))) {
        const counts = (s: C4Node): boolean => s.id !== id && !waiting.has(s.id) && on.shown(s)
        // In a parent, the next cell of its children's grid.
        const box = on.boxOf(node)
        // At the top, the free place nearest where it stands: taken out of
        // a container it lies over that container, now a sibling, and
        // beside every sibling it went to the far right of the canvas.
        const at = node.parentId && nodes[node.parentId]
          ? gridSlotIn(nodes, node.parentId, { width: box.w, height: box.h }, (s) => counts(s), { width: on.boxOf(nodes[node.parentId]).w, height: on.boxOf(nodes[node.parentId]).h })
          : freeSpotNear(Object.values(nodes).filter((s) => !s.parentId && counts(s)).map((s) => { const b = on.boxOf(s); return { x: b.x, y: b.y, width: b.w, height: b.h } }),
            { width: box.w, height: box.h }, { x: box.x + box.w / 2, y: box.y + box.h / 2 })
        node.x = at.x
        node.y = at.y
        touched.push(id)
        if (node.parentId && !Object.values(nodes).some((s) => s.parentId === node.parentId && counts(s)) && moved.filter((m) => nodes[m]?.parentId === node.parentId).length === 1) alone.push(id)
      }
      waiting.delete(id)
    }
    const parents = [...new Set(moved.map((id) => nodes[id].parentId).filter((p): p is string => !!p && !!nodes[p]))]
    for (const parentId of parents) touched.push(...growWithRoom(nodes, parentId, on, fit))
    for (const id of alone) {
      const node = nodes[id]
      const frame = on.boxOf(nodes[node.parentId!])
      const box = on.boxOf(node)
      Object.assign(node, centredIn({ width: frame.w, height: frame.h }, { width: box.w, height: box.h }, compoundPadding(nodes[node.parentId!].type)))
    }
  }
  settle(ids.filter((id) => nodes[id] && canvas.shown(nodes[id])), canvas)
  if (opened) settle(ids.filter((id) => nodes[id] && !canvas.shown(nodes[id]) && opened.shown(nodes[id])), opened)
  return touched
}

/** Refits `startId` to its children, then each ancestor, and wherever one
 *  grew on the canvas its siblings make room for it (makeRoomAround).
 *  Returns the ids pushed aside. Mutates `nodes`. */
export function growWithRoom(
  nodes: Record<string, C4Node>,
  startId: string,
  canvas: CanvasShape,
  fit: (parentId: string) => void = (parentId) => fitShown(nodes, parentId, canvas),
): string[] {
  const pushed: string[] = []
  const seen = new Set<string>()
  for (let cur: C4Node | undefined = nodes[startId]; cur && !seen.has(cur.id); cur = cur.parentId ? nodes[cur.parentId] : undefined) {
    seen.add(cur.id)
    const was = canvas.boxOf(cur)
    fit(cur.id)
    const now = canvas.boxOf(nodes[cur.id])
    if (now.w <= was.w && now.h <= was.h) continue
    // Not drawn: what it now reaches over is in no way of it. As a box, a
    // view's undrawn domain grown round an entity pushed the next domain,
    // with what the view draws in it (F-0048).
    if (canvas.frame?.(cur)) continue
    for (const [id, at] of Object.entries(makeRoomAround(cur.id, nodes, canvas))) {
      nodes[id].x = at.x
      nodes[id].y = at.y
      pushed.push(id)
    }
    // Pushed past the parent's left or top edge, where a refit (which grows
    // right and down) does not follow: the frame grows that way.
    if (cur.parentId) growFrameLeftUp(nodes, cur.parentId, canvas.shown)
  }
  return pushed
}

/** The top a child keeps below its parent's top edge; one above it is drawn
 *  there (liveColaEngine's LIVE_CHILD_TOP_MIN). */
const CHILD_TOP_MIN = 50

/** Grows `parentId`'s frame left and up over children that reach past its
 *  left or top edge (opened round its centre, or pushed aside), moving it
 *  and moving them back by as much: they stay where they are drawn. Mutates
 *  `nodes`. */
export function growFrameLeftUp(nodes: Record<string, C4Node>, parentId: string, shown: (n: C4Node) => boolean = () => true): void {
  const parent = nodes[parentId]
  if (!parent) return
  const kids = Object.values(nodes).filter((c) => c.parentId === parentId && shown(c))
  if (!kids.length) return
  const pad = compoundPadding(parent.type)
  const minX = Math.min(...kids.map((c) => c.x))
  const minY = Math.min(...kids.map((c) => c.y))
  const dx = minX < 0 ? pad.side - minX : 0
  const dy = minY < CHILD_TOP_MIN ? pad.top - minY : 0
  if (!dx && !dy) return
  parent.x -= dx
  parent.y -= dy
  for (const k of kids) { k.x += dx; k.y += dy }
}

/** Fits `parentId` to the children the canvas draws (`canvas.shown`, or
 *  those `counts` accepts), as fitAncestors measures them (the size they
 *  open to); a folded or childless one keeps its size. Mutates `nodes`. */
export function fitShown(nodes: Record<string, C4Node>, parentId: string, canvas: CanvasShape | { shown: (n: C4Node) => boolean }): void {
  const parent = nodes[parentId]
  if (!parent || !isContainerType(parent.type) || parent.collapsed) return
  const children = Object.values(nodes).filter((c) => c.parentId === parentId && canvas.shown(c))
  if (!children.length) return
  const size = fittedParentSize(parent, children.map((c) => ({ x: c.x, y: c.y, width: effectiveWidth(c), height: effectiveHeight(c) })))
  parent.width = size.width
  parent.height = size.height
}

/** The gap an expand leaves between what it pushed and what pushed it. */
export const EXPAND_GAP = 20
/** What a push counts for each sibling it would put the pushed one on (px). */
const HIT_COST = 200

/**
 * Room for `grownId`, which an expand (or what was moved into it) made
 * larger, among its siblings on the canvas: the siblings it now lies on move out of its way, and what
 * they then lie on moves on, as a wave from it outwards. The siblings are
 * taken nearest first; each moves the least way out of what was placed
 * before it (never back towards the grown one, and rather not onto
 * another), so a sibling moves only when something moved into it, and the
 * arrangement around the grown one is kept. Pairs a push did not reach are
 * left as they were, and siblings keep the room they had between them, up
 * to EXPAND_GAP. Only what the canvas draws counts (`canvas.shown`), at
 * the size it draws it (`canvas.boxOf`). Returns id → new {x, y} for the
 * siblings that moved.
 *
 * Pairwise pushes (separateSiblings) left overlaps behind among many
 * siblings: each pass pushed both of a pair half way, into others, and 20
 * passes did not settle a grid of 48 root systems round an opened one.
 */
export function makeRoomAround(
  grownId: string,
  nodes: Record<string, C4Node>,
  canvas: CanvasShape,
): Record<string, { x: number; y: number }> {
  const grown = nodes[grownId]
  if (!grown) return {}
  const { shown, boxOf } = canvas
  const siblings = Object.values(nodes).filter((n) => (n.parentId ?? undefined) === (grown.parentId ?? undefined) && shown(n))
  if (siblings.length < 2) return {}
  const box = new Map(siblings.map((n) => [n.id, boxOf(n)]))
  const before = new Map(siblings.map((n) => [n.id, boxOf(n)]))
  const g = box.get(grownId)!
  const gx = g.x + g.w / 2
  const gy = g.y + g.h / 2
  const gapTo = (b: CanvasBox): number =>
    Math.max(g.x - (b.x + b.w), b.x - (g.x + g.w), g.y - (b.y + b.h), b.y - (g.y + g.h), 0)
  const order = siblings.filter((n) => n.id !== grownId)
    .map((n) => ({ id: n.id, gap: gapTo(box.get(n.id)!), centre: Math.hypot(box.get(n.id)!.x + box.get(n.id)!.w / 2 - gx, box.get(n.id)!.y + box.get(n.id)!.h / 2 - gy) }))
    .sort((a, b) => a.gap - b.gap || a.centre - b.centre || (a.id < b.id ? -1 : 1))
  const placed: string[] = [grownId]
  const moved = new Set<string>([grownId])
  const hits = (a: CanvasBox, b: CanvasBox, gap: number): boolean =>
    a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap
  // Two siblings keep the room they had, up to EXPAND_GAP: one pushed does
  // not push on what was closer to it than that.
  const gapOf = (a: string, b: string): number => {
    if (a === grownId || b === grownId) return EXPAND_GAP
    const [p, q] = [before.get(a)!, before.get(b)!]
    return Math.min(EXPAND_GAP, Math.max(0, p.x - (q.x + q.w), q.x - (p.x + p.w), p.y - (q.y + q.h), q.y - (p.y + p.h)))
  }
  for (const { id } of order) {
    const b = box.get(id)!
    const cx = b.x + b.w / 2 - gx
    const cy = b.y + b.h / 2 - gy
    for (let step = 0; step < placed.length * 4 + 8; step++) {
      // Only what moved can be in the way: two siblings the expand did not
      // reach stay as they were, close or not.
      const at = placed.findIndex((pid) => (moved.has(pid) || moved.has(id)) && hits(b, box.get(pid)!, gapOf(id, pid)))
      if (at < 0) break
      const blocker = box.get(placed[at])!
      const gap = gapOf(id, placed[at])
      // Out of its way, away from the grown one on each axis.
      const ways = [
        { dx: blocker.x + blocker.w + gap - b.x, dy: 0, ok: cx >= 0 },
        { dx: blocker.x - gap - (b.x + b.w), dy: 0, ok: cx <= 0 },
        { dx: 0, dy: blocker.y + blocker.h + gap - b.y, ok: cy >= 0 },
        { dx: 0, dy: blocker.y - gap - (b.y + b.h), ok: cy <= 0 },
      ].filter((w) => w.ok)
      // The least way out, counting what it would then lie on: each such
      // sibling would have to move on in turn.
      const cost = (w: { dx: number; dy: number }): number => {
        const to = { x: b.x + w.dx, y: b.y + w.dy, w: b.w, h: b.h }
        let hit = 0
        for (const n of siblings) if (n.id !== id && n.id !== grownId && hits(to, box.get(n.id)!, 0)) hit++
        return Math.abs(w.dx) + Math.abs(w.dy) + HIT_COST * hit
      }
      const way = ways.reduce((best, w) => (cost(w) < cost(best) ? w : best))
      b.x += way.dx
      b.y += way.dy
      moved.add(id)
    }
    placed.push(id)
  }
  const result: Record<string, { x: number; y: number }> = {}
  for (const n of siblings) {
    const b = box.get(n.id)!
    if (n.id !== grownId && (b.x !== n.x || b.y !== n.y)) result[n.id] = { x: b.x, y: b.y }
  }
  return result
}

/**
 * The nodes whose place on a canvas (`nodes` hold it, `positions` say which
 * it knows) lies mostly outside their parent's frame there: the middle of
 * the box outside it. A place kept relative to another parent (a node file
 * moved by hand into another container's folder, a model edited outside
 * Studio) reads so; such a node is placed afresh (placeUnplaced). Measured
 * as the canvas draws it: a container folded there, or with nothing in it
 * on the canvas (`shown`: what a view draws), at its folded size. Not in a
 * container the canvas draws only to hold what it shows (`frames`): it has
 * no frame to stray from.
 */
export function strayNodeIds(
  nodes: Record<string, C4Node>,
  positions: Record<string, unknown>,
  folded: (n: C4Node) => boolean = (n) => n.collapsed,
  shown?: ReadonlySet<string>,
  frames?: ReadonlySet<string>,
): Set<string> {
  const out = new Set<string>()
  const parents = new Set<string>()
  for (const n of Object.values(nodes)) if (n.parentId && (!shown || shown.has(n.id))) parents.add(n.parentId)
  for (const n of Object.values(nodes)) {
    const parent = n.parentId ? nodes[n.parentId] : undefined
    // A folded parent may keep the size it is drawn at, smaller than what
    // it holds: opened, it is fit to it.
    if (!parent || folded(parent) || frames?.has(parent.id) || !(n.id in positions) || !(parent.id in positions)) continue
    // Measured as the canvas draws it: folded there (in a view, by the
    // view's own folds), at its folded size. At its open size the middle
    // of a container folded at its parent's edge lay outside the parent
    // fit to the fold, and a view switch placed it afresh. So is one with
    // nothing in it: a state dragged to the bottom of its machine, which
    // grew to hold the folded box, lay outside it by its stored 220 px
    // height, and the next opening rearranged the machine (F-0049).
    const fold = isContainerType(n.type) && (folded(n) || !parents.has(n.id))
    const cx = n.x + (fold ? COLLAPSED_WIDTH[n.type] : FIXED_SIZE_TYPES.has(n.type) ? NODE_SIZES[n.type].width : (n.width ?? NODE_SIZES[n.type].width)) / 2
    const cy = n.y + (fold ? COLLAPSED_HEIGHT[n.type] : FIXED_SIZE_TYPES.has(n.type) ? NODE_SIZES[n.type].height : (n.height ?? NODE_SIZES[n.type].height)) / 2
    if (cx < 0 || cy < 0 || cx > parent.width || cy > parent.height) out.add(n.id)
  }
  return out
}

/** The room "Wrap into…" leaves round what it wraps: on each side, and
 *  for the header above it. */
export const WRAP_PAD = 30
export const WRAP_HEADER = 40

/**
 * Gives the nodes a canvas has no place for a place on it. `nodes` hold the
 * canvas's positions for every node it knows (`positions`, its own map); a
 * node added on another canvas is still where that one had it, relative to
 * a parent that is laid out differently here: outside its frame, or on a
 * sibling. So is one whose place there lies mostly outside its parent's
 * frame (strayNodeIds). Each such node wraps what it holds here, goes right of the
 * siblings the canvas has placed, top-aligned with them, and its ancestors
 * are refit; where one grew, its siblings make room for it (growWithRoom). What is inside a node
 * placed this way keeps its place in it. Only nodes in `shown` (the ones a
 * view lists) are placed, when given; `folded` says which containers the
 * canvas draws folded (a view's own folds), the model's when not given.
 *
 * A new parent "Wrap into…" made on another canvas (`wrap`), with no place
 * here round children that have one (in the parent it went into), goes
 * round them where they are, as the wrap put it round them there: with its
 * room and header, its siblings making room where it now covers them;
 * tightly, where the canvas draws it only to hold what it shows (`frames`:
 * it has no frame there). Placed beside its siblings, it took them along,
 * and the live layout, freeing it, rearranged its surroundings (F-0047).
 * Their ids go into `wrapped`, not the result: the result names what the
 * live layout settles.
 *
 * Mutates `nodes`; returns the ids it placed. A canvas with no positions at all has not been laid out and is
 * left as it is.
 */
export function placeUnplaced(
  nodes: Record<string, C4Node>,
  positions: Record<string, unknown> | undefined,
  shown?: Set<string>,
  folded?: (n: C4Node) => boolean,
  options: { frames?: ReadonlySet<string>; wrap?: ReadonlySet<string>; wrapped?: string[] } = {},
): string[] {
  if (!positions || Object.keys(positions).length === 0) return []
  const { frames } = options
  const strays = strayNodeIds(nodes, positions, folded, shown, frames)
  const known = (id: string): boolean => id in positions && !strays.has(id)
  const depth = (n: C4Node): number => {
    let d = 0
    const seen = new Set<string>([n.id])
    for (let cur = n.parentId ? nodes[n.parentId] : undefined; cur && !seen.has(cur.id); cur = cur.parentId ? nodes[cur.parentId] : undefined) {
      seen.add(cur.id)
      d++
    }
    return d
  }
  // Deepest first: a parent has grown for what is new inside it before its
  // own level is looked at.
  const fresh = Object.values(nodes)
    .filter((n) => !known(n.id) && (!shown || shown.has(n.id)))
    .sort((a, b) => depth(b) - depth(a) || (a.id < b.id ? -1 : 1))
  // Inside a parent that is itself new here, a node moves with it.
  const unplaced = fresh.filter((n) => !n.parentId || !nodes[n.parentId] || known(n.parentId))
  const waiting = new Set(unplaced.map((n) => n.id))
  // What is still to be placed lies where another canvas had it: not yet
  // on this one.
  const drawn = modelCanvas(nodes, shown, frames)
  const canvas: CanvasShape = { ...drawn, shown: (n) => !waiting.has(n.id) && drawn.shown(n) }
  // A new node has the size another canvas gave it: here it wraps what it
  // holds.
  for (const node of fresh) if (!waiting.has(node.id)) fitShown(nodes, node.id, canvas)
  const placed: string[] = []
  for (const node of unplaced) {
    const held = options.wrap?.has(node.id) ? Object.values(nodes).filter((c) => c.parentId === node.id && known(c.id) && drawn.shown(c)) : []
    if (held.length) {
      waiting.delete(node.id)
      wrapRound(nodes, node, held, canvas, !!frames?.has(node.id))
      options.wrapped?.push(node.id)
      continue
    }
    fitShown(nodes, node.id, canvas)
    const at = placeBesideSiblings(nodes, node.parentId, (s) => s.id !== node.id && !waiting.has(s.id) && (!shown || shown.has(s.id)))
    node.x = at.x
    node.y = at.y
    waiting.delete(node.id)
    placed.push(node.id)
    if (node.parentId && nodes[node.parentId]) growWithRoom(nodes, node.parentId, canvas)
  }
  return placed
}

/**
 * Puts `node` round `held` (its children, with places relative to the
 * parent `node` is in), where they stand: they keep their places on the
 * canvas. Drawn, with "Wrap into…"'s room and header; where the canvas
 * draws it only as a frame, tightly. A drawn one pushes what it now covers
 * out of its way, and its parents grow for it (growWithRoom). Mutates
 * `nodes`.
 */
function wrapRound(nodes: Record<string, C4Node>, node: C4Node, held: C4Node[], canvas: CanvasShape, frame: boolean): void {
  const boxes = held.map((c) => canvas.boxOf(c))
  const left = Math.min(...boxes.map((b) => b.x))
  const top = Math.min(...boxes.map((b) => b.y))
  const right = Math.max(...boxes.map((b) => b.x + b.w))
  const bottom = Math.max(...boxes.map((b) => b.y + b.h))
  const pad = frame ? 0 : WRAP_PAD
  const header = frame ? 0 : WRAP_HEADER
  node.x = left - pad
  node.y = top - pad - header
  node.width = right - left + 2 * pad
  node.height = bottom - top + 2 * pad + header
  for (const c of Object.values(nodes)) {
    if (c.parentId !== node.id) continue
    c.x -= node.x
    c.y -= node.y
  }
  if (frame) return
  for (const [id, at] of Object.entries(makeRoomAround(node.id, nodes, canvas))) {
    nodes[id].x = at.x
    nodes[id].y = at.y
  }
  const parentId = node.parentId
  if (!parentId || !nodes[parentId]) return
  // The parents grow as far as they must to hold it, and keep the size
  // they had otherwise: refit, one laid out with room to spare shrank.
  growFrameLeftUp(nodes, parentId, canvas.shown)
  growWithRoom(nodes, parentId, canvas, (id) => {
    const p = nodes[id]
    const was = { width: p.width, height: p.height }
    fitShown(nodes, id, canvas)
    p.width = Math.max(was.width, p.width)
    p.height = Math.max(was.height, p.height)
  })
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
      // A technology only when they all use it (deriveRFEdges).
      if (projected[kept].technology !== r.technology) projected[kept] = { ...projected[kept], technology: undefined }
      continue
    }
    rolledUpLine.set(key, id)
    projected[id] = { ...r, sourceId: s, targetId: t }
  }
  return { nodes: visible, relations: projected }
}
