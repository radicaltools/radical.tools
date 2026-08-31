// ─── View-model helpers ──────────────────────────────────────────────────────
//
// Pure functions describing how the C4 model projects into a given view:
// which nodes belong to a view, which containers are effectively collapsed
// (model- or view-level), which nodes are hidden behind a collapsed ancestor,
// and the effective rendered size of a node. Extracted from diagramStore so the
// store body stays focused on state transitions; re-exported from there to keep
// the public import surface unchanged.

import {
  C4Node,
  C4Relation,
  DiagramView,
  COLLAPSED_HEIGHT,
  COLLAPSED_WIDTH,
  isContainerType,
} from '../types/c4'

/** Compute the effective set of node IDs for a view: explicit nodeIds + all their ancestors */
export function computeViewNodeSet(
  view: DiagramView | undefined,
  nodes: Record<string, C4Node>,
): Set<string> | undefined {
  if (!view) return undefined
  if (view.nodeIds.length === 0) return undefined
  const result = new Set<string>()
  for (const id of view.nodeIds) {
    let cur = id
    while (cur && nodes[cur]) {
      result.add(cur)
      cur = nodes[cur].parentId ?? ''
    }
  }
  return result
}

/**
 * Compute which nodes should be treated as collapsed in a view.
 * A parent (system/container) is view-collapsed if:
 * - it has children in the full model, AND
 * - none of those children are in the view filter, AND
 * - it is not already collapsed on the model.
 * Returns empty set when no view filter is active.
 */
export function computeViewCollapsedSet(
  viewFilter: Set<string> | undefined,
  allNodes: Record<string, C4Node>,
): Set<string> {
  const result = new Set<string>()
  if (!viewFilter) return result

  // Which parents have at least one child in the view?
  const parentHasViewChild = new Set<string>()
  for (const n of Object.values(allNodes)) {
    if (n.parentId && viewFilter.has(n.id)) parentHasViewChild.add(n.parentId)
  }

  for (const [id, n] of Object.entries(allNodes)) {
    if (!viewFilter.has(id)) continue
    if (!isContainerType(n.type)) continue
    if (n.collapsed) continue // already collapsed on the model
    if (parentHasViewChild.has(id)) continue // has visible children

    // Check it actually has children in the full model
    const hasChildInModel = Object.values(allNodes).some((c) => c.parentId === id)
    if (hasChildInModel) result.add(id)
  }
  return result
}

/** Is the node effectively collapsed (model-collapsed OR view-collapsed)?
 *  Pass `expandedSet` (from `view.expandedNodeIds`) to allow a named view to
 *  override a model-level collapse. */
export function isEffectivelyCollapsed(
  node: C4Node,
  viewCollapsedSet?: Set<string>,
  expandedSet?: Set<string>,
): boolean {
  if (expandedSet?.has(node.id)) return false // view-level explicit expansion
  return node.collapsed || (viewCollapsedSet?.has(node.id) ?? false)
}

/**
 * Compute whether a node is effectively collapsed in a given named view.
 * Used by tree-panel components (RightPanel) to show ▶/▼ correctly
 * without duplicating the logic in each component.
 *
 * @param node          The C4Node to check.
 * @param activeViewId  The currently active view ID (or null/undefined for the default view).
 * @param view          The DiagramView object (pass `undefined` when no view is active).
 */
export function nodeEffectivelyCollapsedInView(
  node: C4Node,
  activeViewId: string | null | undefined,
  view: DiagramView | undefined,
): boolean {
  if (!activeViewId) return node.collapsed
  return (
    (node.collapsed && !(view?.expandedNodeIds?.includes(node.id) ?? false)) ||
    (view?.collapsedNodeIds?.includes(node.id) ?? false)
  )
}

/** Return the subset of nodes/relations visible in the active view (or all if no view). */
export function filterForView(
  allNodes: Record<string, C4Node>,
  allRelations: Record<string, C4Relation>,
  viewFilter: Set<string> | undefined,
  viewCollapsedSet?: Set<string>,
): { nodes: Record<string, C4Node>; relations: Record<string, C4Relation> } {
  if (!viewFilter) return { nodes: allNodes, relations: allRelations }
  const nodes: Record<string, C4Node> = {}
  for (const [id, n] of Object.entries(allNodes)) {
    if (viewFilter.has(id)) {
      nodes[id] = viewCollapsedSet?.has(id) ? { ...n, collapsed: true } : n
    }
  }

  const relations: Record<string, C4Relation> = {}
  for (const [id, r] of Object.entries(allRelations)) {
    if (viewFilter.has(r.sourceId) && viewFilter.has(r.targetId)) relations[id] = r
  }
  return { nodes, relations }
}

/**
 * Walk up the parent chain. Returns true if the node is hidden because
 * one of its ancestors is collapsed (model or view-collapsed).
 */
export function isNodeHidden(
  nodeId: string,
  nodes: Record<string, C4Node>,
  viewCollapsedSet?: Set<string>,
  expandedSet?: Set<string>,
): boolean {
  const node = nodes[nodeId]
  if (!node || !node.parentId) return false
  const parent = nodes[node.parentId]
  if (!parent) return false
  if (isEffectivelyCollapsed(parent, viewCollapsedSet, expandedSet)) return true
  return isNodeHidden(node.parentId, nodes, viewCollapsedSet, expandedSet)
}

/**
 * Returns the id of the deepest visible ancestor for a given node.
 * If the node itself is visible, returns nodeId unchanged.
 */
export function getVisibleAncestor(
  nodeId: string,
  nodes: Record<string, C4Node>,
  viewCollapsedSet?: Set<string>,
  expandedSet?: Set<string>,
): string {
  if (!isNodeHidden(nodeId, nodes, viewCollapsedSet, expandedSet)) return nodeId
  const node = nodes[nodeId]
  if (!node || !node.parentId) return nodeId
  return getVisibleAncestor(node.parentId, nodes, viewCollapsedSet, expandedSet)
}

/**
 * View-aware version: walks up until the node is both visible (not collapsed)
 * AND present in the view filter. Used by deriveRFEdges to aggregate children
 * edges onto their view-visible parent.
 */
export function getViewVisibleAncestor(
  nodeId: string,
  nodes: Record<string, C4Node>,
  viewFilter: Set<string> | undefined,
  viewCollapsedSet?: Set<string>,
  expandedSet?: Set<string>,
): string {
  // Without a view filter, fall back to normal collapse logic
  if (!viewFilter) return getVisibleAncestor(nodeId, nodes, viewCollapsedSet, expandedSet)
  // Walk up until we find a node in the view that isn't hidden
  let cur = nodeId
  while (cur) {
    if (viewFilter.has(cur) && !isNodeHidden(cur, nodes, viewCollapsedSet, expandedSet)) return cur
    const node = nodes[cur]
    if (!node?.parentId) break
    cur = node.parentId
  }
  // Fallback: return whatever getVisibleAncestor gives
  return getVisibleAncestor(nodeId, nodes, viewCollapsedSet, expandedSet)
}

/** True if `ancestorId` is a (transitive) ancestor of `nodeId`. */
export function isAncestorOf(
  ancestorId: string,
  nodeId: string,
  nodes: Record<string, C4Node>,
): boolean {
  let cur = nodes[nodeId]?.parentId
  while (cur) {
    if (cur === ancestorId) return true
    cur = nodes[cur]?.parentId
  }
  return false
}

/** Return all descendant node ids (children, grandchildren, …) */
export function getDescendants(nodeId: string, nodes: Record<string, C4Node>): string[] {
  const result: string[] = []
  function walk(id: string) {
    for (const n of Object.values(nodes)) {
      if (n.parentId === id) {
        result.push(n.id)
        walk(n.id)
      }
    }
  }
  walk(nodeId)
  return result
}

/** Effective rendered height of a node (respects collapse + view collapse). */
export function effectiveNodeHeight(
  n: C4Node,
  viewCollapsedSet?: Set<string>,
  expandedSet?: Set<string>,
): number {
  if (isContainerType(n.type) && isEffectivelyCollapsed(n, viewCollapsedSet, expandedSet)) {
    return COLLAPSED_HEIGHT[n.type]
  }
  return n.height
}

/** Effective rendered width of a node (respects collapse + view collapse). */
export function effectiveNodeWidth(
  n: C4Node,
  viewCollapsedSet?: Set<string>,
  expandedSet?: Set<string>,
): number {
  if (isContainerType(n.type) && isEffectivelyCollapsed(n, viewCollapsedSet, expandedSet)) {
    return COLLAPSED_WIDTH[n.type]
  }
  return n.width
}
