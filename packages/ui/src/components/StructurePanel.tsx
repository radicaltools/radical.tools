import React, { useMemo, useState } from 'react'
import type { C4ElementType } from '@radical/common/c4'
import { NODE_COLORS, TYPE_ICON_PATHS } from '@radical/common/c4'
import { pipelineOf, structureRows, type PipelineContext } from '@radical/common/viewPipeline'
import { useDiagramStore } from '../store/diagramStore'

// ─── Structure ───────────────────────────────────────────────────────────────
// What the active view shows, as a tree (viewPipeline.ts structureRows): its
// filter's chain — needs, the requirements under each, the scenarios under
// those — or, without one, its elements by containment. A click selects the
// element and opens its properties; a row with rows under it folds them.

export function StructurePanel(): React.ReactElement {
  const nodes = useDiagramStore((s) => s.c4Nodes)
  const relations = useDiagramStore((s) => s.c4Relations)
  const metamodel = useDiagramStore((s) => s.metamodel)
  const view = useDiagramStore((s) => (s.activeViewId ? s.views[s.activeViewId] : undefined))
  const selectedNodeId = useDiagramStore((s) => s.selectedNodeId)
  const selectNode = useDiagramStore((s) => s.selectNode)

  const ctx = useMemo<PipelineContext>(() => ({ nodes, relations, metamodel }), [nodes, relations, metamodel])
  const rows = useMemo(() => structureRows(view, ctx), [view, ctx])
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set())
  const toggle = (path: string) => setFolded((prev) => {
    const next = new Set(prev)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    return next
  })
  const shown = useMemo(() => {
    const closed = [...folded]
    return closed.length ? rows.filter((r) => !closed.some((p) => r.path.startsWith(p + '/'))) : rows
  }, [rows, folded])

  if (!rows.length) {
    return <div className="lp-empty-state" style={{ padding: '4px 12px 8px' }}>{pipelineOf(view) ? "No elements pass the view's filter." : 'No elements.'}</div>
  }
  return (
    <div className="structure-tree" role="tree" aria-label="Structure">
      {shown.map((row) => {
        const n = row.node
        const open = !folded.has(row.path)
        const color = NODE_COLORS[n.type as C4ElementType] ?? metamodel.nodeTypes[n.type]?.color ?? '#64748b'
        const icon = TYPE_ICON_PATHS[n.type as C4ElementType] ?? TYPE_ICON_PATHS.system
        return (
          <div key={row.path} role="treeitem" aria-selected={selectedNodeId === n.id} aria-level={row.depth + 1}
            className={`tree-node${selectedNodeId === n.id ? ' selected' : ''}`}
            style={{ paddingLeft: 12 + row.depth * 14 }}
            onClick={() => selectNode(n.id)}
            title={metamodel.nodeTypes[n.type]?.label ?? n.type}>
            <span className="tree-toggle" role={row.hasChildren ? 'button' : undefined}
              aria-label={row.hasChildren ? (open ? `Fold what hangs under ${n.label}` : `Show what hangs under ${n.label}`) : undefined}
              style={{ cursor: row.hasChildren ? 'pointer' : 'default', opacity: row.hasChildren ? 1 : 0.3 }}
              onClick={(e) => { if (!row.hasChildren) return; e.stopPropagation(); toggle(row.path) }}>
              {row.hasChildren ? (open ? '▼' : '▶') : '·'}
            </span>
            <span className="tree-badge">
              <svg viewBox="0 0 16 16" width="10" height="10" fill={color} aria-hidden><path d={icon} /></svg>
            </span>
            <span className="tree-node-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{n.label}</span>
            {row.alsoIn > 0 && <span className="tv-also-in" title={`Also under ${row.alsoIn} other element${row.alsoIn === 1 ? '' : 's'}`}>+{row.alsoIn}</span>}
          </div>
        )
      })}
    </div>
  )
}
