import React, { useState, useCallback, useMemo } from 'react'
import { useDiagramStore } from '../store/diagramStore'
import type { C4Node, C4ElementType } from '@radical/common/c4'
import { NODE_COLORS, NODE_FG, TYPE_LABELS, nodeTypeSize, viewShowsEveryNode } from '@radical/common/c4'
import { isParentAllowed, isPlacementAllowed } from '@radical/common/metamodel'
import { ElementPalette, usePaletteCollapsed } from './ElementPalette'
import { pipelineActive, pipelineOf, structureRows, type ChainRow, type PipelineContext } from '@radical/common/viewPipeline'
import { nodeSummary } from '@radical/common/nodeSummary'

// ─── Table view ──────────────────────────────────────────────────────────────
// Shows what the view's steps give (viewPipeline.ts, set in the Nodes panel)
// as a tree: the chain's levels — needs, the requirements under each, the
// scenarios under those — or, without a chain, the elements' containment.
// Each row is an element: its name, edited in place, with a guide line per
// level and its type beside it (a row with rows under it folds them away),
// and its summary (nodeSummary.ts: a requirement's EARS sentence, a
// scenario's Given / When / Then, …). The palette's types drop onto a row
// to nest.

interface ColDef {
  key: 'label' | 'summary'
  label: string
  width: number
}

const COLS: ColDef[] = [
  { key: 'label',   label: 'Name',    width: 420 },
  { key: 'summary', label: 'Summary', width: 420 },
]

interface EditCell {
  rowId: string
  draft: string
  /** What the cell held when it was opened. */
  initial: string
}

export function TableView(): React.ReactElement {
  const nodes            = useDiagramStore((s) => s.c4Nodes)
  const relations        = useDiagramStore((s) => s.c4Relations)
  const updateNode       = useDiagramStore((s) => s.updateNode)
  const selectNode       = useDiagramStore((s) => s.selectNode)
  const selectedNodeId   = useDiagramStore((s) => s.selectedNodeId)
  const activeViewId     = useDiagramStore((s) => s.activeViewId)
  const activeView       = useDiagramStore((s) => s.activeViewId ? s.views[s.activeViewId] : undefined)
  const addNodeToView    = useDiagramStore((s) => s.addNodeToView)
  const requestCreateNode = useDiagramStore((s) => s.requestCreateNode)
  const pushNotification = useDiagramStore((s) => s.pushNotification)
  const readOnly         = useDiagramStore((s) => s.appMode !== 'designer')
  const metamodel        = useDiagramStore((s) => s.metamodel)

  // The palette, as above the canvas: its types drop onto a row to nest.
  const [paletteCollapsed, togglePalette] = usePaletteCollapsed()
  const [editCell, setEditCell]   = useState<EditCell | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [dropParentId, setDropParentId] = useState<string | null>(null)
  const [dragKind, setDragKind] = useState<'new' | 'existing' | null>(null)

  // The rows: the chain's tree; without a chain, the containment of what
  // the steps give (flat in their order when they set one).
  const pipeline = pipelineOf(activeView)
  const pipelineCtx = useMemo<PipelineContext>(() => ({ nodes, relations, metamodel }), [nodes, relations, metamodel])
  const allRows = useMemo<ChainRow[]>(() => structureRows(activeView, pipelineCtx), [activeView, pipelineCtx])

  // A row with rows under it folds them away.
  const [foldedRows, setFoldedRows] = useState<ReadonlySet<string>>(() => new Set())
  const toggleRowFold = useCallback((path: string) => {
    setFoldedRows((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])
  const rows = useMemo(() => {
    const folded = [...foldedRows]
    return folded.length ? allRows.filter((row) => !folded.some((p) => row.path.startsWith(p + '/'))) : allRows
  }, [allRows, foldedRows])

  const onDragOver = useCallback((e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer.types)
    const isNew = types.includes('application/c4-type')
    const isExisting = types.includes('application/c4-node-id')
    if (!isNew && !isExisting) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
    setDragKind(isNew ? 'new' : 'existing')
    if (isNew) {
      // Highlight the row under the cursor — it will become the parent.
      const rowEl = (e.target as HTMLElement).closest('.tv-row') as HTMLElement | null
      setDropParentId(rowEl?.dataset.nodeId ?? null)
    } else {
      setDropParentId(null)
    }
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
      setDropParentId(null)
      setDragKind(null)
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    setDropParentId(null)
    setDragKind(null)

    // ── Case 1: new node dragged from the palette ──────────────────────────
    const typeStr = e.dataTransfer.getData('application/c4-type')
    if (typeStr) {
      const mm = useDiagramStore.getState().metamodel
      const size = nodeTypeSize(typeStr, mm)
      const def = mm?.nodeTypes[typeStr]
      const label = def?.label ?? (typeStr[0].toUpperCase() + typeStr.slice(1))
      const allowedParents = def?.allowedParents ?? []

      // Detect the table row under the drop point — its node is the candidate parent.
      const rowEl = (e.target as HTMLElement).closest('.tv-row') as HTMLElement | null
      const dropOnNodeId = rowEl?.dataset.nodeId
      const dropOnNode = dropOnNodeId ? nodes[dropOnNodeId] : undefined

      let parentId: string | undefined = undefined
      if (dropOnNode) {
        if (isPlacementAllowed(mm, typeStr, dropOnNode, nodes)) {
          // Dropped onto a valid parent row.
          parentId = dropOnNode.id
        } else if (dropOnNode.parentId && isPlacementAllowed(mm, typeStr, nodes[dropOnNode.parentId], nodes)) {
          // Dropped onto a sibling row — inherit its (valid) parent.
          parentId = dropOnNode.parentId
        } else {
          const allowedStr = allowedParents.length
            ? allowedParents.map(t => mm?.nodeTypes[t]?.label ?? t).join(', ')
            : 'the model root'
          pushNotification(`Cannot place ${label} on "${dropOnNode.label}". Drop it onto a ${allowedStr} row.`, 'error')
          return
        }
      } else if (!isParentAllowed(mm, typeStr, undefined)) {
        // Dropped on empty area but this type needs a parent.
        const allowedStr = allowedParents.length
          ? allowedParents.map(t => mm?.nodeTypes[t]?.label ?? t).join(', ')
          : 'a parent'
        pushNotification(`${label} must be dropped onto a ${allowedStr} row.`, 'error')
        return
      }

      // Validates parent/cardinality (pushes its own error toast on failure),
      // opens the type's wizard when it has one, and auto-adds the created
      // node to the active view.
      const where = parentId ? ` inside "${nodes[parentId]?.label ?? parentId}"` : ''
      requestCreateNode({
        type: typeStr as C4ElementType,
        label,
        description: '',
        technology: '',
        collapsed: false,
        external: false,
        parentId,
        x: 0,
        y: 0,
        ...size,
      }, {
        onCreated: () => pushNotification(`${label} added to the model${where}.`, 'info'),
      })
      return
    }

    // ── Case 2: existing node dragged from the Nodes panel → add to view ───
    const nodeId = e.dataTransfer.getData('application/c4-node-id')
    if (!nodeId || !activeViewId || !activeView) return

    const node = nodes[nodeId]
    if (!node) { pushNotification('Node not found.', 'error'); return }

    if (viewShowsEveryNode(activeView) || activeView.nodeIds.includes(nodeId)) {
      pushNotification(`"${node.label}" is already in this view.`, 'warning')
      return
    }
    addNodeToView(activeViewId, nodeId)
    pushNotification(`"${node.label}" added to view.`, 'info')
  }, [activeViewId, activeView, nodes, requestCreateNode, addNodeToView, pushNotification])

  const commitEdit = useCallback(() => {
    if (!editCell) return
    const { rowId, draft, initial } = editCell
    // Left without a change, or emptied: nothing to save (no undo step that does nothing).
    if (draft.trim() && draft !== initial) updateNode(rowId, { label: draft.trim() } as Partial<C4Node>)
    setEditCell(null)
  }, [editCell, updateNode])

  const cancelEdit = useCallback(() => setEditCell(null), [])

  const startEdit = useCallback((rowId: string, current: string) => {
    if (readOnly) return
    setEditCell({ rowId, draft: current, initial: current })
  }, [readOnly])

  function renderCell(row: ChainRow, col: ColDef): React.ReactNode {
    const node = row.node

    // The summary is read only: it is made of several fields, edited in the properties panel.
    if (col.key === 'summary') {
      const summary = nodeSummary(node, nodes, relations)
      return (
        <span className="tv-cell-value tv-cell-summary" title={summary}>
          {summary ? <span className="tv-summary-text">{summary}</span> : <span className="tv-cell-placeholder">—</span>}
        </span>
      )
    }

    const rawVal = node.label
    if (editCell?.rowId === node.id) {
      return (
        <input
          autoFocus
          type="text"
          className="tv-cell-input"
          value={editCell.draft}
          onChange={(e) => setEditCell({ ...editCell, draft: e.target.value })}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') cancelEdit()
            if (e.key === 'Enter') commitEdit()
            if (e.key === 'Tab') { e.preventDefault(); commitEdit() }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )
    }

    // The name, with the tree: a guide line per level above, the fold, the type.
    const folded = foldedRows.has(row.path)
    return (
      <span
        className="tv-cell-value tv-chain-cell"
        onClick={(e) => { e.stopPropagation(); startEdit(node.id, rawVal) }}
        title={rawVal || 'Click to edit'}
      >
        {Array.from({ length: row.depth }, (_, i) => <span key={i} className="tv-tree-guide" aria-hidden />)}
        {row.hasChildren ? (
          <button className={`tv-group-toggle${folded ? '' : ' open'}`} aria-expanded={!folded}
            aria-label={folded ? `Show what hangs under ${rawVal}` : `Fold what hangs under ${rawVal}`}
            onClick={(e) => { e.stopPropagation(); toggleRowFold(row.path) }}>
            <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden><path d="M5 3 L11 8 L5 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        ) : <span className="tv-group-toggle-space" />}
        <span className="tv-chain-type" style={{ background: NODE_COLORS[node.type] ?? metamodel.nodeTypes[node.type]?.color ?? '#555', color: NODE_FG[node.type] ?? '#fff' }}>
          {metamodel.nodeTypes[node.type]?.label ?? TYPE_LABELS[node.type] ?? node.type}
        </span>
        {rawVal || <span className="tv-cell-placeholder">Click to edit…</span>}
        {row.alsoIn > 0 && (
          <span className="tv-also-in" title={`Also under ${row.alsoIn} other element${row.alsoIn === 1 ? '' : 's'}`}>+{row.alsoIn}</span>
        )}
      </span>
    )
  }

  return (
    <div
      className={`tv-wrap${isDragOver ? ' tv-drop-active' : ''}`}
      onClick={() => setEditCell(null)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Drop overlay */}
      {isDragOver && (
        dragKind === 'new' && dropParentId && nodes[dropParentId] ? (
          // Hovering a specific row — show a compact pill, keep the row visible.
          <div className="tv-drop-pill">
            <span className="tv-drop-icon">＋</span>
            <span>Add inside <strong>{nodes[dropParentId].label}</strong></span>
          </div>
        ) : (
          <div className="tv-drop-overlay">
            <div className="tv-drop-overlay-inner">
              <span className="tv-drop-icon">＋</span>
              <span>
                {dragKind === 'existing'
                  ? 'Drop to add to view'
                  : 'Drop onto a row to nest, or here to add at root'}
              </span>
            </div>
          </div>
        )
      )}

      {!readOnly && <ElementPalette collapsed={paletteCollapsed} onToggleCollapsed={togglePalette} />}

      <div className="tv-table-wrap">
        <table className="tv-table">
          <colgroup>
            {COLS.map(c => <col key={c.key} style={{ width: c.width }} />)}
          </colgroup>
          <thead>
            <tr>
              {COLS.map(c => <th key={c.key} className="tv-th">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="tv-empty" colSpan={COLS.length}>{pipelineActive(pipeline) ? "No elements pass the view's steps." : 'No nodes.'}</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={row.path}
                data-node-id={row.node.id}
                className={`tv-row tv-chain-row depth-${Math.min(row.depth, 3)}${selectedNodeId === row.node.id ? ' tv-row-selected' : ''}${dropParentId === row.node.id ? ' tv-row-drop-parent' : ''}`}
                onClick={(e) => { e.stopPropagation(); selectNode(row.node.id) }}
              >
                {COLS.map(col => (
                  <td key={col.key} className="tv-td">{renderCell(row, col)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
