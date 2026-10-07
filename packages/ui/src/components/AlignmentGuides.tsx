import React from 'react'
import { useStore, type Node } from 'reactflow'
import type { LayoutConstraint } from '@radical/common/c4'
import { activeLayoutConstraints, useDiagramStore } from '../store/diagramStore'

/**
 * Dashed guides between the elements of each alignment on the active canvas
 * (a row or a column the user asked to keep). Drawn in the gaps between
 * consecutive members, so a guide never covers a box; an alignment that
 * keeps its order has arrowheads pointing along it. Faint by default; when a
 * member is selected the guide is drawn fully and offers buttons that
 * switch order-keeping and remove the alignment.
 *
 * Rendered as a ReactFlow child, outside the viewport element that exports
 * capture. The lines sit under React Flow's renderer (z-index 4), so boxes
 * and edges cover them; the remove buttons sit above it, where they can be
 * clicked. Designer mode only.
 */
export function AlignmentGuides(): React.ReactElement | null {
  const constraints = useDiagramStore(activeLayoutConstraints)
  const designer = useDiagramStore((s) => s.appMode === 'designer' && !s.presentationActive)
  if (!designer || constraints.length === 0) return null
  return <Guides constraints={constraints} />
}

type Box = { x: number; y: number; width: number; height: number }

interface Segment { x1: number; y1: number; x2: number; y2: number }

function Guides({ constraints }: { constraints: LayoutConstraint[] }): React.ReactElement {
  const selectedNodeIds = useDiagramStore((s) => s.selectedNodeIds)
  const removeLayoutConstraint = useDiagramStore((s) => s.removeLayoutConstraint)
  const setAlignmentOrdered = useDiagramStore((s) => s.setAlignmentOrdered)
  const [tx, ty, zoom] = useStore((s) => s.transform)
  const nodeInternals = useStore((s) => s.nodeInternals)
  const selected = new Set(selectedNodeIds)

  const boxOf = (id: string): Box | null => {
    const n = nodeInternals.get(id) as (Node & { positionAbsolute?: { x: number; y: number } }) | undefined
    if (!n || n.hidden || !n.width || !n.height) return null
    const p = n.positionAbsolute ?? n.position
    return { x: p.x * zoom + tx, y: p.y * zoom + ty, width: n.width * zoom, height: n.height * zoom }
  }

  const guides = constraints.flatMap((c) => {
    const boxes = c.nodeIds.map(boxOf).filter((b): b is Box => !!b)
    if (boxes.length < 2) return []
    const row = c.axis === 'horizontal'
    boxes.sort((a, b) => (row ? a.x - b.x : a.y - b.y))
    const line = boxes.reduce((sum, b) => sum + (row ? b.y + b.height / 2 : b.x + b.width / 2), 0) / boxes.length
    const segments: Segment[] = []
    for (let i = 0; i + 1 < boxes.length; i++) {
      const a = boxes[i]
      const b = boxes[i + 1]
      const from = row ? a.x + a.width : a.y + a.height
      const to = row ? b.x : b.y
      if (to - from < 4) continue
      segments.push(row ? { x1: from, y1: line, x2: to, y2: line } : { x1: line, y1: from, x2: line, y2: to })
    }
    const active = c.nodeIds.some((id) => selected.has(id))
    return [{ c, segments, active }]
  })

  const layer = { position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' } as const
  return (
    <>
      <svg width="100%" height="100%" style={{ ...layer, zIndex: 3 }} data-testid="alignment-guides">
        <defs>
          <marker id="alignment-guide-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0 0L8 4L0 8z" fill="var(--accent)" stroke="none" />
          </marker>
        </defs>
        {guides.map(({ c, segments, active }) => (
          <g key={c.id} opacity={active ? 0.95 : 0.4} stroke="var(--accent)" strokeWidth={active ? 1.8 : 1.4}>
            {segments.map((s, i) => (
              <g key={i}>
                <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} strokeDasharray="6 4"
                  markerEnd={c.ordered ? 'url(#alignment-guide-arrow)' : undefined} />
                {/* End ticks across the line mark where it meets each box. */}
                {s.y1 === s.y2 ? (
                  <>
                    <line x1={s.x1} y1={s.y1 - 4} x2={s.x1} y2={s.y1 + 4} />
                    <line x1={s.x2} y1={s.y2 - 4} x2={s.x2} y2={s.y2 + 4} />
                  </>
                ) : (
                  <>
                    <line x1={s.x1 - 4} y1={s.y1} x2={s.x1 + 4} y2={s.y1} />
                    <line x1={s.x2 - 4} y1={s.y2} x2={s.x2 + 4} y2={s.y2} />
                  </>
                )}
              </g>
            ))}
          </g>
        ))}
      </svg>
      <div style={{ ...layer, zIndex: 5 }}>
        {guides.filter((g) => g.active && g.segments.length > 0).map(({ c, segments }) => {
          const s = segments[0]
          const noun = c.axis === 'horizontal' ? 'row' : 'column'
          const direction = c.axis === 'horizontal' ? 'left to right' : 'top to bottom'
          return (
            <div
              key={c.id}
              className="alignment-guide-actions"
              style={{ left: (s.x1 + s.x2) / 2, top: (s.y1 + s.y2) / 2, flexDirection: c.axis === 'horizontal' ? 'row' : 'column' }}
            >
              <button
                type="button"
                className={`alignment-guide-btn${c.ordered ? ' on' : ''}`}
                title={c.ordered ? `Let layouts reorder this ${noun}` : `Keep this ${noun} in the order its elements were selected, ${direction}`}
                aria-label={c.ordered ? `Stop keeping ${noun} order` : `Keep ${noun} order`}
                aria-pressed={!!c.ordered}
                onClick={() => setAlignmentOrdered(c.id, !c.ordered)}
              >
                <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: c.axis === 'vertical' ? 'rotate(90deg)' : undefined }}>
                  <path d="M1 6h9M7 3l3 3-3 3" />
                </svg>
              </button>
              <button
                type="button"
                className="alignment-guide-btn"
                title={`Stop keeping this ${noun} aligned`}
                aria-label={`Remove ${noun} alignment`}
                onClick={() => removeLayoutConstraint(c.id)}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}
