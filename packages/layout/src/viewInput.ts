// ─── View layout input ──────────────────────────────────────────────────────
// What a layout run sees for one view — the node filter, view-level collapse
// rules and hidden relations the canvas applies when it renders — and how
// its result is written back. Shared by Studio's store and the MCP server.

import { COLLAPSED_HEIGHT, COLLAPSED_WIDTH, isContainerType, viewShowsEveryNode, type C4Node, type C4Relation, type DiagramView, type LayoutConstraint, type PositionMap } from '@radical/common/c4'
import { alignmentError, enforceAlignments, resolveAlignments, type Alignment } from './constraints'
import { fittedParentSize, projectToVisibleGraph } from './geometry'

/** Compute the effective set of node IDs for a view: explicit nodeIds + all their ancestors */
export function computeViewNodeSet(view: DiagramView | undefined, nodes: Record<string, C4Node>): Set<string> | undefined {
  if (!view) return undefined
  if (viewShowsEveryNode(view)) return undefined
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
  allNodes: Record<string, C4Node>
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
    const hasChildInModel = Object.values(allNodes).some(c => c.parentId === id)
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
  expandedSet?: Set<string>
): boolean {
  if (expandedSet?.has(node.id)) return false  // view-level explicit expansion
  return node.collapsed || (viewCollapsedSet?.has(node.id) ?? false)
}

/** Return the subset of nodes/relations visible in the active view (or all if no view). */
export function filterForView(
  allNodes: Record<string, C4Node>,
  allRelations: Record<string, C4Relation>,
  viewFilter: Set<string> | undefined,
  viewCollapsedSet?: Set<string>
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

export interface LayoutInput {
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  viewFilter: Set<string> | undefined
  viewCollapsedSet: Set<string>
  expandedSet: Set<string> | undefined
  /** The view's alignment rules that hold on this canvas (resolveAlignments). */
  alignments: Alignment[]
}

/**
 * The graph a layout algorithm should see for `view` (undefined = All
 * elements): the same
 * node filter, collapse rules (view-collapsed, per-view collapsed and
 * expanded overrides) and hidden relations the canvas applies when it
 * renders. `collapsed` on the returned nodes is the effective state.
 * `constraints` defaults to the view's own; All elements keeps its rules in
 * the document (DiagramData.defaultLayoutConstraints), so pass those.
 */
export function viewLayoutInput(
  view: DiagramView | undefined,
  allNodes: Record<string, C4Node>,
  allRelations: Record<string, C4Relation>,
  constraints: readonly LayoutConstraint[] | undefined = view?.layoutConstraints,
): LayoutInput {
  const viewFilter = computeViewNodeSet(view, allNodes)
  const viewCollapsedSet = computeViewCollapsedSet(viewFilter, allNodes)
  for (const id of view?.collapsedNodeIds ?? []) viewCollapsedSet.add(id)
  const expandedSet = view?.expandedNodeIds?.length ? new Set(view.expandedNodeIds) : undefined

  const filtered = filterForView(allNodes, allRelations, viewFilter)
  const nodes: Record<string, C4Node> = {}
  for (const [id, n] of Object.entries(filtered.nodes)) {
    const collapsed = isEffectivelyCollapsed(n, viewCollapsedSet, expandedSet)
    nodes[id] = collapsed === n.collapsed ? n : { ...n, collapsed }
  }
  const hidden = new Set(view?.hiddenRelationIds ?? [])
  const relations: Record<string, C4Relation> = {}
  for (const [id, r] of Object.entries(filtered.relations)) {
    if (!hidden.has(id)) relations[id] = r
  }
  return { nodes, relations, viewFilter, viewCollapsedSet, expandedSet, alignments: resolveAlignments(constraints, nodes) }
}

/**
 * Write a layout result into the model. Collapsed nodes keep their stored
 * size: the canvas draws them at the collapsed size anyway, and the stored
 * one is what they expand back to.
 */
export function applyLayoutPositions(
  c4Nodes: Record<string, C4Node>,
  positions: PositionMap,
  input: LayoutInput,
): void {
  for (const [id, pos] of Object.entries(positions)) {
    const node = c4Nodes[id]
    if (!node) continue
    node.x = pos.x
    node.y = pos.y
    if (input.nodes[id]?.collapsed) continue
    if (pos.width)  node.width  = pos.width
    if (pos.height) node.height = pos.height
  }
}

/**
 * Moves `c4Nodes` (the model, mutated) so the view's alignments hold, when
 * they do not yet. `input` must describe the current positions. True when
 * anything moved.
 */
export function applyAlignments(c4Nodes: Record<string, C4Node>, input: LayoutInput): boolean {
  if (!input.alignments.length) return false
  const { nodes } = projectToVisibleGraph(input.nodes, input.relations)
  if (alignmentError(nodes, {}, input.alignments) <= 0.5) return false
  applyLayoutPositions(c4Nodes, enforceAlignments(nodes, {}, input.alignments), input)
  return true
}

/**
 * Refits every compound node that has children in the view, deepest first,
 * to wrap those children at their effective (view-collapsed) size — what
 * Studio's store does after a layout run. Mutates `nodes`.
 */
export function resizeParentsBottomUp(
  nodes: Record<string, C4Node>,
  input: Pick<LayoutInput, 'viewFilter' | 'viewCollapsedSet' | 'expandedSet'>,
): void {
  const { viewFilter, viewCollapsedSet, expandedSet } = input
  const inView = (n: C4Node): boolean => !viewFilter || viewFilter.has(n.id)
  const size = (n: C4Node): { width: number; height: number } => (
    isContainerType(n.type) && isEffectivelyCollapsed(n, viewCollapsedSet, expandedSet)
      ? { width: COLLAPSED_WIDTH[n.type], height: COLLAPSED_HEIGHT[n.type] }
      : { width: n.width, height: n.height }
  )
  const depth = (id: string): number => {
    let d = 0
    for (let cur = nodes[id]?.parentId; cur && d < 64; cur = nodes[cur]?.parentId) d++
    return d
  }
  const parentIds = [...new Set(Object.values(nodes).filter((n) => inView(n) && n.parentId).map((n) => n.parentId!))]
  parentIds.sort((a, b) => depth(b) - depth(a))
  for (const id of parentIds) {
    const parent = nodes[id]
    if (!parent || !isContainerType(parent.type) || isEffectivelyCollapsed(parent, viewCollapsedSet, expandedSet)) continue
    const children = Object.values(nodes).filter((c) => c.parentId === id && inView(c))
    if (!children.length) continue
    const fitted = fittedParentSize(parent, children.map((c) => ({ x: c.x, y: c.y, ...size(c) })))
    parent.width = fitted.width
    parent.height = fitted.height
  }
}

/** Gap the tree layout keeps between siblings it had to part. */
const TREE_SIBLING_GAP = 28

/**
 * resizeParentsBottomUp for a layout that sized containers itself (the tree
 * layout): a container the refit makes larger than the engine laid it out
 * (it grows to its type's least size) comes to lie on the sibling beside it.
 * Level by level from the deepest, the siblings are parted (each moved right
 * of the ones it overlaps, in the order they stand) before their parent is
 * fitted. Mutates `nodes`.
 */
export function fitAndSeparateBottomUp(
  nodes: Record<string, C4Node>,
  input: Pick<LayoutInput, 'viewFilter' | 'viewCollapsedSet' | 'expandedSet'>,
): void {
  const { viewFilter, viewCollapsedSet, expandedSet } = input
  const inView = (n: C4Node): boolean => !viewFilter || viewFilter.has(n.id)
  const size = (n: C4Node): { width: number; height: number } => (
    isContainerType(n.type) && isEffectivelyCollapsed(n, viewCollapsedSet, expandedSet)
      ? { width: COLLAPSED_WIDTH[n.type], height: COLLAPSED_HEIGHT[n.type] }
      : { width: n.width, height: n.height }
  )
  const depth = (id: string | undefined): number => {
    let d = 0
    for (let cur = id ? nodes[id]?.parentId : undefined; cur && d < 64; cur = nodes[cur]?.parentId) d++
    return id ? d + 1 : 0
  }
  const part = (children: C4Node[]): void => {
    const ordered = [...children].sort((a, b) => a.x - b.x || a.y - b.y || (a.id < b.id ? -1 : 1))
    const placed: C4Node[] = []
    for (const c of ordered) {
      for (let guard = 0; guard < ordered.length; guard++) {
        const sc = size(c)
        const hit = placed.find((q) => {
          const sq = size(q)
          return c.x < q.x + sq.width + TREE_SIBLING_GAP && q.x < c.x + sc.width + TREE_SIBLING_GAP
            && c.y < q.y + sq.height && q.y < c.y + sc.height
        })
        if (!hit) break
        c.x = hit.x + size(hit).width + TREE_SIBLING_GAP
      }
      placed.push(c)
    }
  }
  const parents = new Set<string | undefined>([undefined])
  for (const n of Object.values(nodes)) if (inView(n) && n.parentId) parents.add(n.parentId)
  const byDepth = [...parents].sort((a, b) => depth(b) - depth(a))
  for (const id of byDepth) {
    const children = Object.values(nodes).filter((c) => (c.parentId ?? undefined) === id && inView(c))
    if (children.length > 1) part(children)
    const parent = id ? nodes[id] : undefined
    if (!parent || !isContainerType(parent.type) || isEffectivelyCollapsed(parent, viewCollapsedSet, expandedSet) || !children.length) continue
    const fitted = fittedParentSize(parent, children.map((c) => ({ x: c.x, y: c.y, ...size(c) })))
    parent.width = fitted.width
    parent.height = fitted.height
  }
}
