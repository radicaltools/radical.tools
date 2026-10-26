import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  NodeTypes,
  EdgeTypes,
  NodeMouseHandler,
  NodeDragHandler,
  SelectionDragHandler,
  ReactFlowInstance,
  useStore,
  useStoreApi,
  useUpdateNodeInternals,
  getNodesBounds,
  getViewportForBounds,
  type Node as RFNode,
} from 'reactflow'
import { zoomIdentity } from 'd3-zoom'
import { lowDetailAt } from '../store/canvasDetail'
import { useDiagramStore, viewById, milestoneOnCanvas, editsModel } from '../store/diagramStore'
import { openCard } from '../store/showInView'
import { paletteCover, propertiesPanelCover } from './propertiesCover'
import { withDetail, PersonNode, SystemNode, ContainerNode, ComponentNode, DatabaseNode, WebAppNode, QueueNode, DomainNode, GroupNode, AdrNode, FitnessFnNode, NeedNode, RequirementNode, ScenarioNode, BlueprintNode, MockupNode, StateMachineNode, StateNode, PseudostateNode, EventNode, EntityNode, ProcessNode, StepNode, GenericNode } from './nodes/C4Nodes'
import { RelationEdge } from './edges/RelationEdge'
import { edgeLabelDetail, edgeLabelsShownAt } from './edges/edgeGeometry'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import { AlignmentGuides } from './AlignmentGuides'
import { CollapseToggleMirror, nodeControlAt } from './CollapseToggleMirror'
import { selectCanvasFocus } from '../store/canvasFocus'
import { noteUserCamera } from '../store/userCamera'
import { noteViewCamera } from '../store/viewCameras'
import { ElementPalette } from './ElementPalette'
import { CanvasControls } from './CanvasControls'
import { ExploreBar } from './ExploreBar'
import { ExploreMenu } from './ExploreMenu'
import { NodeDiscussionBadges } from './NodeDiscussionBadges'
import { keepKeysHere } from './keysHere'
import type { NodeDiscussionCounts } from '@radical/common/discussions'
import { C4ElementType, NODE_SIZES, COLLAPSED_HEIGHT, nodeTypeSize, type C4Node } from '@radical/common/c4'
import { connectTypes, newElementFilters, viewShownNodes } from '@radical/common/viewPipeline'
import { allowedPlacesText, isParentAllowed, isPlacementAllowed, isRelationAllowed, relationTypeName, type Metamodel } from '@radical/common/metamodel'
import { nestRefusal } from '@radical/common/model'

/** The viewport that fits `bounds` in the part of the canvas (`rect`) the
 *  elements palette on its left leaves free — and, framing a selection
 *  (`card`), the properties card on its right — while that is at least half
 *  of it; else in the whole canvas. A fit of the whole view leaves the card
 *  out: it comes and goes with the selection. */
function viewportInFree(
  bounds: { x: number; y: number; width: number; height: number },
  rect: { width: number; height: number },
  minZoom: number, maxZoom: number, padding: number, card = false,
): { x: number; y: number; zoom: number } {
  const left = paletteCover()
  const free = rect.width - left - (card ? propertiesPanelCover() : 0)
  if (free < rect.width / 2) return getViewportForBounds(bounds, rect.width, rect.height, minZoom, maxZoom, padding)
  const vp = getViewportForBounds(bounds, free, rect.height, minZoom, maxZoom, padding)
  return { ...vp, x: vp.x + left }
}

// Node and edge type registrations: each draws a card, or a block when
// zoomed out (withDetail, store/canvasDetail.ts).
const nodeTypes: NodeTypes = {
  person: withDetail(PersonNode) as any,
  system: withDetail(SystemNode) as any,
  container: withDetail(ContainerNode) as any,
  component: withDetail(ComponentNode) as any,
  database: withDetail(DatabaseNode) as any,
  webapp: withDetail(WebAppNode) as any,
  queue: withDetail(QueueNode) as any,
  domain: withDetail(DomainNode) as any,
  group: withDetail(GroupNode) as any,
  adr: withDetail(AdrNode) as any,
  'fitness-fn': withDetail(FitnessFnNode) as any,
  need: withDetail(NeedNode) as any,
  requirement: withDetail(RequirementNode) as any,
  scenario: withDetail(ScenarioNode) as any,
  blueprint: withDetail(BlueprintNode) as any,
  mockup: withDetail(MockupNode) as any,
  'state-machine': withDetail(StateMachineNode) as any,
  state: withDetail(StateNode) as any,
  pseudostate: withDetail(PseudostateNode) as any,
  event: withDetail(EventNode) as any,
  entity: withDetail(EntityNode) as any,
  process: withDetail(ProcessNode) as any,
  step: withDetail(StepNode) as any,
  // Any other type (one made in the metamodel editor): React Flow draws the
  // nodes of a type it has no component for with its `default`.
  default: withDetail(GenericNode) as any,
}

const edgeTypes: EdgeTypes = {
  c4relation: RelationEdge as any,
}

// One dimmed copy per node object: a node that did not change keeps the same
// object from render to render, so React Flow leaves it alone.
const focusDimmedCopies = new WeakMap<RFNode, RFNode>()
function focusDimmed(n: RFNode): RFNode {
  let copy = focusDimmedCopies.get(n)
  if (!copy) {
    copy = { ...n, className: (n.className ?? '') + ' focus-dim' }
    focusDimmedCopies.set(n, copy)
  }
  return copy
}

// What the connect gesture offers besides relation types: the element moved
// inside the target, and its container ("holds", where it is).
const NEST_INSIDE = '@inside'
const NEST_HOLDS = '@holds'

/** What the connect gesture goes from: the selected elements where the one
 *  pressed (or marked from) is one of several selected, else that one. */
function connectSources(state: { selectedNodeIds: string[] }, from: string): string[] {
  return state.selectedNodeIds.length > 1 && state.selectedNodeIds.includes(from) ? [...state.selectedNodeIds] : [from]
}

/** Moves `ids` into `parentId` (null: the top of the model): one gesture,
 *  so one undo step and one notice, those of one parent at a time
 *  (reparentNodes takes siblings). Those the move is refused for
 *  (nestRefusal, the card's Parent rule) stay, and a notice names them and
 *  says why: a take-out the metamodel refuses did nothing and said nothing. */
function nestAll(ids: string[], parentId: string | null): void {
  const s = useDiagramStore.getState()
  const moving: string[] = []
  const refused: Array<{ node: C4Node; why: string }> = []
  for (const id of ids) {
    const node = s.c4Nodes[id]
    if (!node || (node.parentId ?? null) === parentId) continue
    const why = nestRefusal(s, [id], parentId)
    if (why) refused.push({ node, why })
    else moving.push(id)
  }
  if (moving.length) {
    const byParent = new Map<string, string[]>()
    for (const id of moving) {
      const key = s.c4Nodes[id]?.parentId ?? ''
      byParent.set(key, [...(byParent.get(key) ?? []), id])
    }
    s.runAsOneStep(() => { for (const group of byParent.values()) useDiagramStore.getState().reparentNodes(group, parentId, { quiet: true }) })
  }
  const now = useDiagramStore.getState()
  const moved = moving.filter((id) => (now.c4Nodes[id]?.parentId ?? null) === parentId)
  if (moved.length) {
    now.setSelectedNodeIds(moved)
    const parent = parentId ? now.c4Nodes[parentId] : undefined
    const where = parent ? (now.metamodel?.nodeTypes[parent.type]?.label ?? parent.type) : 'the canvas root'
    now.pushNotification(`Moved ${moved.length} ${moved.length === 1 ? 'node' : 'nodes'} into ${where}.`, 'info')
  }
  if (refused.length) now.pushNotification(refusalsText(refused), 'error')
}

/** The refusals of several elements, one sentence for those refused alike:
 *  'Cannot place Container "API", "Orders DB" inside the canvas root.
 *  Allowed parents: …'. */
function refusalsText(refused: Array<{ node: C4Node; why: string }>): string {
  const alike = new Map<string, string[]>()
  for (const { node, why } of refused) {
    const name = `"${node.label}"`
    const key = why.includes(name) ? why.replace(name, '\u0000') : why
    alike.set(key, [...(alike.get(key) ?? []), name])
  }
  return [...alike].map(([key, names]) => key.replace('\u0000', names.join(', '))).join(' ')
}

/** Relates each of `sources` to `targetId` (of `type`, '' for none), as
 *  one undo step: one gesture. */
function relateAll(sources: string[], targetId: string, type: string | undefined): void {
  useDiagramStore.getState().runAsOneStep(() => {
    for (const from of sources) useDiagramStore.getState().addRelation({ sourceId: from, targetId, ...(type ? { relationType: type } : {}) })
  })
}

// The special key as React Flow names it.
const SPECIAL_KEY_CODE = { alt: 'Alt', shift: 'Shift', ctrl: 'Control', meta: 'Meta' } as const

// A target of the relation being drawn: marked, its type over it (CSS
// ::before reads --connect-label). One copy per node object and label.
const connectCopies = new WeakMap<RFNode, { label: string; copy: RFNode }>()
function connectTarget(n: RFNode, label: string): RFNode {
  const known = connectCopies.get(n)
  if (known?.label === label) return known.copy
  const copy = { ...n, className: (n.className ?? '') + ' connect-target', style: { ...n.style, ['--connect-label' as string]: JSON.stringify(label) } }
  connectCopies.set(n, { label, copy })
  return copy
}

// Over each element a relation (or nesting) can go to, a pill for each way:
// the relation's type ("uses"), "inside", or "holds" on the container the
// element stands in. A drop on a pill makes that relation or nests it there
// (the canvas's mouseup reads data-connect-target and data-connect-type).
// Rendered into the canvas's viewport over the element, they move and zoom
// with it, at the same size on screen at any zoom (--canvas-unzoom), and lie
// over every line: rendered into the element's own node, a line raised
// above it (one to the selected element, rolled up to a folded container)
// lay over its pills and took the drop, which then did nothing.
function ConnectPills({ containerRef, targets, nameOf }: {
  containerRef: React.RefObject<HTMLDivElement>
  targets: Map<string, Array<{ type: string; text: string }>>
  nameOf: (id: string) => string
}): React.ReactElement | null {
  const nodeInternals = useStore((s) => s.nodeInternals)
  const viewport = containerRef.current?.querySelector('.react-flow__viewport')
  if (!viewport) return null
  return createPortal(
    <>
      {[...targets].map(([id, types]) => {
        const node = nodeInternals.get(id)
        if (!node || node.hidden) return null
        const at = node.positionAbsolute ?? node.position
        return (
          <div key={id} className="connect-pills-over" style={{ left: at.x, top: at.y, width: node.width ?? 0 }}>
            <div className="connect-pills" role="group" aria-label={`Drop on ${nameOf(id)}`} data-connect-over={id}>
              {types.map((t) => t.type === NEST_HOLDS
                ? <span key={t.type} className="connect-pill holds">{t.text}</span>
                : <span key={t.type || 'relation'} className="connect-pill" data-connect-target={id} data-connect-type={t.type}>{t.text}</span>)}
            </div>
          </div>
        )
      })}
    </>,
    viewport,
  )
}

// When the grabbed element's parent is selected too, React Flow drags the
// parent and leaves the grabbed one out of what it moves (handing over
// no node, or one that does not move): the first element it drags stands
// in. Read as given, the drag threw on every frame, or moved the parent on
// screen only, and was neither saved nor an undo step.
function draggedNode(grabbedNode: RFNode | undefined, nodes: RFNode[]): RFNode | undefined {
  return (grabbedNode && nodes.find((n) => n.id === grabbedNode.id)) ?? nodes[0] ?? grabbedNode
}

/** How long the camera takes to frame a selection, or to go back. */
const SELECTION_CAMERA_MS = 400
/** The least zoom the camera shows what an exploration's + added at:
 *  readable cards. */
const EXPLORE_MIN_ZOOM = 0.6
/** Framing a selection zooms in no further than this, or than the zoom in
 *  use when that is closer already. */
const SELECTION_MAX_ZOOM = 1
/** A fit of the view (on open, Fit All, Smart fit) zooms in no further than
 *  this: a model of a few elements stands at its size, not over the whole
 *  canvas, so the next one added does not throw the camera far out. */
const FIT_MAX_ZOOM = 1

/** Whether two cameras show the same (to a pixel and a fraction of zoom). */
function sameCamera(a: { x: number; y: number; zoom: number }, b: { x: number; y: number; zoom: number }): boolean {
  return Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.zoom - b.zoom) < 0.001
}

/** How long Smart fit keeps refitting after an expand or collapse (the live
 *  layout settles siblings around the change meanwhile). */
const ACTIVE_FIT_WINDOW_MS = 1500
/** Longest Smart fit follows the live layout after an expand, a collapse or
 *  opening a view. */
const MAX_TRACK_MS = 6000

// ─── Connection preview line (drawn while dragging) ────────────────────────────
function ConnectionPreviewLine({
  containerRef,
  sourceId,
  mouseX,
  mouseY,
}: {
  containerRef: React.RefObject<HTMLDivElement>
  sourceId: string
  mouseX: number
  mouseY: number
}) {
  const container = containerRef.current
  if (!container) return null

  // Find source node element and compute its center relative to the container
  const nodeEl = container.querySelector(`.react-flow__node[data-id="${CSS.escape(sourceId)}"]`) as HTMLElement | null
  if (!nodeEl) return null

  const cRect = container.getBoundingClientRect()
  const nRect = nodeEl.getBoundingClientRect()

  const sx = nRect.left + nRect.width / 2 - cRect.left
  const sy = nRect.top + nRect.height / 2 - cRect.top
  const ex = mouseX - cRect.left
  const ey = mouseY - cRect.top

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 99,
      }}
    >
      <line
        x1={sx}
        y1={sy}
        x2={ex}
        y2={ey}
        stroke="var(--accent)"
        strokeWidth={2}
        strokeDasharray="6 4"
        opacity={0.7}
      />
      <circle cx={ex} cy={ey} r={4} fill="var(--accent)" opacity={0.7} />
    </svg>
  )
}

interface DiscussionCanvasProps { onDiscuss?: (nodeId: string) => void; nodeDiscussions?: NodeDiscussionCounts }

function StructuralCanvas({ onDiscuss, nodeDiscussions }: DiscussionCanvasProps): React.ReactElement {
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null)
  const [discussionMenu, setDiscussionMenu] = useState<{ nodeId: string; x: number; y: number; trigger: HTMLElement | null } | null>(null)
  const discussionMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!discussionMenu) return
    discussionMenuRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const close = (event: MouseEvent): void => {
      if (!discussionMenuRef.current?.contains(event.target as Node)) setDiscussionMenu(null)
    }
    window.addEventListener('mousedown', close, true)
    return () => window.removeEventListener('mousedown', close, true)
  }, [discussionMenu])
  useEffect(() => { setDiscussionMenu(null) }, [onDiscuss])

  const appMode = useDiagramStore((s) => s.appMode)
  // Both viewer AND presenter must be layout-read-only — the saved
  // positions/sizes are part of the document and should not drift just
  // because someone is browsing or presenting it.
  const isViewMode = appMode !== 'designer'
  const presentationActive = useDiagramStore((s) => s.presentationActive)
  const autoFitActive = useDiagramStore((s) => s.autoFitActive)

  const rfNodes = useDiagramStore((s) => s.rfNodes)
  const rfEdges = useDiagramStore((s) => s.rfEdges)
  const focus = useDiagramStore(selectCanvasFocus)
  const activeViewId = useDiagramStore((s) => s.activeViewId)
  const onNodesChange = useDiagramStore((s) => s.onNodesChange)
  const onEdgesChange = useDiagramStore((s) => s.onEdgesChange)
  const selectNode = useDiagramStore((s) => s.selectNode)
  const selectEdge = useDiagramStore((s) => s.selectEdge)
  const requestCreateNode = useDiagramStore((s) => s.requestCreateNode)
  const liveGrab = useDiagramStore((s) => s.liveGrab)
  const liveDrag = useDiagramStore((s) => s.liveDrag)
  const liveRelease = useDiagramStore((s) => s.liveRelease)

  // Connection mode
  const connectSource = useDiagramStore((s) => s.connectSource)
  const selectedNodeId = useDiagramStore((s) => s.selectedNodeId)
  const relinking = useDiagramStore((s) => s.relinking)
  const selectedKey = useDiagramStore((s) => s.selectedNodeIds.join('\u0000'))
  const connectionModifier = useDiagramStore((s) => s.connectionModifier)
  const cancelConnection = useDiagramStore((s) => s.cancelConnection)

  // Sequence editing mode
  const activeSequenceId = useDiagramStore((s) => s.activeSequenceId)
  const activeSequenceName = useDiagramStore((s) => s.activeSequenceId ? s.sequences[s.activeSequenceId]?.name : undefined)
  const setActiveSequence = useDiagramStore((s) => s.setActiveSequence)

  // Milestone view mode: the milestone drawn (a playing slide's own, none
  // over one that draws the live model), with nothing to act on while a
  // presentation plays.
  const activeSnapshotId = useDiagramStore(milestoneOnCanvas)
  const snapshotName = useDiagramStore((s) => {
    const id = milestoneOnCanvas(s)
    return id ? s.snapshots.find((sn) => sn.id === id)?.name : undefined
  })
  const milestoneDirty = useDiagramStore((s) => s.milestoneDirty && !s.presentationActive)
  const commitMilestoneChanges = useDiagramStore((s) => s.commitMilestoneChanges)
  const discardMilestoneChanges = useDiagramStore((s) => s.discardMilestoneChanges)
  const [milestoneNewName, setMilestoneNewName] = useState<string | null>(null)
  const diffHighlight = useDiagramStore((s) => s.diffHighlight)
  const showDiff = useDiagramStore((s) => s.showDiff)
  const toggleShowDiff = useDiagramStore((s) => s.toggleShowDiff)
  const milestoneStats = useMemo(() => {
    let added = 0, changed = 0, removed = 0
    for (const k of Object.values(diffHighlight)) {
      if (k === 'new') added++
      else if (k === 'changed') changed++
      else if (k === 'removed') removed++
    }
    return { added, changed, removed }
  }, [diffHighlight])
  const activeViewName = useDiagramStore((s) =>
    s.activeViewId ? s.views[s.activeViewId]?.name : 'All elements'
  )
  // A view of type Explore says so where a structure view does.
  const activeViewExplore = useDiagramStore((s) => !!s.activeViewId && s.views[s.activeViewId]?.kind === 'explore')

  // Track whether the modifier key is currently held — use BOTH ref (sync)
  // and state (triggers re-render for visual feedback).
  const modifierHeldRef = useRef(false)
  const [modifierHeld, setModifierHeld] = useState(false)

  useEffect(() => {
    const keyProp = (e: KeyboardEvent): boolean => {
      switch (connectionModifier) {
        case 'shift': return e.shiftKey
        case 'ctrl':  return e.ctrlKey
        case 'alt':   return e.altKey
        case 'meta':  return e.metaKey
      }
    }
    const onDown = (e: KeyboardEvent) => {
      if (keyProp(e) && !modifierHeldRef.current) {
        modifierHeldRef.current = true
        setModifierHeld(true)
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (!keyProp(e) && modifierHeldRef.current) {
        modifierHeldRef.current = false
        setModifierHeld(false)
      }
    }
    const onBlur = () => { modifierHeldRef.current = false; setModifierHeld(false) }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [connectionModifier])

  const setFitViewFn = useDiagramStore((s) => s.setFitViewFn)
  const setViewportFns = useDiagramStore((s) => s.setViewportFns)

  // Always keep window.__rfCurrentViewport up-to-date so slide capture is
  // accurate. A subscription, not useViewport(): that re-rendered the whole
  // canvas on every camera frame (Smart fit, pan, zoom).
  const rfStore = useStoreApi()
  useEffect(() => {
    const record = (transform: [number, number, number]): void => {
      ;(window as any).__rfCurrentViewport = { x: transform[0], y: transform[1], zoom: transform[2] }
      // The relation types over the targets of a connection keep their size
      // on screen at any zoom (.connect-target::before).
      containerRef.current?.style.setProperty('--canvas-unzoom', String(1 / (transform[2] || 1)))
    }
    record(rfStore.getState().transform)
    // And kept as the view's camera by this viewer, outside the model
    // (viewCameras.ts): a slide's is the slide's, an exploration keeps none.
    // Not on mount: React Flow's default camera stands until the view's is placed.
    const keep = (transform: [number, number, number]): void => {
      const s = useDiagramStore.getState()
      if (s.presentationActive || (s.activeViewId !== null && !s.views[s.activeViewId])) return
      noteViewCamera(s.activeViewId, { x: transform[0], y: transform[1], zoom: transform[2] })
    }
    return rfStore.subscribe((s, prev) => {
      if (s.transform === prev.transform) return
      record(s.transform)
      keep(s.transform)
    })
  }, [rfStore])

  // Cards or blocks for the zoom (store/canvasDetail.ts). After a swap the
  // nodes have other handles: React Flow measures them again, a frame later,
  // or it would connect to the handles a node no longer has.
  const updateNodeInternals = useUpdateNodeInternals()
  useEffect(() => {
    let frame = 0
    const follow = (zoom: number): void => {
      const store = useDiagramStore.getState()
      const low = lowDetailAt(zoom, store.lowDetail)
      if (low === store.lowDetail) return
      store.setLowDetail(low)
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => updateNodeInternals(rfStore.getState().getNodes().map((n) => n.id)))
    }
    // Not on mount: the camera is React Flow's default until the view's is
    // placed, and switching views already set the detail for that camera.
    const off = rfStore.subscribe((s, prev) => { if (s.transform[2] !== prev.transform[2]) follow(s.transform[2]) })
    return () => { off(); cancelAnimationFrame(frame) }
  }, [rfStore, updateNodeInternals])

  /** Moves the camera in this frame. React Flow's setViewport always goes
   *  through a d3 transition, which applies even a zero duration one frame
   *  later: the nodes would draw once under the old camera. */
  const setCameraNow = useCallback((vp: { x: number; y: number; zoom: number }) => {
    const { d3Zoom, d3Selection, transform } = rfStore.getState()
    // Already there: a camera move re-runs every node's and edge's selector
    // (a few tens of ms on a large canvas), and a fit that follows the live
    // layout asks for the same camera frame after frame once it rests.
    if (Math.abs(transform[0] - vp.x) < 0.5 && Math.abs(transform[1] - vp.y) < 0.5 && Math.abs(transform[2] - vp.zoom) < 1e-4) return
    if (d3Zoom && d3Selection) d3Zoom.transform(d3Selection, zoomIdentity.translate(vp.x, vp.y).scale(vp.zoom))
    else rfInstanceRef.current?.setViewport(vp)
  }, [rfStore])

  // ── Auto-fit animation state ─────────────────────────────────────────
  // We run a single persistent rAF loop that *exponentially* eases the
  // viewport towards a moving target (recomputed every frame from current
  // node bounds). This is critically-damped lerp, not a fixed-duration
  // tween — it keeps converging smoothly even when the target keeps
  // changing (e.g. live physics still settling after a collapse), with no
  // hard transitions between successive ticks.
  const fitAnimRef = useRef<number | null>(null)
  const fitTargetRef = useRef<{ x: number; y: number; zoom: number } | null>(null)
  const fitForceRef = useRef(false) // bypass deadband for explicit fits
  // EMA-filtered target. Auto-fit ticks blend the freshly computed target
  // into this with a low-pass filter, so cola-induced jitter on the bbox
  // is averaged out instead of triggering discrete corrections. The rAF
  // chaser pulls the camera toward this filtered value continuously.
  // Smart-fit memory: ids of nodes that were visible (not `hidden`) on the
  // previous auto-fit tick. Smart-fit only reacts when something *new*
  // appears (expand parent → kids un-hide). Without new nodes, the camera
  // stays put — no fit-all churn from cola jitter or unrelated edits.
  const prevVisibleIdsRef = useRef<Set<string>>(new Set())
  // Active-fit window: while open, every tick refits to keep up with
  // cola still re-arranging things after an expand/collapse. Closes
  // automatically after ACTIVE_FIT_WINDOW_MS of no further visibility
  // changes — preventing the camera from breathing forever.
  const fitWindowUntilRef = useRef<number>(0)
  // Newly-appeared node ids in the *most recent* expand event (used to
  // bias zoom-out so the new nodes are guaranteed to be in frame, even
  // if cola is still pushing them around).
  const recentlyAddedIdsRef = useRef<Set<string>>(new Set())
  // When the user last moved the camera by hand: the "diagram left the
  // screen" refit waits a moment after that, so it never fights a gesture.
  const lastUserCameraRef = useRef<number>(0)
  // After an expand or collapse the camera follows the diagram every frame
  // (see smoothFitView) until this time, or earlier once the live layout
  // comes to rest and the active-fit window has closed.
  const trackUntilRef = useRef<number>(0)
  const trackingRef = useRef(false)
  // A view just opened with Smart fit on: the nodes it shows, to fit at once
  // in the first frame React Flow draws them (see placeCamera).
  const snapIdsRef = useRef<Set<string> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // How much of the relation labels the zoom shows (see edgeLabelDetail and
  // index.css). Set on the container from a store subscription, so crossing
  // a threshold restyles the labels without re-rendering the canvas.
  useEffect(() => {
    const apply = (zoom: number): void => {
      const el = containerRef.current
      const detail = edgeLabelDetail(zoom)
      if (el && el.dataset.edgeLabels !== detail) el.dataset.edgeLabels = detail
    }
    apply(rfStore.getState().transform[2])
    return rfStore.subscribe((s, prev) => { if (s.transform !== prev.transform) apply(s.transform[2]) })
  }, [rfStore])

  /**
   * Full fit-all target — everything visible (used for explicit Fit-All
   * button + initial auto-fit toggle, i.e. `force=true` callers).
   */
  const computeFitTarget = useCallback((): { x: number; y: number; zoom: number } | null => {
    const inst = rfInstanceRef.current
    const container = containerRef.current
    if (!inst || !container) return null
    const allNodes = inst.getNodes()
    if (allNodes.length === 0) return null
    // Exclude `hidden` nodes — collapsed parents leave their children behind
    // with their old (now off-screen) absolute positions; including them in
    // the bounds would balloon the bbox and shrink the fit to ~1/3 of the
    // viewport.
    const nodes = allNodes.filter((n) => !n.hidden)
    if (nodes.length === 0) return null
    const rect = container.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    const bounds = getNodesBounds(nodes)
    // Inflate bbox by a generous safety margin so live-cola drift after the
    // fit converges doesn't push edge nodes off-screen. The fractional
    // padding alone isn't enough because cola can keep moving outward for
    // ~1s past the moment we compute the target.
    const FIT_MARGIN = 140
    const padded = {
      x: bounds.x - FIT_MARGIN,
      y: bounds.y - FIT_MARGIN,
      width: bounds.width + FIT_MARGIN * 2,
      height: bounds.height + FIT_MARGIN * 2,
    }
    return viewportInFree(padded, rect, 0.05, FIT_MAX_ZOOM, 0.18)
  }, [])

  /**
   * Smart-fit target — used by the 300ms auto-fit interval.
   * Returns:
   *  - `null` if nothing changed (no newly-visible nodes since last tick).
   *    Caller must NOT move the camera.
   *  - viewport target whose world rect is `union(currentViewportWorldRect,
   *    bounds(newlyVisibleNodes))` — i.e. just zoom out / pan enough to
   *    include the newly-revealed content while keeping everything the user
   *    already had on screen.
   * On first ever call (no memory yet), returns the same as `computeFitTarget`.
   */
  const computeSmartFitTarget = useCallback((): { x: number; y: number; zoom: number } | null => {
    const inst = rfInstanceRef.current
    const container = containerRef.current
    if (!inst || !container) return null
    const rect = container.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    const allNodes = inst.getNodes()
    const visible = allNodes.filter((n) => !n.hidden)
    if (visible.length === 0) {
      prevVisibleIdsRef.current = new Set()
      return null
    }
    const currentIds = new Set(visible.map((n) => n.id))
    const prev = prevVisibleIdsRef.current
    // An element added or removed where all of them stay in sight leaves the
    // camera where it is: refitting a few elements on each one jumped.
    const vp = inst.getViewport()
    const view = { x: -vp.x / vp.zoom, y: -vp.y / vp.zoom, width: rect.width / vp.zoom, height: rect.height / vp.zoom }
    const IN_VIEW_MARGIN = 24 / vp.zoom
    const inView = visible.every((n) => {
      const p = n.positionAbsolute ?? n.position
      return p.x >= view.x + IN_VIEW_MARGIN && p.y >= view.y + IN_VIEW_MARGIN
        && p.x + (n.width ?? 0) <= view.x + view.width - IN_VIEW_MARGIN
        && p.y + (n.height ?? 0) <= view.y + view.height - IN_VIEW_MARGIN
    })
    const changed = visible.some((n) => !prev.has(n.id)) || [...prev].some((id) => !currentIds.has(id))
    // That ends a refit in progress too (after a view opened, for a while).
    if (changed && inView && !snapIdsRef.current) {
      prevVisibleIdsRef.current = currentIds
      trackUntilRef.current = 0
      fitWindowUntilRef.current = 0
      return null
    }
    // First-tick bootstrap: no prior memory → behave like fit-all so the
    // diagram is correctly framed when auto-fit first turns on.
    if (prev.size === 0) {
      prevVisibleIdsRef.current = currentIds
      const bounds = getNodesBounds(visible)
      const FIT_MARGIN = 140
      const padded = {
        x: bounds.x - FIT_MARGIN,
        y: bounds.y - FIT_MARGIN,
        width: bounds.width + FIT_MARGIN * 2,
        height: bounds.height + FIT_MARGIN * 2,
      }
      return viewportInFree(padded, rect, 0.05, FIT_MAX_ZOOM, 0.18)
    }
    const newlyVisible = visible.filter((n) => !prev.has(n.id))
    const removedCount = [...prev].filter((id) => !currentIds.has(id)).length
    // Always update memory so a later expand still detects "new".
    prevVisibleIdsRef.current = currentIds

    const now = performance.now()
    const hasChange = newlyVisible.length > 0 || removedCount > 0
    if (hasChange) {
      // Open / refresh active-fit window — cola needs ~1s to settle
      // siblings around the new/removed nodes; keep refitting in that
      // window so the user always sees the full result, not a stale
      // mid-animation snapshot.
      fitWindowUntilRef.current = now + ACTIVE_FIT_WINDOW_MS
      trackUntilRef.current = now + MAX_TRACK_MS
      if (newlyVisible.length > 0) {
        recentlyAddedIdsRef.current = new Set(newlyVisible.map((n) => n.id))
      }
    }
    // Outside the active window with no fresh change → camera stays put,
    // unless the diagram has left the screen altogether (the physics moved
    // it after the window closed): Smart fit keeps it in view.
    if (now > fitWindowUntilRef.current) {
      const HANDS_OFF_MS = 2000
      if (now - lastUserCameraRef.current < HANDS_OFF_MS) return null
      const vp = inst.getViewport()
      const view = { x: -vp.x / vp.zoom, y: -vp.y / vp.zoom, width: rect.width / vp.zoom, height: rect.height / vp.zoom }
      const onScreen = visible.some((n) => {
        const p = n.positionAbsolute ?? n.position
        const w = n.width ?? 0
        const h = n.height ?? 0
        return p.x < view.x + view.width && p.x + w > view.x && p.y < view.y + view.height && p.y + h > view.y
      })
      if (onScreen) return null
    }

    // Inside the active window: include all currently-visible nodes
    // PLUS any recently-added nodes (in case cola has temporarily pushed
    // them off-screen mid-animation — they'll be referenced by their
    // current absolute positions). Computing fit-all of "visible" is
    // simpler and equivalent here because hidden=false → already in the
    // visible array.
    void newlyVisible
    void removedCount
    const bounds = getNodesBounds(visible)
    // Same safety margin as in the bootstrap branch — cola continues to
    // settle inside the active-fit window and edge nodes can otherwise end
    // up flush against (or just past) the viewport border.
    const FIT_MARGIN = 140
    const padded = {
      x: bounds.x - FIT_MARGIN,
      y: bounds.y - FIT_MARGIN,
      width: bounds.width + FIT_MARGIN * 2,
      height: bounds.height + FIT_MARGIN * 2,
    }
    return viewportInFree(padded, rect, 0.05, FIT_MAX_ZOOM, 0.18)
  }, [])

  /** Puts the camera on `target`, then refits it every frame while the live
   *  layout moves the diagram, until `trackUntilRef` (or the layout comes to
   *  rest once the active-fit window has closed). */
  const trackFit = useCallback((target: { x: number; y: number; zoom: number }) => {
    if (fitAnimRef.current != null) cancelAnimationFrame(fitAnimRef.current)
    trackingRef.current = true
    const track = () => {
      const now = performance.now()
      const moving = useDiagramStore.getState().liveLayoutMoving
      if (now > trackUntilRef.current || (!moving && now > fitWindowUntilRef.current)) {
        trackingRef.current = false
        fitAnimRef.current = null
        return
      }
      const next = computeFitTarget()
      if (next) setCameraNow(next)
      fitAnimRef.current = requestAnimationFrame(track)
    }
    setCameraNow(target)
    fitAnimRef.current = requestAnimationFrame(track)
  }, [computeFitTarget, setCameraNow])

  /**
   * Request a smooth fit. `force=true` snaps deadband off and re-arms the
   * loop even when the diagram looks stationary (used for explicit Fit-All
   * button + initial auto-fit toggle).
   *
   * Multiple calls don't restart the animation — they just update the
   * target. The persistent rAF loop interpolates towards whatever the
   * latest target is, producing a continuous, naturally-damped motion.
   */
  const smoothFitView = useCallback((duration = 260, force = false) => {
    // Quick-search (and any other explicit "focus this node" caller) sets a
    // short suppression window on the window object. While active, the
    // auto-fit interval tick must not run — otherwise the zoom-in onto the
    // searched node is immediately overridden by fit-to-all on the next
    // 300ms tick. Manual / forced calls (Fit-All button) bypass this.
    // A view just opened: placeCamera fits it as soon as it is drawn.
    if (!force && snapIdsRef.current) return
    if (!force) {
      const until = (window as unknown as { __radicalAutoFitSuppressUntil?: number }).__radicalAutoFitSuppressUntil ?? 0
      if (performance.now() < until) {
        // Keep the smart-fit "previously visible" memory in sync with
        // reality while suppressed (e.g. during a presentation slide
        // transition, which swaps the whole node/view set). Otherwise the
        // first tick after suppression ends sees a stale diff against the
        // pre-transition node set, reads it as "newly revealed content",
        // and yanks the camera back to a fit-all framing right after the
        // caller's own viewport was correctly applied.
        const inst = rfInstanceRef.current
        if (inst) {
          const visible = inst.getNodes().filter((n) => !n.hidden)
          prevVisibleIdsRef.current = new Set(visible.map((n) => n.id))
        }
        return
      }
    }
    // Smart-fit: forced calls (Fit-All / initial toggle) → fit-all of all
    // visible nodes. Auto ticks → only react when something *new* appeared
    // (e.g. parent expand reveals children); union current viewport with
    // those new nodes' bounds and zoom out just enough to include them.
    // Returns null when nothing changed → don't move the camera.
    const target = force ? computeFitTarget() : computeSmartFitTarget()
    if (!target) return

    const inst = rfInstanceRef.current
    if (!inst) return
    const container = containerRef.current
    if (!container) return

    // After an expand or collapse: frame the diagram at once, then in every
    // frame while the live layout moves it. Easing towards a target refreshed
    // every 300 ms left the camera one to three seconds behind, and the
    // diagram, pushed aside by the group that grew, slid in from an edge.
    if (!force && performance.now() < trackUntilRef.current) {
      if (!trackingRef.current) trackFit(target)
      return
    }

    fitTargetRef.current = target
    fitForceRef.current = force
    if (fitAnimRef.current == null) {
      const tick = () => {
        const inst2 = rfInstanceRef.current
        const tgt = fitTargetRef.current
        if (!inst2 || !tgt) {
          fitAnimRef.current = null
          return
        }
        const cur = inst2.getViewport()
        // Time-constant tau (ms): smaller = snappier. Forced ~140ms,
        // auto ~280ms (smooth continuous tracking of new content).
        // Fraction per frame at 60fps: 1 - exp(-16.6/tau).
        const tau = fitForceRef.current ? 140 : 280
        const alpha = 1 - Math.exp(-16.6 / tau)
        const nx = cur.x + (tgt.x - cur.x) * alpha
        const ny = cur.y + (tgt.y - cur.y) * alpha
        const nz = cur.zoom + (tgt.zoom - cur.zoom) * alpha
        const dx = Math.abs(tgt.x - nx)
        const dy = Math.abs(tgt.y - ny)
        const dz = Math.abs(tgt.zoom - nz)
        if (dx < 0.2 && dy < 0.2 && dz < 0.0005) {
          inst2.setViewport(tgt)
          fitAnimRef.current = null
          return
        }
        inst2.setViewport({ x: nx, y: ny, zoom: nz })
        fitAnimRef.current = requestAnimationFrame(tick)
      }
      fitAnimRef.current = requestAnimationFrame(tick)
    }
    void duration // duration kept in API for callers; loop is time-constant based
  }, [computeFitTarget, computeSmartFitTarget, trackFit])

  /** Stops the camera animation or tracking in flight. */
  const stopFit = useCallback(() => {
    if (fitAnimRef.current != null) {
      cancelAnimationFrame(fitAnimRef.current)
      fitAnimRef.current = null
    }
    trackingRef.current = false
    trackUntilRef.current = 0
    snapIdsRef.current = null
  }, [])

  /**
   * Suppress the auto-fit interval for `durationMs` and cancel any in-flight
   * fit animation immediately. Used by callers that just set an explicit
   * camera position of their own (quick-search focus, presentation slide
   * navigation) so the next 300ms auto-fit tick doesn't immediately
   * fight/override it.
   */
  const suppressAutoFit = useCallback((durationMs: number) => {
    ;(window as unknown as { __radicalAutoFitSuppressUntil?: number }).__radicalAutoFitSuppressUntil =
      performance.now() + durationMs
    stopFit()
  }, [stopFit])

  // Cancel the in-flight fit animation on unmount (HMR / route change).
  useEffect(() => {
    return stopFit
  }, [stopFit])

  // React Flow passes an event only for camera moves the user makes (wheel,
  // pinch, dragging the pane); fits and focus pass none. The user's camera
  // wins: cancel any fit still animating, which would otherwise pull the
  // view back on every frame, and close the active-fit window so the next
  // tick leaves the camera alone. Smart fit itself stays on (it is a
  // setting); it reacts again to the next expand or collapse.
  const takeCamera = useCallback(() => {
    lastUserCameraRef.current = performance.now()
    noteUserCamera()
    stopFit()
    fitWindowUntilRef.current = 0
  }, [stopFit])
  const onUserMoveStart = useCallback((event: unknown) => { if (event) takeCamera() }, [takeCamera])
  // When the user last moved the camera by hand (a wheel, a drag of the
  // pane, the zoom buttons or keys). A press on the pane alone is no move,
  // though React Flow reports it as a move start: the press of a click on
  // the empty canvas must not count as moving the camera it brings back.
  const userMovedCameraAtRef = useRef(0)
  const markUserCamera = useCallback(() => { userMovedCameraAtRef.current = performance.now() }, [])
  const onUserMove = useCallback((event: unknown) => { if (event) markUserCamera() }, [markUserCamera])

  /**
   * The camera for a view just opened (or a document just loaded), in one
   * step: each view keeps its own coordinates, so a flight from the previous
   * view's camera crossed empty canvas and the diagram slid in from an edge.
   * With Smart fit on, the view is fitted in the first frame React Flow draws
   * its nodes (`ids`, which the store has just shown: React Flow takes them
   * a frame or two later); the saved camera `vp` bridges those frames. With
   * Smart fit off, the saved camera stays. Either way the shown nodes become
   * Smart fit's baseline: it reacts again to the next expand or collapse.
   * `keep` holds `vp` even with Smart fit on: a reload of the same model
   * (an outside edit) leaves the camera where the user had it.
   */
  const placeCamera = useCallback((
    vp: { x: number; y: number; zoom: number } | null,
    ids?: string[],
    opts?: { keep?: boolean },
  ) => {
    const inst = rfInstanceRef.current
    if (!inst) return
    stopFit()
    fitWindowUntilRef.current = 0
    const shown = new Set(ids ?? inst.getNodes().filter((n) => !n.hidden).map((n) => n.id))
    prevVisibleIdsRef.current = shown
    if (vp) setCameraNow(vp)
    if (opts?.keep || !useDiagramStore.getState().autoFitActive) return
    snapIdsRef.current = shown
    let frames = 0
    const snap = () => {
      if (snapIdsRef.current !== shown) return // stopped, or a newer view
      const visible = inst.getNodes().filter((n) => !n.hidden)
      const drawn = visible.length > 0 && visible.every((n) => n.width && n.height)
        && (shown.size === 0 || (visible.length === shown.size && visible.every((n) => shown.has(n.id))))
      if (!drawn && ++frames < 30) {
        fitAnimRef.current = requestAnimationFrame(snap)
        return
      }
      fitAnimRef.current = null
      snapIdsRef.current = null
      prevVisibleIdsRef.current = new Set(visible.map((n) => n.id))
      const target = computeFitTarget()
      if (!target) return
      // Then follow the view while it settles (the live layout, group sizes).
      const now = performance.now()
      fitWindowUntilRef.current = now + ACTIVE_FIT_WINDOW_MS
      trackUntilRef.current = now + MAX_TRACK_MS
      trackFit(target)
    }
    fitAnimRef.current = requestAnimationFrame(snap)
  }, [stopFit, setCameraNow, computeFitTarget, trackFit])
  // d3-zoom folds wheel events within ~150 ms into one gesture and reports its
  // start only once, so a wheel that lands while a fit animates would not
  // reach onMoveStart: every wheel takes the camera.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = () => { markUserCamera(); takeCamera() }
    el.addEventListener('wheel', onWheel, { capture: true, passive: true })
    return () => el.removeEventListener('wheel', onWheel, { capture: true })
  }, [takeCamera, markUserCamera])

  // The camera functions this canvas put on window: taken off when it goes
  // (a slide without a canvas unmounts it), so no one moves a camera that
  // is not on screen any more.
  const registeredViewportFns = useRef<{ getViewport: unknown; setViewport: unknown } | null>(null)
  const registeredFocusNodes = useRef<unknown>(null)
  // And the zoom keys': left behind by a canvas gone (a table, wiki, matrix,
  // hierarchy or Warnier view shown), ⌘+ did nothing there, kept the
  // browser from zooming, and zoomed the gone canvas to NaN.
  const registeredZoom = useRef<{ zoomIn: unknown; zoomOut: unknown } | null>(null)
  // Gone before its first camera (a slide without a canvas came straight
  // after): it puts nothing on window any more, and takes no slide's focus.
  const unmountedRef = useRef(false)
  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      const W = window as any
      if (registeredFocusNodes.current && W.__rfFocusNodes === registeredFocusNodes.current) delete W.__rfFocusNodes
      const zoom = registeredZoom.current
      if (zoom && W.__radicalZoomIn === zoom.zoomIn) delete W.__radicalZoomIn
      if (zoom && W.__radicalZoomOut === zoom.zoomOut) delete W.__radicalZoomOut
      const mine = registeredViewportFns.current
      if (!mine) return
      if (W.__rfSetViewport === mine.setViewport) delete W.__rfSetViewport
      if (W.__rfGetViewport === mine.getViewport) delete W.__rfGetViewport
    }
  }, [])
  /** Frames the nodes `ids` the canvas shows, once React Flow has drawn them
   *  (a slide switch may have just swapped the view), zooming in no further
   *  than `maxZoom`. With none of them shown, fits the whole canvas. */
  const frameNodes = useCallback((
    ids: string[], duration: number, maxZoom: number,
    onTarget?: (vp: { x: number; y: number; zoom: number }) => void,
  ) => {
    const instance = rfInstanceRef.current
    if (!instance) return
    const wanted = new Set(ids)
    suppressAutoFit(duration + 1800)
    let frames = 0
    const frame = () => {
      const focus = instance.getNodes().filter((n) => wanted.has(n.id) && !n.hidden)
      const drawn = focus.length > 0 && focus.every((n) => n.width && n.height)
      if (!drawn && ++frames < 30) {
        requestAnimationFrame(frame)
        return
      }
      const rect = containerRef.current?.getBoundingClientRect()
      if (!drawn || !rect || rect.width === 0 || rect.height === 0) {
        smoothFitView(duration, true)
        return
      }
      const bounds = getNodesBounds(focus)
      const MARGIN = 60
      const target = viewportInFree(
        { x: bounds.x - MARGIN, y: bounds.y - MARGIN, width: bounds.width + MARGIN * 2, height: bounds.height + MARGIN * 2 },
        rect, 0.05, maxZoom, 0.08, true,
      )
      suppressAutoFit(duration + 1800)
      instance.setViewport(target, { duration })
      onTarget?.(target)
    }
    requestAnimationFrame(frame)
  }, [suppressAutoFit, smoothFitView])

  // A click that selects on the canvas frames the selection with what it is
  // connected to, as the metamodel diagram does, unless all of it is in view
  // and readable already; a click on the empty canvas brings back the camera
  // from before. Clicks that add to a selection leave the camera alone (the
  // next element to pick must stay where it is). Only clicks on the canvas move it: a
  // search, a view switch or a slide that selects sets its own camera. Not
  // in a presentation, whose slides set the camera. A camera the user moved
  // after the framing stays. With Focus off a click moves no camera at all.
  const preFocusCameraRef = useRef<{ x: number; y: number; zoom: number } | null>(null)
  const framedCameraRef = useRef<{ x: number; y: number; zoom: number } | null>(null)
  // The framing's flight, and when the pointer last went down on the canvas:
  // a press during the flight stops it half-way (d3 interrupts it), and the
  // camera there is still the framing's, not one the user chose.
  const framingFlightRef = useRef<{ from: number; until: number }>({ from: 0, until: 0 })
  const pressedAtRef = useRef(0)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onPress = () => { pressedAtRef.current = performance.now() }
    el.addEventListener('pointerdown', onPress, { capture: true, passive: true })
    return () => el.removeEventListener('pointerdown', onPress, { capture: true })
  }, [])
  /** Whether the camera `now` is still the one the last framing set: where
   *  it flew to, or on its way there when the click came, and not moved by
   *  the user since. */
  const stillFramed = useCallback((now: { x: number; y: number; zoom: number }) => {
    const framed = framedCameraRef.current
    const flight = framingFlightRef.current
    if (!framed || userMovedCameraAtRef.current >= flight.from) return false
    return sameCamera(now, framed) || (pressedAtRef.current >= flight.from && pressedAtRef.current <= flight.until)
  }, [])
  const frameSelection = useCallback(() => {
    // After the click's selection has reached the store.
    requestAnimationFrame(() => {
      const instance = rfInstanceRef.current
      const s = useDiagramStore.getState()
      if (!instance || s.presentationActive) return
      if (!s.selectionFocus) {
        // Focus off: no framing, and no camera to bring back either.
        preFocusCameraRef.current = null
        framedCameraRef.current = null
        return
      }
      const focus = selectCanvasFocus(s)
      if (!focus) {
        const back = preFocusCameraRef.current
        const framed = stillFramed(instance.getViewport())
        preFocusCameraRef.current = null
        framedCameraRef.current = null
        if (back && framed) {
          suppressAutoFit(SELECTION_CAMERA_MS + 1800)
          instance.setViewport(back, { duration: SELECTION_CAMERA_MS })
        }
        return
      }
      const now = instance.getViewport()
      // Already in view, zoomed in far enough to show relation labels: the
      // camera stays.
      const rect = containerRef.current?.getBoundingClientRect()
      const shown = instance.getNodes().filter((n) => focus.frame.has(n.id) && !n.hidden && n.width && n.height)
      if (rect && shown.length > 0 && edgeLabelsShownAt(now.zoom)) {
        const b = getNodesBounds(shown)
        const left = b.x * now.zoom + now.x
        const top = b.y * now.zoom + now.y
        const free = rect.width - propertiesPanelCover()
        if (left >= paletteCover() && top >= 0 && left + b.width * now.zoom <= free && top + b.height * now.zoom <= rect.height) return
      }
      // Framing again from the framed camera keeps the one from before.
      if (!preFocusCameraRef.current || !stillFramed(now)) {
        preFocusCameraRef.current = now
      }
      framedCameraRef.current = null
      frameNodes([...focus.frame], SELECTION_CAMERA_MS, Math.max(now.zoom, SELECTION_MAX_ZOOM), (vp) => {
        framedCameraRef.current = vp
        const from = performance.now()
        framingFlightRef.current = { from, until: from + SELECTION_CAMERA_MS }
      })
    })
  }, [frameNodes, suppressAutoFit, stillFramed])
  // The camera to go back to belongs to the canvas it was taken on.
  useEffect(() => {
    preFocusCameraRef.current = null
    framedCameraRef.current = null
  }, [activeViewId])

  const onInit = useCallback((instance: ReactFlowInstance) => {
    rfInstanceRef.current = instance
    setFitViewFn(
      // Animated fit (initial toggle / fitAll button) — force=true so the
      // user always sees a response even if the viewport is already close.
      () => smoothFitView(600, true),
      // Auto-fit interval tick (300 ms): respects the deadband — only kicks
      // in when the diagram has drifted out of frame by more than ~3% of the
      // viewport. This eliminates the constant micro-juddering from the live
      // physics solver while still snapping back after collapse/expand.
      () => smoothFitView(550, false),
    )
    const getViewport = () => instance.getViewport()
    const setViewport = (vp: { x: number; y: number; zoom: number }, opts?: { duration?: number }) => instance.setViewport(vp, opts)
    registeredViewportFns.current = { getViewport, setViewport }
    setViewportFns(getViewport, setViewport)
    // Quick-search uses this to pan + zoom onto a specific node. Computed
    // here because only the RF instance knows the node's absolute layout
    // position (parent-relative coords would otherwise need translation).
    ;(window as any).__rfFocusNode = (nodeId: string, opts?: { zoom?: number; duration?: number }) => {
      const n = instance.getNode(nodeId) as (ReturnType<typeof instance.getNode> & { width?: number; height?: number }) | undefined
      if (!n) return
      const w = (n.width ?? 200)
      const h = (n.height ?? 120)
      const px = (n.positionAbsolute?.x ?? n.position.x) + w / 2
      const py = (n.positionAbsolute?.y ?? n.position.y) + h / 2
      const dur = opts?.duration ?? 600
      // Block the auto-fit interval tick from clobbering this zoom while
      // the pan animation is running and for a couple of seconds after,
      // so the user actually has time to look at the focused node.
      suppressAutoFit(dur + 2500)
      // Centred in what the palette and the properties card leave free.
      const zoom = opts?.zoom ?? 1.1
      instance.setCenter(px + (propertiesPanelCover() - paletteCover()) / 2 / zoom, py, { zoom, duration: dur })
    }
    // A presentation slide with focus elements frames just those, once React
    // Flow has drawn them (the slide switch may have just swapped the view).
    // Hidden ones (inside a collapsed group) are left out; with none shown,
    // the slide falls back to fitting the whole view. Put on window only
    // once this canvas has placed its first camera (below): a slide that
    // asks before then leaves its focus pending (`__rfPendingFocus`).
    const focusNodes = (ids: string[], opts?: { duration?: number }) => {
      frameNodes(ids, opts?.duration ?? 600, 1.5)
    }
    // Presentation slide navigation (diagramStore's goToSlide/previewSlide)
    // uses this to stop the auto-fit interval from fighting the slide's own
    // captured camera right after a slide switch swaps the visible node set.
    ;(window as any).__rfSuppressAutoFit = suppressAutoFit
    ;(window as any).__rfPlaceCamera = placeCamera
    // Explore from here: what a + (or + 1 level, or the opening) just added,
    // `ids`, with what it was added from, `from`, at a readable zoom (no
    // less than EXPLORE_MIN_ZOOM): as many of them, nearest to `from` first,
    // as fit at that zoom; never a fit of the whole exploration.
    ;(window as any).__rfShowAdded = (ids: string[], from: string[]) => {
      const wanted = new Set([...ids, ...from])
      let frames = 0
      const frame = () => {
        const shown = instance.getNodes().filter((n) => wanted.has(n.id) && !n.hidden)
        if (!(shown.length > 0 && shown.every((n) => n.width && n.height)) && ++frames < 30) {
          requestAnimationFrame(frame)
          return
        }
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect || rect.width === 0 || shown.length === 0) return
        const MARGIN = 60
        const PADDING = 0.08
        const freeW = rect.width - paletteCover() - propertiesPanelCover()
        // As viewportInFree frames them: with the margin, and the padding
        // round that.
        const fits = (list: typeof shown): boolean => {
          const b = getNodesBounds(list)
          const scale = EXPLORE_MIN_ZOOM * (1 + PADDING)
          return (b.width + 2 * MARGIN) * scale <= freeW && (b.height + 2 * MARGIN) * scale <= rect.height
        }
        // All the elements added from when they fit, else the first of them.
        const all = shown.filter((n) => from.includes(n.id))
        const anchors = all.length && !fits(all) ? [all.find((n) => n.id === from.find((id) => all.some((a) => a.id === id)))!] : all
        const centre = (n: (typeof shown)[number]) => {
          const p = n.positionAbsolute ?? n.position
          return { x: p.x + (n.width ?? 0) / 2, y: p.y + (n.height ?? 0) / 2 }
        }
        const at = anchors.length ? getNodesBounds(anchors) : getNodesBounds(shown)
        const mid = { x: at.x + at.width / 2, y: at.y + at.height / 2 }
        const added = shown.filter((n) => !from.includes(n.id))
          .sort((a, b) => Math.hypot(centre(a).x - mid.x, centre(a).y - mid.y) - Math.hypot(centre(b).x - mid.x, centre(b).y - mid.y))
        let framed = [...anchors]
        for (const n of added) if (fits([...framed, n])) framed.push(n)
        if (!framed.length) framed = [added[0] ?? shown[0]]
        const b = getNodesBounds(framed)
        const target = viewportInFree(
          { x: b.x - MARGIN, y: b.y - MARGIN, width: b.width + MARGIN * 2, height: b.height + MARGIN * 2 },
          rect, EXPLORE_MIN_ZOOM, 1, PADDING, true,
        )
        suppressAutoFit(SELECTION_CAMERA_MS + 1800)
        instance.setViewport(target, { duration: SELECTION_CAMERA_MS })
      }
      requestAnimationFrame(frame)
    }
    // Restore the camera saved with the active view (or default context).
    // Falls back to fit-all if no viewport was persisted yet.
    setTimeout(() => {
      if (unmountedRef.current) return
      const s = useDiagramStore.getState()
      const W = window as any
      W.__rfFocusNodes = focusNodes
      registeredFocusNodes.current = focusNodes
      // A slide asked for its camera while this canvas was mounting.
      const pending = W.__rfPendingCamera as { vp: { x: number; y: number; zoom: number } } | undefined
      if (pending) {
        W.__rfPendingCamera = undefined
        suppressAutoFit(1800)
        instance.setViewport(pending.vp)
        return
      }
      // A slide asked to zoom onto its focus elements while this canvas was
      // mounting (after a table slide, from a deep link or a reload): the
      // view's own camera placed here after it showed the whole view.
      const pendingFocus = W.__rfPendingFocus as { ids: string[]; duration: number } | undefined
      if (pendingFocus) {
        W.__rfPendingFocus = undefined
        focusNodes(pendingFocus.ids, { duration: 0 })
        return
      }
      const stored = s.activeViewId
        ? viewById(s, s.activeViewId)?.viewport ?? null
        : s.defaultViewport
      if (stored || s.autoFitActive) {
        placeCamera(stored)
      } else {
        const fit = computeFitTarget()
        if (fit) instance.setViewport(fit)
      }
    }, 100)

    // Register global zoom helpers used by the Toolbar zoom buttons.
    if (unmountedRef.current) return
    const zoomIn = () => { markUserCamera(); takeCamera(); instance.zoomIn({ duration: 300 }) }
    const zoomOut = () => { markUserCamera(); takeCamera(); instance.zoomOut({ duration: 300 }) }
    registeredZoom.current = { zoomIn, zoomOut }
    ;(window as any).__radicalZoomIn  = zoomIn
    ;(window as any).__radicalZoomOut = zoomOut
    return () => {
      delete (window as any).__radicalZoomIn
      delete (window as any).__radicalZoomOut
    }
  }, [setFitViewFn, setViewportFns, smoothFitView, suppressAutoFit, takeCamera, markUserCamera, placeCamera, frameNodes, computeFitTarget])

  // Double-click on the canvas background → add a new System at that position
  const onCanvasDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!rfInstanceRef.current) return
      // Only fire if the double-click is directly on the pane (not on a node)
      const target = event.target as HTMLElement
      if (!target.classList.contains('react-flow__pane')) return
      // screenToFlowPosition takes raw screen coordinates (no need to subtract bounds)
      const { x, y } = rfInstanceRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      requestCreateNode({
        type: 'system' as C4ElementType,
        label: 'New System',
        description: '',
        collapsed: false,
        external: false,
        x: x - NODE_SIZES.system.width / 2,
        y: y - NODE_SIZES.system.height / 2,
        ...NODE_SIZES.system,
      })
    },
    [requestCreateNode]
  )

  const onNodeClick: NodeMouseHandler = useCallback(
    (e, node) => {
      // Connection clicks are handled by onClickCapture on the container.
      // This only handles normal selection.
      if (modifierHeldRef.current || useDiagramStore.getState().connectSource) return
      cancelConnection()
      // When the multi-selection modifier is held, let ReactFlow's own
      // multi-select handling (surfaced via onNodesChange) drive the
      // selection set — calling selectNode() here would collapse it back
      // to a single id.
      const multi = e.shiftKey || e.metaKey || e.ctrlKey
      if (multi) return
      selectNode(node.id)
      frameSelection()
    },
    [cancelConnection, selectNode, frameSelection]
  )

  // A double-click opens the element's or the relation's properties card
  // (a click only selects; an open card then follows the selection).
  const onNodeDoubleClick: NodeMouseHandler = useCallback((_e, node) => {
    const s = useDiagramStore.getState()
    if (s.presentationActive || !s.c4Nodes[node.id]) return
    if (s.selectedNodeId !== node.id) selectNode(node.id)
    openCard()
  }, [selectNode])
  const onEdgeDoubleClick = useCallback((_e: React.MouseEvent, edge: { id: string }) => {
    const s = useDiagramStore.getState()
    // A step's arrow is no relation; a sequence being edited takes clicks.
    if (s.presentationActive || edge.id.startsWith('flow:') || edge.id.startsWith('virtual-') || !s.c4Relations[edge.id]) return
    if (s.activeSequenceId && s.appMode === 'designer') return
    if (s.selectedEdgeId !== edge.id) selectEdge(edge.id)
    openCard()
  }, [selectEdge])

  // Use a native mousedown/mouseup flow on the container to handle
  // drag-to-connect: modifier+mousedown on source → drag → mouseup on target.
  const connectingRef = useRef(false) // true while actively dragging a connection
  // In Viewer and Presenter: the element pressed with the key, which a
  // release on it adds to the selection or takes out.
  const selectOnlyRef = useRef<string | null>(null)
  // There, a frame pressed with the key: a drag from it draws a box over
  // what it holds, as one from the empty canvas does (where it starts).
  const boxFromRef = useRef<{ x: number; y: number } | null>(null)
  const [connectMouse, setConnectMouse] = useState<{ x: number; y: number } | null>(null)
  // The element the line is drawn over: its panel of relation types shows.
  const [connectOver, setConnectOver] = useState<string | null>(null)
  const connectOverRef = useRef<string | null>(null)
  connectOverRef.current = connectOver

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const findNodeId = (target: HTMLElement): string | null => {
      const nodeEl = target.closest('.react-flow__node') as HTMLElement | null
      return nodeEl?.getAttribute('data-id') ?? null
    }

    const isModHeld = (e: MouseEvent): boolean => {
      const mod = useDiagramStore.getState().connectionModifier
      return mod === 'shift' ? e.shiftKey :
             mod === 'ctrl'  ? e.ctrlKey :
             mod === 'alt'   ? e.altKey :
                               e.metaKey
    }

    const onMouseDown = (e: MouseEvent) => {
      if (!isModHeld(e)) return
      const nodeId = findNodeId(e.target as HTMLElement)
      if (!nodeId) return

      // Prevent ReactFlow from seeing this (no drag, no select)
      e.stopPropagation()
      e.preventDefault()

      const state = useDiagramStore.getState()
      // Viewer and Presenter do not edit: the key only adds the element to
      // the selection or takes it out (no line, no pills, no relation or
      // nesting, which were shown there and lost on the way back).
      if (!editsModel(state)) {
        selectOnlyRef.current = nodeId
        if ((e.target as HTMLElement).closest('.react-flow__node')?.classList.contains('parent')) boxFromRef.current = { x: e.clientX, y: e.clientY }
        return
      }
      state.startConnection(nodeId)
      connectingRef.current = true
      setConnectMouse({ x: e.clientX, y: e.clientY })
    }

    const onMouseMove = (e: MouseEvent) => {
      // Drawn on from a frame in Viewer or Presenter: React Flow's box
      // starts on the empty canvas only, so it is started there, at the
      // press, and the release is no click on the frame.
      const from = boxFromRef.current
      if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > 4) {
        boxFromRef.current = null
        selectOnlyRef.current = null
        el.querySelector('.react-flow__pane')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: from.x, clientY: from.y, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey }))
      }
      if (!connectingRef.current) return
      setConnectMouse({ x: e.clientX, y: e.clientY })
      // Over the panel the element stays the one it stands over.
      const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      if (under?.closest('.connect-pills')) return
      setConnectOver(under ? findNodeId(under) : null)
    }

    const onMouseUp = (e: MouseEvent) => {
      const pressed = selectOnlyRef.current
      selectOnlyRef.current = null
      boxFromRef.current = null
      if (pressed && findNodeId(e.target as HTMLElement) === pressed) {
        const ids = useDiagramStore.getState().selectedNodeIds
        useDiagramStore.getState().setSelectedNodeIds(ids.includes(pressed) ? ids.filter((id) => id !== pressed) : [...ids, pressed])
      }
      if (!connectingRef.current) return
      connectingRef.current = false
      setConnectMouse(null)
      setConnectOver(null)

      const state = useDiagramStore.getState()
      const src = state.connectSource
      if (!src) return

      // Dropped on a field of the target's panel: a relation of that type,
      // or the element moved inside the target.
      const field = (e.target as HTMLElement).closest<HTMLElement>('[data-connect-target]')
      const sources = connectSources(state, src)
      if (field) {
        const type = field.dataset.connectType
        if (type === NEST_INSIDE) nestAll(sources, field.dataset.connectTarget!)
        else relateAll(sources, field.dataset.connectTarget!, type)
        state.cancelConnection()
        return
      }

      // On the panel beside its fields: the element it stands over.
      const panel = (e.target as HTMLElement).closest<HTMLElement>('.connect-pills')
      const nodeId = panel ? panel.dataset.connectOver ?? connectOverRef.current : findNodeId(e.target as HTMLElement)
      const offered = nodeId ? connectTargetsRef.current?.get(nodeId)?.map((t) => t.type) ?? [] : []
      // On the empty canvas: out of its container, where it may stand there;
      // where it may not, it stays and a notice says why.
      // (Holding the selection key, React Flow lays its selection pane over it.)
      const onCanvas = (e.target as HTMLElement).closest('.react-flow') && !(e.target as HTMLElement).closest('.react-flow__node, .react-flow__edge, .react-flow__panel, .connect-pills')
      if (!nodeId && onCanvas) nestAll(sources, null)
      // Inside the target, its only offer; nothing on its container.
      else if (nodeId && offered.length === 1 && offered[0] === NEST_INSIDE) nestAll(sources, nodeId)
      // On what holds them: where they are, which a notice says.
      else if (nodeId && offered.length === 1 && offered[0] === NEST_HOLDS) {
        state.pushNotification(`${sources.length === 1 ? `"${state.c4Nodes[src]?.label ?? src}" is` : `The ${sources.length} elements are`} already in "${state.c4Nodes[nodeId]?.label ?? nodeId}": nothing to move.`, 'info')
      }
      // Several: of the one type that fits each (several types ask by the panel).
      else if (nodeId && sources.length > 1 && !sources.includes(nodeId)) {
        const types = offered.filter((t) => t !== NEST_INSIDE)
        if (types.length === 1) relateAll(sources, nodeId, types[0])
        else state.pushNotification(types.length
          ? `Several relation types fit: drop on one of the pills over "${state.c4Nodes[nodeId]?.label ?? nodeId}".`
          : `No relation fits each of the ${sources.length} elements and "${state.c4Nodes[nodeId]?.label ?? nodeId}"${offered.includes(NEST_INSIDE) ? ': drop on its "inside" pill to move them into it' : ''}.`, types.length ? 'info' : 'error')
      }
      // On another of those it goes from.
      else if (nodeId && nodeId !== src && sources.includes(nodeId)) {
        state.pushNotification(`"${state.c4Nodes[nodeId]?.label ?? nodeId}" is one of the ${sources.length} selected elements the line goes from: drop on another element.`, 'info')
      }
      // Refused, of the type the view's chain follows, or asked about where
      // several types fit (connectNodes).
      else if (nodeId && nodeId !== src) state.connectNodes(src, nodeId)
      // Let go where it was pressed: a click with the special key, which
      // adds the element to the selection or takes it out.
      else if (nodeId === src) {
        const ids = state.selectedNodeIds
        state.setSelectedNodeIds(ids.includes(src) ? ids.filter((id) => id !== src) : [...ids, src])
      }
      state.cancelConnection()
    }

    // The click that follows a special-key press on a node is the mouseup's
    // to handle (it adds the element to the selection): React Flow's own
    // multi-selection would take it out again.
    const onClick = (e: MouseEvent) => {
      if (isModHeld(e) && findNodeId(e.target as HTMLElement)) e.stopPropagation()
    }

    // Capture phase so we intercept before ReactFlow
    el.addEventListener('mousedown', onMouseDown, true)
    el.addEventListener('click', onClick, true)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      el.removeEventListener('mousedown', onMouseDown, true)
      el.removeEventListener('click', onClick, true)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const onPaneClick = useCallback(() => {
    cancelConnection()
    selectNode(null)
    selectEdge(null)
    frameSelection()
  }, [cancelConnection, selectNode, selectEdge, frameSelection])

  // Metamodel-aware validation for ReactFlow's built-in connect drag.
  const isValidConnection = useCallback((conn: { source: string | null; target: string | null }) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return false
    const state = useDiagramStore.getState()
    const src = state.c4Nodes[conn.source]
    const dst = state.c4Nodes[conn.target]
    if (!src || !dst) return false
    return isRelationAllowed(state.metamodel, src.type, dst.type)
  }, [])

  const onEdgeClick = useCallback(
    (_e: React.MouseEvent, edge: { id: string }) => {
      // A step's arrow to the next is no relation to select.
      if (edge.id.startsWith('flow:')) return
      const state = useDiagramStore.getState()
      // If a sequence is being edited, toggle this relation and don't open
      // properties. Only Designer edits one: Viewer and Presenter show the
      // sequence picked, and a click there selects the relation.
      if (state.activeSequenceId && state.appMode === 'designer' && !state.presentationActive && !edge.id.startsWith('virtual-')) {
        state.toggleRelationInSequence(state.activeSequenceId, edge.id)
        return
      }
      selectEdge(edge.id)
      frameSelection()
    },
    [selectEdge, frameSelection]
  )

  // Handle drag-from-sidebar drop
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const typeStr = event.dataTransfer.getData('application/c4-type') as C4ElementType
      if (!typeStr || !rfInstanceRef.current) return

      const flowPos = rfInstanceRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      // Detect if drop point is inside a node that is an allowed parent for
      // the dropped type, according to the active metamodel.
      const mm = useDiagramStore.getState().metamodel
      const def = mm?.nodeTypes[typeStr]
      const allowedParents = def?.allowedParents ?? []
      const typeLabel = def?.label ?? typeStr

      // Find the deepest visible node under the cursor regardless of whether
      // it's an allowed parent — we need it both to compute relative coords
      // (when valid) and to produce an accurate error toast (when not).
      const currentNodes = rfInstanceRef.current.getNodes()
      let hoveredNode: (typeof currentNodes)[number] | null = null
      for (const n of currentNodes) {
        if (n.hidden) continue
        const ax = n.positionAbsolute?.x ?? n.position.x
        const ay = n.positionAbsolute?.y ?? n.position.y
        const w = n.width ?? 0
        const h = n.height ?? 0
        if (flowPos.x >= ax && flowPos.x <= ax + w && flowPos.y >= ay && flowPos.y <= ay + h) {
          if (!hoveredNode || (n.zIndex ?? 0) >= (hoveredNode.zIndex ?? 0)) {
            hoveredNode = n
          }
        }
      }

      let parentId: string | undefined
      let relX = flowPos.x
      let relY = flowPos.y

      if (hoveredNode) {
        const hoveredType = hoveredNode.type ?? ''
        if (allowedParents.includes(hoveredType)) {
          // Valid drop into parent.
          parentId = hoveredNode.id
          const pax = hoveredNode.positionAbsolute?.x ?? hoveredNode.position.x
          const pay = hoveredNode.positionAbsolute?.y ?? hoveredNode.position.y
          relX = flowPos.x - pax
          relY = flowPos.y - pay
        } else {
          // Dropped on a node that is NOT a permitted parent for this type
          // (e.g. dragging a System onto a Container). Refuse the drop.
          const hoveredLabel = mm?.nodeTypes[hoveredType]?.label ?? hoveredType
          useDiagramStore.getState().pushNotification(
            `Cannot place ${typeLabel} inside ${hoveredLabel}. Allowed parents: ${allowedPlacesText(mm, typeStr)}.`,
            'error',
          )
          return
        }
      } else if (!isParentAllowed(mm, typeStr, undefined)) {
        // Dropped on empty canvas but this type cannot live at the root
        // (nor anywhere, when it has no allowed parent either).
        useDiagramStore.getState().pushNotification(
          allowedParents.length
            ? `${typeLabel} must be placed inside ${allowedParents.map(t => mm?.nodeTypes[t]?.label ?? t).join(', ')}.`
            : `Cannot place ${typeLabel} at the canvas root. Allowed parents: ${allowedPlacesText(mm, typeStr)}.`,
          'error',
        )
        return
      }

      const size = nodeTypeSize(typeStr, mm)
      // The values the view's filter asks for, as the table gives them; one
      // the filter leaves out all the same is added, and a message says so
      // (it was added without a word, and not drawn).
      const s = useDiagramStore.getState()
      const view = s.activeViewId ? s.views[s.activeViewId] : undefined
      const filtered = newElementFilters(view, { nodes: s.c4Nodes, relations: s.c4Relations, metamodel: s.metamodel }, typeStr)
      // Opens the type's wizard instead, when it has one; with the special
      // key held, it is added at once.
      const mod = s.connectionModifier
      const skipWizard = mod === 'alt' ? event.altKey : mod === 'shift' ? event.shiftKey : mod === 'ctrl' ? event.ctrlKey : event.metaKey
      requestCreateNode({
        type: typeStr,
        label: typeStr[0].toUpperCase() + typeStr.slice(1),
        description: '',
        technology: '',
        collapsed: false,
        external: false,
        ...filtered?.properties,
        parentId,
        x: relX - size.width / 2,
        y: relY - size.height / 2,
        ...size,
      } as Omit<C4Node, 'id'>, {
        skipWizard,
        onCreated: (id) => {
          const now = useDiagramStore.getState()
          const shown = viewShownNodes(now.activeViewId ? now.views[now.activeViewId] : undefined, now.c4Nodes, now.c4Relations)
          if (shown && !shown.has(id)) now.pushNotification(`${now.c4Nodes[id]?.label ?? typeLabel} was added, but this view's filter does not show it.`, 'warning')
        },
      })
    },
    [requestCreateNode]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  // Cancel connection on Escape; otherwise Escape clears the selection, as
  // a click on the background does (it did nothing). Not while a field, a
  // dialog or a menu has it, nor while a presentation plays (Esc ends it).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (connectSource) { cancelConnection(); return }
      if (e.defaultPrevented) return
      const el = e.target as HTMLElement | null
      if (el && typeof el.closest === 'function'
        && (el.isContentEditable || el.closest('input, textarea, select, [role="dialog"], [role="menu"]'))) return
      const s = useDiagramStore.getState()
      if (s.presentationActive || (!s.selectedNodeId && !s.selectedEdgeId && !s.selectedNodeIds.length)) return
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      onPaneClick()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [connectSource, cancelConnection, onPaneClick])

  // Cola-driven drag handlers
  const dragRafRef = useRef<number | null>(null)

  // A drag moves only the element (calm); with Cmd/Ctrl held when it
  // starts, the physics makes room around it (push). The connection
  // modifier keeps its own key.
  // React Flow drags the other selected nodes along: a calm drag moves
  // them too (the physics would put them back).
  const dragDragsAlong = useRef<string[]>([])
  // React Flow reports a click as a drag too: only a move pins.
  const dragFrom = useRef<{ x: number; y: number } | null>(null)
  // The camera is the user's once an element moves under the pointer. For
  // a moment after a view opens, Smart fit refits every frame while the
  // layout moves, and a drag counts as moving: the camera zoomed out under
  // the pointer, which carried the element further, which zoomed it out
  // more (60 px of mouse travel moved an element 2 000 px).
  const dragTookCamera = useRef(false)
  const onNodeDragStart: NodeDragHandler = useCallback(
    (event, grabbedNode, nodes) => {
      const node = draggedNode(grabbedNode, nodes)
      if (!node) return
      const mod = useDiagramStore.getState().connectionModifier
      const push = (mod !== 'meta' && event.metaKey) || (mod !== 'ctrl' && event.ctrlKey)
      dragDragsAlong.current = push ? [] : nodes.filter((n) => n.id !== node.id).map((n) => n.id)
      dragFrom.current = { ...node.position }
      dragTookCamera.current = false
      liveGrab(node.id, node.position.x, node.position.y, push ? 'push' : 'calm', node.positionAbsolute, dragDragsAlong.current)
    },
    [liveGrab]
  )

  const onNodeDrag: NodeDragHandler = useCallback(
    (_event, grabbedNode, nodes) => {
      const node = draggedNode(grabbedNode, nodes)
      if (!node) return
      if (!dragTookCamera.current) {
        dragTookCamera.current = true
        takeCamera()
      }
      liveDrag(node.id, node.position.x, node.position.y, node.positionAbsolute)
    },
    [liveDrag, takeCamera]
  )

  const onNodeDragStop: NodeDragHandler = useCallback(
    (_event, grabbedNode, nodes) => {
      const node = draggedNode(grabbedNode, nodes)
      if (!node) return
      const from = dragFrom.current
      const moved = !from || Math.abs(node.position.x - from.x) > 0.5 || Math.abs(node.position.y - from.y) > 0.5
      // Where the pointer let go. React Flow reports a move only when the
      // position relative to the parent changes: while a child drags its
      // parent's edge along, every other step went unreported, and the drop
      // was saved short of where it was drawn (F-0014).
      if (moved) liveDrag(node.id, node.position.x, node.position.y, node.positionAbsolute)
      liveRelease(node.id, dragDragsAlong.current, moved)
      dragDragsAlong.current = []
      dragFrom.current = null
    },
    [liveDrag, liveRelease]
  )

  // After a box select React Flow drags the selection's frame, not a node:
  // the same drag, which went unsaved and was no undo step.
  const onSelectionDragStart: SelectionDragHandler = useCallback(
    (event, nodes) => onNodeDragStart(event, nodes[0], nodes),
    [onNodeDragStart]
  )
  const onSelectionDrag: SelectionDragHandler = useCallback(
    (event, nodes) => onNodeDrag(event, nodes[0], nodes),
    [onNodeDrag]
  )
  const onSelectionDragStop: SelectionDragHandler = useCallback(
    (event, nodes) => onNodeDragStop(event, nodes[0], nodes),
    [onNodeDragStop]
  )

  // CSS class for connecting mode visual feedback
  const canvasClasses = ['canvas-area']
  if (connectSource) canvasClasses.push('connecting')
  if (modifierHeld) canvasClasses.push('connect-ready')
  if (autoFitActive) canvasClasses.push('autofit-active')

  // Where a relation from the element being connected may go: the one a
  // line is drawn from, or the selected one while the connection key is
  // held. Each target with the relation's type, as the metamodel allows and
  // the view's filter draws it (connectTypes).
  // An end of a relation dragged with the key held: where it can go, its
  // other end staying (marked as the source).
  const edits = editsModel({ appMode, presentationActive })
  const relink = relinking && modifierHeld && edits ? relinking : null
  const relinkRelation = relink ? useDiagramStore.getState().c4Relations[relink.relationId] : undefined
  const connectFrom = relinkRelation
    ? (relink!.end === 'target' ? relinkRelation.sourceId : relinkRelation.targetId)
    : connectSource ?? (modifierHeld && edits ? selectedNodeId : null)
  const connectTargets = useMemo(() => {
    if (!connectFrom) return null
    const s = useDiagramStore.getState()
    const view = s.activeViewId ? s.views[s.activeViewId] : undefined
    const metamodel = s.metamodel as Metamodel | undefined
    const ctx = { nodes: s.c4Nodes, relations: s.c4Relations, metamodel: metamodel! }
    const shown = rfNodes.filter((n) => !n.hidden).map((n) => n.id)
    // Each target's relation types, '' for a relation with no type.
    const targets = new Map<string, Array<{ type: string; text: string }>>()
    const put = (id: string, types: string[], ends: { from: string; to: string }): void => {
      targets.set(id, types.length ? types.map((type) => ({ type, text: relationTypeName(metamodel, type, true, ends) })) : [{ type: '', text: 'relation' }])
    }
    const fixedType = s.c4Nodes[connectFrom]?.type ?? ''
    if (relink && relinkRelation) {
      // Where the end can move, the relation keeping its type: not onto
      // the other end, nor where it is, nor where its type does not fit.
      const moving = relink.end === 'target' ? relinkRelation.targetId : relinkRelation.sourceId
      const kept = relinkRelation.relationType
      const keep = (types: string[] | undefined): string[] | undefined =>
        !types ? undefined : !kept ? types : types.includes(kept) ? [kept] : undefined
      for (const id of shown.filter((id) => id !== moving)) {
        const types = keep(relink.end === 'target'
          ? connectTypes(view, connectFrom, [id], ctx).get(id)
          : connectTypes(view, id, [connectFrom], ctx).get(connectFrom))
        if (types) put(id, types, relink.end === 'target' ? { from: fixedType, to: s.c4Nodes[id].type } : { from: s.c4Nodes[id].type, to: fixedType })
      }
      return targets
    }
    // The elements it goes from: the selected ones where it is one of several.
    const sources = connectSources(s, connectFrom).map((id) => s.c4Nodes[id]).filter(Boolean)
    const fromSet = new Set(sources.map((n) => n.id))
    // What fits every one of them.
    const each = sources.map((n) => connectTypes(view, n.id, shown.filter((id) => !fromSet.has(id)), ctx))
    for (const [id, types] of each[0] ?? new Map()) {
      const common = types.filter((t) => each.every((m) => m.get(id)?.includes(t)))
      if (each.every((m) => m.has(id)) && (common.length || !types.length)) put(id, common, { from: fixedType, to: s.c4Nodes[id].type })
    }
    // Nesting is the other way two elements belong together: "inside" where
    // the elements may be placed (not where they are, nor in what they hold),
    // and their container marked "holds" (a drop on the empty canvas takes
    // them out).
    for (const id of shown) {
      const target = s.c4Nodes[id]
      if (!target || fromSet.has(id)) continue
      // The card's Parent rule (nestRefusal): not into an external element,
      // nor where the move would then be refused; the metamodel's types
      // first, which rule out most at once.
      if (!sources.every((n) => id !== n.parentId && isPlacementAllowed(metamodel, n.type, target, s.c4Nodes))) continue
      if (nestRefusal(s, [...fromSet], id)) continue
      targets.set(id, [...(targets.get(id) ?? []), { type: NEST_INSIDE, text: 'inside' }])
    }
    const holder = sources[0]?.parentId
    if (holder && shown.includes(holder) && sources.every((n) => n.parentId === holder)) targets.set(holder, [{ type: NEST_HOLDS, text: 'holds' }])
    return targets
  }, [connectFrom, rfNodes, relink, relinkRelation, selectedKey])
  const connectTargetsRef = useRef(connectTargets)
  connectTargetsRef.current = connectTargets

  // While an end is dragged with the key held, the element under the
  // pointer shows its panel of types (as connectOver does for a line).
  useEffect(() => {
    if (!relink) return
    const onMove = (e: MouseEvent): void => {
      const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      if (under?.closest('.connect-pills')) return
      setConnectOver(under?.closest('.react-flow__node')?.getAttribute('data-id') ?? null)
    }
    window.addEventListener('mousemove', onMove)
    return () => { window.removeEventListener('mousemove', onMove); setConnectOver(null) }
  }, [relink])
  const connectLabels = useMemo(() => connectTargets
    ? new Map([...connectTargets].map(([id, types]) => [id, types.map((t) => t.text).join(' · ')]))
    : null, [connectTargets])

  // Annotate nodes: connecting-source class when in connect mode, the
  // targets of a relation from it marked and the other elements dimmed,
  // focus-dim on the nodes a selection leaves out (canvasFocus.ts).
  const annotatedNodes = connectLabels
    ? rfNodes.map((n) => {
        if (n.id === connectFrom) return { ...n, className: (n.className ?? '') + ' connecting-source' }
        const label = connectLabels.get(n.id)
        if (label) return connectTarget(n, label)
        return focusDimmed(n)
      })
    : connectSource || focus
    ? rfNodes.map((n) =>
        n.id === connectSource
          ? { ...n, className: (n.className ?? '') + ' connecting-source' }
          : focus && !focus.nodes.has(n.id) ? focusDimmed(n) : n
      )
    : rfNodes

  // Edges between a container's children are drawn above the container (so
  // they stay visible and clickable), and one can lie over its expand /
  // collapse button; a selected element's lines are drawn above the
  // elements, and one can lie over its + in an exploration. A click there
  // is meant for the button: hand it over before the edge sees it. Same
  // reach as the button's own hit area (CSS). A control drawn over the
  // canvas keeps its own click: a selected pinned container's Unpin pin
  // sits within reach of its − (F-0075).
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).closest('.c4-node-collapse-btn, .explore-more, .node-discussion-badge, button, a[href], input, select, textarea, [contenteditable="true"]')) return
    const btn = nodeControlAt(containerRef.current, e.clientX, e.clientY)
    if (!btn) return
    e.stopPropagation()
    e.preventDefault()
    btn.click()
  }, [])

  return (
    <div
      ref={containerRef}
      className={canvasClasses.join(' ')}
      onKeyDownCapture={(event) => {
        if (!onDiscuss || presentationActive || !(event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) return
        const trigger = (event.target as HTMLElement).closest<HTMLElement>('.react-flow__node')
        const nodeId = trigger?.dataset.id
        if (!nodeId || !useDiagramStore.getState().c4Nodes[nodeId]) return
        event.preventDefault()
        event.stopPropagation()
        const rect = trigger.getBoundingClientRect()
        setDiscussionMenu({ nodeId, x: Math.min(rect.left, window.innerWidth - 180), y: Math.min(rect.bottom, window.innerHeight - 60), trigger })
      }}
      onClickCapture={onClickCapture}
      onDrop={isViewMode ? undefined : onDrop}
      onDragOver={isViewMode ? undefined : onDragOver}
      onDoubleClick={isViewMode ? undefined : onCanvasDoubleClick}
    >
      {activeSequenceId && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          background: 'var(--accent)',
          color: '#fff',
          fontSize: 11,
          fontWeight: 600,
          padding: '5px 12px',
          borderRadius: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          pointerEvents: 'all',
          userSelect: 'none',
        }}>
          {isViewMode || presentationActive
            ? <>Sequence: {activeSequenceName ?? activeSequenceId}</>
            : <>Editing: {activeSequenceName ?? activeSequenceId} — click relations to add steps (remove via step list)</>}
          <button
            onClick={() => setActiveSequence(null)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '0 2px', fontSize: 13, lineHeight: 1, opacity: 0.85 }}
            title={isViewMode || presentationActive ? 'Close the sequence' : 'Stop editing'}
          >✕</button>
        </div>
      )}
      {activeSnapshotId && snapshotName && (
        <div
          className="nodrag nopan milestone-chip"
          style={{
            position: 'absolute',
            top: 8,
            left: 12,
            fontSize: 11,
            color: 'var(--text-muted)',
            background: 'var(--bg-panel)',
            border: `1px solid ${milestoneDirty ? 'var(--accent)' : 'var(--border-color)'}`,
            padding: '4px 8px',
            borderRadius: 4,
            pointerEvents: 'all',
            zIndex: 10,
            display: 'flex',
            gap: 6,
            alignItems: 'center',
          }}
        >
          <span style={{ color: 'var(--accent)', fontSize: 10 }}>●</span>
          <span>
            Milestone: <strong style={{ color: 'var(--text-primary)' }}>{snapshotName}</strong>
            {milestoneDirty && <span style={{ color: 'var(--accent)', marginLeft: 4 }}>· unsaved</span>}
          </span>
          {!presentationActive && <button
            title={showDiff ? 'Hide diff' : 'Show changes vs. previous milestone'}
            onClick={toggleShowDiff}
            style={{ fontSize: 11, padding: '2px 6px', cursor: 'pointer', background: showDiff ? 'var(--accent)' : 'var(--bg-surface)', color: showDiff ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 3 }}
          >{showDiff ? '⊙ diff on' : '⊙ diff'}</button>}
          {!presentationActive && showDiff && (milestoneStats.added + milestoneStats.changed + milestoneStats.removed) > 0 && (
            <span style={{ marginLeft: 2, opacity: 0.9 }}>
              <span style={{ color: '#4ade80' }}>+{milestoneStats.added}</span>
              {' '}
              <span style={{ color: '#fb923c' }}>~{milestoneStats.changed}</span>
              {' '}
              <span style={{ color: '#f87171' }}>−{milestoneStats.removed}</span>
            </span>
          )}
          {milestoneDirty && (
            <>
              <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--border-color)', margin: '0 2px' }} />
              <button
                title="Apply changes to this and all later milestones"
                onClick={() => commitMilestoneChanges('propagate')}
                style={{ fontSize: 11, padding: '2px 6px', cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 3 }}
              >Propagate</button>
              {milestoneNewName !== null ? (
                <>
                  <input
                    autoFocus
                    value={milestoneNewName}
                    onChange={e => setMilestoneNewName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { commitMilestoneChanges('new', milestoneNewName); setMilestoneNewName(null) }
                      if (e.key === 'Escape') setMilestoneNewName(null)
                    }}
                    placeholder="New milestone name…"
                    style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, border: '1px solid var(--border-color)', background: 'var(--bg-input, var(--bg-surface))', color: 'var(--text-primary)', width: 160 }}
                  />
                  <button
                    onClick={() => { commitMilestoneChanges('new', milestoneNewName); setMilestoneNewName(null) }}
                    style={{ fontSize: 11, padding: '2px 6px', cursor: 'pointer', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)' }}
                  >Save</button>
                </>
              ) : (
                <button
                  title="Save as new milestone"
                  onClick={() => setMilestoneNewName(`${snapshotName} (edited)`)}
                  style={{ fontSize: 11, padding: '2px 6px', cursor: 'pointer', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)' }}
                >New milestone</button>
              )}
              <button
                title="Discard changes and return to live"
                onClick={discardMilestoneChanges}
                style={{ fontSize: 11, padding: '2px 6px', cursor: 'pointer', background: 'none', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-muted)' }}
              >Discard</button>
            </>
          )}
        </div>
      )}
      <DeleteConfirmDialog />
      <ReactFlow
        nodes={annotatedNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onDiscuss && !presentationActive ? (event, node) => {
          if (!useDiagramStore.getState().c4Nodes[node.id]) return
          event.preventDefault()
          event.stopPropagation()
          const trigger = (event.target as HTMLElement).closest<HTMLElement>('.react-flow__node')
          setDiscussionMenu({ nodeId: node.id, x: Math.min(event.clientX, window.innerWidth - 180), y: Math.min(event.clientY, window.innerHeight - 60), trigger })
        } : undefined}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onSelectionDragStart={onSelectionDragStart}
        onSelectionDrag={onSelectionDrag}
        onSelectionDragStop={onSelectionDragStop}
        onEdgeClick={onEdgeClick as any}
        onEdgeDoubleClick={onEdgeDoubleClick as any}
        onPaneClick={onPaneClick}
        onInit={onInit}
        onMoveStart={onUserMoveStart}
        onMove={onUserMove}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={!presentationActive}
        nodesConnectable={!isViewMode && !presentationActive}
        elementsSelectable
        connectOnClick={false}
        isValidConnection={isValidConnection}
        minZoom={0.05}
        maxZoom={3}
        // Delete edits the model: in Designer only, and not while a
        // presentation plays (there it hid the element from the view for
        // good while the model kept it). The arrow keys moved the selected
        // element on screen only (nothing saved, no undo, out of its
        // container): React Flow's keyboard moves are off.
        deleteKeyCode={isViewMode || presentationActive ? null : 'Delete'}
        disableKeyboardA11y
        // The special key picks several: a click adds or takes out (the
        // mouseup above), a drag over the empty canvas draws a box.
        multiSelectionKeyCode={SPECIAL_KEY_CODE[connectionModifier]}
        selectionKeyCode={SPECIAL_KEY_CODE[connectionModifier]}
        selectNodesOnDrag={false}
        elevateEdgesOnSelect
        elevateNodesOnSelect
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="var(--canvas-dots)"
        />
        <AlignmentGuides />
        <CollapseToggleMirror />
        {!presentationActive && onDiscuss && nodeDiscussions && <NodeDiscussionBadges counts={nodeDiscussions} onDiscuss={onDiscuss} />}
      </ReactFlow>

      <RelationTypeMenu containerRef={containerRef} />
      <ExploreMenu containerRef={containerRef} />
      {discussionMenu && onDiscuss && createPortal(
        <div ref={discussionMenuRef} role="menu" aria-label="Node actions" className="relation-type-menu" style={{ position: 'fixed', left: discussionMenu.x, top: discussionMenu.y, zIndex: 1000 }}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDiscussionMenu(null) }}
          onKeyDown={(event) => {
            keepKeysHere(event)
            if (event.key === 'Escape') { event.preventDefault(); discussionMenu.trigger?.focus(); setDiscussionMenu(null) }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); discussionMenuRef.current?.querySelector<HTMLButtonElement>('button')?.focus() }
          }}>
          <button type="button" role="menuitem" onClick={() => { onDiscuss(discussionMenu.nodeId); setDiscussionMenu(null) }}>Discuss</button>
        </div>, document.body,
      )}

      {connectSource && connectMouse && (
        <ConnectionPreviewLine
          containerRef={containerRef}
          sourceId={connectSource}
          mouseX={connectMouse.x}
          mouseY={connectMouse.y}
        />
      )}

      {connectTargets && (
        <ConnectPills containerRef={containerRef} targets={connectTargets} nameOf={(id) => useDiagramStore.getState().c4Nodes[id]?.label ?? id} />
      )}

      {connectSource && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: 5,
            padding: '4px 12px',
            fontSize: 12,
            fontWeight: 600,
            pointerEvents: 'none',
            zIndex: 100,
          }}
        >
          Connecting from "{rfNodes.find((n) => n.id === connectSource)?.data?.label ?? connectSource}" — release on target
        </div>
      )}

      {/* An exploration's name, with what is done to it. */}
      <ExploreBar />

      {/* View name caption — bottom-left, same style as SequenceView */}
      {activeViewName && !activeSnapshotId && (
        <div
          className="canvas-view-caption"
          style={{
            position: 'absolute',
            top: 8,
            left: 12,
            fontSize: 11,
            color: 'var(--text-muted)',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            padding: '4px 8px',
            borderRadius: 4,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {activeViewExplore ? 'Explore' : 'Structure'}: <strong style={{ color: 'var(--text-primary)' }}>{activeViewName}</strong>
        </div>
      )}
    </div>
  )
}

/** The canvas, with the elements palette down its left side in Designer and
 *  its controls centred at its bottom (neither while a presentation plays).
 *  `smartLayoutNote` goes to the Smart Layout button (CanvasControls). */
export function Canvas({ smartLayoutNote, onDiscuss, nodeDiscussions }: { smartLayoutNote?: string } & DiscussionCanvasProps = {}): React.ReactElement {
  const presenting = useDiagramStore((s) => s.presentationActive)
  const showPalette = useDiagramStore((s) => s.appMode === 'designer') && !presenting
  // One element around both, whether the palette shows or not: switching
  // modes must not mount the canvas again.
  return (
    <div className="canvas-column">
      {showPalette && <ElementPalette />}
      <StructuralCanvas onDiscuss={onDiscuss} nodeDiscussions={nodeDiscussions} />
      {!presenting && <CanvasControls smartLayoutNote={smartLayoutNote} />}
    </div>
  )
}

/** The relation types to pick from when a relation drawn on the canvas
 *  fits several (relationTypeChoice), at the pointer where it was dropped.
 *  Esc or a click elsewhere adds nothing. */
function RelationTypeMenu({ containerRef }: { containerRef: React.RefObject<HTMLDivElement> }): React.ReactElement | null {
  const choice = useDiagramStore((s) => s.relationTypeChoice)
  const metamodel = useDiagramStore((s) => s.metamodel)
  const nodes = useDiagramStore((s) => s.c4Nodes)
  const choose = useDiagramStore((s) => s.chooseRelationType)
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  // Where the pointer was let go: the menu opens there.
  useEffect(() => {
    const onUp = (e: PointerEvent | MouseEvent) => {
      const r = containerRef.current?.getBoundingClientRect()
      if (r) setAt({ x: e.clientX - r.left, y: e.clientY - r.top })
    }
    window.addEventListener('mouseup', onUp, true)
    return () => window.removeEventListener('mouseup', onUp, true)
  }, [containerRef])
  useEffect(() => {
    if (!choice) return
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') choose(null) }
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) choose(null) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown, true)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onDown, true) }
  }, [choice, choose])
  if (!choice) return null
  const source = nodes[choice.sourceId]?.label ?? choice.sourceId
  const target = nodes[choice.targetId]?.label ?? choice.targetId
  const box = containerRef.current?.getBoundingClientRect()
  const x = Math.max(8, Math.min((at?.x ?? (box?.width ?? 400) / 2), (box?.width ?? 400) - 240))
  const y = Math.max(8, Math.min((at?.y ?? (box?.height ?? 300) / 2), (box?.height ?? 300) - 40 - choice.types.length * 30))
  return (
    <div ref={menuRef} className="relation-type-menu" role="menu" aria-label={`Relation from ${source} to ${target}`}
      style={{ position: 'absolute', left: x, top: y, zIndex: 120 }}>
      <div className="relation-type-menu-title">{source} → {target}: which relation?</div>
      {choice.types.map((t) => {
        const def = metamodel?.relationTypes[t]
        return (
          <button key={t} type="button" role="menuitem" title={def?.description} onClick={() => choose(t)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
              e.preventDefault()
              const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
              const i = items.indexOf(e.currentTarget)
              items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus()
            }}>
            {relationTypeName(metamodel, t, false, nodes[choice.sourceId] && nodes[choice.targetId] ? { from: nodes[choice.sourceId].type, to: nodes[choice.targetId].type } : undefined)}
          </button>
        )
      })}
    </div>
  )
}
