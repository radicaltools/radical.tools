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
  const visible: Record<string, C4Node> = {}
  for (const n of Object.values(nodes)) {
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

  const projected: Record<string, C4Relation> = {}
  const seen = new Set<string>()
  for (const id of Object.keys(relations).sort()) {
    const r = relations[id]
    const s = visibleAncestor(r.sourceId)
    const t = visibleAncestor(r.targetId)
    if (!s || !t || s === t) continue
    const key = `${s}\u0000${t}`
    if (seen.has(key)) continue
    seen.add(key)
    projected[id] = s === r.sourceId && t === r.targetId ? r : { ...r, sourceId: s, targetId: t }
  }
  return { nodes: visible, relations: projected }
}
