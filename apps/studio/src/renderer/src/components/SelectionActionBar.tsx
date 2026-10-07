import React, { useMemo, useState, useRef, useEffect } from 'react'
import { activeLayoutConstraints, childrenInView, useDiagramStore } from '@radical/ui/store/diagramStore'
import { standingOrder } from '@radical/layout/constraints'
import { loadStudioSettings, saveStudioSettings } from '@radical/ui/studioSettings'
import { isParentAllowed } from '@radical/common/metamodel'
import { defaultGridColumns } from '@radical/common/c4'

/**
 * Floating action bar that appears over the canvas whenever one or more
 * nodes are selected. It surfaces:
 *  • the selection count,
 *  • a "Wrap into…" menu (only types that the metamodel allows for the
 *    current sibling group),
 *  • an "Align…" menu: keep two or more nodes in a row or a column on this
 *    canvas (optionally in the order they were selected, a remembered choice),
 *    or three or more in a grid filled in selection order; with one container
 *    selected, the same for its children, in the order they stand (a
 *    collapsed one's children line up when it is expanded),
 *    or stop keeping the alignments wholly inside the selection,
 *  • a destructive Delete button.
 */
export function SelectionActionBar(): React.ReactElement | null {
  const selectedNodeIds = useDiagramStore((s) => s.selectedNodeIds)
  const c4Nodes = useDiagramStore((s) => s.c4Nodes)
  const metamodel = useDiagramStore((s) => s.metamodel)
  const wrap = useDiagramStore((s) => s.wrapSelectionInNewParent)
  const removeNode = useDiagramStore((s) => s.removeNode)
  const unwrapNode = useDiagramStore((s) => s.unwrapNode)
  const reparentNodes = useDiagramStore((s) => s.reparentNodes)
  const setSelectedNodeIds = useDiagramStore((s) => s.setSelectedNodeIds)
  const appMode = useDiagramStore((s) => s.appMode)
  const activeViewId = useDiagramStore((s) => s.activeViewId)
  const removeNodeFromView = useDiagramStore((s) => s.removeNodeFromView)
  const constraints = useDiagramStore(activeLayoutConstraints)
  const addAlignment = useDiagramStore((s) => s.addAlignment)
  const addGrid = useDiagramStore((s) => s.addGrid)
  const removeLayoutConstraint = useDiagramStore((s) => s.removeLayoutConstraint)

  const [menuOpen, setMenuOpen] = useState(false)
  const [moveMenuOpen, setMoveMenuOpen] = useState(false)
  const [alignMenuOpen, setAlignMenuOpen] = useState(false)
  const [keepOrder, setKeepOrder] = useState(() => loadStudioSettings().alignKeepsOrder)
  // Grid columns offered for the current selection: about square until changed.
  const [gridColumns, setGridColumns] = useState<{ count: number; columns: number } | null>(null)
  // What Align… works on: the selection, or the one selected container's
  // children in this view (ordered as they stand, or last stood while the
  // container is collapsed, when applied).
  const childCount = useDiagramStore((s) => (s.selectedNodeIds.length === 1 ? childrenInView(s, s.selectedNodeIds[0]).boxes.length : 0))
  const childrenDrawn = useDiagramStore((s) => (s.selectedNodeIds.length === 1 ? childrenInView(s, s.selectedNodeIds[0]).drawn : false))
  const ofChildren = selectedNodeIds.length === 1 && childCount >= 2
  const alignCount = ofChildren ? childCount : selectedNodeIds.length
  const alignIds = (layout: 'horizontal' | 'vertical' | 'grid'): string[] => (ofChildren
    ? standingOrder(childrenInView(useDiagramStore.getState(), selectedNodeIds[0]).boxes, layout)
    : [...selectedNodeIds])
  const orderHint = ofChildren ? (childrenDrawn ? 'as they stand now' : 'as they last stood') : 'in selection order'
  const columns = gridColumns?.count === alignCount ? gridColumns.columns : defaultGridColumns(alignCount)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const moveMenuRef = useRef<HTMLDivElement | null>(null)
  const alignMenuRef = useRef<HTMLDivElement | null>(null)

  // Close menu on outside click.
  useEffect(() => {
    if (!menuOpen && !moveMenuOpen && !alignMenuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
      if (moveMenuOpen && moveMenuRef.current && !moveMenuRef.current.contains(e.target as Node)) {
        setMoveMenuOpen(false)
      }
      if (alignMenuOpen && alignMenuRef.current && !alignMenuRef.current.contains(e.target as Node)) {
        setAlignMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [menuOpen, moveMenuOpen, alignMenuOpen])

  // Compute wrapper candidates for the current selection. We surface ALL
  // node types from the metamodel and mark each one as enabled/disabled with
  // a human-readable reason — an empty list is far less useful than "here is
  // why nothing fits".
  const wrappers = useMemo(() => {
    if (selectedNodeIds.length === 0 || !metamodel) {
      return [] as { id: string; label: string; disabled: boolean; reason?: string }[]
    }
    const nodes = selectedNodeIds.map(id => c4Nodes[id]).filter(Boolean)
    if (nodes.length === 0) return []
    const commonParentId = nodes[0].parentId ?? null
    const sameParent = nodes.every(n => (n.parentId ?? null) === commonParentId)
    const commonParent = commonParentId ? c4Nodes[commonParentId] : undefined
    const commonParentLabel = commonParent
      ? (metamodel.nodeTypes[commonParent.type]?.label ?? commonParent.type)
      : 'the canvas root'

    const result: { id: string; label: string; disabled: boolean; reason?: string }[] = []
    for (const def of Object.values(metamodel.nodeTypes)) {
      let disabled = false
      let reason: string | undefined

      if (!sameParent) {
        disabled = true
        reason = 'Selected nodes have different parents — select siblings only.'
      } else if (nodes.length === 1 && nodes[0].type === def.id) {
        disabled = true
        reason = `Already a ${def.label}.`
      } else if (!isParentAllowed(metamodel, def.id, commonParent?.type)) {
        disabled = true
        const allowed = def.allowedParents
        const allowedStr = allowed && allowed.length
          ? allowed.map(t => metamodel.nodeTypes[t]?.label ?? t).join(', ')
          : 'the canvas root'
        reason = `${def.label} cannot live inside ${commonParentLabel}. Allowed: ${allowedStr}.`
      } else {
        const bad = nodes.find(n => !isParentAllowed(metamodel, n.type, def.id))
        if (bad) {
          const childDef = metamodel.nodeTypes[bad.type]
          const childLabel = childDef?.label ?? bad.type
          const allowed = childDef?.allowedParents
          const allowedStr = allowed && allowed.length
            ? allowed.map(t => metamodel.nodeTypes[t]?.label ?? t).join(', ')
            : 'the canvas root'
          disabled = true
          reason = `${childLabel} "${bad.label}" cannot live inside ${def.label}. Allowed: ${allowedStr}.`
        }
      }
      result.push({ id: def.id, label: def.label, disabled, reason })
    }
    // Only keep what the user can actually do.
    return result
      .filter(r => !r.disabled)
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [selectedNodeIds, c4Nodes, metamodel])

  // Compute eligible "Move to…" target parents. Includes every existing node
  // (plus a synthetic "Canvas root" entry) where:
  //   • all selected nodes share the same current parent,
  //   • the target is not the current parent (no-op),
  //   • the target is not one of the selected nodes nor any of their
  //     descendants (would create a cycle),
  //   • the metamodel allows each selected child's type inside the target.
  const moveTargets = useMemo(() => {
    if (selectedNodeIds.length === 0 || !metamodel) {
      return [] as { id: string | null; label: string; path: string }[]
    }
    const nodes = selectedNodeIds.map((id) => c4Nodes[id]).filter(Boolean)
    if (nodes.length === 0) return []
    const commonParentId = nodes[0].parentId ?? null
    const sameParent = nodes.every((n) => (n.parentId ?? null) === commonParentId)
    if (!sameParent) return []

    // Build the forbidden set: selected nodes + all their descendants.
    const forbidden = new Set<string>(selectedNodeIds)
    const collectDescendants = (id: string): void => {
      for (const n of Object.values(c4Nodes)) {
        if (n.parentId === id && !forbidden.has(n.id)) {
          forbidden.add(n.id)
          collectDescendants(n.id)
        }
      }
    }
    for (const id of selectedNodeIds) collectDescendants(id)

    const pathOf = (id: string | null): string => {
      if (!id) return 'Canvas root'
      const segs: string[] = []
      let cur = c4Nodes[id]
      const seen = new Set<string>()
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id)
        segs.unshift(cur.label || cur.type)
        cur = cur.parentId ? c4Nodes[cur.parentId] : (undefined as unknown as typeof cur)
      }
      return segs.join(' / ')
    }

    const isAllowedTarget = (targetType: string | undefined): boolean =>
      nodes.every((n) => isParentAllowed(metamodel, n.type, targetType))

    const out: { id: string | null; label: string; path: string }[] = []
    // Root option (only when not already at root and all selected types are
    // permitted at root).
    if (commonParentId !== null && isAllowedTarget(undefined)) {
      out.push({ id: null, label: 'Canvas root', path: 'Canvas root' })
    }
    for (const cand of Object.values(c4Nodes)) {
      if (forbidden.has(cand.id)) continue
      if (cand.id === commonParentId) continue
      if (!isAllowedTarget(cand.type)) continue
      const labelDef = metamodel.nodeTypes[cand.type]
      const typeLabel = labelDef?.label ?? cand.type
      out.push({
        id: cand.id,
        label: `${cand.label || cand.type} (${typeLabel})`,
        path: pathOf(cand.id),
      })
    }
    return out.sort((a, b) => a.path.localeCompare(b.path))
  }, [selectedNodeIds, c4Nodes, metamodel])

  if (appMode !== 'designer') return null
  if (selectedNodeIds.length === 0) return null

  // Unwrap is offered only when exactly one node is selected AND it has at
  // least one direct child — otherwise the action would be identical to
  // plain Delete (or a no-op).
  const onlyId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null
  const onlyNode = onlyId ? c4Nodes[onlyId] : null
  const hasChildren = !!onlyNode && Object.values(c4Nodes).some((n) => n.parentId === onlyNode.id)
  const canUnwrap = !!onlyNode && hasChildren

  const aligning = new Set(ofChildren ? childrenInView(useDiagramStore.getState(), selectedNodeIds[0]).boxes.map((c) => c.id) : selectedNodeIds)
  const alignedHere = constraints.filter((c) => c.nodeIds.every((id) => aligning.has(id)))

  const onDelete = (): void => {
    // Use the same "model vs view" resolution that the Delete-key path uses.
    // Simpler: drop them straight from the model (consistent with explicit
    // user intent via the bar). View-only hide stays available via Delete-key.
    const ids = [...selectedNodeIds]
    setSelectedNodeIds([])
    for (const id of ids) removeNode(id)
  }

  return (
    <div className="sel-bar" role="toolbar" aria-label="Selection actions">
      <div className="sel-bar-count">
        <span className="sel-bar-badge">{selectedNodeIds.length}</span>
        <span className="sel-bar-label">
          {selectedNodeIds.length === 1 ? 'node selected' : 'nodes selected'}
        </span>
      </div>
      {wrappers.length > 0 && <div className="sel-bar-divider" />}
      {wrappers.length > 0 && (
        <div className="sel-bar-wrap" ref={menuRef}>
          <button
            type="button"
            className="sel-bar-btn"
            onClick={() => setMenuOpen((o) => !o)}
            title="Wrap into a new container"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="12" height="10" rx="1.5" />
              <path d="M5 7h6M5 10h4" />
            </svg>
            Wrap into…
            <svg viewBox="0 0 10 10" width="9" height="9" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
              <path d="M2 4l3 3 3-3" />
            </svg>
          </button>
          {menuOpen && (
            <div className="sel-bar-menu" role="menu">
              {wrappers.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  role="menuitem"
                  className="sel-bar-menu-item"
                  onClick={() => {
                    setMenuOpen(false)
                    wrap(w.id)
                  }}
                >
                  <span>{w.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="sel-bar-divider" />
      {moveTargets.length > 0 && (
        <>
          <div className="sel-bar-wrap" ref={moveMenuRef}>
            <button
              type="button"
              className="sel-bar-btn"
              onClick={() => setMoveMenuOpen((o) => !o)}
              title="Move the selected nodes into a different parent"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
              Move to…
              <svg viewBox="0 0 10 10" width="9" height="9" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                <path d="M2 4l3 3 3-3" />
              </svg>
            </button>
            {moveMenuOpen && (
              <div className="sel-bar-menu" role="menu">
                {moveTargets.map((t) => (
                  <button
                    key={t.id ?? '__root__'}
                    type="button"
                    role="menuitem"
                    className="sel-bar-menu-item"
                    onClick={() => {
                      setMoveMenuOpen(false)
                      reparentNodes([...selectedNodeIds], t.id)
                    }}
                  >
                    <span>{t.label}</span>
                    {t.id !== null && (
                      <span className="sel-bar-menu-reason">{t.path}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="sel-bar-divider" />
        </>
      )}
      {canUnwrap && (
        <>
          <button
            type="button"
            className="sel-bar-btn"
            onClick={() => {
              const id = onlyNode!.id
              unwrapNode(id)
            }}
            title="Remove this container but keep its direct children and their relations"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 4h12M2 8h12M2 12h12" strokeDasharray="2 2" />
              <path d="M5 2l-3 2 3 2M11 10l3 2-3 2" />
            </svg>
            Unwrap
          </button>
          <div className="sel-bar-divider" />
        </>
      )}
      {alignCount >= 2 && (
        <>
          <div className="sel-bar-wrap" ref={alignMenuRef}>
            <button
              type="button"
              className="sel-bar-btn"
              onClick={() => setAlignMenuOpen((o) => !o)}
              style={{ whiteSpace: 'nowrap' }}
              title={ofChildren ? 'Keep the children of this element in a row, a column or a grid on this canvas' : 'Keep the selected nodes in a row, a column or a grid on this canvas'}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <rect x="1.5" y="5" width="3.5" height="6" rx="0.8" />
                <rect x="10.5" y="4" width="4" height="8" rx="0.8" />
                <path d="M5 8h5.5" strokeDasharray="1.5 1.5" />
              </svg>
              {ofChildren ? 'Align children…' : 'Align…'}
              <svg viewBox="0 0 10 10" width="9" height="9" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                <path d="M2 4l3 3 3-3" />
              </svg>
            </button>
            {alignMenuOpen && (
              <div className="sel-bar-menu sel-bar-menu-wide" role="menu">
                {ofChildren && !childrenDrawn && (
                  <div className="sel-bar-menu-note">Collapsed: its children line up when you expand it.</div>
                )}
                <button
                  type="button"
                  role="menuitem"
                  className="sel-bar-menu-item"
                  onClick={() => { setAlignMenuOpen(false); addAlignment('horizontal', alignIds('horizontal'), { ordered: keepOrder }) }}
                >
                  <span>Keep in a row</span>
                  <span className="sel-bar-menu-reason">Centres on one horizontal line{keepOrder ? `, left to right ${orderHint}` : ''}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="sel-bar-menu-item"
                  onClick={() => { setAlignMenuOpen(false); addAlignment('vertical', alignIds('vertical'), { ordered: keepOrder }) }}
                >
                  <span>Keep in a column</span>
                  <span className="sel-bar-menu-reason">Centres on one vertical line{keepOrder ? `, top to bottom ${orderHint}` : ''}</span>
                </button>
                {alignCount >= 3 && (
                  <div className="sel-bar-menu-grid">
                    <button
                      type="button"
                      role="menuitem"
                      className="sel-bar-menu-item"
                      onClick={() => { setAlignMenuOpen(false); addGrid(alignIds('grid'), columns) }}
                    >
                      <span>Keep in a grid</span>
                      <span className="sel-bar-menu-reason">
                        {columns} {columns === 1 ? 'column' : 'columns'}, row by row {orderHint}
                      </span>
                    </button>
                    <div className="sel-bar-stepper" role="group" aria-label="Grid columns">
                      <button
                        type="button"
                        aria-label="Fewer columns"
                        disabled={columns <= 1}
                        onClick={() => setGridColumns({ count: alignCount, columns: columns - 1 })}
                      >−</button>
                      <span>{columns}</span>
                      <button
                        type="button"
                        aria-label="More columns"
                        disabled={columns >= alignCount}
                        onClick={() => setGridColumns({ count: alignCount, columns: columns + 1 })}
                      >+</button>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={keepOrder}
                  className="sel-bar-menu-item sel-bar-menu-check"
                  onClick={() => {
                    const next = !keepOrder
                    setKeepOrder(next)
                    saveStudioSettings({ ...loadStudioSettings(), alignKeepsOrder: next })
                  }}
                >
                  <span>
                    <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="0.7" y="0.7" width="10.6" height="10.6" rx="2" />
                      {keepOrder && <path d="M3 6.2l2 2 4-4.4" />}
                    </svg>
                    Keep their order
                  </span>
                  <span className="sel-bar-menu-reason">{ofChildren ? 'The order they stand in now' : 'The order you selected them in'}; no layout may swap them</span>
                </button>
                {alignedHere.length > 0 && (
                  <button
                    type="button"
                    role="menuitem"
                    className="sel-bar-menu-item"
                    onClick={() => { setAlignMenuOpen(false); removeLayoutConstraint(alignedHere.map((c) => c.id)) }}
                  >
                    <span>Stop keeping aligned</span>
                    <span className="sel-bar-menu-reason">
                      {alignedHere.length === 1 ? '1 alignment' : `${alignedHere.length} alignments`} {ofChildren ? 'of these children' : 'in this selection'}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="sel-bar-divider" />
        </>
      )}
      {activeViewId && (
        <>
          <button
            type="button"
            className="sel-bar-btn"
            onClick={() => {
              const ids = [...selectedNodeIds]
              setSelectedNodeIds([])
              removeNodeFromView(activeViewId, ids)
            }}
            title="Hide selected nodes from the active view (model is not changed)"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" />
              <path d="M2 2l12 12" />
            </svg>
            Hide from view
          </button>
          <div className="sel-bar-divider" />
        </>
      )}
      <button
        type="button"
        className="sel-bar-btn sel-bar-btn-danger"
        onClick={onDelete}
        title="Delete selected nodes from the model"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4h10M6 4V2.5h4V4M5 4l1 9h4l1-9" />
        </svg>
        Delete
      </button>
    </div>
  )
}
