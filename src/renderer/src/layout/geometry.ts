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
import { C4Node, COLLAPSED_HEIGHT, COLLAPSED_WIDTH, NODE_SIZES, isContainerType } from '../types/c4'

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
