import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Panel,
  Position,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from 'reactflow'
import type { Metamodel } from '@radical/common/metamodel'
import { runSmartLayout } from '@radical/ui/layout/smartLayoutRunner'
import { LiveColaLayout } from '@radical/ui/layout/liveColaLayout'
import {
  absolutePositions,
  buildMetamodelGraph,
  layoutFromModel,
  smartLayoutModel,
  relationColor,
  CONTAINS_COLOR,
  CATEGORY_PADDING,
  CONTAINS_EDGE,
  MAX_VISIBLE_PROPERTIES,
  type EdgeEnd,
  type EdgeRoute,
  type MetamodelGraph,
  type MetamodelGraphFilter,
  type MetamodelGraphCategory,
  type MetamodelGraphNode,
  type MetamodelLayout,
  type Rect,
} from './metamodelGraph'

/** What the diagram (and the inspector beside it) is focused on. A relation
 *  selection's id is a relation type id, or `CONTAINS_EDGE` for containment. */
export type DiagramSelection =
  | { kind: 'type'; id: string }
  | { kind: 'relation'; id: string }
  | null

// The whole metamodel at first: every containment edge and each type's
// properties. The legend narrows it down.
export const DEFAULT_DIAGRAM_FILTER: MetamodelGraphFilter = {
  showContainment: true,
  showProperties: true,
  hiddenRelations: new Set(),
}

// ── Nodes ──────────────────────────────────────────────────────────────────

interface TypeNodeData {
  node: MetamodelGraphNode
  showProperties: boolean
  dim: boolean
  selected: boolean
}

function TypeNode({ data }: NodeProps<TypeNodeData>): React.ReactElement {
  const { node, showProperties, dim, selected } = data
  const { def } = node
  const props = def.properties ?? []
  const shown = props.length > MAX_VISIBLE_PROPERTIES ? props.slice(0, MAX_VISIBLE_PROPERTIES) : props
  const hasChips = node.nestsInSelf || node.selfRelations.length > 0
  return (
    <div
      className={`mmd-node${dim ? ' dim' : ''}${selected ? ' selected' : ''}`}
      style={{ width: node.width, height: node.height }}
    >
      <Handle type="target" position={Position.Top} className="mmd-handle" isConnectable={false} />
      <Handle type="source" position={Position.Bottom} className="mmd-handle" isConnectable={false} />
      <div className="mmd-node-header" style={{ background: def.color, color: def.fg }}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill={def.fg} aria-hidden>
          <path d={def.iconPath} />
        </svg>
        <span className="mmd-node-label">{def.label}</span>
        {def.hubOnly && <span className="mmd-node-tag">hub</span>}
      </div>
      {showProperties && (
        <div className="mmd-node-body">
          {props.length === 0 && <div className="mmd-prop mmd-prop-empty">no properties</div>}
          {shown.map((p) => (
            <div key={p.key} className="mmd-prop">
              <span className="mmd-prop-key">
                {p.key}
                {p.required && <span className="mmd-req">*</span>}
              </span>
              <span className="mmd-prop-type">{p.type}</span>
            </div>
          ))}
          {props.length > shown.length && (
            <div className="mmd-prop mmd-prop-empty">+{props.length - shown.length} more</div>
          )}
        </div>
      )}
      {hasChips && (
        <div className="mmd-node-chips">
          {node.nestsInSelf && (
            <span className="mmd-chip" style={{ borderColor: CONTAINS_COLOR }} title={`${def.label} can be nested inside another ${def.label}`}>
              ↻ nests
            </span>
          )}
          {node.selfRelations.map((r) => (
            <span
              key={r.id}
              className="mmd-chip"
              style={{ borderColor: r.color }}
              title={`${def.label} ${r.label.toLowerCase()} ${def.label}`}
            >
              ↻ {r.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

interface CategoryNodeData {
  category: MetamodelGraphCategory
  frame: Rect
}

/** A category's frame: drawn behind its types, transparent to clicks so the
 *  edges and the pane under it stay reachable. */
function CategoryNode({ data }: NodeProps<CategoryNodeData>): React.ReactElement {
  return (
    <div className="mmd-category" style={{ width: data.frame.width, height: data.frame.height }}>
      <span className="mmd-category-label">{data.category.label}</span>
    </div>
  )
}

// ── Edge ───────────────────────────────────────────────────────────────────

interface TypeEdgeData {
  route: EdgeRoute
  color: string
  contains: boolean
  bidirectional: boolean
  label: string
  dim: boolean
  hovered: boolean
}

const OUTWARD: Record<string, { x: number; y: number }> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** Arrowhead (or diamond) with its tip on the node border, pointing into the node. */
function headPath(end: EdgeEnd, shape: 'arrow' | 'diamond'): string {
  const o = OUTWARD[end.side]
  // Unit vector pointing into the node (the direction the head points).
  const ux = -o.x
  const uy = -o.y
  const at = (back: number, side: number): string => `${end.x - ux * back - uy * side} ${end.y - uy * back + ux * side}`
  return shape === 'arrow'
    ? `M ${end.x} ${end.y} L ${at(9, 4.5)} L ${at(9, -4.5)} Z`
    : `M ${end.x} ${end.y} L ${at(7, 4)} L ${at(14, 0)} L ${at(7, -4)} Z`
}

function TypeEdge({ id, data }: EdgeProps<TypeEdgeData>): React.ReactElement | null {
  if (!data) return null
  const { route, color, contains, bidirectional, label, dim, hovered } = data
  return (
    <g className={`mmd-edge${dim ? ' dim' : ''}`}>
      <path d={route.path} fill="none" stroke="transparent" strokeWidth={14} className="react-flow__edge-interaction" />
      <path
        id={id}
        d={route.path}
        fill="none"
        stroke={color}
        strokeWidth={contains ? 1.4 : 1.8}
        strokeDasharray={contains ? '5 4' : undefined}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {contains ? (
        <path d={headPath(route.source, 'diamond')} fill={color} />
      ) : (
        <>
          <path d={headPath(route.target, 'arrow')} fill={color} />
          {bidirectional && <path d={headPath(route.source, 'arrow')} fill={color} />}
        </>
      )}
      {/* Containment is told apart by its dashes and diamond; every relation
          carries its name on the line. */}
      {!contains && (
        <EdgeLabelRenderer>
          <div
            className={`mmd-edge-label${dim ? ' dim' : ''}${hovered ? ' hovered' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${route.label.x}px, ${route.label.y}px)`, color }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  )
}

const nodeTypes = { mmType: TypeNode, mmCategory: CategoryNode }
const edgeTypes = { mmEdge: TypeEdge }

// ── Focus ──────────────────────────────────────────────────────────────────

function unionOf(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  const x = Math.min(...rects.map((r) => r.x))
  const y = Math.min(...rects.map((r) => r.y))
  return {
    x,
    y,
    width: Math.max(...rects.map((r) => r.x + r.width)) - x,
    height: Math.max(...rects.map((r) => r.y + r.height)) - y,
  }
}

function focusSets(
  graph: MetamodelGraph,
  selection: DiagramSelection,
): { nodes: Set<string>; edges: Set<string> } | null {
  if (!selection) return null
  const nodes = new Set<string>()
  const edges = new Set<string>()
  for (const e of graph.edges) {
    const hit =
      selection.kind === 'relation' ? e.type === selection.id : e.source === selection.id || e.target === selection.id
    if (!hit) continue
    edges.add(e.id)
    nodes.add(e.source)
    nodes.add(e.target)
  }
  if (selection.kind === 'type') nodes.add(selection.id)
  else
    for (const n of graph.nodes)
      if (n.selfRelations.some((r) => r.id === selection.id) || (selection.id === CONTAINS_EDGE && n.nestsInSelf))
        nodes.add(n.id)
  return { nodes, edges }
}

// ── Legend / filter (rendered in the editor's side column) ─────────────────

export function MetamodelLegend({
  metamodel,
  filter,
  selection,
  onFilter,
  onSelect,
}: {
  metamodel: Metamodel
  filter: MetamodelGraphFilter
  selection: DiagramSelection
  onFilter: (f: MetamodelGraphFilter) => void
  onSelect: (s: DiagramSelection) => void
}): React.ReactElement {
  const relations = Object.values(metamodel.relationTypes)
  const drawable = relations.filter((r) => r.allowedPairs.length > 0)
  const anyPair = relations.filter((r) => r.allowedPairs.length === 0)
  const isSel = (id: string): boolean => selection?.kind === 'relation' && selection.id === id
  const toggle = (id: string): void => {
    const hiddenRelations = new Set(filter.hiddenRelations)
    if (hiddenRelations.has(id)) hiddenRelations.delete(id)
    else hiddenRelations.add(id)
    onFilter({ ...filter, hiddenRelations })
  }
  return (
    <div className="mmd-legend">
      <label className="mmd-legend-row">
        <input
          type="checkbox"
          checked={filter.showProperties}
          onChange={() => onFilter({ ...filter, showProperties: !filter.showProperties })}
        />
        Show properties on boxes
      </label>
      <div className="mmd-legend-head">
        <span>Edges</span>
        <button className="mm-link" onClick={() => onFilter({ ...filter, showContainment: true, hiddenRelations: new Set() })}>all</button>
        <button
          className="mm-link"
          onClick={() => onFilter({ ...filter, showContainment: false, hiddenRelations: new Set(relations.map((r) => r.id)) })}
        >
          none
        </button>
      </div>
      <div className={`mmd-legend-row${isSel(CONTAINS_EDGE) ? ' active' : ''}`}>
        <input
          type="checkbox"
          aria-label="Show Contains"
          checked={filter.showContainment}
          onChange={() => onFilter({ ...filter, showContainment: !filter.showContainment })}
        />
        <svg width="22" height="8" aria-hidden>
          <path d="M1 4 L5 1 L9 4 L5 7 Z" fill={CONTAINS_COLOR} />
          <path d="M9 4 H21" stroke={CONTAINS_COLOR} strokeWidth="1.4" strokeDasharray="3 2" />
        </svg>
        <button className="mmd-legend-name" onClick={() => onSelect({ kind: 'relation', id: CONTAINS_EDGE })}>
          Contains
        </button>
      </div>
      {drawable.map((r) => {
        const color = relationColor(metamodel, r.id)
        return (
          <div key={r.id} className={`mmd-legend-row${isSel(r.id) ? ' active' : ''}`}>
            <input
              type="checkbox"
              aria-label={`Show ${r.label}`}
              checked={!filter.hiddenRelations.has(r.id)}
              onChange={() => toggle(r.id)}
            />
            <svg width="22" height="8" aria-hidden>
              <path d="M1 4 H14" stroke={color} strokeWidth="1.8" />
              <path d="M21 4 L13 0.5 L13 7.5 Z" fill={color} />
            </svg>
            <button className="mmd-legend-name" onClick={() => onSelect({ kind: 'relation', id: r.id })}>
              {r.label}
            </button>
          </div>
        )
      })}
      {anyPair.length > 0 && (
        <div className="mmd-legend-note">Between any types: {anyPair.map((r) => r.label).join(', ')}</div>
      )}
      <div className="mmd-legend-note">
        Click a type or an edge to focus it. Double-click a type to edit it.
      </div>
    </div>
  )
}

// ── Diagram ────────────────────────────────────────────────────────────────

// Smart Layout plus the physics take a few seconds; keep the settled result
// so switching tabs or toggling a filter back does not re-run them.
const layoutCache = new Map<string, MetamodelLayout>()
const LAYOUT_CACHE_SIZE = 12
/** The physics stops once no box moved more than this for PHYSICS_STILL_TICKS ticks… */
const PHYSICS_STILL_PX = 0.5
const PHYSICS_STILL_TICKS = 20
/** …or after this long, whichever comes first. */
const PHYSICS_BUDGET_MS = 4000

function graphKey(graph: MetamodelGraph): string {
  return JSON.stringify([
    graph.nodes.map((n) => [n.id, n.category, n.width, n.height]),
    graph.edges.map((e) => e.id),
  ])
}

interface Props {
  metamodel: Metamodel
  filter: MetamodelGraphFilter
  selection: DiagramSelection
  onSelect: (s: DiagramSelection) => void
  /** Double-click: open the type in the list editor. */
  onEdit: (typeId: string) => void
}

function DiagramInner({ metamodel, filter, selection, onSelect, onEdit }: Props): React.ReactElement {
  const [hoverEdge, setHoverEdge] = useState<string | null>(null)
  const [layout, setLayout] = useState<{ graph: MetamodelGraph; layout: MetamodelLayout } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'smart' | 'physics' | 'done'>('smart')
  const [fitToken, setFitToken] = useState(0)
  // Hidden until the first fit, so the picture does not flash at 100 % zoom.
  const [fitted, setFitted] = useState(false)
  const rf = useReactFlow()

  const graph = useMemo(() => buildMetamodelGraph(metamodel, filter), [metamodel, filter])

  // Same pipeline as Smart Layout on the model canvas: Smart Layout places
  // everything, then the live WebCoLa physics settles the result from those
  // positions (no re-arrangement from scratch) — link lengths pull related
  // types together, overlaps are pushed apart, groups hold their members.
  useEffect(() => {
    let cancelled = false
    let settled = false
    let cola: LiveColaLayout | null = null
    let budget: ReturnType<typeof setTimeout> | undefined
    let frame = 0
    const key = graphKey(graph)
    const cached = layoutCache.get(key)
    if (cached) {
      setLayout({ graph, layout: cached })
      setPhase('done')
      setFitToken((t) => t + 1)
      return
    }
    setError(null)
    setPhase('smart')
    smartLayoutModel(graph, (nodes, relations) => runSmartLayout(nodes, relations))
      .then((model) => {
        if (cancelled) return
        const publish = (): void => setLayout({ graph, layout: layoutFromModel(graph, model) })
        publish()
        setFitToken((t) => t + 1)
        setPhase('physics')

        const settle = (): void => {
          if (settled || cancelled) return
          settled = true
          cola?.stop()
          clearTimeout(budget)
          cancelAnimationFrame(frame)
          const l = layoutFromModel(graph, model)
          layoutCache.set(key, l)
          if (layoutCache.size > LAYOUT_CACHE_SIZE) layoutCache.delete(layoutCache.keys().next().value!)
          setLayout({ graph, layout: l })
          setPhase('done')
          setFitToken((t) => t + 1)
        }

        let last = absolutePositions(graph, model)
        let stillTicks = 0
        cola = new LiveColaLayout({
          getModel: () => model,
          applyPositions: (positions) => {
            for (const [id, p] of Object.entries(positions)) {
              const n = model.nodes[id]
              if (!n) continue
              n.x = p.x
              n.y = p.y
              if (p.width != null) n.width = p.width
              if (p.height != null) n.height = p.height
            }
            const now = absolutePositions(graph, model)
            let moved = 0
            for (const id of Object.keys(now))
              moved = Math.max(moved, Math.abs(now[id].x - last[id].x), Math.abs(now[id].y - last[id].y))
            last = now
            stillTicks = moved < PHYSICS_STILL_PX ? stillTicks + 1 : 0
            if (stillTicks >= PHYSICS_STILL_TICKS) return settle()
            // One redraw per frame however often cola ticks.
            if (!frame)
              frame = requestAnimationFrame(() => {
                frame = 0
                if (!cancelled && !settled) publish()
              })
          },
        })
        // skipBulk: start from Smart Layout's positions, as the canvas does
        // after Smart Layout, instead of cola's own initial arrangement.
        cola.start(true)
        // WebCoLa does not always converge with nested groups (see
        // known-issues.spec.ts), so the physics gets a time budget.
        budget = setTimeout(settle, PHYSICS_BUDGET_MS)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
      cola?.stop()
      clearTimeout(budget)
      cancelAnimationFrame(frame)
    }
  }, [graph])

  // Fit after Smart Layout and again once the physics has settled. The
  // bounds come from the layout itself (the category frames wrap every box),
  // not from ReactFlow's measurements, which lag behind while the physics
  // replaces the nodes every frame.
  useEffect(() => {
    if (!fitToken || !layout) return
    const bounds = unionOf(Object.values(layout.layout.frames))
    if (!bounds) return
    const id = requestAnimationFrame(() => {
      rf.fitBounds(bounds, { padding: 0.06, duration: fitted ? 300 : 0 })
      setFitted(true)
    })
    return () => cancelAnimationFrame(id)
  // Only a new fitToken re-fits; the layout read here is the one it came with.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToken, rf])

  const focus = useMemo(() => (layout ? focusSets(layout.graph, selection) : null), [layout, selection])

  // Selecting something frames it with everything it is connected to;
  // clearing the selection frames the whole diagram again.
  const selectionKey = selection ? `${selection.kind}:${selection.id}` : ''
  const lastSelectionKey = useRef(selectionKey)
  useEffect(() => {
    if (lastSelectionKey.current === selectionKey) return
    lastSelectionKey.current = selectionKey
    if (!layout || !fitted) return
    const { positions, frames } = layout.layout
    const boxes = focus
      ? layout.graph.nodes
          .filter((n) => focus.nodes.has(n.id) && positions[n.id])
          .map((n) => ({ ...positions[n.id], width: n.width, height: n.height }))
      : Object.values(frames)
    const bounds = unionOf(boxes.length ? boxes : Object.values(frames))
    if (bounds) rf.fitBounds(bounds, { padding: focus ? 0.15 : 0.06, duration: 400 })
  // Only a change of selection re-frames; physics ticks must not move the camera.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey])

  // A selected relation shows only its sources and targets: every other type
  // and edge is hidden, and each category frame wraps just its remaining
  // types. A selected type keeps the rest visible but dimmed.
  const onlyFocus = selection?.kind === 'relation' && !!focus

  const nodes = useMemo((): Node<TypeNodeData | CategoryNodeData>[] => {
    if (!layout) return []
    const { positions, frames } = layout.layout
    const byId = new Map(layout.graph.nodes.map((n) => [n.id, n]))
    const frameOf = (category: MetamodelGraphCategory): Rect | null => {
      if (!onlyFocus) return frames[category.id]
      const inner = unionOf(
        category.members
          .filter((id) => focus!.nodes.has(id))
          .map((id) => ({ ...positions[id], width: byId.get(id)!.width, height: byId.get(id)!.height })),
      )
      return inner && {
        x: inner.x - CATEGORY_PADDING.side,
        y: inner.y - CATEGORY_PADDING.top,
        width: inner.width + 2 * CATEGORY_PADDING.side,
        height: inner.height + CATEGORY_PADDING.top + CATEGORY_PADDING.bottom,
      }
    }
    return [
      // Frames first and lowest so the types and edges paint over them.
      ...layout.graph.categories.map((category) => {
        const frame = frameOf(category)
        return {
          id: category.id,
          type: 'mmCategory',
          position: frame ? { x: frame.x, y: frame.y } : { x: 0, y: 0 },
          hidden: !frame,
          draggable: false,
          connectable: false,
          selectable: false,
          zIndex: -1,
          data: { category, frame: frame ?? frames[category.id] },
        }
      }),
      ...layout.graph.nodes.map((n) => ({
        id: n.id,
        type: 'mmType',
        position: positions[n.id] ?? { x: 0, y: 0 },
        hidden: onlyFocus && !focus!.nodes.has(n.id),
        draggable: false,
        connectable: false,
        data: {
          node: n,
          showProperties: filter.showProperties,
          dim: !!focus && !focus.nodes.has(n.id),
          selected: selection?.kind === 'type' && selection.id === n.id,
        },
      })),
    ]
  }, [layout, focus, selection, onlyFocus, filter.showProperties])

  const edges = useMemo((): Edge<TypeEdgeData>[] => {
    if (!layout) return []
    return layout.graph.edges
      .filter((e) => layout.layout.routes[e.id])
      .map((e) => {
        const inFocus = !!focus?.edges.has(e.id)
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'mmEdge',
          hidden: onlyFocus && !inFocus,
          // Focused edges paint over the dimmed rest.
          zIndex: inFocus ? 1 : 0,
          data: {
            route: layout.layout.routes[e.id],
            color: e.color,
            contains: e.type === CONTAINS_EDGE,
            bidirectional: e.bidirectional,
            label: e.label,
            dim: !!focus && !inFocus,
            hovered: hoverEdge === e.id,
          },
        }
      })
  }, [layout, focus, onlyFocus, hoverEdge])

  // The layout on screen belongs to an older graph while a new one runs.
  const status = error
    ? `Layout failed: ${error}`
    : !layout || layout.graph !== graph || phase === 'smart'
      ? 'Smart Layout…'
      : phase === 'physics'
        ? 'Settling…'
        : null

  return (
    <div className={`mmd-canvas${fitted ? '' : ' unfitted'}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesConnectable={false}
        nodesDraggable={false}
        elementsSelectable={false}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, n) => {
          if (!metamodel.nodeTypes[n.id] || (selection?.kind === 'type' && selection.id === n.id)) return onSelect(null)
          onSelect({ kind: 'type', id: n.id })
        }}
        onNodeDoubleClick={(_, n) => {
          if (metamodel.nodeTypes[n.id]) onEdit(n.id)
        }}
        onEdgeClick={(_, e) => {
          const type = layout?.graph.edges.find((x) => x.id === e.id)?.type
          if (type) onSelect({ kind: 'relation', id: type })
        }}
        onEdgeMouseEnter={(_, e) => setHoverEdge(e.id)}
        onEdgeMouseLeave={() => setHoverEdge(null)}
        onPaneClick={() => onSelect(null)}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
        <Controls showInteractive={false} />
        {status && (
          <Panel position="top-center">
            <div className="mmd-status">{status}</div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  )
}

/** Read-only picture of the metamodel: node types as boxes, containment and
 *  relation types as edges, placed by Smart Layout. Has its own ReactFlow
 *  store so it never touches the main canvas's. */
export function MetamodelDiagram(props: Props): React.ReactElement {
  return (
    <ReactFlowProvider>
      <DiagramInner {...props} />
    </ReactFlowProvider>
  )
}
