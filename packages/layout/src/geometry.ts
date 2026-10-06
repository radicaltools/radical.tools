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
import { C4Node, C4Relation, COLLAPSED_HEIGHT, COLLAPSED_WIDTH, NODE_SIZES, isContainerType } from '@radical/common/c4'

export function effectiveWidth(n: C4Node): number {
  if (isContainerType(n.type) && n.collapsed) return COLLAPSED_WIDTH[n.type]
  return n.width ?? NODE_SIZES[n.type].width
}

export function effectiveHeight(n: C4Node): number {
  if (isContainerType(n.type) && n.collapsed) return COLLAPSED_HEIGHT[n.type]
  return n.height ?? NODE_SIZES[n.type].height
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
