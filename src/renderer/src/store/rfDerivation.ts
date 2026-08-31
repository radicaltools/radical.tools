// ─── React Flow state derivation ─────────────────────────────────────────────
//
// Pure functions that project the raw C4 model into the Node/Edge arrays
// React Flow renders: sibling-overlap separation on drag, node derivation
// (size/collapse/zIndex/visibility), and edge derivation (view-visible
// endpoint resolution, virtual-edge aggregation, label merging). Extracted
// from diagramStore so the store body focuses on state transitions.

import { Node, Edge, MarkerType } from 'reactflow'
import {
  C4Node,
  C4Relation,
  C4NodeRFData,
  C4EdgeRFData,
  NODE_SIZES,
  COLLAPSED_HEIGHT,
  COLLAPSED_WIDTH,
  isContainerType,
} from '../types/c4'
import {
  isNodeHidden,
  isEffectivelyCollapsed,
  getViewVisibleAncestor,
  isAncestorOf,
  effectiveNodeHeight,
  effectiveNodeWidth,
} from './viewModel'

/**
 * Multi-pass sibling overlap separation.
 * The dragged node stays fixed; siblings on the same parent level are pushed
 * apart until there are no more overlaps or max iterations are reached.
 * Returns a map of id → new {x, y} for nodes that actually moved.
 */
const COLLISION_MARGIN = 10

export function separateSiblings(
  draggedId: string,
  nodes: Record<string, C4Node>,
): Record<string, { x: number; y: number }> {
  const dragged = nodes[draggedId]
  if (!dragged) return {}

  // Visible siblings at the same parent level
  const siblings = Object.values(nodes).filter(
    (n) => n.parentId === dragged.parentId && !isNodeHidden(n.id, nodes),
  )
  if (siblings.length < 2) return {}

  // Working copy of mutable positions
  const pos: Record<string, { x: number; y: number; w: number; h: number }> = {}
  for (const n of siblings) {
    pos[n.id] = { x: n.x, y: n.y, w: effectiveNodeWidth(n), h: effectiveNodeHeight(n) }
  }

  const hasParent = !!dragged.parentId

  for (let pass = 0; pass < 20; pass++) {
    let anyOverlap = false

    for (let i = 0; i < siblings.length; i++) {
      for (let j = i + 1; j < siblings.length; j++) {
        const a = siblings[i]
        const b = siblings[j]
        const pa = pos[a.id]
        const pb = pos[b.id]

        const ox = Math.min(pa.x + pa.w, pb.x + pb.w) - Math.max(pa.x, pb.x) + COLLISION_MARGIN
        const oy = Math.min(pa.y + pa.h, pb.y + pb.h) - Math.max(pa.y, pb.y) + COLLISION_MARGIN

        if (ox > 0 && oy > 0) {
          anyOverlap = true
          const fixA = a.id === draggedId
          const fixB = b.id === draggedId

          if (ox <= oy) {
            const dir = pa.x < pb.x ? 1 : -1
            if (fixA) {
              pb.x += dir * ox
              // If pushed past parent boundary, split: clamp sibling, push dragged
              if (hasParent && pb.x < 0) {
                pa.x += -pb.x // push dragged by the overflow amount
                pb.x = 0
              }
            } else if (fixB) {
              pa.x -= dir * ox
              if (hasParent && pa.x < 0) {
                pb.x += -pa.x
                pa.x = 0
              }
            } else {
              pa.x -= (dir * ox) / 2
              pb.x += (dir * ox) / 2
              if (hasParent) {
                if (pa.x < 0) {
                  pb.x += -pa.x
                  pa.x = 0
                }
                if (pb.x < 0) {
                  pa.x += -pb.x
                  pb.x = 0
                }
              }
            }
          } else {
            const dir = pa.y < pb.y ? 1 : -1
            if (fixA) {
              pb.y += dir * oy
              if (hasParent && pb.y < 0) {
                pa.y += -pb.y
                pb.y = 0
              }
            } else if (fixB) {
              pa.y -= dir * oy
              if (hasParent && pa.y < 0) {
                pb.y += -pa.y
                pa.y = 0
              }
            } else {
              pa.y -= (dir * oy) / 2
              pb.y += (dir * oy) / 2
              if (hasParent) {
                if (pa.y < 0) {
                  pb.y += -pa.y
                  pa.y = 0
                }
                if (pb.y < 0) {
                  pa.y += -pb.y
                  pb.y = 0
                }
              }
            }
          }
        }
      }
    }

    if (!anyOverlap) break
  }

  // ── Final sweep: resolve chain overlaps among non-dragged siblings ────────
  // The pairwise solver can fail when 3+ elements form a chain (C pushes B
  // into A). A linear sweep guarantees no overlaps between non-dragged nodes.
  if (hasParent) {
    const nonDragged = siblings.filter((s) => s.id !== draggedId)

    // Horizontal sweep (left → right): only for elements on the same row
    nonDragged.sort((a, b) => pos[a.id].x - pos[b.id].x)
    for (let k = 0; k < nonDragged.length; k++) {
      const p = pos[nonDragged[k].id]
      if (p.x < 0) p.x = 0
      if (k > 0) {
        const prev = pos[nonDragged[k - 1].id]
        // Only adjust if they actually overlap vertically (same row)
        const vyOverlap = Math.min(prev.y + prev.h, p.y + p.h) - Math.max(prev.y, p.y)
        if (vyOverlap > 0) {
          const minX = prev.x + prev.w + COLLISION_MARGIN
          if (p.x < minX) p.x = minX
        }
      }
    }

    // Vertical sweep (top → bottom): only for elements in the same column
    nonDragged.sort((a, b) => pos[a.id].y - pos[b.id].y)
    for (let k = 0; k < nonDragged.length; k++) {
      const p = pos[nonDragged[k].id]
      if (p.y < 0) p.y = 0
      if (k > 0) {
        const prev = pos[nonDragged[k - 1].id]
        // Only adjust if they actually overlap horizontally (same column)
        const vxOverlap = Math.min(prev.x + prev.w, p.x + p.w) - Math.max(prev.x, p.x)
        if (vxOverlap > 0) {
          const minY = prev.y + prev.h + COLLISION_MARGIN
          if (p.y < minY) p.y = minY
        }
      }
    }
  }

  // Return only nodes that actually moved
  const result: Record<string, { x: number; y: number }> = {}
  for (const sib of siblings) {
    if (pos[sib.id].x !== sib.x || pos[sib.id].y !== sib.y) {
      result[sib.id] = { x: pos[sib.id].x, y: pos[sib.id].y }
    }
  }
  return result
}

export function deriveRFNodes(
  nodes: Record<string, C4Node>,
  viewFilter?: Set<string>,
  viewCollapsedSet?: Set<string>,
  ghostIds?: Set<string>,
  locked?: boolean,
  expandedSet?: Set<string>,
): Node<C4NodeRFData>[] {
  const rfNodes: Node<C4NodeRFData>[] = []

  // React Flow requires parents to appear before their children. Sort by
  // ancestor depth (roots first), then by type for stable ordering inside a
  // depth band. Type-based ordering alone is wrong as soon as containers can
  // nest (e.g. a sub-system inside a system) — comparing by type without
  // depth would put the sub-system before its parent and React Flow would
  // silently drop the parentNode link.
  const depthCache = new Map<string, number>()
  const depthOf = (id: string): number => {
    const cached = depthCache.get(id)
    if (cached !== undefined) return cached
    const n = nodes[id]
    const d = n?.parentId ? depthOf(n.parentId) + 1 : 0
    depthCache.set(id, d)
    return d
  }
  const typeRank = (t: string): number => {
    if (t === 'domain') return 0
    if (t === 'group') return 0
    if (t === 'system') return 0
    if (t === 'container' || t === 'database' || t === 'webapp' || t === 'queue') return 1
    if (t === 'component') return 2
    return 3
  }
  const sorted = Object.values(nodes)
    .filter((n) => !viewFilter || viewFilter.has(n.id))
    .sort((a, b) => {
      const da = depthOf(a.id)
      const db = depthOf(b.id)
      if (da !== db) return da - db
      return typeRank(a.type) - typeRank(b.type)
    })

  // Pre-compute which nodes have children among view-visible nodes.
  // Using `sorted` (already filtered by viewFilter) ensures that a parent
  // whose children are excluded from the current view renders at
  // COLLAPSED_HEIGHT instead of its full model height.
  const parentSet = new Set(sorted.map((n) => n.parentId).filter(Boolean))

  // Minimum top offset for children inside an expanded parent — must clear
  // the header (~30px) + 2-line label (~52px) + small gap. Mirrors the value
  // used by ELK / smartLayout / fitParentToChildren.
  const PARENT_LABEL_PAD = 110

  for (const n of sorted) {
    const hidden = isNodeHidden(n.id, nodes, viewCollapsedSet, expandedSet)
    const hasChildren = parentSet.has(n.id)
    const collapsed = isEffectivelyCollapsed(n, viewCollapsedSet, expandedSet)
    const isGhost = ghostIds?.has(n.id) ?? false

    // Fixed-size node types always render at canonical NODE_SIZES regardless of
    // what is stored in the document (handles legacy nodes created with old sizes).
    const isFixedSize = n.type === 'adr' || n.type === 'fitness-fn' || n.type === 'requirement'

    const effHeight = isFixedSize
      ? NODE_SIZES[n.type].height
      : // Render at COLLAPSED_HEIGHT when:
        //   a) node is effectively collapsed (model or view-collapse), OR
        //   b) no children are visible in this view AND the node is not model-
        //      collapsed-but-view-expanded (in that case n.height holds the last
        //      expanded height which the user intentionally revealed).
        isContainerType(n.type) && (collapsed || (!hasChildren && !n.collapsed))
        ? COLLAPSED_HEIGHT[n.type]
        : n.height
    const effWidth = isFixedSize
      ? NODE_SIZES[n.type].width
      : isContainerType(n.type) && (collapsed || (!hasChildren && !n.collapsed))
        ? COLLAPSED_WIDTH[n.type]
        : n.width

    // Render-time safeguard: if a child sits too close to its parent's top
    // (because the saved layout pre-dates the larger header padding), push
    // the visible position down without mutating the model.
    let renderY = n.y
    if (n.parentId) {
      const parent = nodes[n.parentId]
      const parentExpanded =
        parent &&
        isContainerType(parent.type) &&
        !isEffectivelyCollapsed(parent, viewCollapsedSet, expandedSet) &&
        parentSet.has(parent.id)
      if (parentExpanded && renderY < PARENT_LABEL_PAD) {
        renderY = PARENT_LABEL_PAD
      }
    }

    rfNodes.push({
      id: n.id,
      type: n.type,
      position: { x: n.x, y: renderY },
      parentNode: n.parentId,
      extent: undefined,
      expandParent: false,
      hidden,
      // Ghost nodes (removed-in-current-milestone overlay) are not selectable
      // or draggable — they only exist as a visual diff hint.
      // In viewer/presenter modes (`locked`), nothing is draggable so the
      // saved layout cannot drift while someone browses the document.
      selectable: !hidden && !isGhost && !locked,
      draggable: !hidden && !isGhost && !locked,
      className: isGhost ? 'rf-node-ghost' : undefined,
      data: {
        c4id: n.id,
        type: n.type,
        label: n.label,
        description: n.description,
        technology: n.technology,
        parentId: n.parentId,
        collapsed,
        external: n.external,
        width: effWidth,
        height: effHeight,
        hasChildren,
      },
      style: {
        width: effWidth,
        height: effHeight,
      },
      width: effWidth,
      height: effHeight,
      // Stack deeper nodes above their ancestors so a sub-system rendered
      // inside another system doesn't get hidden behind it.
      zIndex:
        depthOf(n.id) * 10 +
        (n.type === 'domain' || n.type === 'group'
          ? -1
          : n.type === 'system'
            ? 0
            : n.type === 'container'
              ? 1
              : 2),
    })
  }
  return rfNodes
}

export function deriveRFEdges(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  viewFilter?: Set<string>,
  viewCollapsedSet?: Set<string>,
  hiddenRelationIds?: Set<string>,
  expandedSet?: Set<string>,
): Edge<C4EdgeRFData>[] {
  const rfEdges: Edge<C4EdgeRFData>[] = []
  // Track virtual edges already emitted to avoid duplicates
  const seen = new Set<string>()

  // Depth-based zIndex — mirrors deriveRFNodes so edges always render above
  // their parent group nodes and are reachable by pointer events.
  const depthCache = new Map<string, number>()
  const depthOf = (id: string): number => {
    const cached = depthCache.get(id)
    if (cached !== undefined) return cached
    const n = nodes[id]
    const d = n?.parentId ? depthOf(n.parentId) + 1 : 0
    depthCache.set(id, d)
    return d
  }

  for (const rel of Object.values(relations)) {
    if (!nodes[rel.sourceId] || !nodes[rel.targetId]) continue
    if (hiddenRelationIds && hiddenRelationIds.has(rel.id)) continue

    const visSource = getViewVisibleAncestor(rel.sourceId, nodes, viewFilter, viewCollapsedSet, expandedSet)
    const visTarget = getViewVisibleAncestor(rel.targetId, nodes, viewFilter, viewCollapsedSet, expandedSet)

    if (visSource === visTarget) continue // collapsed to same ancestor → self-loop, skip

    // If filtering by view, both endpoints must be in the view
    if (viewFilter && (!viewFilter.has(visSource) || !viewFilter.has(visTarget))) continue

    // Skip "parent ↔ own descendant" virtual edges. They appear when a child
    // is in the view and its sibling (also a child of the same parent) is NOT
    // in the view: that sibling resolves up to the parent, producing a
    // misleading visual link from the child to its own parent. Hide them.
    if (visSource !== rel.sourceId || visTarget !== rel.targetId) {
      if (isAncestorOf(visSource, visTarget, nodes) || isAncestorOf(visTarget, visSource, nodes)) {
        continue
      }
    }

    const key = `${visSource}→${visTarget}`
    const isVirtual = visSource !== rel.sourceId || visTarget !== rel.targetId

    if (seen.has(key)) {
      // Append label to existing edge instead of duplicating
      const existing = rfEdges.find((e) => e.source === visSource && e.target === visTarget)
      if (existing && rel.label) {
        existing.label = existing.label ? `${existing.label}\n${rel.label}` : rel.label
      }
      continue
    }
    seen.add(key)

    // Edge must render above the parent containers of its endpoints so it's
    // not hidden behind them. Use the same depth * 10 formula as deriveRFNodes
    // so edges inside nested structures always exceed their parent's zIndex.
    const srcDepth = depthOf(visSource)
    const tgtDepth = depthOf(visTarget)
    const edgeZIndex = Math.max(srcDepth, tgtDepth) * 10 + 5

    rfEdges.push({
      id: isVirtual ? `virtual-${key}` : rel.id,
      source: visSource,
      target: visTarget,
      type: 'c4relation',
      animated: false,
      zIndex: edgeZIndex,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
      label: rel.label,
      data: {
        originalSourceId: rel.sourceId,
        originalTargetId: rel.targetId,
        label: rel.label,
        technology: rel.technology,
        relationType: rel.relationType,
        isVirtual,
      },
    })
  }
  return rfEdges
}
