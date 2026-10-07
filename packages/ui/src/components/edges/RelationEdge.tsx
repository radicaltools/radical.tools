import React, { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react'
import {
  EdgeProps,
  EdgeLabelRenderer,
  BaseEdge,
  Position,
  useStore,
  type ReactFlowState,
} from 'reactflow'
import { C4EdgeRFData } from '@radical/common/c4'
import { useDiagramStore } from '../../store/diagramStore'
import { edgeGeometry, LABEL_BOX } from './edgeGeometry'

// ─── Custom arrowhead ─────────────────────────────────────────────────────────

function Arrow({ x, y, side, color, size }: { x: number; y: number; side: Position; color: string; size: number }) {
  const half = size / 2
  // Arrow tip is at (x,y) on the node border, pointing INTO the node
  let d: string
  switch (side) {
    case Position.Top:    d = `M${x - half},${y - size}L${x},${y}L${x + half},${y - size}`; break
    case Position.Bottom: d = `M${x - half},${y + size}L${x},${y}L${x + half},${y + size}`; break
    case Position.Left:   d = `M${x - size},${y - half}L${x},${y}L${x - size},${y + half}`; break
    case Position.Right:  d = `M${x + size},${y - half}L${x},${y}L${x + size},${y + half}`; break
  }
  return <path d={d} fill={color} stroke="none" />
}

// ─── Reconnect handle (draggable endpoint) ───────────────────────────────────

function ReconnectHandle({
  x,
  y,
  edgeId,
  end,
  otherNodeId,
}: {
  x: number
  y: number
  edgeId: string
  end: 'source' | 'target'
  otherNodeId: string
}) {
  const updateRelation = useDiagramStore((s) => s.updateRelation)
  const [dragging, setDragging] = useState(false)
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null)
  const svgRef = useRef<SVGElement | null>(null)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      setDragging(true)
      setMouse({ x: e.clientX, y: e.clientY })
    },
    []
  )

  useEffect(() => {
    if (!dragging) return

    const onMove = (e: MouseEvent) => {
      setMouse({ x: e.clientX, y: e.clientY })
    }

    const onUp = (e: MouseEvent) => {
      setDragging(false)
      setMouse(null)

      // Find node under cursor
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const nodeEl = (el as HTMLElement)?.closest?.('.react-flow__node') as HTMLElement | null
      const nodeId = nodeEl?.getAttribute('data-id')

      if (nodeId && nodeId !== otherNodeId && !edgeId.startsWith('virtual-')) {
        updateRelation(edgeId, end === 'source' ? { sourceId: nodeId } : { targetId: nodeId })
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, edgeId, end, otherNodeId, updateRelation])

  // Compute preview line endpoint in SVG coordinates
  const previewPt = useMemo(() => {
    if (!dragging || !mouse) return null
    // We need to convert screen coords to SVG flow coords.
    // Find the ReactFlow viewport SVG element.
    const svg = document.querySelector('.react-flow__edges')?.closest('svg')
    if (!svg) return null
    const pt = svg.createSVGPoint()
    pt.x = mouse.x
    pt.y = mouse.y
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const svgPt = pt.matrixTransform(ctm.inverse())
    return { x: svgPt.x, y: svgPt.y }
  }, [dragging, mouse])

  return (
    <>
      {/* Draggable handle circle */}
      <circle
        cx={x}
        cy={y}
        r={10}
        fill="var(--accent)"
        stroke="#fff"
        strokeWidth={2.5}
        style={{ cursor: 'grab', pointerEvents: 'all' }}
        className="nodrag nopan"
        onMouseDown={onMouseDown}
      />
      {/* Preview line while dragging */}
      {dragging && previewPt && (
        <>
          <line
            x1={x}
            y1={y}
            x2={previewPt.x}
            y2={previewPt.y}
            stroke="var(--accent)"
            strokeWidth={2}
            strokeDasharray="6 4"
            opacity={0.6}
          />
          <circle cx={previewPt.x} cy={previewPt.y} r={4} fill="var(--accent)" opacity={0.6} />
        </>
      )}
    </>
  )
}

// ─── Edge component ───────────────────────────────────────────────────────────

export const RelationEdge = memo(
  ({
    id,
    source,
    target,
    data,
    style,
    selected,
  }: EdgeProps<C4EdgeRFData>) => {
    // Sides, ports, path and label spot come from one pass over the whole
    // canvas (edgeGeometry.ts); the geometry object stays the same while
    // nothing this edge draws changed, so only the edges that moved re-render.
    const moving = useDiagramStore((s) => s.liveLayoutMoving)
    const geometrySelector = useCallback(
      (s: ReactFlowState) => edgeGeometry(s.nodeInternals, s.edges, moving).get(id),
      [id, moving],
    )
    const geometry = useStore(geometrySelector)
    const diffKind = useDiagramStore(s => s.showDiff ? s.diffHighlight[id] : undefined)

    // Not drawable yet (an end is hidden or not measured).
    if (!geometry) return null

    const { sourcePoint: sp, targetPoint: tp, path: edgePath } = geometry
    // @radical/layout's sides carry the same string values as reactflow's enum
    const tgtSide = geometry.targetSide as Position
    const { x: labelX, y: labelY } = geometry.label

    const strokeColor = selected ? 'var(--accent)' : data?.isVirtual ? '#6b7280' : '#94a3b8'
    const strokeDash  = data?.isVirtual ? '6 3' : undefined

    // Diff highlight
    const diffStroke =
      diffKind === 'new' ? 'var(--success)'
      : diffKind === 'removed' ? 'var(--danger)'
      : diffKind === 'changed' ? 'var(--warning, #d97706)'
      : null
    const diffDash = diffKind === 'removed' ? '6 4' : undefined
    const diffOpacity = diffKind === 'removed' ? 0.55 : 1

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          style={{
            ...style,
            stroke:          diffStroke ?? strokeColor,
            strokeWidth:     diffStroke ? 3 : selected ? 2 : 1.5,
            strokeDasharray: diffDash ?? strokeDash,
            strokeLinejoin:  'round',
            strokeLinecap:   'round',
            opacity:         diffOpacity,
            filter:          diffStroke ? `drop-shadow(0 0 4px ${diffStroke})` : undefined,
          }}
        />
        {/* Custom arrowhead drawn at the target point */}
        <Arrow x={tp.x} y={tp.y} side={tgtSide} color={diffStroke ?? strokeColor} size={selected ? 10 : 8} />

        {/* Reconnect handles at endpoints when edge is selected */}
        {selected && !data?.isVirtual && (
          <>
            <ReconnectHandle x={sp.x} y={sp.y} edgeId={id} end="source" otherNodeId={target} />
            <ReconnectHandle x={tp.x} y={tp.y} edgeId={id} end="target" otherNodeId={source} />
          </>
        )}

        {(data?.label || data?.technology || data?.relationType) && (
          <EdgeLabelRenderer>
            <div
              style={{
                position:        'absolute',
                transform:       `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                background:      'var(--edge-label-bg)',
                border:          `${LABEL_BOX.border}px solid var(--edge-label-border)`,
                borderRadius:    4,
                padding:         `${LABEL_BOX.padY}px ${LABEL_BOX.padX}px`,
                fontSize:        LABEL_BOX.fontSize,
                color:           'var(--text-primary)',
                pointerEvents:   'none',
                maxWidth:        LABEL_BOX.maxWidth,
                textAlign:       'center',
                lineHeight:      LABEL_BOX.lineHeight,
                // No backdrop-filter: every label would become its own
                // compositor layer re-blurred on each pan/zoom frame, which
                // drops large diagrams to ~8 fps on Retina GPUs. The
                // background is ~90% opaque, so the blur was barely visible.
                zIndex:          1000,
              }}
              className="nodrag nopan"
            >
              {data.label
                ? <div>{data.label}</div>
                : data.relationType && <div style={{ opacity: 0.85, fontStyle: 'italic' }}>{data.relationType}</div>
              }
              {data.technology && (
                <div style={{ fontStyle: 'italic', opacity: 0.85, fontSize: LABEL_BOX.techFontSize }}>
                  [{data.technology}]
                </div>
              )}
            </div>
          </EdgeLabelRenderer>
        )}
        {data?.sequenceStep !== undefined && data.sequenceStep.length > 0 && (
          <EdgeLabelRenderer>
            <div
              style={{
                position:      'absolute',
                transform:     `translate(-50%, -50%) translate(${sp.x + (tp.x - sp.x) * 0.18}px,${sp.y + (tp.y - sp.y) * 0.18}px)`,
                background:    'var(--accent)',
                color:         '#fff',
                borderRadius:  data.sequenceStep.length === 1 ? '50%' : 8,
                minWidth:      20,
                height:        20,
                padding:       data.sequenceStep.length === 1 ? 0 : '0 5px',
                display:       'flex',
                alignItems:    'center',
                justifyContent:'center',
                fontSize:      10,
                fontWeight:    700,
                pointerEvents: 'none',
                zIndex:        1001,
                boxShadow:     '0 1px 4px rgba(0,0,0,0.4)',
                lineHeight:    1,
                whiteSpace:    'nowrap',
              }}
              className="nodrag nopan"
            >
              {data.sequenceStep.join(',')}
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    )
  }
)

RelationEdge.displayName = 'RelationEdge'
