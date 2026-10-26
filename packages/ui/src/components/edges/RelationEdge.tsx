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
import { edgeFocus } from '../../store/canvasFocus'
import { edgeGeometry, edgeLabelsShownAt, LABEL_BOX } from './edgeGeometry'
import { editingControl } from '../editingControl'
import { LABEL_FONT_FAMILY } from '@radical/layout/edgeLabels'

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
  const moveRelationEnd = useDiagramStore((s) => s.moveRelationEnd)
  const setRelinking = useDiagramStore((s) => s.setRelinking)
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
      // The canvas marks where the end can go while the connection key is held.
      if (!edgeId.startsWith('virtual-')) setRelinking({ relationId: edgeId, end })
    },
    [edgeId, end, setRelinking]
  )

  useEffect(() => {
    if (!dragging) return

    const onMove = (e: MouseEvent) => {
      setMouse({ x: e.clientX, y: e.clientY })
    }

    const onUp = (e: MouseEvent) => {
      setDragging(false)
      setMouse(null)
      setRelinking(null)

      // Find node under cursor: a field of the drop panel (Canvas:
      // ConnectDropPanel) names it and the type; the panel beside its
      // fields, the element it stands over.
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      const field = el?.closest?.<HTMLElement>('[data-connect-target]')
      const panel = el?.closest?.<HTMLElement>('.connect-pills')
      const nodeEl = el?.closest?.('.react-flow__node') as HTMLElement | null
      const nodeId = field?.dataset.connectTarget ?? panel?.dataset.connectOver ?? nodeEl?.getAttribute('data-id')

      // The relation keeps its type: refused where it does not fit there.
      if (nodeId && nodeId !== otherNodeId && !edgeId.startsWith('virtual-')) {
        const updates = end === 'source' ? { sourceId: nodeId } : { targetId: nodeId }
        const kept = useDiagramStore.getState().c4Relations[edgeId]?.relationType
        if (kept) moveRelationEnd(edgeId, updates, kept)
        else updateRelation(edgeId, updates)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, edgeId, end, otherNodeId, moveRelationEnd, updateRelation, setRelinking])

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
    <g {...editingControl}>
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
            pointerEvents="none"
          />
          {/* Under the pointer: what is below it is where the end goes. */}
          <circle cx={previewPt.x} cy={previewPt.y} r={4} fill="var(--accent)" opacity={0.6} pointerEvents="none" />
        </>
      )}
    </g>
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
    const allLabels = useDiagramStore((s) => s.allEdgeLabelsShown)
    const edgeStyle = useDiagramStore((s) => (s.activeViewId ? s.views[s.activeViewId]?.edgeStyle : undefined) ?? s.defaultEdgeStyle)
    const geometrySelector = useCallback(
      (s: ReactFlowState) => edgeGeometry(s.nodeInternals, s.edges, moving, allLabels || edgeLabelsShownAt(s.transform[2]), edgeStyle).get(id),
      [id, moving, allLabels, edgeStyle],
    )
    const geometry = useStore(geometrySelector)
    const diffKind = useDiagramStore(s => s.showDiff ? s.diffHighlight[id] : undefined)
    // Zoomed out, labels are hidden (see edgeLabelDetail); the relation the
    // user points at, or one of a selected node, keeps its label.
    const [hovered, setHovered] = useState(false)
    const endSelectedSelector = useCallback(
      (s: ReactFlowState) => !!(s.nodeInternals.get(source)?.selected || s.nodeInternals.get(target)?.selected),
      [source, target],
    )
    const endSelected = useStore(endSelectedSelector)
    // A selection brings its relations forward and dims the rest (canvasFocus.ts).
    const focus = useDiagramStore((s) => edgeFocus(s, id))
    // Its ends are rewired in Designer only: in Viewer and Presenter a drag
    // rewired the relation on the canvas, unsaved and gone back in Designer.
    const rewirable = useDiagramStore((s) => s.appMode === 'designer' && !s.presentationActive)

    // Not drawable yet (an end is hidden or not measured).
    if (!geometry) return null

    const { sourcePoint: sp, targetPoint: tp, path: edgePath } = geometry
    // @radical/layout's sides carry the same string values as reactflow's enum
    const tgtSide = geometry.targetSide as Position
    const { x: labelX, y: labelY } = geometry.label
    // A label-less relation shows its type, except a transition: one without
    // an event is a completion transition and is drawn bare.
    const typeName = data?.relationType === 'transition' ? undefined : data?.typeName ?? data?.relationType

    // A step's arrow to the next is the steps' colour, finely dashed.
    const strokeColor = data?.flow ? '#14b8a6' : selected || focus === 'focus' ? 'var(--accent)' : data?.isVirtual ? '#6b7280' : '#94a3b8'
    const strokeDash  = data?.flow ? '4 3' : data?.isVirtual ? '6 3' : undefined

    // Diff highlight
    const diffStroke =
      diffKind === 'new' ? 'var(--success)'
      : diffKind === 'removed' ? 'var(--danger)'
      : diffKind === 'changed' ? 'var(--warning, #d97706)'
      : null
    const diffDash = diffKind === 'removed' ? '6 4' : undefined
    const diffOpacity = diffKind === 'removed' ? 0.55 : 1

    return (
      <g className={focus === 'dim' ? 'focus-dim' : undefined}>
        <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
          <BaseEdge
            id={id}
            path={edgePath}
            style={{
              ...style,
              stroke:          diffStroke ?? strokeColor,
              strokeWidth:     diffStroke ? 3 : selected || focus === 'focus' ? 2 : 1.5,
              strokeDasharray: diffDash ?? strokeDash,
              strokeLinejoin:  'round',
              strokeLinecap:   'round',
              opacity:         diffOpacity,
              filter:          diffStroke ? `drop-shadow(0 0 4px ${diffStroke})` : undefined,
            }}
          />
        </g>
        {/* Custom arrowhead drawn at the target point */}
        <Arrow x={tp.x} y={tp.y} side={tgtSide} color={diffStroke ?? strokeColor} size={selected ? 10 : 8} />

        {/* Reconnect handles at endpoints when edge is selected */}
        {selected && !data?.isVirtual && rewirable && (
          <>
            <ReconnectHandle x={sp.x} y={sp.y} edgeId={id} end="source" otherNodeId={target} />
            <ReconnectHandle x={tp.x} y={tp.y} edgeId={id} end="target" otherNodeId={source} />
          </>
        )}

        {data && (data.label || data.technology || typeName) && (
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
                // The font its size is measured in (relationLabelSize).
                fontFamily:      LABEL_FONT_FAMILY,
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
              className={[
                'nodrag nopan relation-label',
                selected || hovered || endSelected ? 'relation-label-active' : '',
                focus === 'dim' ? 'focus-dim' : '',
                data.label || typeName ? '' : 'relation-label-tech-only',
              ].join(' ')}
            >
              {/* A rolled-up line's relations, one a line (deriveRFEdges joins them with a line break). */}
              {data.label
                ? data.label.split('\n').map((name, i) => <div key={i} className="relation-label-name">{name}</div>)
                : typeName && <div className="relation-label-name" style={{ opacity: 0.85, fontStyle: 'italic' }}>{typeName}</div>
              }
              {data.technology && (
                <div className="relation-label-tech" style={{ fontStyle: 'italic', opacity: 0.85, fontSize: LABEL_BOX.techFontSize }}>
                  [{data.technology}]
                </div>
              )}
            </div>
          </EdgeLabelRenderer>
        )}
        {/* Step numbers: a forward step's near the source, a backward one's
            (a response, which starts at the target) near the target. */}
        {([[data?.sequenceStep, 0.18, false], [data?.sequenceStepBack, 0.82, true]] as const).map(([steps, at, back]) => steps && steps.length > 0 && (
          <EdgeLabelRenderer key={back ? 'back' : 'fwd'}>
            <div
              style={{
                position:      'absolute',
                transform:     `translate(-50%, -50%) translate(${sp.x + (tp.x - sp.x) * at}px,${sp.y + (tp.y - sp.y) * at}px)`,
                background:    'var(--accent)',
                color:         '#fff',
                borderRadius:  steps.length === 1 && !back ? '50%' : 8,
                minWidth:      20,
                height:        20,
                padding:       steps.length === 1 && !back ? 0 : '0 5px',
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
              className={`nodrag nopan sequence-step-badge${back ? ' sequence-step-back' : ''}`}
            >
              {back ? `↩ ${steps.join(',')}` : steps.join(',')}
            </div>
          </EdgeLabelRenderer>
        ))}
      </g>
    )
  }
)

RelationEdge.displayName = 'RelationEdge'
