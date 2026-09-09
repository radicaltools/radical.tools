import React, { useState, useCallback, useMemo } from 'react'
import { useDiagramStore } from '../store/diagramStore'
import type { C4Node, C4Relation, C4ElementType } from '../types/c4'
import { NODE_COLORS, NODE_FG, TYPE_LABELS, NODE_SIZES } from '../types/c4'
import type { Metamodel, PropertyDef } from '../types/metamodel'
import { isParentAllowed, composeEarsSentence, resolveEarsSubject } from '../types/metamodel'

// ─── Column definitions ──────────────────────────────────────────────────────
//
// Node-type tabs are NOT hardcoded per entity — every node type's columns are
// derived from its metamodel `properties` (see `deriveNodeCols`). A type only
// gets its own tab when `NodeTypeDef.tableTab` is set (ADR, Fitness Function,
// Requirement, Blueprint by default); plain C4 elements stay in "All Nodes".
// This is what lets a custom type added via the Metamodel Editor show up
// here automatically, with no code changes.

type CellType = 'text' | 'textarea' | 'enum' | 'boolean' | 'number' | 'readonly'

interface ColDef {
  key: string
  label: string
  width: number
  type: CellType
  options?: string[]
  /** Hide cell when another field on the same row doesn't match. */
  visibleWhen?: { key: string; values: string[] }
}

const ALL_NODES_COLS: ColDef[] = [
  { key: '_type',       label: 'Type',        width: 130, type: 'readonly' },
  { key: 'label',       label: 'Name',        width: 220, type: 'text' },
  { key: 'description', label: 'Description', width: 280, type: 'textarea' },
]

const REL_BASE_COLS: ColDef[] = [
  { key: '_source',    label: 'From',       width: 200, type: 'readonly' },
  { key: '_relType',   label: 'Type',       width: 130, type: 'readonly' },
  { key: '_target',    label: 'To',         width: 200, type: 'readonly' },
  { key: 'label',      label: 'Label',      width: 200, type: 'text' },
  { key: 'technology', label: 'Technology', width: 160, type: 'text' },
]

const NODE_BASE_COL: ColDef = { key: 'label', label: 'Name', width: 220, type: 'text' }

const DEFAULT_COL_WIDTH: Record<CellType, number> = {
  text: 160,
  textarea: 260,
  enum: 140,
  boolean: 90,
  number: 110,
  readonly: 160,
}

function propToCol(p: PropertyDef): ColDef {
  return { key: p.key, label: p.label, width: DEFAULT_COL_WIDTH[p.type], type: p.type, options: p.options, visibleWhen: p.visibleWhen }
}

/** Computed (non-property) columns for specific node types, e.g. the EARS
 *  sentence preview — these can't be expressed as a plain metamodel property
 *  since they're derived from several fields plus the relation graph. */
const COMPUTED_NODE_COLS: Record<string, ColDef[]> = {
  requirement: [{ key: '_ears_sentence', label: 'EARS Sentence', width: 380, type: 'readonly' }],
}

function deriveNodeCols(typeId: string, mm: Metamodel): ColDef[] {
  const props = mm.nodeTypes[typeId]?.properties ?? []
  return [NODE_BASE_COL, ...(COMPUTED_NODE_COLS[typeId] ?? []), ...props.map(propToCol)]
}

/** Node types whose own tab renders as an indented tree instead of a flat
 *  list, using the given relation type as the child→parent edge (e.g. a
 *  Requirement "derives from" the requirement it decomposes). Unlike canvas
 *  containment (`parentId`), this doesn't require the type to be a
 *  container — it's purely a Table View reading of the relation graph. */
const RELATION_TREE_BY_TYPE: Record<string, string> = {
  requirement: 'derives',
}

// ─── Tab definitions ─────────────────────────────────────────────────────────
//
// 'all' and 'relations' are fixed; every other tab id is a node-type id from
// the current metamodel (`NodeTypeDef.tableTab === true`) — see `useMemo`
// below in the component.

type Tab = string

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNodeProp(node: C4Node, key: string, nodes: Record<string, C4Node>, relations?: Record<string, C4Relation>): string {
  if (key === '_type')   return TYPE_LABELS[node.type] ?? node.type
  if (key === '_ears_sentence') return composeEarsSentence(node as unknown as Record<string, unknown>, relations ? resolveEarsSubject(node.id, relations, nodes) : undefined).sentence
  const raw = (node as unknown as Record<string, unknown>)[key]
  if (raw === undefined || raw === null) return ''
  if (typeof raw === 'boolean') return raw ? 'true' : 'false'
  return String(raw)
}

function getRelProp(rel: C4Relation, key: string, nodes: Record<string, C4Node>): string {
  if (key === '_source')  return nodes[rel.sourceId]?.label ?? rel.sourceId
  if (key === '_target')  return nodes[rel.targetId]?.label ?? rel.targetId
  if (key === '_relType') return rel.relationType ?? 'interacts'
  const raw = (rel as unknown as Record<string, unknown>)[key]
  return raw !== undefined && raw !== null ? String(raw) : ''
}

// ─── Inline edit state ───────────────────────────────────────────────────────

interface EditCell {
  rowId: string
  colKey: string
  draft: string
}

// ─── Tree ordering helper ────────────────────────────────────────────────────

interface TreeRow {
  node: C4Node
  depth: number
}

/** Builds an indented row order from any parent-of function — canvas
 *  containment (`parentId`) for "All Nodes", or a relation graph (e.g.
 *  `derives`) for Requirement decomposition. Guards against cycles, which
 *  can't happen for containment but can for a freely user-drawn relation. */
function buildTreeRows(nodeList: C4Node[], getParentId: (n: C4Node) => string | null): TreeRow[] {
  const byParent = new Map<string | null, C4Node[]>()
  for (const n of nodeList) {
    const key = getParentId(n)
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(n)
  }
  const result: TreeRow[] = []
  const seen = new Set<string>()
  function walk(parentId: string | null, depth: number) {
    const children = byParent.get(parentId) ?? []
    for (const n of children) {
      if (seen.has(n.id)) continue // cycle guard
      seen.add(n.id)
      result.push({ node: n, depth })
      walk(n.id, depth + 1)
    }
  }
  walk(null, 0)
  // append any orphans not visited (broken parent refs, or an unreachable cycle)
  for (const n of nodeList) {
    if (!seen.has(n.id)) result.push({ node: n, depth: 0 })
  }
  return result
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TableView(): React.ReactElement {
  const nodes            = useDiagramStore((s) => s.c4Nodes)
  const relations        = useDiagramStore((s) => s.c4Relations)
  const updateNode       = useDiagramStore((s) => s.updateNode)
  const updateRelation   = useDiagramStore((s) => s.updateRelation)
  const selectNode       = useDiagramStore((s) => s.selectNode)
  const selectEdge       = useDiagramStore((s) => s.selectEdge)
  const selectedNodeId   = useDiagramStore((s) => s.selectedNodeId)
  const selectedEdgeId   = useDiagramStore((s) => s.selectedEdgeId)
  const activeViewId     = useDiagramStore((s) => s.activeViewId)
  const activeView       = useDiagramStore((s) => s.activeViewId ? s.views[s.activeViewId] : undefined)
  const addNodeToView    = useDiagramStore((s) => s.addNodeToView)
  const addNode          = useDiagramStore((s) => s.addNode)
  const pushNotification = useDiagramStore((s) => s.pushNotification)
  const readOnly         = useDiagramStore((s) => s.appMode !== 'designer')
  const metamodel        = useDiagramStore((s) => s.metamodel)
  const setTableActiveTab = useDiagramStore((s) => s.setTableActiveTab)

  // Persisted on the view (like wikiFocusId/treemapFocusId) so switching
  // away and back — or reopening the view — restores the selected tab.
  const tab: Tab = activeView?.tableActiveTab ?? 'all'
  const setTab = useCallback((next: Tab) => {
    if (activeViewId) setTableActiveTab(activeViewId, next)
  }, [activeViewId, setTableActiveTab])

  const [editCell, setEditCell]   = useState<EditCell | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [dropParentId, setDropParentId] = useState<string | null>(null)
  const [dragKind, setDragKind] = useState<'new' | 'existing' | null>(null)

  const visibleNodeIds = useMemo<Set<string> | null>(() => {
    if (!activeView || activeView.nodeIds.length === 0) return null
    return new Set(activeView.nodeIds)
  }, [activeView])

  const nodeList = useMemo(() =>
    visibleNodeIds
      ? Object.values(nodes).filter(n => visibleNodeIds.has(n.id))
      : Object.values(nodes),
    [nodes, visibleNodeIds],
  )

  const nodeTabs = useMemo(() =>
    Object.values(metamodel.nodeTypes)
      .filter(t => t.tableTab)
      .map(t => ({ id: t.id, label: t.label })),
    [metamodel],
  )

  const TABS = useMemo(() => [
    { id: 'all', label: 'All Nodes' },
    ...nodeTabs,
    { id: 'relations', label: 'Relations' },
  ], [nodeTabs])

  const nodesByType = useMemo(() => {
    const m = new Map<string, C4Node[]>()
    for (const n of nodeList) {
      const arr = m.get(n.type)
      if (arr) arr.push(n)
      else m.set(n.type, [n])
    }
    return m
  }, [nodeList])

  const relList = useMemo(() =>
    visibleNodeIds
      ? Object.values(relations).filter(r => visibleNodeIds.has(r.sourceId) || visibleNodeIds.has(r.targetId))
      : Object.values(relations),
    [relations, visibleNodeIds],
  )

  // Sparse union: base relation columns + every extra property declared by a
  // relation type that actually appears in `relList`, deduped by key (two
  // relation types sharing a property key share the same underlying field).
  const relCols = useMemo<ColDef[]>(() => {
    const seen = new Set(REL_BASE_COLS.map(c => c.key))
    const extra: ColDef[] = []
    for (const r of relList) {
      const def = metamodel.relationTypes[r.relationType ?? 'interacts']
      for (const p of def?.properties ?? []) {
        if (seen.has(p.key)) continue
        seen.add(p.key)
        extra.push(propToCol(p))
      }
    }
    return [...REL_BASE_COLS, ...extra]
  }, [relList, metamodel])

  const treeRows = useMemo<TreeRow[]>(() =>
    tab === 'all' ? buildTreeRows(nodeList, n => n.parentId ?? null) : [],
    [tab, nodeList],
  )

  // Relation-derived tree (e.g. Requirement via "derives"), for tabs
  // configured in RELATION_TREE_BY_TYPE.
  const treeRelationType = RELATION_TREE_BY_TYPE[tab]

  const relationParentOf = useMemo(() => {
    if (!treeRelationType) return null
    const m = new Map<string, string>()
    for (const r of relList) {
      if (r.relationType !== treeRelationType) continue
      if (!m.has(r.sourceId)) m.set(r.sourceId, r.targetId)
    }
    return m
  }, [relList, treeRelationType])

  const typeTreeRows = useMemo<TreeRow[]>(() => {
    if (!relationParentOf) return []
    const list = nodesByType.get(tab) ?? []
    return buildTreeRows(list, n => relationParentOf.get(n.id) ?? null)
  }, [relationParentOf, nodesByType, tab])

  const isNodeTypeTab = tab !== 'all' && tab !== 'relations'
  const isTreeTab = tab === 'all' || !!treeRelationType

  const cols: ColDef[] =
    tab === 'relations' ? relCols
    : isNodeTypeTab      ? deriveNodeCols(tab, metamodel)
    : ALL_NODES_COLS

  const rows: (C4Node | C4Relation)[] =
    tab === 'relations' ? relList
    : tab === 'all'       ? treeRows.map(r => r.node)
    : treeRelationType    ? typeTreeRows.map(r => r.node)
    : (nodesByType.get(tab) ?? [])

  const depthMap = useMemo<Map<string, number>>(() => {
    const source = tab === 'all' ? treeRows : treeRelationType ? typeTreeRows : []
    const m = new Map<string, number>()
    for (const r of source) m.set(r.node.id, r.depth)
    return m
  }, [tab, treeRelationType, treeRows, typeTreeRows])

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
      const id = rowEl?.dataset.nodeId ?? null
      setDropParentId(id)
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

    // ── Case 1: new node dragged from the palette/toolbar ──────────────────
    const typeStr = e.dataTransfer.getData('application/c4-type')
    if (typeStr) {
      const size = NODE_SIZES[typeStr as C4ElementType] ?? { width: 200, height: 100 }
      const mm = useDiagramStore.getState().metamodel
      const def = mm?.nodeTypes[typeStr]
      const label = def?.label ?? (typeStr[0].toUpperCase() + typeStr.slice(1))
      const allowedParents = def?.allowedParents ?? []

      // Detect the table row under the drop point — its node is the candidate parent.
      const rowEl = (e.target as HTMLElement).closest('.tv-row') as HTMLElement | null
      const dropOnNodeId = rowEl?.dataset.nodeId
      const dropOnNode = dropOnNodeId ? nodes[dropOnNodeId] : undefined

      let parentId: string | undefined = undefined
      if (dropOnNode) {
        if (isParentAllowed(mm, typeStr, dropOnNode.type)) {
          // Dropped onto a valid parent row.
          parentId = dropOnNode.id
        } else if (dropOnNode.parentId && isParentAllowed(mm, typeStr, nodes[dropOnNode.parentId]?.type)) {
          // Dropped onto a sibling row — inherit its (valid) parent.
          parentId = dropOnNode.parentId
        } else {
          const allowedStr = allowedParents.length
            ? allowedParents.map(t => mm?.nodeTypes[t]?.label ?? t).join(', ')
            : 'the model root'
          pushNotification(
            `Cannot place ${label} on "${dropOnNode.label}". Drop it onto a ${allowedStr} row.`,
            'error',
          )
          return
        }
      } else if (!isParentAllowed(mm, typeStr, undefined)) {
        // Dropped on empty area but this type needs a parent.
        const allowedStr = allowedParents.length
          ? allowedParents.map(t => mm?.nodeTypes[t]?.label ?? t).join(', ')
          : 'a parent'
        pushNotification(
          `${label} must be dropped onto a ${allowedStr} row.`,
          'error',
        )
        return
      }

      // addNode validates parent/cardinality (pushes its own error toast on
      // failure) and auto-adds the created node to the active view.
      const newId = addNode({
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
      })
      if (newId) {
        const where = parentId ? ` inside "${nodes[parentId]?.label ?? parentId}"` : ''
        pushNotification(`${label} added to the model${where}.`, 'info')
      }
      return
    }

    // ── Case 2: existing node dragged from the Nodes panel → add to view ───
    const nodeId = e.dataTransfer.getData('application/c4-node-id')
    if (!nodeId || !activeViewId || !activeView) return

    const node = nodes[nodeId]
    if (!node) { pushNotification('Node not found.', 'error'); return }

    if (activeView.nodeIds.includes(nodeId)) {
      pushNotification(`"${node.label}" is already in this view.`, 'warning')
      return
    }
    addNodeToView(activeViewId, nodeId)
    pushNotification(`"${node.label}" added to view.`, 'info')
  }, [activeViewId, activeView, nodes, addNode, addNodeToView, pushNotification])

  const commitEdit = useCallback(() => {
    if (!editCell) return
    const { rowId, colKey, draft } = editCell
    const isNumber = cols.find(c => c.key === colKey)?.type === 'number'
    const numVal = draft === '' ? undefined : Number(draft)
    if (tab === 'relations') {
      updateRelation(rowId, { [colKey]: isNumber ? numVal : (draft || undefined) } as Partial<C4Relation>)
    } else {
      if (colKey === 'label' || colKey === 'description' || colKey === 'technology') {
        updateNode(rowId, { [colKey]: draft || undefined } as Partial<C4Node>)
      } else {
        // governance property stored directly on node via Object.assign
        updateNode(rowId, { [colKey]: isNumber ? numVal : draft } as Parameters<typeof updateNode>[1])
      }
    }
    setEditCell(null)
  }, [editCell, tab, cols, updateNode, updateRelation])

  const cancelEdit = useCallback(() => setEditCell(null), [])

  const startEdit = useCallback((rowId: string, colKey: string, current: string) => {
    if (readOnly) return
    setEditCell({ rowId, colKey, draft: current })
  }, [readOnly])

  const handleRowClick = useCallback((rowId: string) => {
    if (tab === 'relations') selectEdge(rowId)
    else selectNode(rowId)
  }, [tab, selectNode, selectEdge])

  const handleBoolToggle = useCallback((rowId: string, colKey: string, current: string) => {
    updateNode(rowId, { [colKey]: current !== 'true' } as Parameters<typeof updateNode>[1])
  }, [updateNode])

  function renderCell(row: C4Node | C4Relation, col: ColDef, depth = 0): React.ReactNode {
    const isNodeRow = tab !== 'relations'
    const rowId = row.id

    // Check visibleWhen — if this column's condition isn't met, render a dimmed dash
    if (col.visibleWhen && isNodeRow) {
      const cur = String((row as unknown as Record<string, unknown>)[col.visibleWhen.key] ?? '')
      if (!col.visibleWhen.values.includes(cur)) {
        return <span className="tv-cell-value" style={{ color: 'var(--text-muted)', opacity: 0.4 }}>—</span>
      }
    }

    const rawVal = isNodeRow
      ? getNodeProp(row as C4Node, col.key, nodes, relations)
      : getRelProp(row as C4Relation, col.key, nodes)
    const isEditing = editCell?.rowId === rowId && editCell?.colKey === col.key

    if (col.type === 'readonly') {
      if (col.key === '_type') {
        const nd = row as C4Node
        return (
          <span
            className="tv-type-badge"
            style={{
              background: NODE_COLORS[nd.type] ?? '#333',
              color: NODE_FG[nd.type] ?? '#fff',
            }}
          >
            {rawVal}
          </span>
        )
      }
      return <span className="tv-cell-readonly">{rawVal}</span>
    }

    if (col.type === 'boolean') {
      const checked = rawVal === 'true'
      return (
        <button
          className={`tv-bool ${checked ? 'tv-bool-on' : ''}`}
          onClick={(e) => { e.stopPropagation(); handleBoolToggle(rowId, col.key, rawVal) }}
          title={`${checked} — click to toggle`}
        >
          {checked ? '✓' : '—'}
        </button>
      )
    }

    if (isEditing) {
      if (col.type === 'enum') {
        return (
          <select
            autoFocus
            className="tv-cell-input"
            value={editCell!.draft}
            onChange={(e) => {
              const val = e.target.value
              setEditCell({ ...editCell!, draft: val })
              // Commit enum changes immediately so conditional cells update
              const rid = editCell!.rowId
              if (tab === 'relations') {
                updateRelation(rid, { [editCell!.colKey]: val || undefined } as Partial<C4Relation>)
              } else if (editCell!.colKey === 'label' || editCell!.colKey === 'description' || editCell!.colKey === 'technology') {
                updateNode(rid, { [editCell!.colKey]: val || undefined } as Partial<C4Node>)
              } else {
                updateNode(rid, { [editCell!.colKey]: val } as Parameters<typeof updateNode>[1])
              }
              setEditCell(null)
            }}
            onBlur={() => setEditCell(null)}
            onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit() }}
            onClick={(e) => e.stopPropagation()}
          >
            {col.options!.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )
      }
      if (col.type === 'textarea') {
        return (
          <textarea
            autoFocus
            className="tv-cell-textarea"
            value={editCell!.draft}
            onChange={(e) => setEditCell({ ...editCell!, draft: e.target.value })}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.stopPropagation(); cancelEdit() }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit() }
            }}
            onClick={(e) => e.stopPropagation()}
            rows={3}
          />
        )
      }
      return (
        <input
          autoFocus
          type={col.type === 'number' ? 'number' : 'text'}
          className="tv-cell-input"
          value={editCell!.draft}
          onChange={(e) => setEditCell({ ...editCell!, draft: e.target.value })}
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

    // Display mode — click to start editing
    const indent = isTreeTab && col.key === 'label' && depth > 0
    return (
      <span
        className={`tv-cell-value ${col.type === 'textarea' ? 'tv-cell-multiline' : ''}`}
        onClick={(e) => { e.stopPropagation(); startEdit(rowId, col.key, rawVal) }}
        title={rawVal || 'Click to edit'}
        style={indent ? { paddingLeft: depth * 16 + 4, display: 'flex', alignItems: 'center', gap: 4 } : undefined}
      >
        {indent && <span className="tv-tree-indent" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{'└'}</span>}
        {rawVal || <span className="tv-cell-placeholder">Click to edit…</span>}
      </span>
    )
  }

  const emptyMsg =
    tab === 'relations' ? 'No relations.' :
    isNodeTypeTab        ? `No ${TABS.find(t => t.id === tab)?.label ?? tab} in this model.` :
                           'No nodes.'

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

      {/* Tab bar */}
      <div className="tv-tabs">
        {TABS.map(t => {
          const count =
            t.id === 'all'       ? nodeList.length
            : t.id === 'relations' ? relList.length
            : nodesByType.get(t.id)?.length ?? 0
          return (
            <button
              key={t.id}
              className={`tv-tab ${tab === t.id ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setTab(t.id); setEditCell(null) }}
            >
              {t.label}
              <span className="tv-tab-count">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="tv-table-wrap">
        <table className="tv-table">
          <colgroup>
            {cols.map(c => <col key={c.key} style={{ width: c.width }} />)}
          </colgroup>
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c.key} className="tv-th">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="tv-empty" colSpan={cols.length}>{emptyMsg}</td>
              </tr>
            )}
            {rows.map((row) => {
              const isNodeRow = tab !== 'relations'
              const isSelected = isNodeRow ? selectedNodeId === row.id : selectedEdgeId === row.id
              const depth = isTreeTab ? (depthMap.get(row.id) ?? 0) : 0
              return (
                <tr
                  key={row.id}
                  data-node-id={isNodeRow ? row.id : undefined}
                  className={`tv-row ${isSelected ? 'tv-row-selected' : ''}${dropParentId === row.id ? ' tv-row-drop-parent' : ''}`}
                  onClick={(e) => { e.stopPropagation(); handleRowClick(row.id) }}
                >
                  {cols.map(col => (
                    <td key={col.key} className="tv-td">
                      {renderCell(row, col, depth)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
