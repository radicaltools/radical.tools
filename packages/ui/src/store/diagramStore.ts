import { create } from 'zustand'
import { current, produce } from 'immer'
import { immer } from 'zustand/middleware/immer'
import {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
  Connection,
} from 'reactflow'
import {
  C4Node,
  C4Relation,
  C4NodeRFData,
  C4EdgeRFData,
  DiagramData,
  DiagramView,
  DiagramSequence,
  DiagramSnapshot,
  PresentationSlide,
  Presentation,
  SlideCanvasState,
  NodePosition,
  PositionMap,
  LayoutConstraint,
  AlignConstraint,
  defaultGridColumns,
  pinnedNodeIds,
  NODE_SIZES,
  COLLAPSED_HEIGHT,
  COLLAPSED_WIDTH,
  isContainerType,
  slideWithoutMilestone,
} from '@radical/common/c4'
import {
  Metamodel,
  NodeTypeDef,
  RelationTypeDef,
  builtInC4Metamodel,
  builtInGovernanceMetamodel,
  isRelationAllowed,
  relationTypesFitting,
  allowedPlacesText,
  isParentAllowed,
  isPlacementAllowed,
  canAddMoreOfType,
  inferRelationType,
  wizardFor,
  sameWizardLink,
  wizardLinksOf,
  type WizardLink,
  relationDisplayLabel,
  relationTypeForProse,
  relationTypeName,
} from '@radical/common/metamodel'
import { processFlow } from '@radical/common/warnier'
import * as model from '@radical/common/model'
import { canBeSubject, newViewName, viewpointsOf } from '@radical/common/viewpoints'
import { chainRelationFor, pipelineOf, viewDrawnIds, viewShownNodes } from '@radical/common/viewPipeline'
import { relationRefusal, relationTypesAccepted } from '@radical/common/relationRules'
import { mergeModels, mergeNotices, mergeSteps } from '@radical/common/modelMerge'
import { markdownToPlain } from '@radical/common/markdown'
import type { HubImportRecord, HubConceptMeta } from './hubStore'
import { conceptFileAsModel, resolveParamValues, retemplateText } from '@radical/common/hubImport'
import { applyTreeLayout } from '@radical/layout/elkLayout'
import { applyRadicalLayout } from '@radical/layout/radicalLayout'
import { runSmartLayout, type SmartLayoutProgress } from '../layout/smartLayoutRunner'
import { minimizeCrossings } from '@radical/layout/crossingOpt'
import { type CanvasBox, EXPAND_GAP, compoundPadding, createBatchPlacer, drawnSize, fittedParentSize, freeSpotNear, gridSlotIn, growFrameLeftUp as growFrameLeftUpIn, isFixedSizeType, growWithRoom, makeRoomAround, placeBesideSiblings, settleMovedNodes, placeGhosts, placeUnplaced, projectToVisibleGraph, strayNodeIds } from '@radical/layout/geometry'
import { liesClearInParent, modelCanvas } from '@radical/layout/geometry'
import { arrangeGrid } from '@radical/layout/constraints'
import {
  applyAlignments,
  applyLayoutPositions,
  computeViewCollapsedSet,
  chainHiddenRelations,
  computeViewNodeSet,
  viewFrames,
  viewExpandedSet,
  fitAndSeparateBottomUp,
  isEffectivelyCollapsed,
  viewLayoutInput,
  type LayoutInput,
} from '@radical/layout/viewInput'
// Re-exported for components that read view collapse state from the store module.
export { computeViewCollapsedSet, isEffectivelyCollapsed }
import { LiveColaLayout, type DragMode } from '../layout/liveColaLayout'
import { LIVE_CHILD_TOP_MIN } from '@radical/layout/liveColaEngine'
import { documentBackend } from './documentBackend'
import { type Exploration, type ExploreChoice, drawnAt, explorationLines, explorationLinks, explorationOf, flatNodes, foldable, folded, grown, isExploration, laidOut as layExploration, linkCounts, listedIds, newExploration, prunedExploration, viewPlaces, withExploreState, withoutExpansions } from './exploration'
export type { Exploration, ExploreChoice } from './exploration'
import { isViewerProfile } from '../runtime'
import { loadStudioSettings, updateStudioSettings } from '../studioSettings'
import { lowDetailAt } from './canvasDetail'
import { type EdgeStyle, type ViewPipeline, addToViewList, isBackwardStep, removeFromViewList, viewCanvasPositions, viewFolderRenameTarget, viewShowsEveryNode, wikiDepthOf, trimStepBackward, withCanvasPositions } from '@radical/common/c4'

// ─── Smart Layout "why this layout" report ───────────────────────────────────
//
// Distilled from SmartLayoutResult after every run and kept in the store so
// the UI can show the full candidate ranking (previously a console.info-only
// breadcrumb) instead of it being invisible to anyone not watching DevTools.

export interface SmartLayoutReportCandidate {
  name: string
  composite: number
  crossings: number
  renderedCrossings: number
  overdraws: number
  renderedOverdraws: number
  nodeOverlap: number
  edgeLengthMean: number
  aspectPenalty: number
  symmetryDeficit: number
}

export interface SmartLayoutReport {
  timestamp: number
  winnerName: string
  /** Ranked ascending by composite score (index 0 = best pre-refinement candidate). */
  candidates: SmartLayoutReportCandidate[]
  before: { crossings: number; overdraws: number }
  after: { crossings: number; overdraws: number }
  refinement: { before: number; after: number; iterations: number }
  planarity: { verdict: 'planar' | 'near-planar' | 'tangled'; crossingEdges: number; totalEdges: number }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID()
}

// ─── Undo / Redo history ────────────────────────────────────────────────────

interface HistoryEntry {
  c4Nodes: Record<string, C4Node>
  c4Relations: Record<string, C4Relation>
  views: Record<string, DiagramView>
  defaultLayoutConstraints: LayoutConstraint[]
  defaultEdgeStyle: EdgeStyle
  /** The canvas that was shown: `c4Nodes` hold its positions. Undo goes
   *  back to it. Restored under another canvas, they became that canvas's
   *  layout (a drag on one view, undone on another, gave the second the
   *  first one's positions). */
  activeViewId: string | null
  defaultPositions: Record<string, NodePosition>
  /** Editing a sequence is a step like any other. Entries used to leave
   *  them out, so Undo after a removed step or a deleted sequence took back
   *  the edit made before it instead. */
  sequences: Record<string, DiagramSequence>
  /** The Hub templates' values: changing them is a step of its own. */
  hubTemplates: Record<string, HubImportRecord>
  /** The metamodel: its edits, Save as viewpoint and Reset to C4 are steps
   *  too. Undo after Save as viewpoint left the viewpoint in it. */
  metamodel: Metamodel
  /** In a milestone: whether it had edits not kept or dropped yet. Undo of
   *  every edit left it "unsaved", with nothing to save. */
  milestoneDirty?: boolean
  /** The milestones, and the milestone each slide shows (slide id →
   *  milestone id): making, renaming and deleting one is a step. A step
   *  rebased on an outside change has neither and leaves them as they are. */
  snapshots?: DiagramSnapshot[]
  slideMilestones?: Record<string, string>
  /** Taken while the exploration of this id was shown. No step keeps an
   *  exploration (Explore from here): the entry holds All elements' places
   *  and canvas, and goes back to the exploration while it is open. */
  explorationId?: string
}

/**
 * A step made before an outside change arrived (an agent's write, an editor,
 * git). Its model is not one to go back to: restoring it took that change
 * back with the step. It is kept as what the step changes, from the model
 * `from` to the model `to`, and Undo or Redo makes that change on the model
 * as it is now (_rebasedEntry).
 */
interface StepChange {
  from: HistoryEntry
  to: HistoryEntry
}

/**
 * A step of the exploration's own (Explore from here): a +, a −, a drag on
 * it, in Designer. It holds the exploration as it was (`explored`, its
 * places included): Undo puts it back, on its canvas. Never saved; gone
 * with the exploration (_dropExplorationSteps). An outside change leaves
 * it as it is: it changes nothing of the model.
 */
interface ExplorationStep {
  explored: Exploration
  /** A +: the expansion it made, and the exploration it made. Undone on an
   *  exploration that changed since outside the history (in Viewer), it
   *  takes out what that expansion added, not the changes made since. */
  expansion?: string
  after?: Exploration
}

type HistoryItem = HistoryEntry | StepChange | ExplorationStep

const isStepChange = (item: HistoryItem): item is StepChange => 'from' in item
const isExplorationStep = (item: HistoryItem): item is ExplorationStep => 'explored' in item

const MAX_HISTORY = 100
const _undoStack: HistoryItem[] = []
const _redoStack: HistoryItem[] = []
/**
 * The live model's history, parked while a milestone is shown. A step
 * belongs to the model it was made on: steps made on the live model undone
 * while a milestone was shown put the live model under the milestone's name
 * (and "propagate" then copied it over every milestone), and steps made in a
 * milestone undone after leaving it made the milestone the live model.
 */
let _liveHistory: { undo: HistoryItem[]; redo: HistoryItem[] } | null = null
/** The live model when the milestone shown was opened (_liveHistory). */
let _liveAtVisit: HistoryEntry | null = null

/** A milestone is about to be shown: its steps start from nothing. The
 *  live model's are kept for the way back, with the live model as it is
 *  (`live`). */
function _historyEntersMilestone(fromLive: boolean, live: HistoryEntry): void {
  const parked = { undo: _undoStack.splice(0), redo: _redoStack.splice(0) }
  if (fromLive) { _liveHistory = parked; _liveAtVisit = live }
}

/** The milestones, the metamodel, the views and the slides' milestones are
 *  the live model's as much as a milestone's: what is done to them while a
 *  milestone is shown (Save as new, a rename, a type added) is no edit of
 *  it, and stays. The live model's parked steps held them as they were
 *  before the visit, and Undo of a live step took them back with it
 *  (saved). Once any of them changed (`now`), each of those steps becomes
 *  the change it makes (StepChange), from the live model as the visit
 *  began, as after a change made outside Studio. */
function _liveHistoryKeepsVisit(now: Pick<HistoryEntry, 'views' | 'metamodel' | 'snapshots' | 'slideMilestones' | 'defaultEdgeStyle'>, stacks: HistoryItem[][]): void {
  const was = _liveAtVisit
  if (!was) return
  const viewIds = new Set([...Object.keys(was.views), ...Object.keys(now.views)])
  const changed = [...viewIds].some((id) => was.views[id] !== now.views[id]) ||
    was.metamodel !== now.metamodel ||
    (!!now.snapshots && was.snapshots !== now.snapshots) ||
    (!!now.slideMilestones && JSON.stringify(was.slideMilestones ?? {}) !== JSON.stringify(now.slideMilestones)) ||
    was.defaultEdgeStyle !== now.defaultEdgeStyle
  if (!changed) return
  const drag = _beforeDrag
  _historyRebased(was, stacks)
  _beforeDrag = drag
  _liveAtVisit = null
}

/** The live model is shown again: the milestone's steps go, its own come
 *  back, unless the milestone's edits were carried into it (`changed`). */
function _historyBackOnLive(changed = false): void {
  _undoStack.length = 0
  _redoStack.length = 0
  if (_liveHistory && !changed) {
    _undoStack.push(..._liveHistory.undo)
    _redoStack.push(..._liveHistory.redo)
  }
  _liveHistory = null
  _liveAtVisit = null
}

/** Another model was loaded: nothing of the history belongs to it, and
 *  neither does the copy a drag in progress keeps for its undo step (a
 *  folder reloaded during a drag: Undo then took the outside edit back). */
function _historyForgotten(): void {
  _undoStack.length = 0
  _redoStack.length = 0
  _liveHistory = null
  _liveAtVisit = null
  _beforeDrag = null
}

/** The model shown (`now`) is about to be read again with a change made
 *  outside Studio in it: every step, of Undo's and of Redo's, becomes the
 *  change it makes (StepChange); each stack is a chain that starts at
 *  `now`. The copy a drag in progress keeps goes, as on any load: its step
 *  would take the outside change back. */
function _historyRebased(now: HistoryEntry, stacks: HistoryItem[][] = [_undoStack, _redoStack]): void {
  for (const stack of stacks) {
    let next = now
    for (let i = stack.length - 1; i >= 0; i--) {
      const item = stack[i]
      if (isStepChange(item)) { next = item.to; continue }
      if (isExplorationStep(item)) continue
      stack[i] = { from: next, to: item }
      // What is typed after the change goes on the same step (_typing).
      if (_typing?.step === item) _typing.step = stack[i]
      next = item
    }
  }
  _beforeDrag = null
}

/** A model of a history entry as a document holds it: All elements'
 *  positions on the nodes and in `defaultPositions`, each view's in the
 *  view, whichever canvas was shown. Steps taken on different canvases
 *  merge then (their nodes hold the positions of the canvas shown). */
function _entryModel(entry: HistoryEntry): DiagramData {
  const shown = snapshotPositions(entry.c4Nodes)
  const view = entry.activeViewId ? entry.views[entry.activeViewId] : undefined
  const defaultPositions = entry.activeViewId === null ? shown : entry.defaultPositions
  return {
    nodes: Object.values(atDefaultPositions(Object.values(entry.c4Nodes), defaultPositions)),
    relations: Object.values(entry.c4Relations),
    sequences: Object.values(entry.sequences),
    views: Object.values(entry.views).map((v) => v !== view ? v : {
      ...v,
      positions: viewCanvasPositions(v, entry.c4Nodes, shown, viewDrawnIds(v, entry.c4Nodes, entry.c4Relations)),
    }),
    defaultPositions,
    defaultLayoutConstraints: entry.defaultLayoutConstraints,
    defaultEdgeStyle: entry.defaultEdgeStyle,
    hubTemplates: entry.hubTemplates,
    metamodel: entry.metamodel,
  }
}

/** What a merged model holds that it cannot: an element whose container
 *  is gone (with what it holds and their relations) and a relation to an
 *  element that is gone. A step brought them back on a model an outside
 *  change had taken their container or other end from (Undo of a delete
 *  after the agent deleted the API: "charges card" from no element). Taken
 *  out; returns the names of what was. With them go the steps of every
 *  relation gone, `gone.relations` too (deleted outside Studio since): Undo
 *  of a relation's delete after the agent deleted its end brought its step
 *  back without it (item 254). And what the step puts back on the views and
 *  layout rules of the elements and relations in `gone` (a fold, a row, an
 *  entry in a view's list, a hidden relation), unless a milestone is shown
 *  (`inMilestone`): the views are the live model's then (keepingSharedViews). */
function _withoutStrays(
  parts: Pick<model.ModelState, 'c4Nodes' | 'c4Relations' | 'views' | 'defaultLayoutConstraints' | 'sequences'>,
  gone: { nodes: Set<string>; relations: Set<string> },
  inMilestone: boolean,
): { parts: typeof parts; dropped: string[] } {
  const dropped: string[] = []
  const next = produce(parts, (draft) => {
    const state = { ...draft, activeViewId: null } as unknown as model.ModelState
    for (const node of Object.values(parts.c4Nodes)) {
      if (!node.parentId || parts.c4Nodes[node.parentId] || !state.c4Nodes[node.id]) continue
      dropped.push(node.label || node.id)
      model.deleteNode(state, node.id)
    }
    const relations = new Set([...gone.relations].filter((id) => !state.c4Relations[id]))
    for (const [id, rel] of Object.entries(state.c4Relations)) {
      const ends = [state.c4Nodes[rel.sourceId], state.c4Nodes[rel.targetId]]
      if (ends.every(Boolean)) continue
      const end = ends.find(Boolean)
      dropped.push(rel.label || (end ? `a relation of ${end.label}` : 'a relation'))
      delete state.c4Relations[id]
      relations.add(id)
    }
    model.forgetRelationsInSequences(state, relations)
    if (!inMilestone) {
      for (const view of Object.values(state.views)) {
        if (view.hiddenRelationIds?.some((id) => relations.has(id))) view.hiddenRelationIds = view.hiddenRelationIds.filter((id) => !relations.has(id))
      }
      const nodes = new Set([...gone.nodes].filter((id) => !state.c4Nodes[id]))
      if (nodes.size) model.forgetNodesInViews(state, nodes)
    }
    // Set anew, not changed in place (forgetNodesInViews).
    draft.defaultLayoutConstraints = state.defaultLayoutConstraints ?? []
  })
  return { parts: next, dropped }
}

/** `entry` as shown on the canvas `viewId` (null: All elements): the same
 *  model, with the positions of that canvas in its nodes. Redo after an
 *  Undo pressed on another canvas than the step's went to the canvas Undo
 *  was pressed on, which the step never changed. */
function _entryOnCanvas(entry: HistoryEntry, viewId: string | null): HistoryEntry {
  if (entry.activeViewId === viewId || (viewId !== null && !entry.views[viewId])) return entry
  const data = _entryModel(entry)
  const c4Nodes: Record<string, C4Node> = {}
  for (const n of data.nodes) c4Nodes[n.id] = { ...n }
  const views: Record<string, DiagramView> = {}
  for (const v of data.views ?? []) views[v.id] = v
  const defaultPositions = data.defaultPositions ?? {}
  const view = viewId ? views[viewId] : undefined
  const positions = view ? view.positions : defaultPositions
  if (Object.keys(positions).length > 0) showCanvasPositions(c4Nodes, positions, view, entry.c4Relations)
  return { ...entry, c4Nodes, views, defaultPositions, activeViewId: viewId }
}

/** What a step removes (an element `from` has) that was built on outside
 *  Studio since: a child added into it, a relation added to it. It stays,
 *  as it is in `now`, with its places on the views and its relations, and
 *  so does what holds it. Undo of an add after the agent added a container
 *  in it took the container away with it ("left out what needs an element
 *  removed"), and Redo brought back the system alone. Returns the merged
 *  model with them, and their names. */
function _keptBuiltOn(from: DiagramData, now: DiagramData, merged: DiagramData): { merged: DiagramData; kept: string[] } {
  const had = new Set(from.nodes.map((n) => n.id))
  const hadRelation = new Set(from.relations.map((r) => r.id))
  const nowNodes = new Map(now.nodes.map((n) => [n.id, n]))
  const present = new Set(merged.nodes.map((n) => n.id))
  const kept: C4Node[] = []
  const keep = (id: string | undefined): void => {
    while (id && !present.has(id) && had.has(id) && nowNodes.has(id)) {
      const node = nowNodes.get(id)!
      present.add(id)
      kept.push(node)
      id = node.parentId
    }
  }
  for (const n of merged.nodes) if (!had.has(n.id)) keep(n.parentId)
  for (const r of merged.relations) if (!hadRelation.has(r.id)) { keep(r.sourceId); keep(r.targetId) }
  if (kept.length === 0) return { merged, kept: [] }
  const keptIds = new Set(kept.map((n) => n.id))
  const relations = [...merged.relations]
  const mergedRelations = new Set(relations.map((r) => r.id))
  for (const r of now.relations) {
    if (mergedRelations.has(r.id) || !(keptIds.has(r.sourceId) || keptIds.has(r.targetId))) continue
    if (present.has(r.sourceId) && present.has(r.targetId)) relations.push(r)
  }
  const nowViews = new Map((now.views ?? []).map((v) => [v.id, v]))
  const views = (merged.views ?? []).map((v) => {
    const there = nowViews.get(v.id)
    const ids = there ? [...keptIds].filter((id) => there.nodeIds.includes(id) && !v.nodeIds.includes(id)) : []
    const places = there ? [...keptIds].filter((id) => there.positions?.[id] && !v.positions?.[id]) : []
    if (!ids.length && !places.length) return v
    return {
      ...v,
      nodeIds: [...v.nodeIds, ...ids],
      positions: { ...v.positions, ...Object.fromEntries(places.map((id) => [id, there!.positions![id]])) },
    }
  })
  const defaultPositions = { ...merged.defaultPositions }
  for (const id of keptIds) if (now.defaultPositions?.[id] && !defaultPositions[id]) defaultPositions[id] = now.defaultPositions[id]
  return {
    merged: { ...merged, nodes: [...merged.nodes, ...kept], relations, views, defaultPositions },
    kept: kept.map((n) => n.label || n.id),
  }
}

/** What the step `change` makes, made on the model `now`: a three-way merge
 *  from `change.from` (mergeModels). Where the model changed since in a
 *  value the step changes too, it stays as it is now (`conflicts`); what it
 *  removes that was built on since stays too (`kept`, _keptBuiltOn); what
 *  the step brings back that has no place left in it does not come back
 *  (`dropped`, _withoutStrays). Shown on the canvas of `change.to`, as Undo
 *  goes back to its step's canvas. */
function _rebasedEntry(change: StepChange, now: HistoryEntry, inMilestone = false): { entry: HistoryEntry; conflicts: string[]; kept: string[]; dropped: string[]; notices: string[] } {
  const nowModel = _entryModel(now)
  const fromModel = _entryModel(change.from)
  const toModel = _entryModel(change.to)
  const result = mergeModels(fromModel, toModel, nowModel, { keepParents: false })
  // What the step changes in an element deleted outside Studio since stays deleted.
  const conflicts = [...result.conflicts, ...result.dropped.filter((d) => d.by === 'ours').map((d) => d.name)]
  const notices = mergeNotices({ dropped: result.dropped.filter((d) => d.by === 'theirs') }, { ours: 'by the step', theirs: 'outside Studio' })
  const { merged, kept } = _keptBuiltOn(fromModel, nowModel, result.merged)
  const mergedNodes: Record<string, C4Node> = {}
  for (const n of merged.nodes) mergedNodes[n.id] = n
  const mergedRelations: Record<string, C4Relation> = {}
  for (const r of merged.relations) mergedRelations[r.id] = r
  const mergedViews: Record<string, DiagramView> = {}
  for (const v of merged.views ?? []) mergedViews[v.id] = v
  const sequencesIn: Record<string, DiagramSequence> = {}
  for (const q of merged.sequences ?? []) sequencesIn[q.id] = q
  // What a side had and the merge left out: deleted on one side.
  const had = (of: (d: DiagramData) => Array<{ id: string }>, present: Record<string, unknown>) =>
    new Set([fromModel, toModel, nowModel].flatMap((d) => of(d).map((e) => e.id)).filter((id) => !present[id]))
  const { parts, dropped } = _withoutStrays({
    c4Nodes: mergedNodes,
    c4Relations: mergedRelations,
    views: mergedViews,
    defaultLayoutConstraints: merged.defaultLayoutConstraints ?? [],
    sequences: sequencesIn,
  }, { nodes: had((d) => d.nodes, mergedNodes), relations: had((d) => d.relations, mergedRelations) }, inMilestone)
  const c4Nodes: Record<string, C4Node> = {}
  for (const n of Object.values(parts.c4Nodes)) c4Nodes[n.id] = { ...n }
  const c4Relations = parts.c4Relations
  const views = { ...parts.views }
  const sequences = parts.sequences ?? {}
  const defaultPositions = merged.defaultPositions ?? {}
  const activeViewId = change.to.activeViewId && views[change.to.activeViewId] ? change.to.activeViewId : null
  const view = activeViewId ? views[activeViewId] : undefined
  const positions = view ? view.positions ?? {} : defaultPositions
  if (Object.keys(positions).length > 0) showCanvasPositions(c4Nodes, positions, view, c4Relations)
  // What the step puts back may meet what was placed outside Studio since,
  // as a merge of unsaved edits does (Undo of Smart Layout after the agent
  // grew Payment Provider): on All elements, room is made as on a load.
  if (!activeViewId && !change.to.activeViewId) _settleOutsidePlaces(c4Nodes, change.to.c4Nodes)
  // And on the view it goes back to, which keeps the places made: Undo of
  // Bookstore's delete, after the agent put Search into it (it came back
  // with Search alone, drawn where Web App had been), put Web App back on
  // top of Search.
  else if (view && activeViewId === change.to.activeViewId) {
    const canvasOf = (entry: Pick<HistoryEntry, 'views' | 'c4Nodes' | 'c4Relations'>): CanvasSets =>
      activeCanvasSets({ activeViewId, views: entry.views, exploration: null, c4Nodes: entry.c4Nodes, c4Relations: entry.c4Relations })
    const settled = _settleOutsidePlaces(c4Nodes, change.to.c4Nodes, canvasOf({ views, c4Nodes, c4Relations }), canvasOf(change.to))
    if (settled.length) {
      const placed = snapshotPositions(c4Nodes)
      views[view.id] = { ...view, positions: { ...view.positions, ...Object.fromEntries(settled.map((id) => [id, placed[id]])) } }
    }
  }
  return {
    entry: {
      c4Nodes,
      c4Relations,
      views,
      defaultLayoutConstraints: parts.defaultLayoutConstraints ?? [],
      defaultEdgeStyle: merged.defaultEdgeStyle ?? 'curved',
      activeViewId,
      defaultPositions,
      sequences,
      hubTemplates: (merged.hubTemplates ?? {}) as Record<string, HubImportRecord>,
      metamodel: (merged.metamodel ?? now.metamodel) as Metamodel,
      milestoneDirty: change.to.milestoneDirty,
      ...(change.to.explorationId ? { explorationId: change.to.explorationId } : {}),
      ...(_rebasedMilestones(change, now)),
    },
    conflicts,
    kept,
    dropped,
    notices,
  }
}

/** What the step `change` does to the milestones (one made, renamed or
 *  deleted), done on the milestones as they are `now`: the others, an
 *  agent's among them, stay as they are. */
function _rebasedMilestones(change: StepChange, now: HistoryEntry): Pick<HistoryEntry, 'snapshots' | 'slideMilestones'> {
  const from = change.from.snapshots
  const to = change.to.snapshots
  if (!from || !to || !now.snapshots) return {}
  const fromById = new Map(from.map((m) => [m.id, m]))
  const toIds = new Set(to.map((m) => m.id))
  const list = now.snapshots.filter((m) => !(fromById.has(m.id) && !toIds.has(m.id)))
    .map((m) => {
      const was = fromById.get(m.id)
      const becomes = to.find((x) => x.id === m.id)
      return was && becomes && was.name !== becomes.name ? { ...m, name: becomes.name } : m
    })
  to.forEach((m, i) => {
    if (fromById.has(m.id) || list.some((x) => x.id === m.id)) return
    list.splice(Math.min(i, list.length), 0, m)
  })
  return { snapshots: list, slideMilestones: { ...now.slideMilestones, ...change.to.slideMilestones } }
}

/** What a change read from outside Studio (an agent's write, merged with
 *  the edits Studio had not written yet) placed on a sibling where Studio
 *  has it (`was`, Studio's live model before the change, at All elements'
 *  places), on All elements. Each side placed clear of what it had: a queue
 *  dropped into Payment Provider in Studio and Orders DB moved into it by
 *  the agent came to the same spot (item 264). By the rule for moves, the
 *  one the change placed (added, moved into another parent or moved) keeps
 *  its place where it lies clear, else goes beside its siblings, with room
 *  made (settleMovedNodes); one the change grew where Studio has it (a
 *  container the agent added into) has room made round it (makeRoomAround),
 *  as an add makes it. Overlaps Studio had already stay. Mutates `nodes`
 *  (copies); returns the ids moved. */
function _settleOutsidePlaces(nodes: Record<string, C4Node>, was: Record<string, C4Node>, sets: CanvasSets = {}, wasSets: CanvasSets = {}): string[] {
  const before = canvasBoxes(was, wasSets.viewFilter, wasSets.viewCollapsedSet, wasSets.expandedSet)
  const overlap = (a: CanvasBox, b: CanvasBox): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  const sameParent = (a: C4Node, b: C4Node): boolean => (a.parentId ?? undefined) === (b.parentId ?? undefined)
  const placed = (n: C4Node): boolean => {
    const w = was[n.id]
    return !w || !sameParent(w, n) || Math.abs(w.x - n.x) >= 0.5 || Math.abs(w.y - n.y) >= 0.5
  }
  const touched: string[] = []
  const settled = new Set<string>()
  let canvas = canvasBoxes(nodes, sets.viewFilter, sets.viewCollapsedSet, sets.expandedSet)
  const siblings = new Map<string, string[]>()
  for (const n of Object.values(nodes)) {
    if (!canvas.shown(n)) continue
    const key = n.parentId ?? ''
    siblings.set(key, [...(siblings.get(key) ?? []), n.id])
  }
  const pairs = [...siblings.values()].flatMap((group) => group.flatMap((aId, i) => group.slice(i + 1).map((bId) => [aId, bId] as const)))
  for (const [aId, bId] of pairs) {
    const a = nodes[aId], b = nodes[bId]
    if (settled.has(aId) || settled.has(bId) || !sameParent(a, b)) continue
    if (!overlap(canvas.boxOf(a), canvas.boxOf(b))) continue
    const wa = was[aId], wb = was[bId]
    if (wa && wb && sameParent(wa, wb) && before.shown(wa) && before.shown(wb) && overlap(before.boxOf(wa), before.boxOf(wb))) continue
    const grew = (n: C4Node): boolean => {
      const w = was[n.id]
      if (!w || !sameParent(w, n)) return false
      const now = canvas.boxOf(n), then = before.boxOf(w)
      return now.w > then.w + 0.5 || now.h > then.h + 0.5
    }
    const [pa, pb, ga, gb] = [placed(a), placed(b), grew(a), grew(b)]
    if (!pa && !pb && !ga && !gb) continue
    // One the change grew where Studio has it: room is made round it.
    const grown = !pb && gb ? b : !pa && ga ? a : undefined
    if (grown) {
      for (const [id, at] of Object.entries(makeRoomAround(grown.id, nodes, canvas))) {
        nodes[id].x = at.x
        nodes[id].y = at.y
        touched.push(id)
      }
      // What was pushed may reach past the parent's frame: it fits again.
      if (grown.parentId && nodes[grown.parentId]) touched.push(...growWithRoom(nodes, grown.parentId, canvasBoxes(nodes, sets.viewFilter, sets.viewCollapsedSet, sets.expandedSet)))
      settled.add(grown.id)
      canvas = canvasBoxes(nodes, sets.viewFilter, sets.viewCollapsedSet, sets.expandedSet)
      continue
    }
    // The one the change placed; of two, the one Studio did not have.
    const mover = pa && pb ? (wb ? a : b) : pa ? a : b
    touched.push(mover.id, ...settleMovedNodes(nodes, [mover.id], canvas))
    settled.add(mover.id)
    canvas = canvasBoxes(nodes, sets.viewFilter, sets.viewCollapsedSet, sets.expandedSet)
  }
  return [...new Set(touched)]
}

/** A milestone shown when the folder changed outside Studio (an agent's
 *  write): the change is the live model's, and the milestone stays shown
 *  with the edits not decided yet. Closing it lost them, with no word. */
interface ShownMilestone {
  id: string
  /** The milestone as Studio had it, before the change was read. */
  before: DiagramSnapshot
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  sequences: Record<string, DiagramSequence>
  dirty: boolean
  promptOpen: boolean
  activeViewId: string | null
  diffHighlight: DiagramStore['diffHighlight']
  diffBaseSnapshotId: string | null
  diffGhostNodes: DiagramStore['diffGhostNodes']
  diffGhostRelations: DiagramStore['diffGhostRelations']
}

/** The milestone `shown` on top of the snapshots read again (`after`): its
 *  elements as shown, with what was changed outside Studio in the milestone
 *  itself merged in (mergeModels; `conflicts` where both changed a value,
 *  the folder's kept). Null when the milestone is gone. */
function _milestoneAfterOutsideChange(shown: ShownMilestone, after: DiagramSnapshot[]): { nodes: Record<string, C4Node>; relations: Record<string, C4Relation>; sequences: Record<string, DiagramSequence>; changed: boolean; conflicts: string[] } | null {
  const now = after.find((m) => m.id === shown.id)
  if (!now) return null
  const changes = model.compareModels(
    { nodes: shown.before.nodes as Record<string, C4Node>, relations: shown.before.relations as Record<string, C4Relation> },
    { nodes: now.nodes as Record<string, C4Node>, relations: now.relations as Record<string, C4Relation> },
  )
  const changed = [changes.nodes, changes.relations].some((c) => c.added.length || c.removed.length || c.changed.length)
  if (!changed) return { nodes: shown.nodes, relations: shown.relations, sequences: shown.sequences, changed, conflicts: [] }
  const asData = (m: { nodes: Record<string, C4Node>; relations: Record<string, C4Relation>; sequences?: Record<string, DiagramSequence> }): DiagramData =>
    ({ nodes: Object.values(m.nodes), relations: Object.values(m.relations), sequences: Object.values(m.sequences ?? {}) })
  const { merged, conflicts } = mergeModels(
    asData(shown.before),
    asData(shown),
    asData(now),
  )
  return {
    nodes: Object.fromEntries(merged.nodes.map((n) => [n.id, n])),
    relations: Object.fromEntries(merged.relations.map((r) => [r.id, r])),
    sequences: now.sequences ? Object.fromEntries((merged.sequences ?? []).map((q) => [q.id, q])) : shown.sequences,
    changed,
    conflicts,
  }
}

/** The metamodel lost types outside Studio (an agent's delete_node_type):
 *  a step that holds elements or relations of a type it no longer has
 *  cannot be gone back to (Undo brought back an element whose type had been
 *  deleted since, as an unknown type). That step and every one beyond it
 *  go; the nearer ones stay. A type deleted in Studio is a step of its own,
 *  and Undo brings it back. */
function _historyKeepsTypes(metamodel: Metamodel): void {
  const fitsEntry = (entry: HistoryEntry): boolean =>
    Object.values(entry.c4Nodes).every((n) => !!metamodel.nodeTypes[n.type]) &&
    Object.values(entry.c4Relations).every((r) => !r.relationType || !!metamodel.relationTypes[r.relationType])
  const fits = (item: HistoryItem): boolean => isExplorationStep(item) || (isStepChange(item) ? fitsEntry(item.from) && fitsEntry(item.to) : fitsEntry(item))
  const trim = (stack: HistoryItem[]): void => {
    // Both stacks are taken from their end: the nearest step is the last.
    for (let i = stack.length - 1; i >= 0; i--) {
      if (!fits(stack[i])) { stack.splice(0, i + 1); return }
    }
  }
  trim(_undoStack)
  trim(_redoStack)
  if (_liveHistory) { trim(_liveHistory.undo); trim(_liveHistory.redo) }
}

function _captureState(state: DiagramStore): HistoryEntry {
  // No clone needed: the store is immer-managed, so `state.c4Nodes` etc. are
  // never mutated in place — future edits produce new objects for the
  // changed paths only, leaving this reference (and everything reachable
  // from it) untouched. Retaining it is Immer's own documented undo pattern.
  const entry: HistoryEntry = {
    c4Nodes: state.c4Nodes,
    c4Relations: state.c4Relations,
    views: state.views,
    defaultLayoutConstraints: state.defaultLayoutConstraints,
    defaultEdgeStyle: state.defaultEdgeStyle,
    activeViewId: state.activeViewId,
    defaultPositions: state.defaultPositions,
    sequences: state.sequences,
    hubTemplates: state.hubTemplates,
    metamodel: state.metamodel as Metamodel,
    milestoneDirty: state.milestoneDirty,
    snapshots: state.snapshots,
    slideMilestones: slideMilestonesOf(state.presentations),
  }
  // On the exploration the nodes hold its places, which are no step's: the
  // entry is taken as All elements has the model, and names the exploration.
  if (onExploration(state)) return { ..._entryOnCanvas(entry, null), explorationId: state.activeViewId! }
  return entry
}

/** What the live model shares with the milestone shown, as it is on the
 *  way back to the live model: the views with what was done on them in the
 *  milestone put back (unparkLiveViews). */
function _sharedNow(state: Pick<DiagramStore, 'views' | 'metamodel' | 'snapshots' | 'presentations' | 'defaultEdgeStyle'>, backup: DiagramStore['liveBackup']): Pick<HistoryEntry, 'views' | 'metamodel' | 'snapshots' | 'slideMilestones' | 'defaultEdgeStyle'> {
  let views = state.views as Record<string, DiagramView>
  for (const [id, view] of Object.entries(backup?.views ?? {})) {
    if (views[id] && views[id] !== view) views = { ...views, [id]: view as DiagramView }
  }
  return {
    views,
    metamodel: state.metamodel as Metamodel,
    snapshots: state.snapshots,
    slideMilestones: slideMilestonesOf(state.presentations),
    defaultEdgeStyle: state.defaultEdgeStyle,
  }
}

/** Which milestone each slide shows (slide id → milestone id). */
function slideMilestonesOf(presentations: Presentation[] | undefined): Record<string, string> {
  const links: Record<string, string> = {}
  for (const p of presentations ?? []) for (const slide of p.slides) if (slide.snapshotId) links[slide.id] = slide.snapshotId
  return links
}

/** Whether the model may be edited now: in Designer (and the metamodel
 *  editor, which edits Designer's model), not in Viewer, Presenter or the
 *  Inspector, nor while a presentation plays. Their canvases are put back on
 *  the way out: a relation made or an element nested there was shown, with
 *  its notices, and then lost unsaid. */
export function editsModel(state: Pick<DiagramStore, 'appMode' | 'presentationActive'>): boolean {
  return (state.appMode === 'designer' || state.appMode === 'metamodel') && !state.presentationActive
}

function _pushUndo(state: DiagramStore): void {
  // Undo belongs to Designer. What is collapsed or laid out in Viewer or
  // Presenter is put back on the way out and is no step of Designer's.
  if (state.appMode === 'viewer' || state.appMode === 'presenter' || state.appMode === 'inspector') return
  // A step that lands while a drag is held (Smart Layout's result) starts
  // from where the drag began: the model halfway through a drag is none to
  // go back to (Undo gave a mid-drag state never seen). The drag's own step
  // starts from what that step made, once it is made.
  const held = _beforeDrag
  if (held) {
    _pushUndoEntry(held)
    queueMicrotask(() => { if (_beforeDrag === held) _beforeDrag = _captureState(useDiagramStore.getState()) })
    return
  }
  _pushUndoEntry(_captureState(state))
}

/** Inside an action of the user that is made of several store actions
 *  (`_asOneStep`): the first push is its undo step, the others are part of
 *  it. */
let _oneStepDepth = 0
let _oneStepPushed = false

/** Runs `action` as one undo step, whatever its parts push. */
function _asOneStep<T>(action: () => T): T {
  if (_oneStepDepth++ === 0) _oneStepPushed = false
  try {
    return action()
  } finally {
    _oneStepDepth--
  }
}

/** The camera in use when a model was loaded. Loading shows All elements
 *  while the canvas still has the camera of what it showed (a view, on a
 *  reload): until it moves, it is not All elements' and is not saved as
 *  theirs (a merged reload wrote the view's camera into defaultViewport). */
let _cameraAtLoad: { x: number; y: number; zoom: number } | null = null

/** The camera in use now, unless it is still the one from before a load. */
function allElementsCamera(camera: { x: number; y: number; zoom: number } | null): { x: number; y: number; zoom: number } | null {
  const was = _cameraAtLoad
  if (!camera || (was && was.x === camera.x && was.y === camera.y && was.zoom === camera.zoom)) return null
  return camera
}

/** Counts the user's steps: each undo step made, undone or redone. */
let _historyMark = 0

/** A number that changes with each undo step the user makes, undoes or
 *  redoes: whether the model was edited since a moment (autosave saves
 *  after a load only once it was, D15). */
export function historyMark(): number {
  return _historyMark
}

function _pushUndoEntry(entry: HistoryEntry): void {
  if (_oneStepDepth > 0) {
    if (_oneStepPushed) return
    _oneStepPushed = true
  }
  _historyMark++
  _undoStack.push(entry)
  if (_undoStack.length > MAX_HISTORY) _undoStack.shift()
  _redoStack.length = 0 // clear redo on new change
}

/** Two states of one exploration list the same elements from the same
 *  expansions (their places aside). */
function sameExplorationShape(a: Exploration, b: Exploration): boolean {
  return a.nodeIds.join('\n') === b.nodeIds.join('\n') && Object.keys(a.explore.expansions).sort().join('\n') === Object.keys(b.explore.expansions).sort().join('\n')
}

/** An undo step of the exploration's (ExplorationStep). Not counted by
 *  historyMark: nothing to save. */
function _pushExplorationStep(step: ExplorationStep): void {
  _undoStack.push(step)
  if (_undoStack.length > MAX_HISTORY) _undoStack.shift()
  _redoStack.length = 0
}

/** The exploration is gone (closed, replaced, saved as a view): its steps
 *  go too; the model's steps made on it stay. */
function _dropExplorationSteps(): void {
  for (const stack of [_undoStack, _redoStack]) {
    for (let i = stack.length - 1; i >= 0; i--) if (isExplorationStep(stack[i])) stack.splice(i, 1)
  }
}

/** A text field has focus (beginTyping): what is typed into it until it
 *  loses focus (endTyping) is one undo step, the one its first letter
 *  pushed (`step`), as long as that step is still the last and the edits
 *  are to the same fields of the same element (`key`). Each letter typed
 *  into the Name field was a step of its own. */
let _typing: { key: string; step: HistoryItem | null } | null = null
/** What was being typed when the milestone question took the focus from
 *  the field: it goes on once the field has it again (beginTyping). What
 *  was typed before and after the question were two steps. */
let _typingAtQuestion: { key: string; step: HistoryItem | null } | null = null

/** The undo step of an edit of `key` ("node:<id>:label"), unless it goes on
 *  what is being typed into a focused field (_typing). A step made before an
 *  outside change (StepChange) that the typing goes on gets the edit
 *  (`edit`) in the model it changes from: left out, Undo took what was typed
 *  after an agent's write for a change made outside Studio and kept it
 *  ("Orders", a write, " API": Undo gave "OrdersAPI"). */
function _pushTextEdit(store: DiagramStore, key: string, edit: (state: model.ModelState) => void): void {
  if (_typing && _typing.key === key && _typing.step && _undoStack[_undoStack.length - 1] === _typing.step) {
    const step = _typing.step
    if (isStepChange(step)) {
      step.from = produce(step.from, (draft) => { edit(draft as unknown as model.ModelState) })
    }
    return
  }
  store._pushUndo()
  if (_typing) _typing = { key, step: _undoStack[_undoStack.length - 1] ?? null }
}

/** The model as it was when the drag in progress began (liveGrab). A drag
 *  changes it over many frames, and only its end says whether anything
 *  moved (React Flow reports a click as a drag): the undo step is made
 *  then, from this. */
let _beforeDrag: HistoryEntry | null = null
/** The exploration as it was when a drag on it began: its step (liveRelease). */
let _explorationBeforeDrag: Exploration | null = null
/** A drag is held: from liveGrab until its drop has landed (_dragLanded),
 *  in any perspective. */
let _dragHeld = false
/** Called once at the drop of the drag held now (afterDrag). */
const _afterDrag: (() => void)[] = []
/** The drop is made and the layout has yet to hand back where it landed
 *  (LiveColaLayout.release): the longest it is waited for. */
let _dropLanding: ReturnType<typeof setTimeout> | null = null
const DROP_LANDING_MS = 1000

/** The drop of the drag held has landed: what waited for it runs. */
function _dragLanded(): void {
  if (_dropLanding !== null) clearTimeout(_dropLanding)
  _dropLanding = null
  _dragHeld = false
  for (const fn of _afterDrag.splice(0)) fn()
}

/** An element is held in a drag. A model reloaded under the held mouse
 *  (an agent's write) threw it back to where the drag began, and the drop
 *  landed short by what was dragged before: an outside change waits for
 *  the drop (afterDrag). */
export function dragHeld(): boolean {
  return _dragHeld
}

/** Run `fn` once the drag held now is dropped, after the drop is made
 *  (its place, pin and undo step) and the layout has put it where it
 *  landed. */
export function afterDrag(fn: () => void): void {
  _afterDrag.push(fn)
}

/**
 * What Designer showed when it was left for Viewer or Presenter
 * (`window.__preModeLayout`), put back on return: both are for looking, and
 * what is dragged, collapsed, laid out or picked there is not kept. The
 * milestone shown belongs to it: with the nodes parked but not
 * `activeSnapshotId` and `liveBackup`, a milestone picked in Viewer was
 * "the one shown" in Designer over the live model's nodes ("Propagate" then
 * copied the live model over every milestone), and "Current (live)" picked
 * in Viewer left a milestone's nodes as the live model.
 */
export interface ParkedDesigner {
  c4Nodes: Record<string, C4Node>
  c4Relations: Record<string, C4Relation>
  sequences: Record<string, DiagramSequence>
  views: Record<string, DiagramView>
  defaultPositions: Record<string, NodePosition>
  activeViewId: string | null
  activeSnapshotId: string | null
  liveBackup: DiagramStore['liveBackup']
  milestoneDirty: boolean
  diffHighlight: DiagramStore['diffHighlight']
  diffBaseSnapshotId: string | null
  diffGhostNodes: DiagramStore['diffGhostNodes']
  diffGhostRelations: DiagramStore['diffGhostRelations']
  /** The Hub template records shown: a milestone's are its own
   *  (milestoneHubTemplates), and one picked in Viewer changed them. */
  hubTemplates?: Record<string, HubImportRecord>
  milestoneHubBase?: Record<string, HubImportRecord> | null
}

function parkDesigner(state: DiagramStore): ParkedDesigner {
  return {
    c4Nodes: state.c4Nodes,
    c4Relations: state.c4Relations,
    sequences: state.sequences,
    views: state.views,
    defaultPositions: state.defaultPositions,
    activeViewId: state.activeViewId,
    activeSnapshotId: state.activeSnapshotId,
    liveBackup: state.liveBackup,
    milestoneDirty: state.milestoneDirty,
    diffHighlight: state.diffHighlight,
    diffBaseSnapshotId: state.diffBaseSnapshotId,
    diffGhostNodes: state.diffGhostNodes,
    diffGhostRelations: state.diffGhostRelations,
    hubTemplates: state.hubTemplates,
    milestoneHubBase: _milestoneHubBase,
  }
}

/** The live model of a parked Designer: its nodes, unless it was showing a
 *  milestone and had the live model set aside. */
export function parkedLiveModel(pre: ParkedDesigner): { nodes: Record<string, C4Node>; relations: Record<string, C4Relation>; sequences: Record<string, DiagramSequence> } {
  return pre.activeSnapshotId && pre.liveBackup
    ? { nodes: pre.liveBackup.nodes, relations: pre.liveBackup.relations, sequences: pre.liveBackup.sequences ?? pre.sequences }
    : { nodes: pre.c4Nodes, relations: pre.c4Relations, sequences: pre.sequences }
}

/** The milestone the canvas draws, which the milestone chip names: the one
 *  shown, or while a presentation plays the one the playing slide is linked
 *  to. A slide with neither a milestone nor a copy draws the live model,
 *  one with a copy draws that copy: no milestone. The chip named the
 *  milestone open in Designer over a slide that drew the live model, and
 *  offered its diff and Propagate there. */
export function milestoneOnCanvas(s: Pick<DiagramStore, 'activeSnapshotId' | 'presentationActive' | 'presentationSlides' | 'presentationSlideIndex' | 'snapshots'>): string | null {
  if (!s.presentationActive) return s.activeSnapshotId
  const id = s.presentationSlides[s.presentationSlideIndex]?.snapshotId
  return id && s.snapshots.some((m) => m.id === id) ? id : null
}

/** The model a slide card replaced in Presenter (previewSlide), put back for
 *  a slide that has no model of its own. */
let _beforeSlidePreview: { nodes: Record<string, C4Node>; relations: Record<string, C4Relation> } | null = null

/** A diagram where many elements overlap their siblings has not been laid
 *  out yet. The live layout keeps the positions a document comes with, so
 *  only Smart Layout will arrange it. Elements are taken as drawn: a
 *  collapsed container at its collapsed size, and what it holds not at all
 *  (with stored sizes, containers Smart Layout packed collapsed read as
 *  overlapping, and the notice asked for a layout that already scored best). */
export function looksUnarranged(nodes: Record<string, C4Node>, activeViewId?: string | null, view?: DiagramView): boolean {
  const collapsed = (n: C4Node): boolean => isContainerType(n.type) && nodeEffectivelyCollapsedInView(n, activeViewId, view)
  const hidden = (n: C4Node): boolean => {
    for (let p = n.parentId ? nodes[n.parentId] : undefined; p; p = p.parentId ? nodes[p.parentId] : undefined) {
      if (collapsed(p)) return true
    }
    return false
  }
  const list = Object.values(nodes).filter((n) => !hidden(n))
  const parents = new Set(list.map((n) => n.parentId).filter(Boolean))
  // As deriveRFNodes draws it.
  const box = (n: C4Node): { x: number; y: number; width: number; height: number } =>
    isFixedSizeType(n.type) ? { x: n.x, y: n.y, ...NODE_SIZES[n.type] }
    : isContainerType(n.type) && (collapsed(n) || (!parents.has(n.id) && !n.collapsed))
      ? { x: n.x, y: n.y, width: COLLAPSED_WIDTH[n.type], height: COLLAPSED_HEIGHT[n.type] }
      : n
  const byParent = new Map<string, Array<{ id: string; x: number; y: number; width: number; height: number }>>()
  for (const n of list) {
    const key = n.parentId ?? ''
    const entry = { id: n.id, ...box(n) }
    const siblings = byParent.get(key)
    if (siblings) siblings.push(entry)
    else byParent.set(key, [entry])
  }
  const overlapping = new Set<string>()
  for (const siblings of byParent.values()) {
    for (let i = 0; i < siblings.length; i++) {
      const a = siblings[i]
      for (let j = i + 1; j < siblings.length; j++) {
        const b = siblings[j]
        if (a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height) {
          overlapping.add(a.id)
          overlapping.add(b.id)
        }
      }
    }
  }
  return overlapping.size > list.length * 0.1
}

/** Called after a document loads (at boot or on switching documents). */
/** Whether the document read last has still to be looked at for the "not
 *  laid out yet" notice: on the first canvas shown after it was read. */
let _layoutHintPending = false

/** After a document is read (`loaded`), or a view opened: tells the user to
 *  run Smart Layout when the first canvas shown looks unarranged. All
 *  elements and the other view types are no picture to arrange. */
function suggestSmartLayoutIfUnarranged(loaded = false): void {
  if (loaded) _layoutHintPending = true
  const s = useDiagramStore.getState()
  const view = s.activeViewId ? s.views[s.activeViewId] : undefined
  if (!_layoutHintPending || !view || (view.kind ?? 'static') !== 'static') return
  _layoutHintPending = false
  if (!looksUnarranged(s.c4Nodes, s.activeViewId, s.activeViewId ? s.views[s.activeViewId] : undefined)) return
  s.pushNotification('This diagram is not laid out yet. The live layout only moves what you drag or add: use Smart Layout to arrange it.', 'info')
}

/** Off while restoreSnapshot leaves the milestone shown on its way to
 *  replacing the live model: it lays out the view on screen itself, after. */
let _arrangeOnLeavingMilestone = true

/** On while expandAncestors opens the containers around an element it
 *  reveals (the card's Views, Quick Search, the Inspector): navigation, not
 *  an edit of the milestone shown. The view's live folds are still parked
 *  (_milestoneViewEdit) and come back when the milestone is left. */
let _revealing = false

/** True when the elements have no places at all: each one at the same
 *  point as its siblings (a Structurizr import puts them all at 0,0). No
 *  picture to keep, unlike one that only looks unarranged. */
function hasNoPlaces(nodes: Record<string, C4Node>): boolean {
  const list = Object.values(nodes)
  if (list.length < 2) return false
  const first = new Map<string, C4Node>()
  for (const n of list) {
    const key = n.parentId ?? ''
    const sibling = first.get(key)
    if (!sibling) first.set(key, n)
    else if (sibling.x !== n.x || sibling.y !== n.y) return false
  }
  return true
}

/** On opening a view: a view of a viewpoint never laid out (no positions
 *  of its own), one of a group of views per element among them, gets Smart
 *  Layout at once, in the designer on the live model; so does a canvas never
 *  laid out whose elements have no places at all (an imported Structurizr
 *  view). Another canvas that looks
 *  unarranged gets the notice. Until then it shows All elements'
 *  places (firstCanvasPositions). With a milestone shown the layout would be
 *  an edit of the milestone and is not kept in the view: the view is laid
 *  out back on live (called again when the milestone is left with it on
 *  screen). */
function arrangeOnFirstOpen(): void {
  const s = useDiagramStore.getState()
  const view = s.activeViewId ? s.views[s.activeViewId] : undefined
  const neverLaidOut = !!view && s.appMode === 'designer' && !s.activeSnapshotId && !Object.keys(view.positions ?? {}).length
  const viewpointView = neverLaidOut && !!(view.partOf || view.viewpoint) && (view.kind ?? 'static') === 'static'
  const placeless = neverLaidOut && ((view.kind ?? 'static') === 'static' || view.kind === 'dynamic') && hasNoPlaces(s.c4Nodes)
  if (view && (viewpointView || placeless)) {
    if (_firstLayoutOf === view.id && s.isLayoutRunning) return
    _firstLayoutOf = view.id
    void s.runSmartLayout()
    return
  }
  suggestSmartLayoutIfUnarranged()
}

/** The view whose first layout (arrangeOnFirstOpen) is running. It is no
 *  undo step: it belongs to the step that made the view (New view: one
 *  Undo, not two), and opening a view is none. Until it lands, All
 *  elements' places it shows are not saved as its own: a reload or a view
 *  switch at once kept them for good, and it was never laid out. */
let _firstLayoutOf: string | null = null

/** A view's first layout landed (`positions`): the steps that hold the view
 *  with no positions of its own hold it laid out. Undo of a step made before
 *  the view was opened gave it back All elements' places, for good. */
function _historyKeepsFirstLayout(viewId: string, positions: Record<string, NodePosition>): void {
  const laidOut = (entry: HistoryEntry): HistoryEntry => {
    const view = entry.views[viewId]
    if (!view || entry.activeViewId === viewId || Object.keys(view.positions ?? {}).length) return entry
    return { ...entry, views: { ...entry.views, [viewId]: { ...view, positions } } }
  }
  for (const stack of [_undoStack, _redoStack, ...(_liveHistory ? [_liveHistory.undo, _liveHistory.redo] : [])]) {
    for (let i = 0; i < stack.length; i++) {
      const item = stack[i]
      if (isExplorationStep(item)) continue
      stack[i] = isStepChange(item) ? { from: laidOut(item.from), to: laidOut(item.to) } : laidOut(item)
    }
  }
}

/** Runs `edit`, a rename or delete, on the model in `state` (a draft). In a
 *  milestone it changes the milestone's elements only: the views are the
 *  live model's and every milestone's, so what the edit does to them (a view
 *  named after the element renamed with it, the element taken out of the
 *  views, its view per element deleted) waits until the edit reaches the
 *  live model (Propagate, commitMilestoneChanges). Done at once, Discard
 *  kept it, and the view of an element deleted came back as a new one. */
function keepingSharedViews(state: DiagramStore, edit: () => void): void {
  if (!state.activeSnapshotId) {
    edit()
    return
  }
  const { views, activeViewId, defaultLayoutConstraints } = useDiagramStore.getState()
  edit()
  state.views = views
  state.activeViewId = activeViewId
  state.defaultLayoutConstraints = defaultLayoutConstraints
}

/** model.syncViewpoints on the views, which are the live model's: their
 *  elements are looked up there, not in the milestone shown. Checked
 *  against a milestone without it (or with it deleted there), a view of
 *  one element lost its element and its "within" filter, in the live views
 *  too (Undo and Redo in a milestone). Use inside immer set. */
function syncViewpointsOfLive(state: DiagramStore): string[] {
  const nodes = state.activeSnapshotId && state.liveBackup ? state.liveBackup.nodes : state.c4Nodes
  return model.syncViewpoints({ c4Nodes: nodes, views: state.views, metamodel: state.metamodel } as unknown as model.ModelState)
}

/** The Hub template records as a milestone has them: its texts hold the
 *  values (read from them through the Hub's originals), the records keep
 *  the live model's. Shown so, the section said 250 where the card said
 *  450. A value its texts do not give stays the live one. */
function milestoneHubTemplates(records: Record<string, HubImportRecord>, nodes: Record<string, C4Node>): Record<string, HubImportRecord> {
  let out = records
  for (const [id, record] of Object.entries(records)) {
    const found: Record<string, string> = {}
    for (const [nodeId, original] of Object.entries(record.originalNodes ?? {})) {
      const n = nodes[nodeId] as unknown as Record<string, unknown> | undefined
      if (!n) continue
      for (const [key, template] of Object.entries(original)) {
        if (typeof template !== 'string' || typeof n[key] !== 'string' || !/\{\{[A-Z0-9_]+\}\}/.test(template)) continue
        const keys: string[] = []
        const pattern = template.split(/\{\{([A-Z0-9_]+)\}\}/).map((part, i) => {
          if (i % 2 === 0) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          keys.push(part)
          return '([\\s\\S]*?)'
        }).join('')
        const match = new RegExp(`^${pattern}$`).exec(n[key] as string)
        if (match) keys.forEach((k, i) => { if (!(k in found)) found[k] = match[i + 1] })
      }
    }
    if (Object.entries(found).every(([k, v]) => record.paramValues[k] === v)) continue
    if (out === records) out = { ...records }
    out[id] = { ...record, paramValues: { ...record.paramValues, ...found } }
  }
  return out
}

/** The live records (`live`) with what the milestone's edits changed in
 *  its records (`now` against `base`, those it was shown with): a value an
 *  Apply changed, a record added or removed. */
function propagatedHubTemplates(live: Record<string, HubImportRecord>, base: Record<string, HubImportRecord>, now: Record<string, HubImportRecord>): Record<string, HubImportRecord> {
  const out = { ...live }
  for (const [id, record] of Object.entries(now)) {
    const was = base[id]
    if (!was) { out[id] = record; continue }
    const changed = Object.fromEntries(Object.entries(record.paramValues).filter(([k, v]) => was.paramValues[k] !== v))
    if (Object.keys(changed).length) out[id] = { ...(out[id] ?? record), paramValues: { ...(out[id] ?? record).paramValues, ...changed } }
  }
  for (const id of Object.keys(base)) if (!now[id]) delete out[id]
  return out
}

/** The milestone is left without its edits carried into the live model:
 *  the views, All elements' positions and alignments its edits changed are
 *  put back as the live model has them (liveBackup, _milestoneViewEdit). A
 *  view deleted meanwhile stays deleted. Use inside immer set. */
function unparkLiveViews(state: DiagramStore, backup: DiagramStore['liveBackup']): void {
  if (!backup) return
  for (const [id, view] of Object.entries(backup.views ?? {})) {
    if (state.views[id]) state.views[id] = view as any
  }
  if (backup.defaultPositions) state.defaultPositions = backup.defaultPositions as any
  if (backup.defaultLayoutConstraints) state.defaultLayoutConstraints = backup.defaultLayoutConstraints as any
}

/** What a milestone keeps of a view its own way (DiagramSnapshot.views):
 *  all but where it is looked at. Its places and camera are the view's one
 *  layout for every milestone, and what it is focused on is like a camera. */
function milestoneOwnView(view: DiagramView): DiagramView {
  const { positions: _positions, viewport: _viewport, treemapFocusId: _treemap, wikiFocusId: _wiki, tableActiveTab: _tab, ...rest } = view
  return { ...rest, positions: {} } as DiagramView
}

const sameOwnView = (a: DiagramView, b: DiagramView): boolean =>
  JSON.stringify(milestoneOwnView(a)) === JSON.stringify(milestoneOwnView(b))

/** The views a milestone keeps its own way (`snap.views`) are shown in place
 *  of the live ones, which are parked in liveBackup.views and put back on
 *  leaving it (unparkLiveViews). A view's name and folder, its places and
 *  camera are the live model's. Use inside immer set, with liveBackup set. */
function showMilestoneViews(state: DiagramStore, snap: DiagramSnapshot | undefined): void {
  if (!snap?.views || !state.liveBackup) return
  for (const [id, own] of Object.entries(snap.views)) {
    const live = state.views[id] as DiagramView | undefined
    if (!live) continue
    if (!state.liveBackup.views?.[id]) state.liveBackup.views = { ...state.liveBackup.views, [id]: live } as any
    const shown: DiagramView = { ...own, name: live.name, positions: live.positions }
    for (const key of ['folder', 'viewport', 'treemapFocusId', 'wikiFocusId', 'tableActiveTab'] as const) {
      if (live[key] === undefined) delete shown[key]
      else (shown as unknown as Record<string, unknown>)[key] = live[key]
    }
    state.views[id] = shown as any
  }
}

/** Snapshot all node positions from c4Nodes into a positions map */
function snapshotPositions(nodes: Record<string, C4Node>): Record<string, NodePosition> {
  const result: Record<string, NodePosition> = {}
  for (const [id, n] of Object.entries(nodes)) {
    result[id] = { x: n.x, y: n.y, width: n.width, height: n.height }
  }
  return result
}

/**
 * Places the elements `added` while Smart Layout ran, once its layout is
 * on the canvas (D11): inside its parent beside its siblings, the parent
 * grown with room made (placeUnplaced); at the top level, as near the
 * elements it is related to as there is room. Mutates `state` (inside
 * immer set).
 */
function placeAddedDuringLayout(state: DiagramStore, added: string[]): void {
  const nodes = state.c4Nodes as Record<string, C4Node>
  const relations = state.c4Relations as Record<string, C4Relation>
  const fresh = new Set(added)
  const known = Object.fromEntries(Object.keys(nodes).filter((id) => !fresh.has(id)).map((id) => [id, true]))
  const view = viewById(state, state.activeViewId)
  const shown = view ? computeViewNodeSet(view, nodes, relations) ?? undefined : undefined
  placeUnplaced(nodes, known, shown)
  const rootOf = (id: string): C4Node => {
    let n = nodes[id]
    while (n.parentId && nodes[n.parentId]) n = nodes[n.parentId]
    return n
  }
  const parents = new Set(Object.values(nodes).filter((n) => n.parentId).map((n) => n.parentId!))
  const box = (n: C4Node) => ({ x: n.x, y: n.y, ...drawnSize(n, parents.has(n.id)) })
  for (const id of added) {
    const node = nodes[id]
    if (!node || node.parentId || (shown && !shown.has(id))) continue
    const ends = Object.values(relations)
      .map((r) => (r.sourceId === id ? r.targetId : r.targetId === id ? r.sourceId : null))
      .filter((other): other is string => !!other && !!nodes[other] && !fresh.has(other) && (!shown || shown.has(other)))
      .map((other) => box(rootOf(other)))
    if (!ends.length) continue
    const centre = {
      x: ends.reduce((sum, b) => sum + b.x + b.width / 2, 0) / ends.length,
      y: ends.reduce((sum, b) => sum + b.y + b.height / 2, 0) / ends.length,
    }
    const taken = Object.values(nodes).filter((n) => !n.parentId && n.id !== id && (!shown || shown.has(n.id))).map(box)
    const at = freeSpotNear(taken, drawnSize(node, parents.has(id)), centre)
    node.x = at.x
    node.y = at.y
  }
}

/**
 * The canvas shown after a move of `ids` out of `oldParentIds` into another
 * parent (model.reparentNodes saw to the other canvases): the old parents
 * fit what they still hold; a moved node keeps its place only where it lies
 * inside its new parent, clear of its new siblings, else it goes beside
 * them; the new parent fits it and, where it grew, its siblings make room,
 * level by level up the tree. One moved under a folded container is
 * measured as its expand opens it. Returns the nodes, settled (a copy).
 */
function settleMoveOnShownCanvas(
  state: Pick<DiagramStore, 'activeViewId' | 'views' | 'exploration' | 'c4Nodes' | 'c4Relations'>,
  ids: readonly string[],
  oldParentIds: readonly string[],
): Record<string, C4Node> {
  const { viewFilter, viewCollapsedSet, expandedSet } = activeCanvasSets(state)
  const shownNodes: Record<string, C4Node> = Object.fromEntries(Object.entries(state.c4Nodes).map(([id, n]) => [id, { ...n }]))
  // Fit as fitParentToChildren does, on the copy.
  const fit = (parentId: string): void => {
    const parent = shownNodes[parentId]
    if (!parent || !isContainerType(parent.type) || isEffectivelyCollapsed(parent, viewCollapsedSet, expandedSet)) return
    const children = Object.values(shownNodes).filter((c) => c.parentId === parentId && (!viewFilter || viewFilter.has(c.id)))
    if (!children.length) return
    Object.assign(parent, fittedParentSize(parent, children.map((c) => ({
      x: c.x, y: c.y, width: effectiveNodeWidth(c, viewCollapsedSet, expandedSet), height: effectiveNodeHeight(c, viewCollapsedSet, expandedSet),
    }))))
  }
  const canvas = canvasBoxes(shownNodes, viewFilter, viewCollapsedSet, expandedSet)
  // A new parent the canvas drew with nothing in it was drawn at its folded
  // size, whatever size it keeps: it grows from that, and makes room for
  // what it grows by. Measured at the size it kept, it shrank to what was
  // moved into it, made no room, and lay over its neighbours (System 0
  // moved into System 1 on a System context view, over Operator).
  const moved = new Set(ids.flatMap((id) => [id, ...getDescendants(id, shownNodes)]))
  for (const parentId of new Set(ids.map((id) => shownNodes[id]?.parentId))) {
    const parent = parentId ? shownNodes[parentId] : undefined
    if (!parent || !isContainerType(parent.type) || isFixedSizeType(parent.type) || isEffectivelyCollapsed(parent, viewCollapsedSet, expandedSet)) continue
    if (Object.values(shownNodes).some((c) => c.parentId === parent.id && !moved.has(c.id) && canvas.shown(c))) continue
    parent.width = COLLAPSED_WIDTH[parent.type]
    parent.height = COLLAPSED_HEIGHT[parent.type]
  }
  // A refit can grow the old parent too (to its type's least size).
  for (const oldParentId of oldParentIds) if (shownNodes[oldParentId]) growWithRoom(shownNodes, oldParentId, canvas, fit)
  // Measured with the folds above it open.
  const foldsAbove = new Set(ids.flatMap((id) => {
    const out: string[] = []
    for (let p = shownNodes[id]?.parentId; p && shownNodes[p] && !out.includes(p); p = shownNodes[p].parentId) out.push(p)
    return out
  }))
  const opened = canvasBoxes(shownNodes, viewFilter,
    viewCollapsedSet && new Set([...viewCollapsedSet].filter((id) => !foldsAbove.has(id))),
    new Set([...(expandedSet ?? []), ...foldsAbove]))
  settleMovedNodes(shownNodes, ids, canvas, fit, opened)
  return shownNodes
}

/** Writes the places and sizes of `nodes` that differ onto the model.
 *  Mutates `state` (inside immer set). */
function writeGeometry(state: DiagramStore, nodes: Record<string, C4Node>): void {
  for (const [id, n] of Object.entries(nodes)) {
    const live = state.c4Nodes[id]
    if (!live || (live.x === n.x && live.y === n.y && live.width === n.width && live.height === n.height)) continue
    live.x = n.x
    live.y = n.y
    live.width = n.width
    live.height = n.height
  }
}

/** Apply a positions map onto c4Nodes (mutates in-place, use inside immer set) */
function applyPositions(nodes: Record<string, C4Node>, positions: Record<string, NodePosition>): void {
  for (const [id, pos] of Object.entries(positions)) {
    const n = nodes[id]
    if (n) { n.x = pos.x; n.y = pos.y; n.width = pos.width; n.height = pos.height }
  }
}

/**
 * Puts the positions a canvas keeps (`positions`: a view's, or All
 * elements') onto the nodes, and gives the nodes it has none for a place of
 * their own there (placeUnplaced): an element added on another canvas kept
 * that one's place, outside its parent's frame here or on a sibling.
 * In a milestone (`live`: the live nodes), what the milestone cannot draw at
 * the view's places gets one of its own too (ownPlacesInMilestone).
 * Mutates the nodes (use inside immer set); returns the ids it placed, for
 * the live layout to settle with their surroundings.
 */
function showCanvasPositions(
  nodes: Record<string, C4Node>,
  positions: Record<string, NodePosition>,
  view: DiagramView | undefined,
  relations: Record<string, C4Relation>,
  live?: Record<string, C4Node>,
): string[] {
  // Only the view's own places are the live layout's (All elements', which
  // a view never laid out opens on, are the milestone's own).
  const own = view && live && positions === view.positions ? ownPlacesInMilestone(positions, view, nodes, live) : []
  if (own.length) {
    positions = { ...positions }
    for (const id of own) delete positions[id]
  }
  applyPositions(nodes, positions)
  // An exploration is flat: its places are where it draws its elements,
  // and it gives every element one when it grows. One it lists with no
  // place (listed outside Studio, merged in) is laid out again as a whole,
  // its start where it is.
  if (isExploration(view)) {
    const listed = listedIds(view, nodes)
    if (listed.some((id) => !positions[id])) {
      const start = positions[view.explore.start] ?? positions[listed.find((id) => positions[id]) ?? '']
      applyPositions(nodes, layExploration(view, nodes, relations, start ? { x: start.x, y: start.y } : undefined))
    }
    return []
  }
  // Only a canvas draws positions: a table, wiki, matrix, hierarchy or flow
  // view keeps what it was given.
  if (view && view.kind && view.kind !== 'static') return []
  const shown = view ? computeViewNodeSet(view, nodes, relations) ?? undefined : undefined
  // Folded as the view draws it: its own folds over the model's, and a
  // container none of whose children it shows.
  const childless = computeViewCollapsedSet(shown, nodes)
  const folded = view ? (n: C4Node): boolean => nodeEffectivelyCollapsedInView(n, view.id, view) || childless.has(n.id) : undefined
  const placed = placeUnplaced(nodes, positions, shown, folded)
  // One whose parent got a place of its own too moved with it, at a place
  // that was not its own in it: it is placed in it now.
  const left = own.filter((id) => nodes[id] && !placed.includes(id))
  if (!left.length) return placed
  const known = Object.fromEntries(Object.keys(nodes).filter((id) => !left.includes(id)).map((id) => [id, true]))
  return [...placed, ...placeUnplaced(nodes, known, shown, folded)]
}

/**
 * What a milestone shown (`nodes`) cannot draw at a view's places. A view keeps
 * one layout for every milestone, the live model's (`live`); an element with
 * another parent in the milestone than on live has its place there relative
 * to the live parent, and one folded on live but open in the milestone has
 * the room of its fold: drawn there, it lay on its siblings (Component 1.1.1
 * moved into Container 2.0 since, drawn on 1.1.2 in Early). Such an element
 * has no place in the view for the milestone, and gets one of its own there
 * as an add does (placeUnplaced: beside its siblings, its parent grown with
 * room made), which nothing saves into the view. Returns their ids.
 */
function ownPlacesInMilestone(
  positions: Record<string, NodePosition>,
  view: DiagramView,
  nodes: Record<string, C4Node>,
  live: Record<string, C4Node>,
): string[] {
  const differs = (id: string): boolean => {
    const n = nodes[id]
    const was = live[id]
    if (!n || !was) return false
    if ((n.parentId ?? null) !== (was.parentId ?? null)) return true
    return isContainerType(n.type) && !nodeEffectivelyCollapsedInView(n, view.id, view) && nodeEffectivelyCollapsedInView(was, view.id, view)
  }
  return Object.keys(positions).filter(differs)
}

/** The live nodes while a milestone is shown, for showCanvasPositions. */
const liveWhileInMilestone = (state: Pick<DiagramStore, 'activeSnapshotId' | 'liveBackup'>): Record<string, C4Node> | undefined =>
  state.activeSnapshotId && state.liveBackup ? state.liveBackup.nodes as Record<string, C4Node> : undefined

/**
 * The places the other canvases give `ids` (just added, or moved into
 * another parent, on the canvas shown) where they draw them and have none
 * for them: All elements while a view is shown, and every view laid out
 * before (one with positions). Each gets them as showing it would
 * (showCanvasPositions): inside the parent, beside its siblings, the parent
 * grown there with room made. Left to the canvas's next opening, the place
 * was made then and the live layout settled it with its surroundings:
 * opening a view moved elements no one had touched, and a parent grown
 * there lay over its neighbour. Not in a milestone, whose canvases are not
 * the live ones. Returns the positions to write, per canvas ('' for All
 * elements).
 */
function placesOnOtherCanvases(
  state: Pick<DiagramStore, 'c4Nodes' | 'c4Relations' | 'views' | 'activeViewId' | 'activeSnapshotId' | 'defaultPositions' | 'defaultLayoutConstraints'>,
  ids: readonly string[],
  added: boolean,
): Map<string, Record<string, NodePosition>> {
  const out = new Map<string, Record<string, NodePosition>>()
  const nodes = state.c4Nodes as Record<string, C4Node>
  const relations = state.c4Relations as Record<string, C4Relation>
  const touched = ids.filter((id) => nodes[id])
  if (state.activeSnapshotId || !touched.length) return out
  const place = (key: string, positions: Record<string, NodePosition>, view: DiagramView | undefined): void => {
    if (!Object.keys(positions).length || touched.every((id) => id in positions)) return
    const shown = view ? computeViewNodeSet(view, nodes, relations) ?? undefined : undefined
    if (!touched.some((id) => !(id in positions) && (!shown || shown.has(id)))) return
    const copy: Record<string, C4Node> = Object.fromEntries(Object.entries(nodes).map(([id, n]) => [id, { ...n }]))
    // An element added into a parent the canvas has a place for keeps its
    // place in it where that lies inside its frame there, clear of its
    // siblings, as a move does (a child added into a container added just
    // before stays where it was put in it).
    let known = positions
    if (added) {
      applyPositions(copy, positions)
      const canvas = modelCanvas(copy, shown)
      for (const id of touched) {
        const n = copy[id]
        if (id in positions || !n.parentId || !(n.parentId in positions) || !canvas.shown(n) || !liesClearInParent(n, copy, canvas)) continue
        if (known === positions) known = { ...positions }
        known[id] = { x: n.x, y: n.y, width: n.width, height: n.height }
      }
    }
    if (!showCanvasPositions(copy, known, view, relations).length && known === positions) return
    // A row or column of that canvas holds there, as opening it (or a
    // reload) holds it (_enforceLayoutConstraints): the room made for the
    // place could put one of its members off the line, and a reload then
    // snapped it and refit every container.
    const constraints = (view ? view.layoutConstraints : state.defaultLayoutConstraints) ?? []
    if (constraints.length) applyAlignments(copy, viewLayoutInput(view, copy, relations, constraints))
    const next: Record<string, NodePosition> = {}
    for (const n of Object.values(copy)) {
      if (!(n.id in positions) && shown && !shown.has(n.id)) continue
      const was = positions[n.id]
      if (was && was.x === n.x && was.y === n.y && was.width === n.width && was.height === n.height) continue
      next[n.id] = { x: n.x, y: n.y, width: n.width, height: n.height }
    }
    if (Object.keys(next).length) out.set(key, next)
  }
  if (state.activeViewId !== null) place('', state.defaultPositions ?? {}, undefined)
  for (const view of Object.values(state.views) as DiagramView[]) {
    if (view.id === state.activeViewId || view.id === _firstLayoutOf || (view.kind ?? 'static') !== 'static') continue
    place(view.id, view.positions ?? {}, view)
  }
  return out
}

/** Writes what placesOnOtherCanvases gave. Mutates `state` (inside immer set). */
function writeOtherCanvases(state: DiagramStore, places: Map<string, Record<string, NodePosition>>): void {
  for (const [key, next] of places) {
    const positions = key === '' ? state.defaultPositions : state.views[key]?.positions
    if (positions) Object.assign(positions, next)
  }
}

/** The positions a canvas view opens with when it has none of its own (a
 *  new view, a table turned into a structure view): All elements' (the
 *  milestone's own, in a milestone), one layout in which every child lies
 *  in its parent. Not the canvas shown before it: that one's places, and
 *  the places other canvases left on the nodes it does not draw, put the
 *  view's elements over each other and outside their containers. Undefined
 *  for a view that has positions, or is not a canvas. */
function firstCanvasPositions(
  view: DiagramView | undefined,
  defaultPositions: Record<string, NodePosition>,
  milestoneAllPositions: Record<string, NodePosition> | null,
): Record<string, NodePosition> | undefined {
  // An exploration with none is laid out level by level (showCanvasPositions).
  if (isExploration(view) && !Object.keys(view.positions ?? {}).length) return {}
  if (!view || (view.kind ?? 'static') !== 'static' || Object.keys(view.positions ?? {}).length > 0) return undefined
  return milestoneAllPositions ?? defaultPositions
}

/** The page a slide of a wiki view shows: the element whose page it is
 *  (null: the Overview) and the page mode. */
export interface SlideWikiPage { viewId: string; focusId: string | null; pageMode: 'single' | 'multi' }

/** The page wiki view `view` shows: a slide's while one is shown, else the
 *  view's own. */
function shownWikiPage(state: { slideWikiPage: SlideWikiPage | null }, view: DiagramView): SlideWikiPage {
  const slide = state.slideWikiPage
  if (slide && slide.viewId === view.id) return slide
  return { viewId: view.id, focusId: view.wikiFocusId ?? null, pageMode: view.wikiPageMode ?? 'single' }
}

/** What a slide shows of its wiki view, when it keeps a page (a slide added
 *  on one): shown over the view's own page, which it leaves as it is. */
function slideWikiPageOf(slide: PresentationSlide, viewId: string | null): SlideWikiPage | null {
  if (!viewId || slide.wikiFocusId === undefined) return null
  return { viewId, focusId: slide.wikiFocusId ?? null, pageMode: slide.wikiPageMode ?? 'single' }
}

/**
 * Puts the layout of view `viewId` onto the nodes of a slide with no
 * captured canvas, as setActiveView loads it: its own positions, or, never
 * laid out, All elements' (the slide's own model's, for a slide of a
 * milestone), with the elements it has no place for placed in their parent.
 * Applied only when it had some, a view never laid out was drawn at the
 * places the slide before left, its elements over each other and outside
 * their containers. Mutates `state` (inside immer set); returns the ids
 * placed, for the live layout.
 */
function showSlideView(
  state: DiagramStore,
  viewId: string,
  shown: { nodes: Record<string, C4Node> } | undefined,
): string[] {
  const view = state.views[viewId] as DiagramView | undefined
  if (!view) return []
  const positions = firstCanvasPositions(view, state.defaultPositions as Record<string, NodePosition>, shown ? snapshotPositions(shown.nodes) : null)
    ?? view.positions as Record<string, NodePosition>
  if (!Object.keys(positions ?? {}).length) return []
  return showCanvasPositions(state.c4Nodes as Record<string, C4Node>, positions, view, state.c4Relations as Record<string, C4Relation>, liveWhileInMilestone(state as DiagramStore))
}

/**
 * The nodes of a saved document as All elements has them. A document is
 * saved with its nodes where the canvas shown at that moment had them (a
 * view's positions, when a view was open) and All elements' own places in
 * `defaultPositions`. It always opens on All elements, so that is what the
 * nodes must hold: opened with a view's positions in them, the first switch
 * to a view (the one in the address, on every reload) stored those as All
 * elements' and the view's layout replaced it for good.
 */
function atDefaultPositions(nodes: readonly C4Node[], positions: Record<string, NodePosition> | undefined): Record<string, C4Node> {
  const out: Record<string, C4Node> = {}
  for (const n of nodes) {
    const p = positions?.[n.id]
    out[n.id] = p && (p.x !== n.x || p.y !== n.y || p.width !== n.width || p.height !== n.height)
      ? { ...n, x: p.x, y: p.y, width: p.width, height: p.height }
      : n
  }
  return out
}

/** The model a slide shows: its linked milestone when it has one (linked by
 *  hand, so it wins), else the copy captured when the slide was added. A slide
 *  with neither shows the live model: `live` while a milestone is shown over
 *  it (it showed that milestone), else undefined, the model shown. */
function slideModel(
  slide: PresentationSlide,
  snapshots: DiagramSnapshot[],
  live?: { nodes: Record<string, C4Node>; relations: Record<string, C4Relation> },
): { nodes: Record<string, C4Node>; relations: Record<string, C4Relation> } | undefined {
  const milestone = slide.snapshotId ? snapshots.find((s) => s.id === slide.snapshotId) : undefined
  if (milestone) return { nodes: milestone.nodes as Record<string, C4Node>, relations: milestone.relations as Record<string, C4Relation> }
  return slide.modelSnapshot ?? live
}

/** The live model while a milestone is shown over it (Designer's, or one
 *  picked in Presenter). */
function liveUnderMilestone(state: Pick<DiagramStore, 'activeSnapshotId' | 'liveBackup'>): { nodes: Record<string, C4Node>; relations: Record<string, C4Relation> } | undefined {
  return state.activeSnapshotId && state.liveBackup
    ? { nodes: state.liveBackup.nodes as Record<string, C4Node>, relations: state.liveBackup.relations as Record<string, C4Relation> }
    : undefined
}

/** What the slides that showed a milestone deleted since had captured on
 *  it (slide id → the slide as it was): Undo of the delete gives it back. */
const _slidesOfDeletedMilestones = new Map<string, PresentationSlide>()

/** A slide whose milestone is gone (inside immer set): it shows the live
 *  model, with nothing it captured on the milestone. Its copy of the model
 *  kept, it went on drawing the milestone. */
function unlinkSlide(slide: PresentationSlide): void {
  const was = current(slide)
  _slidesOfDeletedMilestones.set(slide.id, was)
  const bare = slideWithoutMilestone(was)
  for (const key of Object.keys(slide) as (keyof PresentationSlide)[]) if (!(key in bare)) delete slide[key]
  Object.assign(slide, bare)
}

/** A slide whose milestone `id` is back (Undo of its delete, inside immer
 *  set): what it had captured on it, with the name it has now. */
function relinkSlide(slide: PresentationSlide, id: string): void {
  const was = _slidesOfDeletedMilestones.get(slide.id)
  if (was?.snapshotId === id) Object.assign(slide, { ...was, name: slide.name })
  else slide.snapshotId = id
}

/** Capture node positions + collapsed state for a presentation slide,
 *  and, on a view, what the view folds and opens: kept in the view, a fold
 *  made or undone after the slide changed what the slide showed. On a
 *  canvas view only what it draws (and the frames that hold it): a node it
 *  did not draw kept the place another canvas left on it, and once the
 *  view gained it the slide drew it there, on its other elements
 *  (placeGainedSince places it). */
function captureCanvasState(nodes: Record<string, C4Node>, view?: DiagramView, relations?: Record<string, C4Relation>): SlideCanvasState {
  const drawn = view && relations && (isExploration(view) || (view.kind ?? 'static') === 'static')
    ? computeViewNodeSet(view, nodes, relations)
    : undefined
  const result: SlideCanvasState['nodes'] = {}
  for (const [id, n] of Object.entries(nodes)) {
    if (drawn && !drawn.has(id)) continue
    result[id] = { x: n.x, y: n.y, width: n.width, height: n.height, collapsed: n.collapsed }
  }
  if (!view) return { nodes: result }
  return { nodes: result, collapsedNodeIds: [...(view.collapsedNodeIds ?? [])], expandedNodeIds: [...(view.expandedNodeIds ?? [])] }
}

/** Puts a slide's captured canvas onto what is shown (inside immer set):
 *  each node's place, size and fold, and its view's folds when it kept them.
 *  Played from Designer the views are put back when it stops; in Presenter
 *  Designer's are parked. */
function applySlideCanvas(state: DiagramStore, canvasState: SlideCanvasState, viewId: string | null): void {
  for (const [id, ns] of Object.entries(canvasState.nodes)) {
    const n = state.c4Nodes[id]
    if (!n) continue
    n.x = ns.x; n.y = ns.y
    n.width = ns.width; n.height = ns.height
    n.collapsed = ns.collapsed
  }
  const view = viewId ? state.views[viewId] as DiagramView | undefined : undefined
  if (!view) return
  if (canvasState.collapsedNodeIds) {
    const same = (a: string[] | undefined, b: string[] | undefined): boolean => JSON.stringify(a ?? []) === JSON.stringify(b ?? [])
    if (!same(view.collapsedNodeIds, canvasState.collapsedNodeIds)) view.collapsedNodeIds = [...canvasState.collapsedNodeIds]
    if (!same(view.expandedNodeIds, canvasState.expandedNodeIds)) view.expandedNodeIds = [...(canvasState.expandedNodeIds ?? [])]
  }
  placeGainedSince(state, canvasState, view)
}

/** What canvas view `view` draws now that its slide did not capture (it
 *  gained it since): where the view places it, or, where that lies on what
 *  the slide shows, beside it. It kept the place another canvas had left
 *  on it, and the slide drew it on the elements it captured (Card Networks
 *  on Auth Service). A slide captured before slides kept only what they
 *  drew has none such. Mutates `state` (inside immer set). */
function placeGainedSince(state: DiagramStore, canvasState: SlideCanvasState, view: DiagramView): void {
  const nodes = state.c4Nodes as Record<string, C4Node>
  const relations = state.c4Relations as Record<string, C4Relation>
  const places = (view.positions ?? {}) as Record<string, NodePosition>
  // An exploration is flat: its places are where it draws its elements.
  if (isExploration(view)) {
    const listed = listedIds(view, nodes)
    const gained = listed.filter((id) => !canvasState.nodes[id])
    if (!gained.length) return
    const box = (id: string) => ({ x: nodes[id].x, y: nodes[id].y, ...drawnSize(nodes[id], false) })
    const taken = listed.filter((id) => canvasState.nodes[id]).map(box)
    for (const id of gained) {
      const at = places[id]
      if (at) { nodes[id].x = at.x; nodes[id].y = at.y }
      const b = box(id)
      const clear = taken.every((o) => b.x + b.width <= o.x || o.x + o.width <= b.x || b.y + b.height <= o.y || o.y + o.height <= b.y)
      if (!clear) Object.assign(nodes[id], freeSpotNear(taken, b, { x: b.x + b.width / 2, y: b.y + b.height / 2 }))
      taken.push(box(id))
    }
    return
  }
  if ((view.kind ?? 'static') !== 'static') return
  const shown = computeViewNodeSet(view, nodes, relations)
  if (!shown) return
  const gained = new Set([...shown].filter((id) => nodes[id] && !canvasState.nodes[id]))
  if (!gained.size) return
  // The view's place where it lies clear of what the slide shows; the
  // others placed beside their siblings (placeUnplaced), as a view places
  // what it has no place for.
  const known: Record<string, NodePosition> = {}
  for (const [id, ns] of Object.entries(canvasState.nodes)) if (nodes[id]) known[id] = { x: ns.x, y: ns.y, width: ns.width, height: ns.height }
  applyPositions(nodes, Object.fromEntries([...gained].filter((id) => places[id]).map((id) => [id, places[id]])))
  const canvas = modelCanvas(nodes, shown)
  for (const id of gained) {
    if (places[id] && liesClearInParent(nodes[id], nodes, canvas, (s) => gained.has(s.id))) known[id] = places[id]
  }
  showCanvasPositions(nodes, known, view, relations)
}

/** The drill level a hierarchy view shows: a slide's while one is shown,
 *  else the view's own. */
function shownTreemapFocus(state: { slideTreemapFocus: { viewId: string; focusId: string | null } | null }, view: DiagramView): string | null {
  const slide = state.slideTreemapFocus
  if (slide && slide.viewId === view.id) return slide.focusId
  return view.treemapFocusId ?? null
}

/** What a slide keeps of view `viewId` besides the canvas: the drill level
 *  of a hierarchy view, the page of a wiki view. */
function slideViewFields(state: DiagramStore, viewId: string | null): Pick<PresentationSlide, 'treemapFocusId' | 'wikiFocusId' | 'wikiPageMode'> {
  const view = viewId ? state.views[viewId] as DiagramView | undefined : undefined
  // A hierarchy view's camera is the element it is drilled into.
  if (view?.kind === 'treemap') return { treemapFocusId: shownTreemapFocus(state, view) }
  // A wiki view's is the page it is on, and how that page is written.
  if (view?.kind === 'wiki') {
    const page = shownWikiPage(state, view)
    return { wikiFocusId: page.focusId, wikiPageMode: page.pageMode }
  }
  return {}
}

/** The drill level a slide of a hierarchy view shows: the one it was added
 *  on, or the top (one made over MCP, or before slides kept it) rather than
 *  wherever the view was left. */
function slideTreemapFocusOf(slide: PresentationSlide, viewId: string | null, views: Record<string, DiagramView>): { viewId: string; focusId: string | null } | null {
  if (!viewId) return null
  if (slide.treemapFocusId !== undefined) return { viewId, focusId: slide.treemapFocusId ?? null }
  return views[viewId]?.kind === 'treemap' ? { viewId, focusId: null } : null
}

/** The view a slide shows: its own, or All elements once that view was
 *  deleted (the whole model was drawn under the deleted view's address). */
function slideViewIdOf(slide: PresentationSlide, views: Record<string, DiagramView>): string | null {
  const id = slide.viewId ?? null
  return id && views[id] ? id : null
}

/** Build the initial presentations array from possibly-legacy persisted data. */
function buildPresentationsFromData(
  presentations: Presentation[] | undefined,
  legacySlides: PresentationSlide[] | undefined,
): { presentations: Presentation[]; activeId: string } {
  let list: Presentation[] = presentations ? [...presentations] : []
  if (list.length === 0) {
    // Migrate legacy single-presentation slides into a default presentation
    list = [{ id: crypto.randomUUID(), name: 'Main', slides: legacySlides ?? [] }]
  }
  return { presentations: list, activeId: list[0].id }
}

/** What changed per element and relation id, for the diff highlight. The
 *  same comparison as compare_milestones (model.compareModels): any field but
 *  the layout. */
export function computeSnapDiff(
  prevNodes: Record<string, C4Node>,
  currNodes: Record<string, C4Node>,
  prevRels: Record<string, C4Relation>,
  currRels: Record<string, C4Relation>,
): Record<string, 'new' | 'changed' | 'removed'> {
  const result: Record<string, 'new' | 'changed' | 'removed'> = {}
  const changes = model.compareModels({ nodes: prevNodes, relations: prevRels }, { nodes: currNodes, relations: currRels })
  for (const group of [changes.nodes, changes.relations]) {
    for (const id of group.added) result[id] = 'new'
    for (const { id } of group.changed) result[id] = 'changed'
    for (const id of group.removed) result[id] = 'removed'
  }
  return result
}

/**
 * Compute sequence-level diff: which relation IDs were added to or removed
 * from sequences between two snapshots. Only covers membership changes —
 * structural node/relation changes are handled by computeSnapDiff.
 * Structural diff entries always win; this fills the gaps.
 */
function computeSeqDiff(
  prevSeqs: Record<string, DiagramSequence> | undefined,
  currSeqs: Record<string, DiagramSequence> | undefined,
): Record<string, 'new' | 'changed' | 'removed'> {
  const result: Record<string, 'new' | 'changed' | 'removed'> = {}
  const prev = prevSeqs ?? {}
  const curr = currSeqs ?? {}
  const allSeqIds = new Set([...Object.keys(prev), ...Object.keys(curr)])
  for (const seqId of allSeqIds) {
    const prevSeq = prev[seqId]
    const currSeq = curr[seqId]
    const prevIds = new Set(prevSeq?.relationIds ?? [])
    const currIds = new Set(currSeq?.relationIds ?? [])
    for (const rid of currIds) if (!prevIds.has(rid)) result[rid] = 'new'
    for (const rid of prevIds) if (!currIds.has(rid) && !result[rid]) result[rid] = 'removed'
    // Check step-description changes for relations present in both sequences at the same position.
    if (prevSeq && currSeq) {
      const len = Math.min(prevSeq.relationIds.length, currSeq.relationIds.length)
      for (let i = 0; i < len; i++) {
        const rid = currSeq.relationIds[i]
        if (rid !== prevSeq.relationIds[i]) continue  // position shifted – skip
        if (result[rid]) continue                     // already 'new' or 'removed'
        const prevDesc = prevSeq.stepDescriptions?.[i] ?? ''
        const currDesc = currSeq.stepDescriptions?.[i] ?? ''
        if (prevDesc !== currDesc || isBackwardStep(prevSeq, i) !== isBackwardStep(currSeq, i)) result[rid] = 'changed'
      }
    }
  }
  return result
}

/**
 * What changed in a sequence's steps from `prev` to `curr`, step by step: a
 * relation can be two steps of one flow, so a set of relation ids (as
 * computeSeqDiff keeps for the canvas) missed a second step removed or
 * added, and a note changed on one coloured the other. The steps are
 * paired in order (longest common subsequence of relation ids): `steps[i]`
 * is 'new' for a step of `curr` with no pair, 'changed' for one whose note
 * changed or that runs the other way; `removed` lists the steps of `prev`
 * with no pair (their index).
 */
export function computeStepDiff(
  prev: Pick<DiagramSequence, 'relationIds' | 'stepDescriptions' | 'stepBackward'> | undefined,
  curr: Pick<DiagramSequence, 'relationIds' | 'stepDescriptions' | 'stepBackward'>,
): { steps: Array<'new' | 'changed' | undefined>; removed: number[] } {
  const a = prev?.relationIds ?? []
  const b = curr.relationIds
  // lcs[i][j]: the longest common run of a[i..] and b[j..].
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const steps: Array<'new' | 'changed' | undefined> = new Array(b.length).fill('new')
  const removed: number[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      steps[j] = (prev?.stepDescriptions?.[i] ?? '') !== (curr.stepDescriptions?.[j] ?? '') || isBackwardStep(prev, i) !== isBackwardStep(curr, j) ? 'changed' : undefined
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      removed.push(i++)
    } else {
      j++
    }
  }
  while (i < a.length) removed.push(i++)
  return { steps, removed }
}

/**
 * Build the ghost maps for a diff: nodes/relations that existed in the base
 * but are not present in the current state. Returned as plain dictionaries
 * so they can be merged into the canvas at render time without polluting
 * the actual model.
 */
export function computeDiffGhosts(
  baseNodes: Record<string, C4Node>,
  currNodes: Record<string, C4Node>,
  baseRels: Record<string, C4Relation>,
  currRels: Record<string, C4Relation>,
): { nodes: Record<string, C4Node>; relations: Record<string, C4Relation> } {
  const nodes: Record<string, C4Node> = {}
  const relations: Record<string, C4Relation> = {}
  for (const id of Object.keys(baseNodes)) {
    if (!currNodes[id]) nodes[id] = JSON.parse(JSON.stringify(baseNodes[id]))
  }
  for (const id of Object.keys(baseRels)) {
    if (!currRels[id]) relations[id] = JSON.parse(JSON.stringify(baseRels[id]))
  }
  return { nodes, relations }
}

/**
 * Compute whether a node is effectively collapsed in a given named view.
 * Used by tree-panel components (Sidebar, RightPanel) to show ▶/▼ correctly
 * without duplicating the logic in each component.
 *
 * @param node          The C4Node to check.
 * @param activeViewId  The currently active view ID (or null/undefined for the default view).
 * @param view          The DiagramView object (pass `undefined` when no view is active).
 */
export function nodeEffectivelyCollapsedInView(
  node: C4Node,
  activeViewId: string | null | undefined,
  view: DiagramView | undefined,
): boolean {
  if (!activeViewId) return node.collapsed
  return (
    (node.collapsed && !(view?.expandedNodeIds?.includes(node.id) ?? false)) ||
    (view?.collapsedNodeIds?.includes(node.id) ?? false)
  )
}

const NO_CONSTRAINTS: LayoutConstraint[] = []

/** The layout constraints of the active canvas: the view's own, or All
 *  elements' when no view is active. */
export function activeLayoutConstraints(
  state: Pick<DiagramStore, 'activeViewId' | 'views' | 'exploration' | 'defaultLayoutConstraints'>,
): LayoutConstraint[] {
  return (state.activeViewId ? viewById(state, state.activeViewId)?.layoutConstraints : state.defaultLayoutConstraints) ?? NO_CONSTRAINTS
}

/** Direct children of `parentId` in the active view, with their boxes in
 *  the parent's frame. `drawn` is false while the parent is collapsed: the
 *  boxes are then where the children were last drawn. */
export function childrenInView(
  state: Pick<DiagramStore, 'rfNodes'>, parentId: string,
): { drawn: boolean; boxes: Array<{ id: string; x: number; y: number; width: number; height: number }> } {
  const children = state.rfNodes.filter((n) => n.parentNode === parentId)
  return {
    drawn: children.some((n) => !n.hidden),
    boxes: children.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, width: n.data.width, height: n.data.height })),
  }
}

/** The layout input for the store's active view. */
function layoutInputForView(state: DiagramStore): LayoutInput {
  // The exploration draws its elements flat, and only the lines it draws.
  const x = shownExploration(state)
  if (x) {
    const lines = new Set(explorationLines(x, state.c4Nodes, state.c4Relations).relations)
    const relations = Object.fromEntries(Object.entries(state.c4Relations).filter(([id]) => lines.has(id)))
    return viewLayoutInput(x, flatNodes(x, state.c4Nodes), relations, NO_CONSTRAINTS)
  }
  return viewLayoutInput(viewById(state, state.activeViewId), state.c4Nodes, state.c4Relations, activeLayoutConstraints(state))
}

// ─── Explore from here ──────────────────────────────────────────────────────
//
// An exploration is a view of type Explore grown from one element. The one
// Explore from here opens is temporary: drawn like any view while it is
// shown and kept in the store's `exploration`, never in `views`, so what
// saves, undoes, merges, puts in a milestone or lists the document's views
// never sees it. Code that draws the canvas shown reads it through
// viewById. Saved as a view it is one of the document's `views`, of type
// Explore, drawn the same way (shownExploration): in Designer what is done
// to it is an undo step like any view edit, in Viewer it is put back as it
// was saved when it or Viewer is left (_viewerExplorations).

/** The view `id` names: one of the document's, or the exploration. */
export function viewById(s: Pick<DiagramStore, 'views' | 'exploration'>, id: string | null | undefined): DiagramView | undefined {
  if (!id) return undefined
  return s.views[id] ?? (s.exploration?.id === id ? s.exploration : undefined)
}

/** Whether `id` names an exploration (open or closed since): the route of
 *  one closed is a place that is gone. */
export { isExplorationId } from './exploration'

/** The canvas shown is the temporary exploration (Explore from here). */
export function onExploration(s: Pick<DiagramStore, 'activeViewId' | 'exploration'>): boolean {
  return !!s.activeViewId && s.exploration?.id === s.activeViewId
}

/** The exploration the canvas shows: the temporary one, or a view of type
 *  Explore; null for any other canvas. */
export function shownExploration(s: Pick<DiagramStore, 'activeViewId' | 'exploration' | 'views'>): Exploration | null {
  const id = s.activeViewId
  if (!id) return null
  if (s.exploration?.id === id) return s.exploration
  const view = s.views[id]
  return isExploration(view) ? view : null
}

/** Views of type Explore changed in Viewer (a +, a −), as they were saved:
 *  put back when the view or Viewer is left. Viewer saves nothing. */
const _viewerExplorations = new Map<string, DiagramView>()

/** Puts back the views of type Explore Viewer changed (`only`: that one),
 *  as they were saved. Mutates `state` (inside immer set). */
function restoreViewerExplorations(state: DiagramStore, only?: string): void {
  for (const [id, view] of [..._viewerExplorations]) {
    if (only !== undefined && id !== only) continue
    _viewerExplorations.delete(id)
    if (state.views[id]) state.views[id] = view as any
  }
}

/** The canvas shown when the exploration was opened: closing it goes back
 *  there. */
let _exploredFrom: string | null = null

/** The exploration as it is now, its places included (on the nodes while
 *  it is shown): for its undo steps. */
function explorationNow(s: Pick<DiagramStore, 'activeViewId' | 'exploration' | 'views' | 'c4Nodes'>): Exploration | null {
  const x = s.exploration
  if (!x) return null
  if (!onExploration(s)) return x
  const positions: Record<string, NodePosition> = {}
  for (const id of listedIds(x, s.c4Nodes)) {
    const n = s.c4Nodes[id]
    positions[id] = { x: n.x, y: n.y, width: n.width, height: n.height }
  }
  return { ...x, positions }
}

/** Adds the node as model.insertNode does, and lists it on the exploration
 *  when that is the canvas shown: it draws only what it lists, and an
 *  element added there was not drawn. Mutates `state` (inside immer set). */
function insertNodeShown(state: DiagramStore, id: string, node: Omit<C4Node, 'id'>): void {
  model.insertNode(state as unknown as model.ModelState, id, node)
  const x = shownExploration(state)
  if (x) {
    addToViewList(x, [id])
    // Under the rest: no + added it.
    x.explore.levels[id] ??= Math.max(0, ...Object.values(x.explore.levels)) + 1
  }
}

/**
 * Walk up the parent chain. Returns true if the node is hidden because
 * one of its ancestors is collapsed (model or view-collapsed).
 */
export function isNodeHidden(
  nodeId: string,
  nodes: Record<string, C4Node>,
  viewCollapsedSet?: Set<string>,
  expandedSet?: Set<string>
): boolean {
  const node = nodes[nodeId]
  if (!node || !node.parentId) return false
  const parent = nodes[node.parentId]
  if (!parent) return false
  if (isEffectivelyCollapsed(parent, viewCollapsedSet, expandedSet)) return true
  return isNodeHidden(node.parentId, nodes, viewCollapsedSet, expandedSet)
}

/**
 * Returns the id of the deepest visible ancestor for a given node.
 * If the node itself is visible, returns nodeId unchanged.
 */
function getVisibleAncestor(
  nodeId: string,
  nodes: Record<string, C4Node>,
  viewCollapsedSet?: Set<string>,
  expandedSet?: Set<string>
): string {
  if (!isNodeHidden(nodeId, nodes, viewCollapsedSet, expandedSet)) return nodeId
  const node = nodes[nodeId]
  if (!node || !node.parentId) return nodeId
  return getVisibleAncestor(node.parentId, nodes, viewCollapsedSet, expandedSet)
}

/**
 * View-aware version: walks up until the node is both visible (not collapsed)
 * AND present in the view filter. Used by deriveRFEdges to aggregate children
 * edges onto their view-visible parent.
 */
export function getViewVisibleAncestor(
  nodeId: string,
  nodes: Record<string, C4Node>,
  viewFilter: Set<string> | undefined,
  viewCollapsedSet?: Set<string>,
  expandedSet?: Set<string>
): string {
  // Without a view filter, fall back to normal collapse logic
  if (!viewFilter) return getVisibleAncestor(nodeId, nodes, viewCollapsedSet, expandedSet)
  // Walk up until we find a node in the view that isn't hidden
  let cur = nodeId
  while (cur) {
    if (viewFilter.has(cur) && !isNodeHidden(cur, nodes, viewCollapsedSet, expandedSet)) return cur
    const node = nodes[cur]
    if (!node?.parentId) break
    cur = node.parentId
  }
  // Fallback: return whatever getVisibleAncestor gives
  return getVisibleAncestor(nodeId, nodes, viewCollapsedSet, expandedSet)
}

/** True if `ancestorId` is a (transitive) ancestor of `nodeId`. */
function isAncestorOf(ancestorId: string, nodeId: string, nodes: Record<string, C4Node>): boolean {
  let cur = nodes[nodeId]?.parentId
  while (cur) {
    if (cur === ancestorId) return true
    cur = nodes[cur]?.parentId
  }
  return false
}

/** Return all descendant node ids (children, grandchildren, …) */
function getDescendants(nodeId: string, nodes: Record<string, C4Node>): string[] {  const result: string[] = []
  function walk(id: string) {
    for (const n of Object.values(nodes)) {
      if (n.parentId === id) {
        result.push(n.id)
        walk(n.id)
      }
    }
  }
  walk(nodeId)
  return result
}

/** Effective rendered height of a node (respects collapse + view collapse). */
function effectiveNodeHeight(n: C4Node, viewCollapsedSet?: Set<string>, expandedSet?: Set<string>): number {
  if (isContainerType(n.type) && isEffectivelyCollapsed(n, viewCollapsedSet, expandedSet)) {
    return COLLAPSED_HEIGHT[n.type]
  }
  return n.height
}

/** Effective rendered width of a node (respects collapse + view collapse). */
function effectiveNodeWidth(n: C4Node, viewCollapsedSet?: Set<string>, expandedSet?: Set<string>): number {
  if (isContainerType(n.type) && isEffectivelyCollapsed(n, viewCollapsedSet, expandedSet)) {
    return COLLAPSED_WIDTH[n.type]
  }
  return n.width
}

/**
 * Multi-pass sibling overlap separation.
 * The dragged node stays fixed; siblings on the same parent level are pushed
 * apart until there are no more overlaps or max iterations are reached.
 * Returns a map of id → new {x, y} for nodes that actually moved.
 */
const COLLISION_MARGIN = 10

function separateSiblings(
  draggedId: string,
  nodes: Record<string, C4Node>
): Record<string, { x: number; y: number }> {
  const dragged = nodes[draggedId]
  if (!dragged) return {}

  // Visible siblings at the same parent level
  const siblings = Object.values(nodes).filter(
    (n) => n.parentId === dragged.parentId && !isNodeHidden(n.id, nodes)
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
                pa.x += -pb.x  // push dragged by the overflow amount
                pb.x = 0
              }
            } else if (fixB) {
              pa.x -= dir * ox
              if (hasParent && pa.x < 0) {
                pb.x += -pa.x
                pa.x = 0
              }
            } else {
              pa.x -= dir * ox / 2
              pb.x += dir * ox / 2
              if (hasParent) {
                if (pa.x < 0) { pb.x += -pa.x; pa.x = 0 }
                if (pb.x < 0) { pa.x += -pb.x; pb.x = 0 }
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
              pa.y -= dir * oy / 2
              pb.y += dir * oy / 2
              if (hasParent) {
                if (pa.y < 0) { pb.y += -pa.y; pa.y = 0 }
                if (pb.y < 0) { pa.y += -pb.y; pb.y = 0 }
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
    const nonDragged = siblings.filter(s => s.id !== draggedId)

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

/** What a canvas draws, folds and opens over a fold (activeCanvasSets). */
interface CanvasSets {
  viewFilter?: Set<string>
  viewCollapsedSet?: Set<string>
  expandedSet?: Set<string>
}

/** The sets the canvas shown draws by (as _sync derives them): what the
 *  active view draws, what it folds, what it opens over a fold. None for
 *  All elements. */
function activeCanvasSets(state: Pick<DiagramStore, 'activeViewId' | 'views' | 'exploration' | 'c4Nodes' | 'c4Relations'>): CanvasSets {
  const view = viewById(state, state.activeViewId)
  if (!view) return {}
  const viewFilter = computeViewNodeSet(view, state.c4Nodes, state.c4Relations)
  const viewCollapsedSet = computeViewCollapsedSet(viewFilter, state.c4Nodes)
  for (const id of view.collapsedNodeIds ?? []) viewCollapsedSet.add(id)
  return { viewFilter, viewCollapsedSet, expandedSet: viewExpandedSet(view, state.c4Nodes, state.c4Relations) }
}

/** What a canvas draws (`viewFilter`, the collapsed sets) and at what
 *  size, as deriveRFNodes draws it. */
function canvasBoxes(
  nodes: Record<string, C4Node>,
  viewFilter?: Set<string>,
  viewCollapsedSet?: Set<string>,
  expandedSet?: Set<string>,
): { shown: (n: C4Node) => boolean; boxOf: (n: C4Node) => CanvasBox } {
  const shown = (n: C4Node): boolean => (!viewFilter || viewFilter.has(n.id)) && !isNodeHidden(n.id, nodes, viewCollapsedSet, expandedSet)
  const parents = new Set(Object.values(nodes).filter(shown).map((n) => n.parentId).filter(Boolean))
  const boxOf = (n: C4Node): CanvasBox => {
    if (isFixedSizeType(n.type)) return { x: n.x, y: n.y, w: NODE_SIZES[n.type].width, h: NODE_SIZES[n.type].height }
    const small = isContainerType(n.type) && (isEffectivelyCollapsed(n, viewCollapsedSet, expandedSet) || (!parents.has(n.id) && !n.collapsed))
    return { x: n.x, y: n.y, w: small ? COLLAPSED_WIDTH[n.type] : n.width, h: small ? COLLAPSED_HEIGHT[n.type] : n.height }
  }
  return { shown, boxOf }
}

/**
 * What an expand shows inside `parentId`, clear of each other: children
 * saved on top of one another (a layout made while they were drawn at
 * another size) would be drawn so. In reading order, each child that lies
 * on one before it moves the least way right or down, and what it then
 * lies on moves on; the others keep their saved places. Returns id → new
 * {x, y} for the children that moved.
 */
function untangleChildren(
  parentId: string,
  nodes: Record<string, C4Node>,
  viewFilter?: Set<string>,
  viewCollapsedSet?: Set<string>,
  expandedSet?: Set<string>,
): Record<string, { x: number; y: number }> {
  const { shown, boxOf } = canvasBoxes(nodes, viewFilter, viewCollapsedSet, expandedSet)
  const children = Object.values(nodes).filter((n) => n.parentId === parentId && shown(n))
    .sort((a, b) => a.y - b.y || a.x - b.x || (a.id < b.id ? -1 : 1))
  if (children.length < 2) return {}
  const box = new Map(children.map((n) => [n.id, boxOf(n)]))
  const moved = new Set<string>()
  const overlaps = (a: CanvasBox, b: CanvasBox, gap: number): boolean =>
    a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap
  const placed: CanvasBox[] = []
  for (const child of children) {
    const b = box.get(child.id)!
    for (let step = 0; step < placed.length * 2 + 4; step++) {
      // Lying on one placed before it, or come close to one that moved.
      const blocker = placed.find((p) => overlaps(b, p, 0) || (moved.has(child.id) && overlaps(b, p, EXPAND_GAP)))
      if (!blocker) break
      const right = blocker.x + blocker.w + EXPAND_GAP - b.x
      const down = blocker.y + blocker.h + EXPAND_GAP - b.y
      if (right <= down) b.x += right
      else b.y += down
      moved.add(child.id)
    }
    placed.push(b)
  }
  const result: Record<string, { x: number; y: number }> = {}
  for (const n of children) {
    const b = box.get(n.id)!
    if (b.x !== n.x || b.y !== n.y) result[n.id] = { x: b.x, y: b.y }
  }
  return result
}

// ─── RF state derivation ─────────────────────────────────────────────────────

// A description as a card shows it (markdownToPlain), once per text: cards
// are derived again on every change of the model.
const plainDescriptions = new Map<string, string>()
function plainDescription(text: string | undefined): string | undefined {
  if (!text) return text
  let plain = plainDescriptions.get(text)
  if (plain === undefined) {
    if (plainDescriptions.size > 5000) plainDescriptions.clear()
    plain = markdownToPlain(text)
    plainDescriptions.set(text, plain)
  }
  return plain
}

function deriveRFNodes(
  nodes: Record<string, C4Node>,
  viewFilter?: Set<string>,
  viewCollapsedSet?: Set<string>,
  ghostIds?: Set<string>,
  locked?: boolean,
  expandedSet?: Set<string>,
  frames?: Set<string>,
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


  for (const n of sorted) {
    // A container the view does not show, there only to hold what it does
    // (viewFrames), is on React Flow for its children's places, invisible.
    const hidden = isNodeHidden(n.id, nodes, viewCollapsedSet, expandedSet) || !!frames?.has(n.id)
    const hasChildren = parentSet.has(n.id)
    const collapsed = isEffectivelyCollapsed(n, viewCollapsedSet, expandedSet)
    const isGhost = ghostIds?.has(n.id) ?? false

    // Fixed-size node types always render at canonical NODE_SIZES regardless of
    // what is stored in the document (handles legacy nodes created with old sizes).
    const isFixedSize = isFixedSizeType(n.type)

    const effHeight = isFixedSize
      ? NODE_SIZES[n.type].height
      // Render at COLLAPSED_HEIGHT when:
      //   a) node is effectively collapsed (model or view-collapse), OR
      //   b) no children are visible in this view AND the node is not model-
      //      collapsed-but-view-expanded (in that case n.height holds the last
      //      expanded height which the user intentionally revealed).
      : isContainerType(n.type) && (collapsed || (!hasChildren && !n.collapsed))
        ? COLLAPSED_HEIGHT[n.type]
        : n.height
    const effWidth = isFixedSize
      ? NODE_SIZES[n.type].width
      : isContainerType(n.type) && (collapsed || (!hasChildren && !n.collapsed))
        ? COLLAPSED_WIDTH[n.type]
        : n.width

    // Render-time safeguard: a child saved on top of its parent's header
    // (a layout from before containers kept room for it) is drawn below
    // it, without mutating the model. Only that: a child the live physics
    // placed stands LIVE_CHILD_TOP_MIN or more below the top, and is drawn
    // where the model says. This used to push everything above 110 down,
    // so children the physics had settled at 60 jumped on every reload,
    // view switch and redo, and the canvas showed what the file did not.
    let renderY = n.y
    if (n.parentId) {
      const parent = nodes[n.parentId]
      const parentExpanded =
        parent &&
        isContainerType(parent.type) &&
        !isEffectivelyCollapsed(parent, viewCollapsedSet, expandedSet) &&
        parentSet.has(parent.id)
      if (parentExpanded && renderY < LIVE_CHILD_TOP_MIN) {
        renderY = LIVE_CHILD_TOP_MIN
      }
    }


    rfNodes.push({
      id: n.id,
      type: n.type,
      position: { x: n.x, y: renderY },
      // A parent that is not in the model (a broken file) is drawn as none:
      // React Flow throws on it, and the whole model could not be opened.
      parentNode: n.parentId && nodes[n.parentId] ? n.parentId : undefined,
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
        // A card has room for plain text only: the Markdown without its marks.
        description: plainDescription(n.description),
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
      zIndex: depthOf(n.id) * 10
        + (n.type === 'domain' || n.type === 'group' ? -1 : n.type === 'system' ? 0 : n.type === 'container' ? 1 : 2),
    })
  }
  return rfNodes
}

function deriveRFEdges(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  viewFilter?: Set<string>,
  viewCollapsedSet?: Set<string>,
  hiddenRelationIds?: Set<string>,
  expandedSet?: Set<string>,
  metamodel?: Metamodel,
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

    // A relation between the two elements themselves is an edge of its own,
    // however many others join them: it is selected, edited and deleted on
    // its own (a second one used to be skipped, so it could not be seen at
    // all). Relations rolled up onto a collapsed container share one edge,
    // whose label lists them all.
    if (isVirtual && seen.has(key)) {
      const existing = rfEdges.find((e) => e.id === `virtual-${key}`)
      const label = relationDisplayLabel(rel, nodes)
      if (existing && label) {
        const joined = existing.data?.label ? `${existing.data.label}\n${label}` : label
        existing.label = joined
        if (existing.data) existing.data.label = joined
      }
      continue
    }
    if (isVirtual) seen.add(key)

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
      label: relationDisplayLabel(rel, nodes),
      data: {
        originalSourceId: rel.sourceId,
        originalTargetId: rel.targetId,
        label: relationDisplayLabel(rel, nodes),
        technology: rel.technology,
        relationType: rel.relationType,
        ...(rel.relationType ? { typeName: relationTypeName(metamodel, rel.relationType, true, nodes[rel.sourceId] && nodes[rel.targetId] ? { from: nodes[rel.sourceId].type, to: nodes[rel.targetId].type } : undefined) } : {}),
        isVirtual,
      },
    })
  }

  // Steps that follow each other: an arrow from each to the next, both shown
  // as themselves (not folded into a parent). No relation of the model.
  for (const arrow of processFlow(nodes)) {
    const shown = (id: string) => (!viewFilter || viewFilter.has(id))
      && getViewVisibleAncestor(id, nodes, viewFilter, viewCollapsedSet, expandedSet) === id
    if (!shown(arrow.sourceId) || !shown(arrow.targetId)) continue
    rfEdges.push({
      id: arrow.id,
      source: arrow.sourceId,
      target: arrow.targetId,
      type: 'c4relation',
      animated: false,
      deletable: false,
      focusable: false,
      // No pointer: it is not there to click (index.css).
      className: 'rf-edge-flow',
      zIndex: Math.max(depthOf(arrow.sourceId), depthOf(arrow.targetId)) * 10 + 5,
      data: { originalSourceId: arrow.sourceId, originalTargetId: arrow.targetId, isVirtual: true, flow: true },
    })
  }
  return rfEdges
}

// ─── Sample diagram ──────────────────────────────────────────────────────────

function buildSampleDiagram(): {
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  snapshots: DiagramSnapshot[]
} {
  const add = (nodes: Record<string, C4Node>, n: C4Node) => { nodes[n.id] = n }
  const rel = (relations: Record<string, C4Relation>, r: C4Relation) => { relations[r.id] = r }

  // ── Snapshot 1: MVP – Frontend + API ──────────────────────────────────────
  const snap1nodes: Record<string, C4Node> = {}
  const snap1rels: Record<string, C4Relation> = {}
  add(snap1nodes, { id: 'sys1', type: 'system', label: 'Platform', description: 'Main system', collapsed: false, x: 200, y: 100, width: 700, height: 400 })
  add(snap1nodes, { id: 'ctn1', type: 'container', label: 'Frontend',  technology: 'React',    description: 'Web UI',      parentId: 'sys1', collapsed: false, x: 40,  y: 70,  ...NODE_SIZES.container })
  add(snap1nodes, { id: 'ctn2', type: 'container', label: 'API',       technology: 'Node.js',  description: 'REST API',    parentId: 'sys1', collapsed: false, x: 360, y: 70,  ...NODE_SIZES.container })
  add(snap1nodes, { id: 'usr1', type: 'person',    label: 'End User',  description: 'Uses web app', collapsed: false, x: -100, y: 180, ...NODE_SIZES.person })
  rel(snap1rels, { id: 'r01', sourceId: 'ctn1', targetId: 'ctn2', label: 'Calls', technology: 'HTTPS' })
  rel(snap1rels, { id: 'r00', sourceId: 'usr1', targetId: 'ctn1', label: 'Uses', technology: 'Browser' })

  // ── Snapshot 2: Added Database container ──────────────────────────────────
  const snap2nodes: Record<string, C4Node> = JSON.parse(JSON.stringify(snap1nodes))
  const snap2rels: Record<string, C4Relation> = JSON.parse(JSON.stringify(snap1rels))
  snap2nodes['sys1'] = { ...snap2nodes['sys1'], width: 900, height: 400 }
  add(snap2nodes, { id: 'ctn3', type: 'container', label: 'Database', technology: 'Postgres', description: 'Data storage', parentId: 'sys1', collapsed: false, x: 580, y: 70, ...NODE_SIZES.container })
  rel(snap2rels, { id: 'r02', sourceId: 'ctn2', targetId: 'ctn3', label: 'Reads/writes', technology: 'SQL' })

  // ── Snapshot 3: API renamed to "Backend", added Cache + Auth service ──────
  const snap3nodes: Record<string, C4Node> = JSON.parse(JSON.stringify(snap2nodes))
  const snap3rels: Record<string, C4Relation> = JSON.parse(JSON.stringify(snap2rels))
  snap3nodes['ctn2'] = { ...snap3nodes['ctn2'], label: 'Backend', description: 'GraphQL API', technology: 'Node.js / GraphQL' }
  snap3nodes['sys1'] = { ...snap3nodes['sys1'], width: 1100, height: 500 }
  add(snap3nodes, { id: 'ctn4', type: 'container', label: 'Cache',         technology: 'Redis',   description: 'Session cache',    parentId: 'sys1', collapsed: false, x: 580, y: 260, ...NODE_SIZES.container })
  add(snap3nodes, { id: 'ctn5', type: 'container', label: 'Auth Service',  technology: 'Keycloak', description: 'Identity provider', parentId: 'sys1', collapsed: false, x: 820, y: 70,  ...NODE_SIZES.container })
  rel(snap3rels, { id: 'r03', sourceId: 'ctn2', targetId: 'ctn4', label: 'Caches', technology: 'Redis protocol' })
  rel(snap3rels, { id: 'r04', sourceId: 'ctn1', targetId: 'ctn5', label: 'Auth', technology: 'OAuth2' })

  const snapshots: DiagramSnapshot[] = [
    { id: 'snap-1', name: 'v1 – MVP',             timestamp: Date.now() - 7 * 86400000, nodes: snap1nodes, relations: snap1rels },
    { id: 'snap-2', name: 'v2 – Added Database',  timestamp: Date.now() - 3 * 86400000, nodes: snap2nodes, relations: snap2rels },
    { id: 'snap-3', name: 'v3 – Auth + Cache',    timestamp: Date.now(),                nodes: snap3nodes, relations: snap3rels },
  ]

  return { nodes: snap3nodes, relations: snap3rels, snapshots }
}

// ─── Node wizard session ─────────────────────────────────────────────────────

/** What Studio shows of a branch's changes since its base. */
export interface BranchOverlay {
  /** Elements by id: new, changed or removed since the base. */
  nodes: Record<string, 'new' | 'changed' | 'removed'>
  relations: Record<string, 'new' | 'changed' | 'removed'>
  /** The changed and removed elements as the base has them. */
  baseNodes: Record<string, C4Node>
  /** Removed elements and relations, drawn as ghosts. */
  ghostNodes: Record<string, C4Node>
  ghostRelations: Record<string, C4Relation>
}

export type NodeWizardSession =
  | {
      mode: 'create'
      /** The node to create once the wizard finishes. */
      draft: Omit<C4Node, 'id'>
      /** Links offered pre-checked (e.g. the parent a wiki child derives from). */
      initialLinks: WizardLink[]
    }
  | { mode: 'edit'; nodeId: string }

export interface RequestCreateNodeOptions {
  /** Create the node directly even if its type has a wizard. */
  skipWizard?: boolean
  links?: WizardLink[]
  onCreated?: (id: string) => void
}

// ─── Store interface ─────────────────────────────────────────────────────────

interface DiagramStore {
  // ── raw C4 model ──
  c4Nodes: Record<string, C4Node>
  c4Relations: Record<string, C4Relation>

  // ── sequences (model-level, referenced by dynamic views) ──
  sequences: Record<string, DiagramSequence>
  /** ID of the sequence currently being edited via canvas clicks. null = none */
  activeSequenceId: string | null

  // ── views ──
  views: Record<string, DiagramView>
  activeViewId: string | null
  /** Positions for the "All" (default) view */
  defaultPositions: Record<string, NodePosition>
  /** Camera state (pan + zoom) for the "All" (default) view */
  defaultViewport: { x: number; y: number; zoom: number } | null
  /** Layout constraints of the "All" (default) view; a named view keeps its
   *  own in `layoutConstraints`. Read the active canvas's with
   *  activeLayoutConstraints(). */
  defaultLayoutConstraints: LayoutConstraint[]
  /** How All elements and views without their own draw relations. */
  defaultEdgeStyle: EdgeStyle

  // ── Explore from here ──
  /** A structure view grown from one element (exploration.ts), shown while
   *  `activeViewId` is its id. Never in `views`: it is not saved, merged or
   *  put in a milestone, and code that draws the canvas reads it with
   *  viewById. Its own undo steps (Designer's +, −, drags) go when it does.
   *  null: none open. */
  exploration: Exploration | null
  /** On the exploration shown in Designer or Viewer: for each element it
   *  lists, how many neighbours it does not show yet (its +). null else. */
  exploreMore: Record<string, number> | null
  /** On the exploration shown: the elements whose + added something still
   *  shown (their −). null else. */
  exploreFoldable: Record<string, true> | null
  /** The element whose + menu is open (what to add), or null. */
  exploreMenuFor: string | null
  openExploreMenu: (nodeId: string | null) => void
  /** Opens an exploration of `nodeId` alone, in place of the one open:
   *  Designer's on the live model, not while a milestone is shown; Viewer's
   *  on the model it shows. */
  exploreFrom: (nodeId: string) => void
  /** The + of an element of the exploration shown: the neighbours it does
   *  not show yet that `choice` takes (all of them when omitted: All) join
   *  it one level below, each on its own, and it is laid out again
   *  (exploration.laidOut). An undo step of the exploration's in Designer. */
  exploreNeighbours: (nodeId: string, choice?: ExploreChoice) => void
  /** The − of an element: what its + added, and all added from those
   *  since, leave the exploration. An undo step of the exploration's in
   *  Designer. */
  foldExploration: (nodeId: string) => void
  /** Keeps the exploration as a view of type Explore named `name` in
   *  `folder`: its start, the elements it shows with their levels and the
   *  expansions that added them, its places and the relations it draws, as
   *  one undo step, shown in its place. Designer only. Returns the view's
   *  id, or null when there is none to keep. */
  saveExploration: (name: string, folder: string | null) => string | null
  /** Drops the exploration without a question, and its undo steps, back on
   *  the canvas it was opened from when it is shown. */
  closeExploration: () => void

  // ── derived React Flow state ──
  rfNodes: Node<C4NodeRFData>[]
  rfEdges: Edge<C4EdgeRFData>[]

  // ── UI state ──
  selectedNodeId: string | null
  selectedEdgeId: string | null
  /**
   * All currently selected node ids on the canvas, in the order they were
   * selected (Align… keeps that order). The first entry mirrors
   * `selectedNodeId` (“primary” selection) when non-empty. Maintained from
   * ReactFlow selection changes; multi-select uses Shift/Cmd by default.
   */
  selectedNodeIds: string[]
  layoutMode: 'elk' | 'cola' | 'radical'
  isLayoutRunning: boolean
  /** Live in-run status for the Smart Layout button (which candidate is being tried / which SA phase is refining). */
  smartLayoutProgress: SmartLayoutProgress | null
  /** Full candidate ranking + SA stats from the last Smart Layout run — powers the "why this layout" panel. */
  lastSmartLayoutReport: SmartLayoutReport | null
  liveLayoutActive: boolean
  /** The live layout is moving nodes; false once it reports rest. Edges skip
   *  costly routing while it moves and route fully when it stops. */
  liveLayoutMoving: boolean
  /** Every relation label is shown whatever the zoom (an export is being
   *  drawn), so the labels are placed even when zoomed out. */
  allEdgeLabelsShown: boolean
  /** The canvas draws simple blocks, zoomed out (canvasDetail.ts). Canvas
   *  keeps it in step with the zoom; switching views sets it from the
   *  incoming camera, so a large view is not drawn as cards first. */
  lowDetail: boolean
  setLowDetail: (low: boolean) => void

  // ── connect mode ──
  connectSource: string | null
  /** The end of a relation being dragged by its reconnect handle: the
   *  canvas marks where it can go while the connection key is held. */
  relinking: { relationId: string; end: 'source' | 'target' } | null
  setRelinking: (relinking: { relationId: string; end: 'source' | 'target' } | null) => void
  connectionModifier: 'shift' | 'ctrl' | 'alt' | 'meta'
  /** A relation drawn between two elements that several relation types
   *  fit, or one whose end is moved onto such a pair (`relationId`): the
   *  canvas asks which (chooseRelationType). */
  relationTypeChoice: { sourceId: string; targetId: string; types: string[]; relationId?: string } | null

  // ── actions: nodes ──
  addNode: (node: Omit<C4Node, 'id'>) => string
  /** Add several nodes, each with its links, as one undo step (a list
   *  written or pasted in the wiki). They come without a place on the
   *  canvas and get one beside their siblings. Stops at the first node the
   *  metamodel refuses, with its error toast. Returns the ids of the nodes
   *  added. */
  addNodes: (items: { node: Omit<C4Node, 'id'>; links?: WizardLink[] }[]) => string[]
  updateNode: (id: string, updates: Partial<Omit<C4Node, 'id'>>) => void
  removeNode: (id: string) => void
  /** Removes the elements (with what lies inside them) as one undo step. */
  removeNodes: (ids: string[]) => void
  /** Runs `action`, whatever store actions it calls, as one undo step. */
  runAsOneStep: (action: () => void) => void
  /** A text field got focus: what is typed into it (updateNode,
   *  updateRelation) until endTyping is one undo step. */
  beginTyping: () => void
  /** The text field lost focus: the next edit is a step of its own. */
  endTyping: () => void
  /** Asks to delete the elements, as the Delete key on the canvas does. */
  requestDelete: (nodeIds: string[]) => void
  toggleCollapse: (id: string) => void
  /** Opens every container around `nodeId` that the canvas shown has
   *  collapsed, outermost first, as one undo step. */
  expandAncestors: (nodeId: string) => void

  // ── node wizard ──
  /** Open wizard session, if any: a node waiting to be created, or an
   *  existing node being filled in. */
  nodeWizard: NodeWizardSession | null
  /** Create a node the user asked for (canvas, table, wiki). When its type
   *  has a create-time wizard (and the user hasn't turned wizards off), the
   *  wizard opens instead and the node is only created when it finishes —
   *  `onCreated` runs then. `links` are created with the node, or offered
   *  pre-checked by the wizard. Returns the new id, or '' when the wizard
   *  opened or the metamodel refused the node. AI tools and imports call
   *  `addNode` directly and never open a wizard. */
  requestCreateNode: (node: Omit<C4Node, 'id'>, opts?: RequestCreateNodeOptions) => string
  /** Open the type's wizard for an existing node. */
  openNodeWizard: (nodeId: string) => void
  /** Apply the wizard's values and links as one undo step. In edit mode,
   *  `links` is the complete set for the wizard's relation steps: links that
   *  existed but aren't listed are removed. Returns the node id, or '' when
   *  the metamodel refused the node (the wizard stays open). */
  finishNodeWizard: (values: Record<string, unknown>, links: WizardLink[]) => string
  cancelNodeWizard: () => void

  // ── actions: relations ──
  /** Adds the relation; returns its id, or null when the model refuses it
   *  (the reason is shown). */
  addRelation: (rel: Omit<C4Relation, 'id'>) => string | null
  updateRelation: (id: string, updates: Partial<Omit<C4Relation, 'id'>>) => void
  /** An end of a relation moved on the canvas (its reconnect handle): as
   *  updateRelation, and where the type it has does not fit the new pair
   *  and several do, asked about first (relationTypeChoice); with
   *  `relationType` (a field of the drop panel), of that type. */
  moveRelationEnd: (id: string, updates: Pick<Partial<C4Relation>, 'sourceId' | 'targetId'>, relationType?: string) => void
  removeRelation: (id: string) => void
  onConnect: (connection: Connection) => void
  /** A relation drawn on the canvas (a handle, Alt-drag): refused where the
   *  metamodel or the view's filter chain would not have it (a relation the
   *  chain does not follow is not drawn), of the type the chain follows, and
   *  asked about where several types fit (relationTypeChoice). */
  connectNodes: (sourceId: string, targetId: string) => void
  /** Adds the relation asked about (or moves the end asked about), of
   *  `type`; null drops it. */
  chooseRelationType: (type: string | null) => void

  // ── actions: selection ──
  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void
  /** Replace the multi-selection set. */
  setSelectedNodeIds: (ids: string[]) => void
  /** Wrap the current selection in a new parent of `parentTypeId`. */
  wrapSelectionInNewParent: (parentTypeId: string) => void
  /**
   * Remove a parent node but keep its direct children (re-parented to the
   * grandparent) along with any relations the children participate in.
   * Relations that touched the removed node itself are dropped.
   */
  unwrapNode: (id: string) => void
  /**
   * Move one or more nodes (which must currently share the same parent) into
   * a new parent. Pass `null` to move them to the canvas root. Coordinates
   * are translated so on-screen position is preserved as closely as possible.
   */
  /** `quiet`: no notice of the move (an outline edit, where it is seen). */
  reparentNodes: (ids: string[], newParentId: string | null, options?: { quiet?: boolean }) => void

  // ── actions: views ──
  /** A new view listing no elements, of `kind` (a structure view when
   *  none is given); returns its id. It shows every element, or with
   *  `empty` none until elements are listed in it. */
  addView: (name: string, kind?: DiagramView['kind'], empty?: boolean) => string
  removeView: (id: string) => void
  renameView: (id: string, name: string) => void
  setActiveView: (id: string | null) => void
  addNodeToView: (viewId: string, nodeId: string) => void
  /** Hide one node or several (one undo step) and their descendants from a view. */
  removeNodeFromView: (viewId: string, nodeIds: string | string[]) => void
  /** Replace the entire visible-nodes set of a view. Unknown ids are ignored. */
  setViewNodes: (viewId: string, nodeIds: string[]) => void
  /** Hide a specific relation from the view, even if both endpoints are visible. */
  hideRelationFromView: (viewId: string, relationId: string) => void
  /** Reverse `hideRelationFromView`. */
  unhideRelationInView: (viewId: string, relationId: string) => void
  /** Replace the view's hidden relations (one undo step). Unknown ids are ignored. */
  setViewHiddenRelations: (viewId: string, relationIds: string[]) => void
  /** Show elements folded or open in one view only, over their model-level
   *  fold; one undo step. */
  setViewCollapsed: (viewId: string, nodeIds: string[], collapsed: boolean) => void
  /** Put a view into a folder of the list of views ("C4/Components"), or
   *  at the top for null or ""; one undo step. */
  setViewFolder: (viewId: string, folder: string | null) => void
  /** Puts the positions and camera of the canvas shown (in the nodes until
   *  it is left) into its view, or into All elements'. Only for the live
   *  model: a milestone's are not saved into the live views. */
  _saveShownCanvas: () => void
  /** Puts the positions of the canvas shown onto the nodes: its view's, or
   *  All elements' (a milestone's own while one is shown). */
  _showLiveCanvasPositions: () => void
  /** While a view is shown, gives the elements All elements has no place
   *  for (added on the view: an import from the Hub) one there, beside
   *  their siblings (placeUnplaced), so that a view opened on All
   *  elements' places draws them where they belong. Not in a milestone. */
  _placeOnAllElements: () => void
  /** Rename a folder of the list of views; its views and subfolders move
   *  along, as one undo step. Returns the new path, or null when refused
   *  (empty name, "/" in it, no such folder). */
  renameViewFolder: (path: string, name: string) => string | null
  /** Move a folder of the list of views one place up (-1) or down (1)
   *  among the folders beside it; one undo step. */
  moveViewFolder: (path: string, direction: -1 | 1) => void
  /** Order the listed views among the places they hold; one undo step. */
  orderViews: (viewIds: string[]) => void
  /** How a view draws relations; null: the model's default. One undo step. */
  setViewEdgeStyle: (viewId: string, style: EdgeStyle | null) => void
  /** A view's pipeline (viewPipeline.ts): source, filters, grouping, order; one undo step, saved. */
  setViewPipeline: (viewId: string, pipeline: ViewPipeline) => void
  /** Makes the view one of the metamodel's viewpoint (its kind and chain,
   *  kept to `subjectId` for a viewpoint that draws one element: undefined
   *  keeps the element the view is of); one undo step. */
  applyViewpoint: (viewId: string, typeId: string, subjectId?: string | null) => boolean
  /** A new view of the metamodel's viewpoint, named after it (for one that
   *  draws one element, a group holding a view of each); one undo step. */
  addViewOfViewpoint: (typeId: string) => string | null
  /** The view keeps its kind and chain (kept to its element), of no viewpoint; one undo step. */
  detachViewpoint: (viewId: string) => void
  /** How All elements and views without their own draw relations. One undo step. */
  setDefaultEdgeStyle: (style: EdgeStyle) => void
  /** Switch a view between 'static', 'dynamic', 'treemap', 'table', 'matrix', 'wiki', 'warnier' and 'explore'.
   *  Switched to Explore it grows from the element selected on it, else its
   *  first, as each element's + would have grown it within its elements;
   *  switched from Explore it keeps its elements and places, nested in
   *  their containers as a structure view keeps them. */
  setViewKind: (viewId: string, kind: 'static' | 'dynamic' | 'treemap' | 'table' | 'matrix' | 'wiki' | 'warnier' | 'explore') => void
  /** Persist treemap drill-down focus (null = top "All"). */
  setTreemapFocus: (viewId: string, focusId: string | null) => void
  /** Persist wiki page focus (null = Overview / table of contents). */
  setWikiFocus: (viewId: string, focusId: string | null) => void
  /** Switch how an element's page renders its children — short preview
   *  cards ('single', default) or each child's full content inline ('multi'). */
  setWikiPageMode: (viewId: string, mode: 'single' | 'multi') => void
  setWikiDepth: (viewId: string, depth: number) => void
  /** Choose how treemap rectangles are sized for a view. */
  setTreemapSizeBy: (viewId: string, mode: 'leaves' | 'uniform' | 'relations') => void
  setTreemapMaxDepth: (viewId: string, depth: number | null) => void
  /** Choose the auto-layout strategy used for this view. */
  setViewLayoutMode: (viewId: string, mode: 'auto' | 'tree') => void
  /**
   * Keeps `nodeIds` on one line on the active canvas — a row ('horizontal')
   * or a column ('vertical') — through drags, the live layout and Smart
   * Layout, and lines them up now. With `ordered` they also keep the order
   * of `nodeIds` along the line (left to right, top to bottom) — the order
   * the user selected them in. Returns the constraint's id, or null when
   * refused (the reason is notified).
   */
  addAlignment: (axis: AlignConstraint['axis'], nodeIds: string[], options?: { ordered?: boolean }) => string | null
  /**
   * Keeps `nodeIds` in a grid of `columns` columns (default: about square)
   * on the active canvas, filled row by row in the order given — the order
   * the user selected them in — and lays them out in even cells now.
   * Returns the constraint's id, or null when refused (notified).
   */
  addGrid: (nodeIds: string[], columns?: number) => string | null
  /** Gives a grid another number of columns and lays it out again, on its
   *  canvas (null = All elements; undefined = the active canvas). */
  setGridColumns: (id: string, columns: number, viewId?: string | null) => void
  /** Makes an alignment keep the order of its members as listed (the order
   *  they were selected in) on its canvas (null = All elements; undefined =
   *  the active canvas), or stop keeping it. */
  setAlignmentOrdered: (id: string, ordered: boolean, viewId?: string | null) => void
  /** Removes layout constraints, as one undo step, from a view (null = All
   *  elements; undefined = the active canvas). */
  removeLayoutConstraint: (ids: string | string[], viewId?: string | null) => void
  /** Lets the live physics move these elements of the active canvas again
   *  (see PinConstraint), as one undo step. */
  unpinNodes: (ids: string[]) => void
  /** Link/unlink a sequence to a dynamic view. */
  setViewSequence: (viewId: string, sequenceId: string | null) => void
  /**
   * Create a new dynamic view scoped to a sequence:
   * populates nodeIds with the source/target nodes of every relation in the
   * sequence, sets kind='dynamic' and links the sequenceId.
   * Returns the new view id.
   */
  addViewFromSequence: (sequenceId: string) => string

  // ── actions: sequences ──
  addSequence: (name: string) => string
  removeSequence: (id: string) => void
  renameSequence: (id: string, name: string) => void
  /** Set which sequence is currently being edited (canvas edge clicks toggle steps). */
  setActiveSequence: (id: string | null) => void
  /** Toggle a relation in a model sequence (append if absent, remove if present). */
  toggleRelationInSequence: (sequenceId: string, relationId: string) => void
  /** Remove the step at index `idx` from a sequence. */
  removeFromSequence: (sequenceId: string, idx: number) => void
  /** Move a step from `fromIdx` to `toIdx` within a sequence. */
  reorderSequence: (sequenceId: string, fromIdx: number, toIdx: number) => void
  /** Clear all steps from a sequence. */
  clearSequence: (sequenceId: string) => void
  /** Set (or clear) the description for a specific step by index. */
  updateStepDescription: (sequenceId: string, idx: number, description: string) => void
  /** Make the step at `idx` run along its relation backward, from the
   *  relation's target to its source (a response), or forward again. */
  setStepBackward: (sequenceId: string, idx: number, backward: boolean) => void

  // ── actions: React Flow sync ──
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  fitParentToChildren: (parentId: string, viewFilter?: Set<string>, viewCollapsedSet?: Set<string>, expandedSet?: Set<string>) => void
  resolveOverlaps: (draggedId: string) => void

  // ── actions: layout ──
  runRadicalLayout: () => void
  runTreeLayout: () => Promise<void>
  runSmartLayout: () => Promise<void>
  setLayoutMode: (mode: 'elk' | 'cola' | 'radical') => void
  startLiveLayout: (opts?: { skipBulk?: boolean }) => void
  stopLiveLayout: () => void
  /** A drag starts. 'calm' (the default) moves only the element (and the
   *  rows and columns it keeps); 'push' lets the physics move the rest. */
  liveGrab: (nodeId: string, x: number, y: number, mode?: DragMode, abs?: { x: number; y: number }, withIds?: string[]) => void
  /** `abs`: the absolute top-left (React Flow's positionAbsolute). */
  liveDrag: (nodeId: string, x: number, y: number, abs?: { x: number; y: number }) => void
  /** A drag ends: when it `moved` (React Flow reports a click as a drag
   *  too), the element and `withIds`, the other selected elements dragged
   *  along, are pinned where they were dropped. */
  liveRelease: (nodeId: string, withIds?: string[], moved?: boolean) => void
  setConnectionModifier: (mod: 'shift' | 'ctrl' | 'alt' | 'meta') => void
  startConnection: (sourceId: string) => void
  cancelConnection: () => void

  // ── actions: diagram I/O ──
  newDiagram: () => void
  /** Show `data`, a model of its own: the history goes. With
   *  `outsideChange`, it is the model shown with a change made outside
   *  Studio (its folder reloaded): the history stays, and its steps are
   *  made on the model with that change (_historyRebased). */
  loadDiagram: (data: DiagramData, opts?: { outsideChange?: boolean }) => void
  saveDiagram: () => DiagramData
  resetDiagram: () => void
  /** Erase nodes, relations, views and sequences as one undo step; milestones,
   *  presentations and the metamodel stay (the AI's reset_diagram). */
  clearModel: () => void

  // ── actions: undo / redo ──
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean

  // ── actions: snapshots (versions / milestones) ──
  snapshots: DiagramSnapshot[]
  /** ID of the milestone currently loaded onto the canvas (null = live HEAD). */
  activeSnapshotId: string | null
  /** Backup of the live HEAD state, kept while a milestone is loaded. Its
   *  Hub template records too: they are the live model's, and an Apply in
   *  the milestone changes them only once it is propagated. */
  liveBackup: {
    nodes: Record<string, C4Node>; relations: Record<string, C4Relation>; sequences: Record<string, DiagramSequence>; hubTemplates?: Record<string, HubImportRecord>
    /** The live versions of the views, of All elements' positions and of
     *  its alignments, as they were before an edit of the milestone changed
     *  them (_milestoneViewEdit): saved in their place, and put back when the
     *  milestone is left without its edits propagated. */
    views?: Record<string, DiagramView>; defaultPositions?: Record<string, NodePosition>; defaultLayoutConstraints?: LayoutConstraint[]
  } | null
  /** True after the user makes a structural edit while viewing a milestone. */
  milestoneDirty: boolean
  /** Open the propagate/new prompt modal. */
  milestonePromptOpen: boolean
  createSnapshot: (name: string) => string
  restoreSnapshot: (id: string) => void
  removeSnapshot: (id: string) => void
  renameSnapshot: (id: string, name: string) => void
  /** Load a milestone onto the canvas for inspection / editing. */
  selectMilestone: (id: string) => void
  /** Commit milestone edits: 'propagate' = apply diff to this + later milestones; 'new' = insert new milestone after current. */
  commitMilestoneChanges: (mode: 'propagate' | 'new', newName?: string) => void
  /** Discard milestone edits and return to live HEAD state. */
  discardMilestoneChanges: () => void
  /** Close the prompt modal without committing (banner stays). */
  dismissMilestonePrompt: () => void

  // ── delete confirmation ──
  /** When the user presses Delete on the canvas, the request is parked here
   * until they choose between "remove from model" or "hide from current view". */
  pendingDelete: { nodeIds: string[]; edgeIds: string[] } | null
  /** Called by the confirm dialog. */
  resolvePendingDelete: (action: 'model' | 'view' | 'cancel') => void

  // ── diff highlight (time travel) ──
  diffHighlight: Record<string, 'new' | 'changed' | 'removed'>
  setDiffHighlight: (diff: Record<string, 'new' | 'changed' | 'removed'>) => void
  /** Snapshot id used as the diff base when viewing a milestone. `null` means
   *  "auto" — use the milestone immediately before the active one (or live
   *  HEAD when the active milestone is the very first). User can override
   *  via {@link setDiffBase} to compare against any milestone. */
  diffBaseSnapshotId: string | null
  setDiffBase: (id: string | null) => void
  /** Ghost copies of items that exist in the diff base but are missing from
   *  the active milestone. Merged into rfNodes/rfEdges by `_sync()` so the
   *  user can see what got removed, without these ghosts polluting the
   *  actual `c4Nodes` / `c4Relations` model. */
  diffGhostNodes: Record<string, C4Node>
  diffGhostRelations: Record<string, C4Relation>
  /** Whether diff overlays are currently visible. Default `false` — user
   *  toggles explicitly to see changes vs. the previous milestone. */
  showDiff: boolean
  toggleShowDiff: () => void
  /** The changes of the branch on show (Studio's Changes on branch, from
   *  the base the CLI or the MCP server saved beside the model), drawn by the
   *  diff overlay above; null when they are not shown. A milestone takes the
   *  overlay over. */
  branch: BranchOverlay | null
  /** Shows the branch's changes on the canvas, or (null) stops showing them. */
  showBranchChanges: (branch: BranchOverlay | null) => void

  // ── app mode ──
  /** The perspective: Designer edits; Viewer and Presenter explore and
   *  present; the metamodel editor and the Inspector (what `radical check`
   *  says about the model) show no canvas. */
  appMode: 'designer' | 'viewer' | 'presenter' | 'metamodel' | 'inspector'
  setAppMode: (mode: 'designer' | 'viewer' | 'presenter' | 'metamodel' | 'inspector') => void

  // ── metamodel (per document) ──
  metamodel: Metamodel
  setMetamodel: (m: Metamodel) => void
  /** Brings the views of a viewpoint in step with the metamodel. */
  _syncViewpoints: () => void
  /** `confirm`, when given, is asked with the metamodel the change makes
   *  once the change is allowed (the metamodel editor lists there what it
   *  would leave the model against); false makes nothing. So for the two
   *  removes below. */
  resetMetamodelToC4: (confirm?: (next: Metamodel) => boolean) => void
  _forgetStepsOfLostTypes: () => void
  /** Where the undo history stands now, for _mergeStepsSince. */
  _historyMark: () => number
  /** The steps pushed since `mark` become one: undo goes back to where the
   *  history stood then. For an action of the user whose parts arrive one
   *  after another (a Hub concept with its related concepts). */
  _mergeStepsSince: (mark: number) => void
  upsertNodeType: (def: NodeTypeDef) => void
  removeNodeType: (id: string, confirm?: (next: Metamodel) => boolean) => void
  upsertRelationType: (def: RelationTypeDef) => void
  removeRelationType: (id: string, confirm?: (next: Metamodel) => boolean) => void

  // ── hub import templates (per document) ──
  /** Keyed by import-instance UUID. Allows reconfiguring template values after import. */
  hubTemplates: Record<string, HubImportRecord>
  /** New values for an imported Hub template: the fields that hold its
   *  parameters are written again from the Hub's text, as one undo step. */
  applyHubTemplate: (id: string, values: Record<string, string>) => void
  upsertHubTemplate: (id: string, record: HubImportRecord) => void
  deleteHubTemplate: (id: string) => void
  /** Catalogue metadata of a hub concept file; carried through load/save untouched. */
  hubMeta: HubConceptMeta | null

  // ── transient notifications (toasts) ──
  notifications: Array<{ id: string; severity: 'error' | 'warning' | 'info'; message: string; ts: number }>
  pushNotification: (message: string, severity?: 'error' | 'warning' | 'info') => void
  dismissNotification: (id: string) => void

  // ── presentation mode ──
  /** All presentations (each contains its own slides) */
  presentations: Presentation[]
  /** Currently selected presentation id (null only if none exist) */
  activePresentationId: string | null
  /** Slides of the active presentation (mirror — kept in sync) */
  presentationSlides: PresentationSlide[]
  presentationActive: boolean
  presentationSlideIndex: number
  /** The drill level a slide of a hierarchy view shows, over the view's
   *  own, while the slide is shown (not saved into the view). */
  slideTreemapFocus: { viewId: string; focusId: string | null } | null
  /** The page (and page mode) a slide of a wiki view shows, over the
   *  view's own, while the slide is shown (not saved into the view). */
  slideWikiPage: SlideWikiPage | null
  addPresentation: (name?: string) => string
  /** Replace every presentation (AI tools). Keeps the active one when it
   *  still exists; an empty list leaves one empty presentation. */
  setPresentations: (presentations: Presentation[]) => void
  removePresentation: (id: string) => void
  renamePresentation: (id: string, name: string) => void
  setActivePresentation: (id: string) => void
  addPresentationSlide: (name?: string) => void
  removePresentationSlide: (id: string) => void
  renamePresentationSlide: (id: string, name: string) => void
  updatePresentationSlideViewport: (id: string, vp: { x: number; y: number; zoom: number }) => void
  startPresentation: () => void
  stopPresentation: () => void
  goToSlide: (index: number) => void
  previewSlide: (index: number) => void
  captureSlideViewport: (id: string) => void
  linkSnapshotToSlide: (slideId: string, snapshotId: string | null) => void
  linkViewToSlide: (slideId: string, viewId: string | null) => void
  setViewportFns: (
    getVP: () => { x: number; y: number; zoom: number },
    setVP: (vp: { x: number; y: number; zoom: number }, opts?: { duration?: number }) => void,
  ) => void

  // ── actions: viewport ──
  autoFitActive: boolean
  setFitViewFn: (fn: (() => void) | null, instantFn?: (() => void) | null) => void
  fitAll: () => void
  /** Flips the Smart fit setting and saves it to the studio settings. */
  toggleAutoFit: () => void
  /** Focus: whether a selection dims the rest of the canvas and the camera
   *  frames it (canvasFocus.ts). */
  selectionFocus: boolean
  /** Flips Focus and saves it to the studio settings. */
  toggleSelectionFocus: () => void
  zoomIn: () => void
  zoomOut: () => void

  // ── internal ──
  _sync: () => void
  _pushUndo: () => void
  _markMilestoneEdit: () => void
  /** An edit of view `viewId` (null: All elements' alignments; 'every':
   *  every view and All elements' positions) while a milestone is shown is
   *  an edit of the milestone: marks it, and parks the live version first
   *  (liveBackup.views). No-op on the live model. */
  _milestoneViewEdit: (viewId: string | null | 'every') => void
  _resizeParentsBottomUp: (viewFilter?: Set<string>, viewCollapsedSet?: Set<string>, expandedSet?: Set<string>) => void
  /** Moves the active canvas's elements so its layout constraints hold
   *  (no undo step of its own). */
  _enforceLayoutConstraints: () => void
  /** Lays grid `id` of the active canvas out in even cells, then keeps the
   *  constraints (no undo step of its own). */
  _arrangeGrid: (id: string) => void
}

/** A layout of the whole canvas places every element anew: the active
 *  canvas's pins (elements dropped after a drag) go with the old places.
 *  Designer only: Viewer puts the old positions back when it is left. */
function unpinLaidOut(state: DiagramStore, appMode: DiagramStore['appMode']): void {
  if (appMode !== 'designer') return
  const pinned = pinnedNodeIds(model.layoutConstraintsOf(state, state.activeViewId))
  if (pinned.length) model.setPinned(state, state.activeViewId, pinned, false, uid)
}

// ─── Live layout singleton (not serialisable → kept outside store) ───────────

let _liveLayout: LiveColaLayout | null = null
/** While a milestone is shown, where its All elements has the nodes. Views
 *  keep one layout for every milestone, so the live views give a milestone
 *  their positions and nothing of it is saved into them; its All elements is
 *  its own. Set when a milestone is shown. */
let _milestoneAllPositions: Record<string, NodePosition> | null = null
/** The Hub template records a milestone was shown with (milestoneHubTemplates):
 *  Propagate carries forward only what an Apply changed from them. */
let _milestoneHubBase: Record<string, HubImportRecord> | null = null

/** What was selected on the open canvas ('' = All elements) when the same
 *  document was read again (an outside change), to show it again after the
 *  reload. Leaving a view clears its selection, so this holds no other
 *  view's. Not saved. */
let _viewSelections = new Map<string, { nodeIds: string[]; edgeId: string | null }>()
/** The document `_viewSelections` belongs to. */
let _viewSelectionsDoc: string | null = null

/** Selects `nodeIds` (or the edge) on the canvas and mirrors it into the
 *  React Flow nodes and edges, keeping only what the canvas shows. */
function showSelection(state: DiagramStore, nodeIds: readonly string[], edgeId: string | null): void {
  const shownNodes = new Set(state.rfNodes.filter((n) => !n.hidden).map((n) => n.id))
  const ids = nodeIds.filter((id) => shownNodes.has(id))
  const edge = ids.length === 0 && edgeId && state.rfEdges.some((e) => e.id === edgeId && !e.hidden) ? edgeId : null
  state.selectedNodeIds = ids
  state.selectedNodeId = ids[0] ?? null
  state.selectedEdgeId = edge
  mirrorSelection(state)
}

/** Paints the store's selection on the React Flow nodes and edges. */
function mirrorSelection(state: DiagramStore): void {
  const ids = new Set(state.selectedNodeIds)
  for (const rn of state.rfNodes as Array<{ id: string; selected?: boolean }>) {
    const want = ids.has(rn.id)
    if (!!rn.selected !== want) rn.selected = want
  }
  for (const re of state.rfEdges as Array<{ id: string; selected?: boolean }>) {
    const want = re.id === state.selectedEdgeId
    if (!!re.selected !== want) re.selected = want
  }
}

// The open create-wizard's callback — a function, so it stays out of the
// (immer-drafted) store state.
let _wizardOnCreated: ((id: string) => void) | undefined

/** Adds the wizard's links for `nodeId`, skipping ones the metamodel refuses
 *  (the wizard only offers allowed pairs, so that's a stale pick) and ones
 *  that already exist. */
function _insertWizardLinks(state: model.ModelState, nodeId: string, links: WizardLink[]): void {
  for (const link of links) {
    const rel = link.direction === 'out'
      ? { sourceId: nodeId, targetId: link.otherId, relationType: link.relationType }
      : { sourceId: link.otherId, targetId: nodeId, relationType: link.relationType }
    if (!state.c4Nodes[link.otherId] || model.checkAddRelation(state, rel)) continue
    const exists = Object.values(state.c4Relations).some(
      (r) => r.sourceId === rel.sourceId && r.targetId === rel.targetId && r.relationType === rel.relationType,
    )
    if (!exists) model.insertRelation(state, uid(), rel)
  }
}

// Counts the times the whole model was replaced (a document loaded, a new or
// sample model started): what was computed for the model before is not for
// the one after. The model shown read again with a change made outside
// Studio (an agent's write) is the same model: a layout computed meanwhile
// is still for it (item 236), and takes the change in (layoutChangedMeanwhile).
let _modelLoads = 0

/** What changed in the model while a layout of `before` (the elements and
 *  their parents when it started) ran: the elements added, and those moved
 *  into another parent, which its result has no place for; they are placed
 *  as new elements once it is applied (placeAddedDuringLayout, D11). An
 *  element deleted meanwhile is left out of the result where it is applied. */
function layoutChangedMeanwhile(before: Map<string, string | undefined>, nodes: Record<string, C4Node>): string[] {
  return Object.values(nodes).filter((n) => !before.has(n.id) || before.get(n.id) !== n.parentId).map((n) => n.id)
}

/** The elements of `nodes` with their parents, for layoutChangedMeanwhile. */
const parentsOf = (nodes: Record<string, C4Node>): Map<string, string | undefined> =>
  new Map(Object.values(nodes).map((n) => [n.id, n.parentId]))

/** `positions` less those of `ids`. */
const positionsWithout = <T,>(positions: Record<string, T>, ids: string[]): Record<string, T> => {
  if (!ids.length) return positions
  const out = { ...positions }
  for (const id of ids) delete out[id]
  return out
}

/** The canvas a layout run was started on. Smart Layout and the tree layout
 *  take seconds on a large view, and the user can open another view, change
 *  perspective, look at a milestone or load another model meanwhile: the
 *  result is for the canvas it was computed from and no other. */
function layoutTarget(s: Pick<DiagramStore, 'activeViewId' | 'appMode' | 'activeSnapshotId'>): string {
  return [_modelLoads, s.appMode, s.activeViewId ?? '', s.activeSnapshotId ?? ''].join('|')
}

/** Tells the user a layout was dropped because its canvas is no longer shown. */
function layoutMissedItsCanvas(push: DiagramStore['pushNotification']): void {
  push('The layout was not applied: the canvas it was computed for is no longer the one shown. Run it again here.', 'warning')
}

/** Writes the document right after a layout instead of after the autosave
 *  delay, so a reload straight after it shows the layout. Designer only:
 *  Viewer and Presenter save nothing of what is arranged there. */
function saveLayoutNow(appMode: DiagramStore['appMode']): void {
  // Nor the exploration's: it is not saved.
  if (appMode !== 'designer' || typeof window === 'undefined' || onExploration(useDiagramStore.getState())) return
  const flush = (window as any).__radicalFlushPersist as (() => Promise<void>) | undefined
  void flush?.()
}

// Set to true during store init when an existing document was loaded from
// localStorage. Used by the boot startLiveLayout() call to skip the
// 110-iteration cola bulk phase (which would immediately overwrite the
// persisted positions).
let _initLoadedFromDisk = false

// Use window to survive HMR module reloads — otherwise after a hot-reload the
// module-local references become null and the auto-fit interval keeps ticking
// against a dead closure.
const _getFitViewFn = (): (() => void) | null =>
  (typeof window !== 'undefined' ? (window as any).__radicalFitViewFn : null) ?? null
const _setFitViewFnRef = (fn: (() => void) | null) => {
  if (typeof window !== 'undefined') (window as any).__radicalFitViewFn = fn
}
const _getFitViewInstantFn = (): (() => void) | null =>
  (typeof window !== 'undefined' ? (window as any).__radicalFitViewInstantFn : null) ?? null
const _setFitViewInstantFnRef = (fn: (() => void) | null) => {
  if (typeof window !== 'undefined') (window as any).__radicalFitViewInstantFn = fn
}
const _getAutoFitTimer = (): ReturnType<typeof setInterval> | null =>
  (typeof window !== 'undefined' ? (window as any).__radicalAutoFitTimer : null) ?? null
const _setAutoFitTimer = (t: ReturnType<typeof setInterval> | null) => {
  if (typeof window !== 'undefined') (window as any).__radicalAutoFitTimer = t
}
// Viewport fns — stored on window so HMR module reloads don't lose them
const _getViewportFn = (): (() => { x: number; y: number; zoom: number }) | null =>
  (window as any).__rfGetViewport ?? null
const _setViewportFn = (): ((vp: { x: number; y: number; zoom: number }, opts?: { duration?: number }) => void) | null =>
  (window as any).__rfSetViewport ?? null

/**
 * Sets a slide's captured camera. After a slide without a canvas (flow,
 * table, matrix, wiki) the canvas is still mounting: the setter left behind
 * by the canvas that went away drew NaN transforms (about 200 console
 * errors a step), and the new canvas then placed the view's own camera.
 * The camera waits for the canvas instead (`__rfPendingCamera`, taken by
 * Canvas when it is ready).
 */
function setSlideCamera(vp: { x: number; y: number; zoom: number }, duration: number): void {
  const W = window as any
  W.__rfPendingFocus = undefined
  W.__rfPendingCamera = { vp, duration }
  requestAnimationFrame(() => {
    const pending = W.__rfPendingCamera as { vp: typeof vp; duration: number } | undefined
    const setViewport = _setViewportFn()
    if (!pending || !setViewport) return
    W.__rfPendingCamera = undefined
    setViewport(pending.vp, { duration: pending.duration })
  })
}

/**
 * Zooms onto a slide's focus elements (a slide with no captured camera).
 * After a slide without a canvas, from a deep link or after a reload the
 * canvas is still mounting, and the view's own camera it then placed showed
 * the whole view: the focus waits for the canvas as the camera does
 * (`__rfPendingFocus`, taken by Canvas once it has placed its first camera;
 * until then it has no `__rfFocusNodes`).
 */
function setSlideFocus(ids: string[], duration: number): void {
  const W = window as any
  W.__rfPendingCamera = undefined
  W.__rfPendingFocus = { ids, duration }
  requestAnimationFrame(() => {
    const pending = W.__rfPendingFocus as { ids: string[]; duration: number } | undefined
    const focusNodes = W.__rfFocusNodes as ((ids: string[], opts?: { duration?: number }) => void) | undefined
    if (!pending || !focusNodes) return
    W.__rfPendingFocus = undefined
    focusNodes(pending.ids, { duration: pending.duration })
  })
}

/** A slide that fits its whole view: no camera or focus of an earlier slide
 *  is left waiting for the canvas. */
function clearSlideCamera(): void {
  const W = window as any
  W.__rfPendingCamera = undefined
  W.__rfPendingFocus = undefined
}

// ─── Store implementation ────────────────────────────────────────────────────

/** Whether the view's viewpoint, kind and chain are set by a group of views
 *  per element: the group's by its viewpoint, its views' by the group. They
 *  change only with the group's viewpoint, so the group stays one. */
export function setByGroup(s: { views: Record<string, DiagramView>; metamodel: Metamodel }, viewId: string): boolean {
  const view = s.views[viewId]
  return !!view && (!!view.partOf || model.isViewGroup(view, s.metamodel))
}

/** Why no element can be hidden from the view by hand, or null when one
 *  can: a view per element shows what its element holds (`group`), and a
 *  view that lists nothing shows what its filter chain gives (`filter`).
 *  Hidden from that, an element left the view listing every other one, and
 *  what was added to the model later never showed there. */
export function hideRefusal(s: { views: Record<string, DiagramView>; metamodel: Metamodel }, viewId: string): 'group' | 'filter' | null {
  const view = s.views[viewId]
  if (!view) return null
  if (setByGroup(s, viewId)) return 'group'
  if (viewShowsEveryNode(view) && view.kind !== 'dynamic' && pipelineOf(view)?.levels?.length) return 'filter'
  return null
}

export const useDiagramStore = create<DiagramStore>()(
  immer((set, get) => {
    /** Opening canvas `to`: nothing stays selected, on the view left or the
     *  one opened; a selection belongs to the picture it was made on, and
     *  coming back to a view starts afresh. Only the view that was open when
     *  the same document was read again gets its selection back. */
    const clearViewSelection = (to: string | null): void => {
      const kept = _viewSelections.get(to ?? '')
      _viewSelections.clear()
      set((state) => showSelection(state as DiagramStore, kept?.nodeIds ?? [], kept?.edgeId ?? null))
    }

    // ── Document persistence boot ────────────────────────────────────────
    // We always have an "active" document. If the index is empty we seed one
    // with the built-in sample. For LS-backed docs we can hydrate
    // synchronously; FS-backed docs are loaded asynchronously below.
    //
    // The embedded viewer profile has no documents at all: it starts empty
    // and the host page injects a model via loadDiagram().
    const buildSampleData = (): DiagramData => {
      const sample = buildSampleDiagram()
      return {
        nodes: Object.values(sample.nodes),
        relations: Object.values(sample.relations),
        defaultPositions: snapshotPositions(sample.nodes),
        snapshots: sample.snapshots,
      }
    }
    const viewerProfile = isViewerProfile()

    let initNodes: Record<string, C4Node>
    let initRelations: Record<string, C4Relation>
    let initViews: Record<string, DiagramView>
    let initDefaultPositions: Record<string, NodePosition>
    let initSnapshots: DiagramSnapshot[]
    let initPres: ReturnType<typeof buildPresentationsFromData>
    let initMetamodel: Metamodel

    // A synchronously readable document (localStorage) shows on first paint.
    // Anything else renders the sample first and the app loads it afterwards.
    const persisted: DiagramData | null = viewerProfile
      ? null
      : documentBackend()?.openActive(buildSampleData) ?? null

    if (persisted && Array.isArray(persisted.nodes) && Array.isArray(persisted.relations)) {
      initNodes = atDefaultPositions(persisted.nodes, persisted.defaultPositions)
      initRelations = {}
      initViews = {}
      for (const r of persisted.relations) initRelations[r.id] = r
      // Older documents kept every node's position in each view.
      if (persisted.views) for (const v of withCanvasPositions(persisted.views.map(withExploreState), initNodes, (view) => viewDrawnIds(view, initNodes, initRelations))) initViews[v.id] = v
      const initSequences: Record<string, DiagramSequence> = {}
      if (persisted.sequences) for (const s of persisted.sequences) initSequences[s.id] = s
      initDefaultPositions = persisted.defaultPositions ?? snapshotPositions(initNodes)
      initSnapshots = persisted.snapshots ?? []
      initPres = buildPresentationsFromData(persisted.presentations, persisted.presentationSlides)
      // Auto-refresh built-in presets so persisted documents pick up
      // metamodel updates shipped with new app versions.
      initMetamodel = model.documentMetamodel(persisted.metamodel, persisted.nodes)
      // Signal the boot startLiveLayout() call to skip cola's bulk phase
      // so the persisted positions aren't immediately overwritten.
      _initLoadedFromDisk = true
      // The document the views' selections belong to: read again (an
      // agent's write), the one opened at boot was taken for another, and
      // a selected relation's card closed while it was typed in.
      _viewSelectionsDoc = documentBackend()?.getActiveId() ?? null
    } else if (viewerProfile) {
      initNodes = {}
      initRelations = {}
      initViews = {}
      initDefaultPositions = {}
      initSnapshots = []
      initPres = buildPresentationsFromData(undefined, [])
      initMetamodel = builtInGovernanceMetamodel()
    } else {
      const sample = buildSampleDiagram()
      initNodes = sample.nodes
      initRelations = sample.relations
      initViews = {}
      initDefaultPositions = snapshotPositions(sample.nodes)
      initSnapshots = sample.snapshots
      initPres = buildPresentationsFromData(undefined, [])
      initMetamodel = builtInC4Metamodel()
    }
    // Views of a viewpoint follow the viewpoint as the metamodel has it now.
    model.syncViewpoints({ c4Nodes: initNodes, views: initViews, metamodel: initMetamodel } as unknown as model.ModelState)

    // Puts the model back as a history entry has it, on the canvas the
    // entry was taken on (undo and redo).
    const _restoreHistoryEntry = (entry: HistoryEntry): void => {
      // The exploration keeps its places through a step (no step holds
      // them), and a step taken on it goes back to it while it is open.
      const exploration = get().exploration
      if (onExploration(get())) get()._saveShownCanvas()
      const backOnExploration = !!exploration && entry.explorationId === exploration.id
      const canvasChanged = (backOnExploration ? exploration!.id : entry.activeViewId) !== get().activeViewId
      set((state) => {
        state.c4Nodes = entry.c4Nodes as any
        state.c4Relations = entry.c4Relations as any
        // What a view is looking at (the hierarchy's drill level, the wiki's
        // page, the table's tab) is like a camera: no step takes it back.
        // Restored with the views, Undo of a drag reset the hierarchy to the
        // top, and that was saved.
        let views = entry.views as Record<string, DiagramView>
        for (const [id, v] of Object.entries(entry.views as Record<string, DiagramView>)) {
          const now = state.views[id] as DiagramView | undefined
          if (!now || (now.treemapFocusId === v.treemapFocusId && now.wikiFocusId === v.wikiFocusId && now.tableActiveTab === v.tableActiveTab)) continue
          if (views === entry.views) views = { ...views }
          views[id] = { ...v, treemapFocusId: now.treemapFocusId, wikiFocusId: now.wikiFocusId, tableActiveTab: now.tableActiveTab } as DiagramView
        }
        state.views = views as any
        state.defaultLayoutConstraints = entry.defaultLayoutConstraints as any
        state.defaultEdgeStyle = entry.defaultEdgeStyle
        state.defaultPositions = entry.defaultPositions as any
        // A view the entry knows may be gone when the entry is older than
        // the view; its positions are All elements' then.
        state.activeViewId = entry.activeViewId && entry.views[entry.activeViewId] ? entry.activeViewId : null
        state.sequences = entry.sequences as any
        if (entry.hubTemplates) state.hubTemplates = entry.hubTemplates as any
        if (entry.metamodel) state.metamodel = entry.metamodel as any
        if (state.activeSequenceId && !entry.sequences[state.activeSequenceId]) state.activeSequenceId = null
        // The milestones as the step had them; a slide that showed one
        // deleted since shows it again, one that shows one gone shows the
        // live model. Other links are Presenter's and stay: one Presenter
        // took off a milestone still there came back with any step undone.
        if (entry.snapshots) {
          const before = new Set(state.snapshots.map((m) => m.id))
          state.snapshots = entry.snapshots as any
          const ids = new Set(entry.snapshots.map((m) => m.id))
          for (const pres of state.presentations) {
            for (const slide of pres.slides) {
              const was = entry.slideMilestones?.[slide.id]
              if (slide.snapshotId && !ids.has(slide.snapshotId)) unlinkSlide(slide)
              else if (!slide.snapshotId && was && ids.has(was) && !before.has(was)) relinkSlide(slide, was)
            }
            if (pres.id === state.activePresentationId) state.presentationSlides = pres.slides
          }
        }
        // A milestone's steps are its edits: with them all undone there is
        // nothing to keep or drop.
        if (state.activeSnapshotId && entry.milestoneDirty !== undefined) {
          state.milestoneDirty = entry.milestoneDirty
          if (!entry.milestoneDirty) state.milestonePromptOpen = false
        }
        state.canUndo = _undoStack.length > 0
        state.canRedo = _redoStack.length > 0
      })
      // On drafts of the nodes: above they are the entry's own, frozen.
      if (backOnExploration) set((state) => {
        if (!state.exploration) return
        state.activeViewId = state.exploration.id
        const places = state.exploration.positions as Record<string, NodePosition>
        if (Object.keys(places).length) showCanvasPositions(state.c4Nodes as Record<string, C4Node>, places, state.exploration as DiagramView, state.c4Relations as Record<string, C4Relation>)
      })
      // A view of a viewpoint follows the metamodel as the step has it. On
      // drafts of the views: in the pass above they are the entry's own,
      // frozen, and changing them threw once the step was off the stack
      // (Undo after "Save as viewpoint… → Replace").
      set((state) => { syncViewpointsOfLive(state as DiagramStore) })
      get()._sync()
      if (canvasChanged && typeof window !== 'undefined') {
        const viewId = get().activeViewId
        const camera = (viewId ? viewById(get(), viewId)?.viewport : get().defaultViewport) ?? null
        const shown = get().rfNodes.filter((n) => !n.hidden).map((n) => n.id)
        ;(window as any).__rfPlaceCamera?.(camera, shown)
      }
      _liveLayout?.reset()
    }

    // An entry is put back as it is; a step from before an outside change
    // is made on the model as it is now (`now`), keeping that change.
    const _restoreHistoryItem = (item: HistoryItem, now: HistoryEntry, action: 'Undo' | 'Redo'): void => {
      if (isExplorationStep(item)) return
      if (!isStepChange(item)) { _restoreHistoryEntry(item); return }
      const { entry, conflicts, kept, dropped, notices } = _rebasedEntry(item, now, !!get().activeSnapshotId)
      _restoreHistoryEntry(entry)
      const list = (names: string[]): string => names.slice(0, 5).join('; ') + (names.length > 5 ? ` and ${names.length - 5} more` : '')
      if (conflicts.length) {
        get().pushNotification(`${action} kept what was changed outside Studio since that step: ${list(conflicts)}.`, 'info')
      }
      if (kept.length) {
        get().pushNotification(`${action} kept what was built on outside Studio since that step: ${list(kept)}.`, 'info')
      }
      if (dropped.length) {
        get().pushNotification(`${action} left out what needs an element removed outside Studio since that step: ${list(dropped)}.`, 'info')
      }
      if (notices.length) get().pushNotification(`${action}: ${list(notices)}.`, 'info')
    }

    // addNode plus its wizard links, as one undo step.
    /**
     * Where a new element goes inside its parent. Dropped on a collapsed
     * container, the drop point is a point of its small box, not a place
     * inside it: taken as one, the element lay on the header once the
     * container was opened (and stayed there when the container was pinned,
     * which holds what is in it). It goes beside the others in it instead.
     * Centred on the drop point in a parent drawn smaller than the element
     * (a state with no states yet), it began above and left of the parent:
     * it is kept below the header and right of the side padding.
     */
    const _placeNewChild = <T extends Omit<C4Node, 'id'>>(node: T): T => {
      const { c4Nodes, activeViewId } = get()
      const parent = node.parentId ? c4Nodes[node.parentId] : undefined
      if (!parent) return node
      const view = viewById(get(), activeViewId)
      if (nodeEffectivelyCollapsedInView(parent, activeViewId, view)) {
        const shown = view ? computeViewNodeSet(view, c4Nodes, get().c4Relations) : null
        return { ...node, ...placeBesideSiblings(c4Nodes, parent.id, (s) => !shown || shown.has(s.id)) }
      }
      const pad = compoundPadding(parent.type)
      return { ...node, x: Math.max(node.x, pad.side), y: Math.max(node.y, pad.top) }
    }

    /**
     * An element the user adds (the palette, a wizard, a + row): a container
     * holds nothing yet, so the canvas draws it at its folded size, and it is
     * stored at that size (its parent then frames what is drawn; it grows
     * once something goes in it); in a parent it goes to the next cell of the
     * grid of the parent's children, the first centred in the parent as it
     * will be fitted to hold it, whatever the drop point. What other callers
     * add (a paste, an import, an agent) keeps the place and size it has.
     */
    const _placeInGrid = <T extends Omit<C4Node, 'id'>>(node: T): T => {
      const sized = isContainerType(node.type) && !node.collapsed ? { ...node, ...drawnSize(node as unknown as C4Node, false) } : node
      const { c4Nodes, activeViewId } = get()
      const parent = sized.parentId ? c4Nodes[sized.parentId] : undefined
      const view = viewById(get(), activeViewId)
      if (!parent || nodeEffectivelyCollapsedInView(parent, activeViewId, view)) return sized
      const shown = view ? computeViewNodeSet(view, c4Nodes, get().c4Relations) : null
      const size = { width: sized.width, height: sized.height }
      const pad = compoundPadding(parent.type)
      const fitted = fittedParentSize(parent, [{ x: pad.side, y: pad.top, ...size }])
      return { ...sized, ...gridSlotIn(c4Nodes, parent.id, size, (c) => !shown || shown.has(c.id), fitted) }
    }

    /** An undo step of the exploration's undone or redone: it is as it was
     *  (`x`, its places included), shown. */
    const _restoreExploration = (x: Exploration): void => {
      if (get().exploration?.id !== x.id) return
      if (!onExploration(get())) {
        set((state) => { state.exploration = x as any })
        get().setActiveView(x.id)
      } else {
        set((state) => {
          state.exploration = x as any
          applyPositions(state.c4Nodes as Record<string, C4Node>, x.positions as Record<string, NodePosition>)
        })
        get()._sync()
        _liveLayout?.reset()
      }
      set((state) => { state.canUndo = _undoStack.length > 0; state.canRedo = _redoStack.length > 0; state.exploreMenuFor = null })
    }

    /** The exploration shown becomes `next` (grown by a +, folded by a −),
     *  laid out again as a whole (exploration.laidOut) with its start where
     *  it is drawn. In Designer an undo step: of the temporary
     *  exploration's own, or like any edit of a view of the document's (and
     *  saved); in Viewer a view of the document's is put back as it was
     *  saved once it or Viewer is left. The camera then shows `show`, with
     *  `from` in view. */
    const _reshapeExploration = (next: Exploration, show: string[], from: string[], record = true, expansion?: string): void => {
      const s = get()
      const x = shownExploration(s)
      if (!x || x.id !== next.id) return
      const temporary = s.exploration?.id === x.id
      const designer = s.appMode === 'designer'
      const step: ExplorationStep | null = temporary && record && designer ? { explored: explorationNow(s)!, ...(expansion ? { expansion } : {}) } : null
      if (step) _pushExplorationStep(step)
      if (!temporary && record) {
        if (designer) {
          get()._pushUndo()
          get()._milestoneViewEdit(x.id)
        } else if (!_viewerExplorations.has(x.id)) _viewerExplorations.set(x.id, x)
      }
      // Its start where it is drawn (or what it lists first, without it).
      const start = [next.explore.start, ...next.nodeIds].find((id) => !!s.c4Nodes[id])
      const at = start ? { x: s.c4Nodes[start].x, y: s.c4Nodes[start].y } : undefined
      const places = layExploration(next, s.c4Nodes, s.c4Relations, at)
      const hidden = explorationLines(next, s.c4Nodes, s.c4Relations).hidden
      set((state) => {
        const shaped = { ...next, positions: places, hiddenRelationIds: hidden }
        if (temporary) state.exploration = shaped as any
        else if (state.views[x.id]) state.views[x.id] = shaped as any
        state.exploreMenuFor = null
        applyPositions(state.c4Nodes as Record<string, C4Node>, places)
        state.canUndo = _undoStack.length > 0
        state.canRedo = _redoStack.length > 0
      })
      if (step && expansion) step.after = explorationNow(get())!
      get()._sync()
      // Taken as they are: the physics moves nothing.
      _liveLayout?.reset()
      if (show.length) (window as any).__rfShowAdded?.(show.filter((id) => !!get().c4Nodes[id]), from)
    }

    /** The arguments of checkRemoveNodeType / checkRemoveRelationType: the
     *  live model (parked in liveBackup while a milestone is open), and
     *  every milestone, with the one open as it is on screen. */
    const _typeHolders = (typeId: string): [model.ModelState, string, model.MilestoneContent[]] => {
      const s = get()
      const open = s.activeSnapshotId && s.liveBackup ? s.snapshots.find((m) => m.id === s.activeSnapshotId) : undefined
      const live = open ? { ...s, c4Nodes: s.liveBackup!.nodes, c4Relations: s.liveBackup!.relations } : s
      const milestones: model.MilestoneContent[] = [...s.snapshots, ...(open ? [{ name: open.name, nodes: s.c4Nodes, relations: s.c4Relations }] : [])]
      return [live as unknown as model.ModelState, typeId, milestones]
    }

    /** Gives `ids` (added, or else moved) their places on the other canvases
     *  (placesOnOtherCanvases). */
    const _placeOnOtherCanvases = (ids: readonly string[], added = true): void => {
      const places = placesOnOtherCanvases(get(), ids, added)
      if (places.size) set((state) => { writeOtherCanvases(state as DiagramStore, places) })
    }

    const _createNodeWithLinks = (draft: Omit<C4Node, 'id'>, links: WizardLink[]): string => {
      const node = _placeNewChild(draft)
      const refused = model.checkAddNode(get(), node)
      if (refused) {
        get().pushNotification(refused, 'error')
        return ''
      }
      const id = uid()
      // A link the rules refuse (a second state machine for an entity, from
      // an Entity lifecycles + row) refuses the element: added without it,
      // it was what the validation then flagged.
      const s0 = get()
      const withNode = { ...s0, c4Nodes: { ...s0.c4Nodes, [id]: { id, ...node } as C4Node } } as unknown as model.ModelState
      for (const link of links) {
        if (!s0.c4Nodes[link.otherId]) continue
        const rel = link.direction === 'out' ? { sourceId: id, targetId: link.otherId, relationType: link.relationType } : { sourceId: link.otherId, targetId: id, relationType: link.relationType }
        const linkRefused = model.checkAddRelation(withNode, rel)
        if (linkRefused) {
          get().pushNotification(linkRefused, 'error')
          return ''
        }
      }
      get()._pushUndo()
      // In a milestone, an edit of the view it is listed in too (its list is
      // the live view's): it went into the saved live view, and stayed
      // after Discard.
      if (get().activeViewId) get()._milestoneViewEdit(get().activeViewId)
      else get()._markMilestoneEdit()
      set((state) => {
        insertNodeShown(state as DiagramStore, id, node)
        _insertWizardLinks(state, id, links)
      })
      if (node.parentId) get().fitParentToChildren(node.parentId)
      _placeOnOtherCanvases([id])
      get()._sync()
      _liveLayout?.invalidate(node.parentId ? [id, node.parentId] : [id])
      return id
    }

    return {
      c4Nodes: initNodes,
      c4Relations: initRelations,
      sequences: (persisted?.sequences
        ? Object.fromEntries(persisted.sequences.map(s => [s.id, s]))
        : {}) as Record<string, DiagramSequence>,
      activeSequenceId: null,
      views: initViews,
      activeViewId: null,
      defaultPositions: initDefaultPositions,
      defaultViewport: persisted?.defaultViewport ?? null,
      defaultLayoutConstraints: persisted?.defaultLayoutConstraints ?? [],
      defaultEdgeStyle: persisted?.defaultEdgeStyle ?? 'curved',
      exploration: null,
      exploreMore: null,
      exploreFoldable: null,
      exploreMenuFor: null,
      rfNodes: deriveRFNodes(initNodes),
      rfEdges: deriveRFEdges(initNodes, initRelations),
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      layoutMode: 'radical',
      isLayoutRunning: false,
      smartLayoutProgress: null,
      lastSmartLayoutReport: null,
      liveLayoutActive: true,
      liveLayoutMoving: false,
      allEdgeLabelsShown: false,
      lowDetail: false,
      setLowDetail(low) {
        if (get().lowDetail !== low) set((state) => { state.lowDetail = low })
      },
      connectSource: null,
      relinking: null,
      relationTypeChoice: null,
      connectionModifier: 'alt' as const,
      autoFitActive: loadStudioSettings().smartFit,
      selectionFocus: loadStudioSettings().selectionFocus,
      canUndo: false,
      canRedo: false,
      snapshots: initSnapshots,
      activeSnapshotId: null,
      liveBackup: null,
      milestoneDirty: false,
      milestonePromptOpen: false,
      pendingDelete: null,
      nodeWizard: null,
      diffHighlight: {},
      diffBaseSnapshotId: null,
      diffGhostNodes: {},
      diffGhostRelations: {},
      showDiff: false,
      branch: null,
      appMode: (viewerProfile ? 'viewer' : 'designer') as 'viewer' | 'designer',
      metamodel: initMetamodel,
      hubTemplates: (persisted?.hubTemplates ?? {}) as Record<string, HubImportRecord>,
      hubMeta: persisted?.hub ?? null,
      notifications: [],
      presentations: initPres.presentations,
      activePresentationId: initPres.activeId,
      presentationSlides: initPres.presentations[0].slides,
      presentationActive: false,
      presentationSlideIndex: 0,
      slideTreemapFocus: null,
      slideWikiPage: null,

      // ── sync helper ──────────────────────────────────────────────────────
      _sync() {
        // A group of views of one element holds a view of each such element
        // (not while a milestone, with its own elements, is on screen).
        if (!get().activeSnapshotId) {
          const plan = model.planViewGroups(get() as unknown as model.ModelState)
          if (plan.add.length || plan.remove.length || plan.refolder.length || plan.unlist.length || plan.rename.length) {
            set((state) => { model.syncViewGroups(state as unknown as model.ModelState, uid) })
          }
        }
        // The exploration shown: flat, its lines only, each element's + and −.
        const s0 = get()
        const x = shownExploration(s0)
        const xActive = !!x && (s0.appMode === 'designer' || s0.appMode === 'viewer') && !s0.presentationActive
        const xLines = x ? explorationLines(x, s0.c4Nodes, s0.c4Relations) : null
        const xNodes = x ? flatNodes(x, s0.c4Nodes) : null
        const xRels = xLines ? Object.fromEntries(xLines.relations.map((id) => [id, s0.c4Relations[id]])) : null
        const more = x && xActive ? linkCounts(explorationLinks(x, s0.c4Nodes, s0.c4Relations)) : null
        const foldables = x && xActive ? foldable(x, s0.c4Nodes) : null
        set((state) => {
          state.exploreMore = more
          state.exploreFoldable = foldables
          if (!xActive) state.exploreMenuFor = null
          const view = viewById(state as DiagramStore, state.activeViewId)
          // Merge diff ghosts (items removed in the active milestone but
          // present in the diff base) so the user can see what's gone.
          // The ghosts are kept in a separate map so they never end up in
          // the real c4Nodes / c4Relations on save.
          const ghostNodes = state.diffGhostNodes as Record<string, C4Node>
          const ghostRels = state.diffGhostRelations as Record<string, C4Relation>
          const hasGhosts = state.showDiff && (Object.keys(ghostNodes).length > 0 || Object.keys(ghostRels).length > 0)
          const liveNodes = state.c4Nodes as Record<string, C4Node>
          const liveRels = state.c4Relations as Record<string, C4Relation>
          const mergedNodes: Record<string, C4Node> = xNodes ?? (hasGhosts ? { ...ghostNodes, ...liveNodes } : liveNodes)
          const mergedRels: Record<string, C4Relation> = xRels ?? (hasGhosts ? { ...ghostRels, ...liveRels } : liveRels)
          // A canvas view with a chain in its steps draws what the chain
          // gives; the exploration what it lists, flat.
          const filter = x ? new Set(listedIds(x, mergedNodes)) : computeViewNodeSet(view as DiagramView | undefined, mergedNodes, mergedRels)
          const vcs = computeViewCollapsedSet(filter, mergedNodes)
          // Also include nodes the user explicitly collapsed in this named view
          if (view?.collapsedNodeIds?.length) {
            for (const nid of view.collapsedNodeIds) vcs.add(nid)
          }
          // Nodes explicitly expanded in this view override model-level
          // collapse, and so do its frames: it draws them only to hold what
          // it shows.
          const frames = x ? new Set<string>() : viewFrames(view as DiagramView | undefined, mergedNodes, mergedRels)
          const expandedSet = x ? undefined : viewExpandedSet(view as DiagramView | undefined, mergedNodes, mergedRels, frames)
          const ghostIdSet = hasGhosts && !x ? new Set(Object.keys(ghostNodes)) : undefined
          // A ghost has the base's place, laid out for All elements: on this
          // canvas it goes inside its container's frame, clear of the rest.
          const drawnNodes = ghostIdSet ? placeGhosts(mergedNodes, ghostIdSet, filter) : mergedNodes
          // "locked" disables drag + selection. Metamodel mode is the only
          // truly read-only mode; designer is always editable; viewer and
          // presenter are "explore" modes (drag + collapse allowed,
          // mutations sandboxed by the setAppMode snapshot/restore).
          // While a presentation is active we also lock — slides are
          // static and must not drift from accidental drags.
          const locked = state.appMode === 'metamodel' || state.presentationActive
          state.rfNodes = deriveRFNodes(drawnNodes, filter, vcs, ghostIdSet, locked, expandedSet, frames) as any
          // The exploration is flat: its elements, and their + and −, lie
          // over its lines.
          if (x) for (const n of state.rfNodes) n.zIndex = 10
          const chainHidden = chainHiddenRelations(view as DiagramView | undefined, mergedNodes, mergedRels)
          const hiddenRels = view?.hiddenRelationIds?.length || chainHidden.length
            ? new Set([...(view?.hiddenRelationIds ?? []), ...chainHidden])
            : undefined
          // Lines end only at elements the view shows, not at its frames.
          const lineEnds = filter && frames.size ? new Set([...filter].filter((id) => !frames.has(id))) : filter
          const derivedEdges = deriveRFEdges(drawnNodes, mergedRels, lineEnds, vcs, hiddenRels, expandedSet, state.metamodel as Metamodel | undefined)
          // The exploration's containment lines: a child and its parent on
          // the next level, joined (it draws them apart). Not relations of
          // the model: drawn only.
          for (const { parent, child } of xLines?.containment ?? []) {
            derivedEdges.push({
              id: `contains:${parent}:${child}`,
              source: parent,
              target: child,
              type: 'c4relation',
              animated: false,
              deletable: false,
              focusable: false,
              className: 'rf-edge-flow',
              zIndex: 5,
              // From the parent, which contains the child.
              markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
              label: 'Contains',
              data: { originalSourceId: parent, originalTargetId: child, label: 'Contains', isVirtual: true },
            } as Edge<C4EdgeRFData>)
          }
          // Annotate edges with step numbers:
          // 1. When actively editing a sequence (activeSequenceId set) — always show numbers
          // 2. When view is dynamic and linked to a sequence — show numbers in view mode
          const editingSeq = state.activeSequenceId
            ? (state.sequences as Record<string, DiagramSequence>)[state.activeSequenceId]
            : undefined
          const viewSeq = (!editingSeq && view?.kind === 'dynamic' && view.sequenceId)
            ? (state.sequences as Record<string, DiagramSequence>)[view.sequenceId]
            : undefined
          const annotateSeq = editingSeq ?? viewSeq
          if (annotateSeq && annotateSeq.relationIds.length > 0) {
            // Build a map from relationId → all 1-based step indices (same
            // relation can appear multiple times in one sequence).
            // A backward step (a response) is numbered apart, at the
            // relation's target end, where it starts.
            const seqIndex = new Map<string, number[]>()
            const backIndex = new Map<string, number[]>()
            annotateSeq.relationIds.forEach((id, i) => {
              const index = isBackwardStep(annotateSeq, i) ? backIndex : seqIndex
              const arr = index.get(id)
              if (arr) arr.push(i + 1)
              else index.set(id, [i + 1])
            })
            for (const edge of derivedEdges) {
              const steps = seqIndex.get(edge.id)
              const back = backIndex.get(edge.id)
              if (steps !== undefined && edge.data) edge.data.sequenceStep = steps
              if (back !== undefined && edge.data) edge.data.sequenceStepBack = back
            }
          }
          state.rfEdges = derivedEdges as any
          // What is selected and gone (taken back by an undo, not in the
          // milestone opened) is selected no more: it left an empty
          // properties card and "1 node selected".
          if (state.selectedNodeIds.some((id) => !mergedNodes[id]) || (state.selectedNodeId && !mergedNodes[state.selectedNodeId])) {
            state.selectedNodeIds = state.selectedNodeIds.filter((id) => !!mergedNodes[id])
            state.selectedNodeId = state.selectedNodeIds[0] ?? null
          }
          const edgeId = state.selectedEdgeId
          if (edgeId && !mergedRels[edgeId] && !derivedEdges.some((e) => e.id === edgeId)) state.selectedEdgeId = null
          // The nodes and edges are rebuilt: keep the selection painted.
          mirrorSelection(state as DiagramStore)
        })
      },

      /** Push current state to undo stack and sync canUndo/canRedo flags */
      _pushUndo() {
        _pushUndo(get())
        set((state) => { state.canUndo = _undoStack.length > 0; state.canRedo = _redoStack.length > 0 })
      },

      /** Mark milestone as dirty if currently editing one (auto-opens prompt on first edit). */
      _markMilestoneEdit() {
        const { activeSnapshotId, milestoneDirty, appMode } = get()
        if (!activeSnapshotId || _revealing) return
        // Milestones are read-only outside designer mode — ignore edit signals
        // so viewer/presenter can browse historical state without ever being
        // pushed into the "unsaved milestone changes" workflow.
        if (appMode !== 'designer') return
        if (milestoneDirty) return
        set((state) => {
          state.milestoneDirty = true
          state.milestonePromptOpen = true
        })
      },

      _milestoneViewEdit(viewId) {
        const { activeSnapshotId, appMode, liveBackup, views, defaultPositions, defaultLayoutConstraints } = get()
        if (!activeSnapshotId || appMode !== 'designer' || !liveBackup) return
        // Views are the live model's and every milestone's: what is done on
        // one while a milestone is shown (a collapse, Hide from view, an
        // alignment, a pin, its filter) went into the live view at once, was
        // saved, and stayed after Discard.
        const ids = viewId === 'every' ? Object.keys(views) : viewId ? [viewId] : []
        set((state) => {
          const backup = state.liveBackup!
          for (const id of ids) {
            if (!views[id] || backup.views?.[id]) continue
            backup.views = { ...backup.views, [id]: views[id] }
          }
          if (viewId === 'every' && !backup.defaultPositions) backup.defaultPositions = defaultPositions as any
          if ((viewId === null || viewId === 'every') && !backup.defaultLayoutConstraints) backup.defaultLayoutConstraints = defaultLayoutConstraints as any
        })
        get()._markMilestoneEdit()
      },

      // ── nodes ────────────────────────────────────────────────────────────
      addNode(node) {
        // Cardinality and parent containment (metamodel rules)
        const refused = model.checkAddNode(get(), node)
        if (refused) {
          get().pushNotification(refused, 'error')
          return ''
        }
        get()._pushUndo()
        // In a milestone, an edit of the view it is listed in too.
        if (get().activeViewId) get()._milestoneViewEdit(get().activeViewId)
        else get()._markMilestoneEdit()
        const id = uid()
        node = _placeNewChild(node)
        set((state) => { insertNodeShown(state as DiagramStore, id, node) })
        // Expand parent to fit the new child
        if (node.parentId) {
          get().fitParentToChildren(node.parentId)
        }
        _placeOnOtherCanvases([id])
        get()._sync()
        // It stays where it was dropped; what it (or the parent it grew,
        // where this canvas does not draw it) covers is pushed clear.
        _liveLayout?.invalidate(node.parentId ? [id, node.parentId] : [id])
        return id
      },

      addNodes(items) {
        const ids: string[] = []
        const place = createBatchPlacer(() => get().c4Nodes)
        for (const { node: unplaced, links = [] } of items) {
          const node = { ...unplaced, ...place(unplaced.parentId ?? undefined) }
          // Checked one by one: a node added before may fill a cardinality.
          const refused = model.checkAddNode(get(), node)
          if (refused) {
            get().pushNotification(refused, 'error')
            break
          }
          if (ids.length === 0) {
            get()._pushUndo()
            // In a milestone, an edit of the view they are listed in too.
            if (get().activeViewId) get()._milestoneViewEdit(get().activeViewId)
            else get()._markMilestoneEdit()
          }
          const id = uid()
          set((state) => {
            insertNodeShown(state as DiagramStore, id, node)
            _insertWizardLinks(state, id, links)
          })
          ids.push(id)
        }
        if (ids.length === 0) return ids
        const parents = new Set(ids.map((id) => get().c4Nodes[id]?.parentId).filter((p): p is string => !!p))
        for (const parentId of parents) get().fitParentToChildren(parentId)
        _placeOnOtherCanvases(ids)
        get()._sync()
        _liveLayout?.invalidate([...ids, ...parents])
        return ids
      },

      // ── node wizard ──────────────────────────────────────────────────────
      requestCreateNode(node, opts = {}) {
        node = _placeInGrid(node)
        const links = opts.links ?? []
        const wizard = wizardFor(get().metamodel, node.type, 'create')
        if (wizard && !opts.skipWizard && loadStudioSettings().nodeWizardOnCreate) {
          // Refuse up front rather than after the user has filled it all in.
          const refused = model.checkAddNode(get(), node)
          if (refused) {
            get().pushNotification(refused, 'error')
            return ''
          }
          _wizardOnCreated = opts.onCreated
          set((state) => { state.nodeWizard = { mode: 'create', draft: node, initialLinks: links } })
          return ''
        }
        const id = links.length ? _createNodeWithLinks(node, links) : get().addNode(node)
        if (id) opts.onCreated?.(id)
        return id
      },

      openNodeWizard(nodeId) {
        const node = get().c4Nodes[nodeId]
        if (!node || !wizardFor(get().metamodel, node.type)) return
        _wizardOnCreated = undefined
        set((state) => { state.nodeWizard = { mode: 'edit', nodeId } })
      },

      finishNodeWizard(values, links) {
        const session = get().nodeWizard
        if (!session) return ''

        if (session.mode === 'create') {
          const node = { ...session.draft, ...values } as Omit<C4Node, 'id'>
          if (!String(node.label ?? '').trim()) node.label = session.draft.label
          const id = _createNodeWithLinks(node, links)
          if (!id) return ''
          set((state) => { state.nodeWizard = null })
          const onCreated = _wizardOnCreated
          _wizardOnCreated = undefined
          onCreated?.(id)
          return id
        }

        const id = session.nodeId
        const node = get().c4Nodes[id] as (C4Node & Record<string, unknown>) | undefined
        const wizard = node ? wizardFor(get().metamodel, node.type) : undefined
        if (!node || !wizard) {
          set((state) => { state.nodeWizard = null })
          return ''
        }
        // Only write what changed — a lazily-loaded description the wizard
        // never saw must not be overwritten with its empty field.
        const patch: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(values)) {
          if (String(value ?? '') !== String(node[key] ?? '')) patch[key] = value
        }
        if ('label' in patch && !String(patch.label ?? '').trim()) delete patch.label
        const before = wizardLinksOf(wizard, id, get().c4Relations)
        const removed = before.filter((b) => !links.some((l) => sameWizardLink(l, b)))
        const added = links.filter((l) => !before.some((b) => sameWizardLink(l, b)))

        if (Object.keys(patch).length || removed.length || added.length) {
          get()._pushUndo()
          get()._markMilestoneEdit()
          set((state) => {
            keepingSharedViews(state as DiagramStore, () => model.patchNode(state, id, patch))
            for (const r of removed) model.deleteRelation(state, r.relationId)
            _insertWizardLinks(state, id, added)
          })
          get()._sync()
          if (removed.length || added.length) _liveLayout?.invalidate()
        }
        set((state) => { state.nodeWizard = null })
        return id
      },

      cancelNodeWizard() {
        _wizardOnCreated = undefined
        set((state) => { state.nodeWizard = null })
      },

      updateNode(id, updates) {
        if (!get().c4Nodes[id]) return
        // A parent change alone is a move: the element keeps its place on
        // the canvas and both parents are refit, as "Move to…" does. Patched
        // as a field, the element kept its old offset under the new parent
        // and lay outside it.
        const keys = Object.keys(updates)
        if (keys.length === 1 && keys[0] === 'parentId') {
          get().reparentNodes([id], (updates.parentId as string | null | undefined) ?? null)
          return
        }
        // Nothing changes: no step (a cell opened and left without typing
        // made an undo step that did nothing).
        const existing = get().c4Nodes[id] as unknown as Record<string, unknown>
        if (Object.entries(updates).every(([k, v]) => existing[k] === v)) return
        // A reparent or retype must respect the metamodel's containment rules.
        const refused = model.checkNodeUpdate(get(), id, updates)
        if (refused) {
          get().pushNotification(refused, 'error')
          return
        }
        _pushTextEdit(get(), `node:${id}:${keys.sort().join(',')}`, (state) => model.patchNode(state, id, updates))
        get()._markMilestoneEdit()
        set((state) => { keepingSharedViews(state as DiagramStore, () => model.patchNode(state, id, updates)) })
        get()._sync()
        // Only wake the live layout if the change actually affects geometry
        // or graph topology. Editing label / description / technology must
        // NOT trigger a cola rebuild — cola would then re-run from scratch
        // and visibly drift the diagram toward its spring equilibrium
        // (typically up-and-left). Pure text edits are a no-op for layout.
        const LAYOUT_KEYS = ['x', 'y', 'width', 'height', 'parentId', 'type', 'collapsed'] as const
        if (LAYOUT_KEYS.some((k) => k in updates)) {
          _liveLayout?.invalidate()
        }
      },

      removeNode(id) {
        get()._pushUndo()
        get()._markMilestoneEdit()
        // The node, its descendants, their relations, every view reference,
        // and the views of one element that it is.
        let placed: string[] | null = null
        set((state) => {
          const active = state.activeViewId
          keepingSharedViews(state as DiagramStore, () => model.deleteNode(state, id))
          if (active && !state.views[active]) {
            // Its view was on screen: back to All elements' positions.
            placed = showCanvasPositions(state.c4Nodes as Record<string, C4Node>, state.defaultPositions as Record<string, NodePosition>, undefined, state.c4Relations as Record<string, C4Relation>)
          }
        })
        get()._sync()
        // A row or column through what it leaves holds now, as a reload
        // would draw it: a container left without children is drawn at its
        // folded size, and its middle left the line.
        let snapped = false
        const input = layoutInputForView(get())
        if (input.alignments.length) set((state) => { snapped = applyAlignments(state.c4Nodes, input) })
        if (snapped) get()._sync()
        if (placed || snapped) _liveLayout?.reset(placed ?? [])
        else _liveLayout?.invalidate()
      },

      runAsOneStep(action) {
        _asOneStep(action)
      },
      beginTyping() {
        _typing = _typingAtQuestion ?? { key: '', step: null }
        _typingAtQuestion = null
      },
      endTyping() {
        _typingAtQuestion = get().milestonePromptOpen ? _typing : null
        _typing = null
      },

      requestDelete(nodeIds) {
        if (!nodeIds.length || get().appMode !== 'designer') return
        set((state) => { state.pendingDelete = { nodeIds, edgeIds: [] } })
      },

      removeNodes(ids) {
        _asOneStep(() => {
          for (const id of ids) if (get().c4Nodes[id]) get().removeNode(id)
        })
      },

      expandAncestors(nodeId) {
        const chain: string[] = []
        const seen = new Set<string>()
        let cur = get().c4Nodes[nodeId]?.parentId
        while (cur && !seen.has(cur)) {
          seen.add(cur)
          chain.push(cur)
          cur = get().c4Nodes[cur]?.parentId
        }
        // Outermost first, so that each container opens inside one that is
        // open already. Whether one is collapsed is a matter of the canvas
        // shown: collapse is per view. Showing an element is no edit of the
        // milestone shown: it asked how to save the milestone.
        const was = _revealing
        _revealing = true
        try {
          _asOneStep(() => {
            for (const id of chain.reverse()) {
              const { c4Nodes, activeViewId, views } = get()
              const node = c4Nodes[id]
              if (node && nodeEffectivelyCollapsedInView(node, activeViewId, viewById({ views, exploration: get().exploration }, activeViewId))) {
                get().toggleCollapse(id)
              }
            }
          })
        } finally {
          _revealing = was
        }
      },

      toggleCollapse(id) {
        // Blocked while a presentation is active — slides are static and
        // their layout (positions + collapsed state) must not drift.
        if (get().presentationActive) return
        // Allowed in every mode. In viewer/presenter ("explore" mode), the
        // resulting mutations to c4Nodes / view positions are sandboxed:
        // the snapshot taken in setAppMode() on the way out of designer is
        // restored when the user returns to designer, and the auto-persist
        // subscriber is gated on appMode === 'designer' so nothing reaches
        // disk. We therefore only push to undo history while editing.
        const inDesigner = get().appMode === 'designer'
        // A fold of the exploration is none of the model's steps.
        if (inDesigner && !onExploration(get())) get()._pushUndo()
        // In a milestone, an edit of it (a view's folds are the live view's).
        if (get().activeViewId) get()._milestoneViewEdit(get().activeViewId)
        else get()._markMilestoneEdit()
        const activeViewId = get().activeViewId
        const modelCollapsed = get().c4Nodes[id]?.collapsed === true
        // Effective collapsed: model-level OR per-view collapse for named views.
        // A model-collapsed node can be view-expanded via view.expandedNodeIds.
        const prevCollapsed = activeViewId
          ? ((modelCollapsed && !(viewById(get(), activeViewId)?.expandedNodeIds?.includes(id) ?? false))
              || (viewById(get(), activeViewId)?.collapsedNodeIds?.includes(id) ?? false))
          : modelCollapsed
        // An element the view shown does not draw (one an agent added,
        // folded from the search or the Nodes tree) only changes the fold
        // the view keeps: nothing on the canvas grows or shrinks. Laid out
        // as drawn, the expand made room round a box the canvas has not
        // got and threw (item 259).
        const viewShown = activeViewId ? get().views[activeViewId] : undefined
        const drawnHere = computeViewNodeSet(viewShown as any, get().c4Nodes, get().c4Relations)?.has(id) ?? true
        // Folded in the model and opened on a view that draws none of its
        // children, it is drawn there at its open size all the same (the
        // view opens it over the model's fold: deriveRFNodes). Measured
        // below as it will be drawn: opened in the model for the toggle, it
        // counted as a container drawn without children, at its folded size,
        // no room was made, and it opened over the container beside it.
        const shownWhere = drawnHere && viewShown ? computeViewNodeSet(viewShown as any, get().c4Nodes, get().c4Relations) : undefined
        const openedEmpty = !!shownWhere && modelCollapsed && prevCollapsed
          && !Object.values(get().c4Nodes).some((c) => c.parentId === id && shownWhere.has(c.id))
        // Apply to model temporarily — layout helpers below (separateSiblings /
        // fitParentToChildren) query node.collapsed to compute effective sizes.
        set((state) => {
          const node = state.c4Nodes[id]
          if (!node) return
          node.collapsed = openedEmpty ? true : !prevCollapsed
        })

        // ── Expand origin: ensure children appear at their saved positions ─
        // When opening a parent, children hold their last known parent-relative
        // x/y. We want to PRESERVE those so the layout looks the same as before
        // the collapse. Only children that were never laid out (x≈0, y≈0) get
        // a tight cluster seed so cola has a non-degenerate starting point.
        // Seeding live cola with the correct absolute position prevents the
        // "teleport, then drift" jump that would occur if cola treated the
        // node as brand-new and spawned it at neighbours' average.
        if (prevCollapsed && drawnHere) {
          const allNodes = get().c4Nodes
          const parent = allNodes[id]
          if (parent && isContainerType(parent.type)) {
            const HEADER_OFFSET = (parent.type === 'container') ? 110 : 120
            const PAD = 24
            const children = Object.values(allNodes).filter((c) => c.parentId === id)
            if (children.length > 0) {
              // Compute parent's absolute top-left by walking the ancestor chain.
              let absX = parent.x
              let absY = parent.y
              let cur: C4Node | undefined = parent
              while (cur?.parentId) {
                const p: C4Node | undefined = allNodes[cur.parentId]
                if (!p) break
                absX += p.x
                absY += p.y
                cur = p
              }

              // Grow around the collapsed box's centre: the frame the
              // children open to (the one fitParentToChildren gives them,
              // header and margins included) is centred on it, the reverse
              // of a collapse, which shrinks to the frame's centre. From
              // the box's top-left corner the group ran right and down, and
              // pushed the diagram below and beside it away; centring the
              // children's bounds instead (lower than the frame's middle by
              // the header) walked the frame up on every cycle.
              const shownView = viewById(get(), activeViewId)
              const shownHere = shownView ? computeViewNodeSet(shownView as any, allNodes, get().c4Relations) : undefined
              const placedKids = children.filter((c) => (!shownHere || shownHere.has(c.id)) && (Math.abs(c.x) >= 1 || Math.abs(c.y) >= 1)) // the rest placed below
              if (placedKids.length > 0) {
                const frame = fittedParentSize(parent, placedKids.map((c) => ({
                  x: c.x, y: c.y,
                  width: c.collapsed ? COLLAPSED_WIDTH[c.type] : (c.width ?? 0),
                  height: c.collapsed ? COLLAPSED_HEIGHT[c.type] : (c.height ?? 0),
                })))
                const dx = COLLAPSED_WIDTH[parent.type] / 2 - frame.width / 2
                const dy = COLLAPSED_HEIGHT[parent.type] / 2 - frame.height / 2
                set((state) => {
                  const p = state.c4Nodes[id]
                  if (p) { p.x += dx; p.y += dy }
                })
                absX += dx
                absY += dy
              }

              // For children that have never been positioned (x≈0 and y≈0),
              // assign a default cluster so cola has somewhere to start.
              const unpositioned = children.filter((c) => Math.abs(c.x) < 1 && Math.abs(c.y) < 1)
              if (unpositioned.length > 0) {
                set((state) => {
                  unpositioned.forEach((child, i) => {
                    const c = state.c4Nodes[child.id]
                    if (!c) return
                    const jx = ((i * 17) % 11) - 5
                    const jy = ((i * 23) % 9) - 4
                    c.x = PAD + jx
                    c.y = HEADER_OFFSET + jy
                  })
                })
              }

              // Seed live cola with each child's absolute centre derived from
              // its (possibly just-assigned) parent-relative position.
              if (_liveLayout) {
                children.forEach((child) => {
                  // Re-read from store in case unpositioned branch updated it
                  const c = get().c4Nodes[child.id] ?? child
                  const cx = absX + c.x + (c.width ?? 0) / 2
                  const cy = absY + c.y + (c.height ?? 0) / 2
                  _liveLayout!.seedPosition(child.id, cx, cy)
                })
              }
            }
          }
        } else if (!prevCollapsed && drawnHere) {
          // Collapsing: shrink to the centre of the expanded box, the
          // reverse of an expand. The node turns from a cola group into a
          // leaf the layout has no position for, and a new leaf spawns among
          // its neighbours: seed it there.
          const allNodes = get().c4Nodes
          const node = allNodes[id]
          if (node && isContainerType(node.type)) {
            // One the canvas shows without children (it has none, or the
            // view draws none of them) is drawn at the folded size already:
            // it stays where it is. Shrunk from its model size, it moved by
            // half the difference on every fold.
            const shownView = activeViewId ? get().views[activeViewId] : undefined
            const shownHere = shownView ? computeViewNodeSet(shownView as any, allNodes, get().c4Relations) : undefined
            const drawnOpen = Object.values(allNodes).some((c) => c.parentId === id && (!shownHere || shownHere.has(c.id)))
            const dx = drawnOpen ? Math.max(0, ((node.width ?? 0) - COLLAPSED_WIDTH[node.type]) / 2) : 0
            const dy = drawnOpen ? Math.max(0, ((node.height ?? 0) - COLLAPSED_HEIGHT[node.type]) / 2) : 0
            if (dx > 0 || dy > 0) {
              set((state) => {
                const n = state.c4Nodes[id]
                if (n) { n.x += dx; n.y += dy }
              })
            }
            let absX = node.x + dx
            let absY = node.y + dy
            for (let p = node.parentId ? allNodes[node.parentId] : undefined; p; p = p.parentId ? allNodes[p.parentId] : undefined) {
              absX += p.x
              absY += p.y
            }
            _liveLayout?.seedPosition(id, absX + COLLAPSED_WIDTH[node.type] / 2, absY + COLLAPSED_HEIGHT[node.type] / 2)
          }
        }

        // NOTE: no intermediate _sync() here — it would push a render with the
        // new `collapsed` flag but stale sibling positions, which auto-fit would
        // then snap to. The loop below only reads/writes the model; we sync
        // once at the end so the viewport sees a single consistent change.

        // When inside a named view, fitParentToChildren must only consider
        // the nodes that are actually visible in this view. Without the view
        // filter it would resize the parent to fit ALL model children
        // (including those not in the view), keeping the parent far too large.
        // We also pass the current view-collapsed set so previously-collapsed
        // siblings are measured at their collapsed size.
        let loopViewFilter: Set<string> | undefined
        let loopVcs: Set<string> | undefined
        let loopExpandedSet: Set<string> | undefined
        if (activeViewId) {
          const view = viewById(get(), activeViewId)
          if (view) {
            loopViewFilter = computeViewNodeSet(view as any, get().c4Nodes, get().c4Relations)
            loopVcs = computeViewCollapsedSet(loopViewFilter, get().c4Nodes)
            if (view.collapsedNodeIds?.length) {
              for (const nid of view.collapsedNodeIds) loopVcs.add(nid)
            }
            // Build the expanded set so fitParentToChildren measures view-expanded
            // nodes at their full size, not their model-collapsed size.
            // When we are COLLAPSING the toggled node (!prevCollapsed = true → now
            // collapsing), it must be excluded from the expanded set even if it was
            // previously in view.expandedNodeIds — otherwise fitParentToChildren
            // would still measure it at full height (stale override).
            loopExpandedSet = viewExpandedSet(view as DiagramView, get().c4Nodes, get().c4Relations)
            if (openedEmpty) loopExpandedSet = new Set([...(loopExpandedSet ?? []), id])
            if (loopExpandedSet) {
              if (!prevCollapsed) loopExpandedSet.delete(id) // we are collapsing `id`
              if (loopExpandedSet.size === 0) loopExpandedSet = undefined
            }
          }
        }

        // Walk up the ancestor chain:
        // At each level: separate siblings of current node, then refit the parent.
        // This propagates size changes upward so grandparent containers also shrink/grow.
        // Under live physics no separation on a collapse: the box shrinks
        // where it stands and nothing needs room. An expand makes room here
        // and the physics takes the result as it is (reset below): left to
        // the physics, every child it showed counted as new and freed the 40
        // elements nearest to it by relation, across other containers whose
        // frames stayed fixed. On a large nested model that scattered a
        // hundred elements, never came to rest, and a reload drew another
        // picture.
        const separate = !_liveLayout?.running || prevCollapsed
        // Opening: the frame is the one its children need now. One added
        // while it was collapsed was not fit for (a collapsed container
        // keeps its size) and lay outside the frame it came back with.
        if (prevCollapsed && drawnHere) {
          const openVcs = loopVcs ? new Set([...loopVcs].filter((nid) => nid !== id)) : undefined
          const untangled = untangleChildren(id, get().c4Nodes, loopViewFilter, openVcs, loopExpandedSet)
          if (Object.keys(untangled).length > 0) {
            set((state) => {
              for (const [cid, at] of Object.entries(untangled)) {
                const c = state.c4Nodes[cid]
                if (c) { c.x = at.x; c.y = at.y }
              }
            })
          }
          get().fitParentToChildren(id, loopViewFilter, openVcs, loopExpandedSet)
        }
        const growFrameLeftUp = (parentId: string, viewFilter?: Set<string>): void => {
          set((state) => { growFrameLeftUpIn(state.c4Nodes as Record<string, C4Node>, parentId, (c) => !viewFilter || viewFilter.has(c.id)) })
        }
        // An expand makes room round what grew, level by level up the tree.
        const roomVcs = loopVcs ? new Set([...loopVcs].filter((nid) => nid !== id)) : undefined
        let currentId: string | undefined = drawnHere ? id : undefined
        while (currentId) {
          const overlapUpdates = prevCollapsed
            ? makeRoomAround(currentId, get().c4Nodes, canvasBoxes(get().c4Nodes, loopViewFilter, roomVcs, loopExpandedSet))
            : separate ? separateSiblings(currentId, get().c4Nodes) : {}
          if (Object.keys(overlapUpdates).length > 0) {
            set((state) => {
              for (const [sid, pos] of Object.entries(overlapUpdates)) {
                const n = state.c4Nodes[sid]
                if (n) { n.x = pos.x; n.y = pos.y }
              }
            })
          }

          const current: C4Node | undefined = get().c4Nodes[currentId]
          if (current?.parentId) {
            // Opened round its centre, or pushed aside, a child can reach
            // past its parent's left or top edge, where a refit (which grows
            // right and down) does not follow: the frame grows that way.
            if (prevCollapsed) growFrameLeftUp(current.parentId, loopViewFilter)
            // Opened, it counts at its full size: the view's collapsed list
            // still names it until the end of the toggle.
            get().fitParentToChildren(current.parentId, loopViewFilter, prevCollapsed ? roomVcs : loopVcs, loopExpandedSet)
            currentId = current.parentId
          } else {
            break
          }
        }

        // If in a named view: revert the temporary model change and persist
        // collapse state per-view instead, so toggling in one view does not
        // affect other views or the default (all-nodes) view.
        if (activeViewId) {
          set((state) => {
            const node = state.c4Nodes[id]
            if (node) node.collapsed = modelCollapsed  // restore original model state
            const v = viewById(state as DiagramStore, activeViewId)
            if (!v) return
            if (!v.collapsedNodeIds) v.collapsedNodeIds = []
            if (!v.expandedNodeIds) v.expandedNodeIds = []
            if (!prevCollapsed) {
              // Collapsing: add to this view's collapsed list; remove any expansion override
              if (!v.collapsedNodeIds.includes(id)) v.collapsedNodeIds.push(id)
              v.expandedNodeIds = v.expandedNodeIds.filter((nid) => nid !== id)
            } else {
              // Expanding: remove from collapsed list
              v.collapsedNodeIds = v.collapsedNodeIds.filter((nid) => nid !== id)
              // If this node is model-collapsed, we need to remember it was
              // explicitly expanded in this view so _sync() can override the
              // model-level collapse when rendering.
              if (modelCollapsed) {
                if (!v.expandedNodeIds.includes(id)) v.expandedNodeIds.push(id)
              } else {
                // Not model-collapsed — no expansion override needed
                v.expandedNodeIds = v.expandedNodeIds.filter((nid) => nid !== id)
              }
            }
          })
        }

        // Children kept in a row or column while it was collapsed line up
        // now: the physics, which held them on their line, takes this
        // result as it is. A fold too: the parent it shrinks may be on a
        // line, which then ran off it until the next load snapped it and
        // refit every container.
        let snapped = false
        const input = layoutInputForView(get())
        if (input.alignments.length) {
          set((state) => { snapped = applyAlignments(state.c4Nodes, input) })
          if (snapped) get()._resizeParentsBottomUp(input.viewFilter, input.viewCollapsedSet, input.expandedSet)
        }
        get()._sync()
        if (prevCollapsed || snapped) _liveLayout?.reset()
        else _liveLayout?.invalidate()
        // Smart fit frames the result as soon as the canvas shows it, not on
        // its next 300 ms tick. React Flow takes the new nodes in an effect,
        // a frame or two after this: ask again each frame meanwhile (a call
        // before the change shows does nothing).
        if (get().autoFitActive && typeof requestAnimationFrame !== 'undefined') {
          let frames = 0
          const kick = () => {
            _getFitViewInstantFn()?.()
            if (++frames < 5) requestAnimationFrame(kick)
          }
          requestAnimationFrame(kick)
        }
      },

      // ── relations ────────────────────────────────────────────────────────
      addRelation(rel) {
        if (!editsModel(get())) return
        // Enforce metamodel relation rules: refuse to create a relation
        // whose (from, to) type pair is not permitted by the active
        // metamodel. Existing in-memory relations are left untouched and
        // surface as Issues instead.
        const refused = model.checkAddRelation(get(), rel)
        if (refused) {
          get().pushNotification(refused, 'error')
          return null
        }
        get()._pushUndo()
        get()._markMilestoneEdit()
        const id = uid()
        // relationType is inferred from the metamodel when not given
        set((state) => { model.insertRelation(state, id, rel) })
        get()._sync()
        _liveLayout?.invalidate()
        return id
      },

      updateRelation(id, updates) {
        if (!editsModel(get())) return
        const existing = get().c4Relations[id] as unknown as Record<string, unknown> | undefined
        if (!existing || Object.entries(updates).every(([k, v]) => existing[k] === v)) return
        // Moving an end obeys the same metamodel rules as adding a relation.
        const refused = model.checkPatchRelation(get(), id, updates)
        if (refused) {
          get().pushNotification(refused, 'error')
          return
        }
        _pushTextEdit(get(), `relation:${id}:${Object.keys(updates).sort().join(',')}`, (state) => model.patchRelation(state, id, updates))
        get()._markMilestoneEdit()
        set((state) => { model.patchRelation(state, id, updates) })
        get()._sync()
      },

      moveRelationEnd(id, updates, relationType) {
        if (!editsModel(get())) return
        const s = get()
        if (relationType) {
          // Kept: the type must join the new pair itself (checkPatchRelation
          // asks only whether some type does).
          const rel = s.c4Relations[id]
          const refusal = rel && model.checkAddRelation(s, { sourceId: updates.sourceId ?? rel.sourceId, targetId: updates.targetId ?? rel.targetId, relationType })
          if (refusal) { s.pushNotification(refusal, 'error'); return }
          s.updateRelation(id, rel?.relationType === relationType ? updates : { ...updates, relationType })
          return
        }
        const refused = model.checkPatchRelation(s, id, updates)
        if (refused) { s.pushNotification(refused, 'error'); return }
        const fit = model.relationTypeOnMove(s, id, updates)
        const rel = s.c4Relations[id]
        if (fit.ask && rel) {
          const ends = { sourceId: updates.sourceId ?? rel.sourceId, targetId: updates.targetId ?? rel.targetId }
          set((state) => { state.relationTypeChoice = { ...ends, types: fit.ask!, relationId: id } })
          return
        }
        s.updateRelation(id, fit.type ? { ...updates, relationType: fit.type } : updates)
      },

      removeRelation(id) {
        if (!editsModel(get())) return
        get()._pushUndo()
        get()._markMilestoneEdit()
        set((state) => { model.deleteRelation(state, id) })
        get()._sync()
        _liveLayout?.invalidate()
      },

      onConnect(connection) {
        if (!connection.source || !connection.target) return
        if (connection.source === connection.target) return
        get().connectNodes(connection.source, connection.target)
      },

      connectNodes(sourceId, targetId) {
        const s = get()
        if (!editsModel(s)) return
        const source = s.c4Nodes[sourceId], target = s.c4Nodes[targetId]
        if (!source || !target || sourceId === targetId) return
        const label = (type: string) => s.metamodel?.nodeTypes[type]?.label ?? type
        if (!isRelationAllowed(s.metamodel, source.type, target.type)) {
          s.pushNotification(`Relation not allowed: ${label(source.type)} → ${label(target.type)}. The metamodel does not permit this connection.`, 'error')
          return
        }
        // The types the model accepts between the two (relationRefusal: a
        // structural relation to what holds an element is refused, a
        // governance one is not; the aggregate rules kept). None of those
        // that fit: the reason, asked for no type first.
        const ctx = { nodes: s.c4Nodes, relations: s.c4Relations, metamodel: s.metamodel }
        const fitting = relationTypesFitting(s.metamodel, source.type, target.type)
        const accepted = relationTypesAccepted(ctx, sourceId, targetId)
        if (fitting.length && !accepted.length) {
          s.pushNotification(relationRefusal(ctx, { sourceId, targetId, relationType: fitting[0].id }) ?? 'Relation not allowed.', 'error')
          return
        }
        // On a canvas whose filter is a chain, the relation is one the chain
        // follows, or it would be added and not drawn (twice, by a second try).
        const view = s.activeViewId ? s.views[s.activeViewId] : undefined
        let made: { relationType?: string } | null = {}
        if (pipelineOf(view)?.levels?.length) {
          made = chainRelationFor(view, sourceId, targetId, { nodes: s.c4Nodes, relations: s.c4Relations, metamodel: s.metamodel })
          if (!made) {
            s.pushNotification(`Not added: this view shows only the relations its filter follows, and none leads from ${source.label} to ${target.label}.`, 'error')
            return
          }
        }
        if (made.relationType) { s.addRelation({ sourceId, targetId, relationType: made.relationType }); return }
        // Several types fit the pair: which one is the user's to say (left
        // to inference, the relation had none, and nothing flagged it).
        const types = accepted
        if (types.length > 1) { set((state) => { state.relationTypeChoice = { sourceId, targetId, types } }); return }
        s.addRelation({ sourceId, targetId, ...(types.length === 1 ? { relationType: types[0] } : {}) })
      },

      chooseRelationType(type) {
        const choice = get().relationTypeChoice
        set((state) => { state.relationTypeChoice = null })
        if (!choice || !type) return
        if (choice.relationId) get().updateRelation(choice.relationId, { sourceId: choice.sourceId, targetId: choice.targetId, relationType: type })
        else get().addRelation({ sourceId: choice.sourceId, targetId: choice.targetId, relationType: type })
      },

      // ── selection ────────────────────────────────────────────────────────
      selectNode(id) {
        set((state) => {
          state.selectedNodeId = id
          state.selectedNodeIds = id ? [id] : []
          if (id) state.selectedEdgeId = null
          // Mirror into RF so the canvas paints the selection ring.
          for (const rn of state.rfNodes as Array<{ id: string; selected?: boolean }>) {
            const want = rn.id === id
            if (!!rn.selected !== want) rn.selected = want
          }
          if (id) {
            for (const re of state.rfEdges as Array<{ selected?: boolean }>) {
              if (re.selected) re.selected = false
            }
          }
        })
      },

      selectEdge(id) {
        set((state) => {
          state.selectedEdgeId = id
          if (id) {
            state.selectedNodeId = null
            state.selectedNodeIds = []
          }
          // Mirror into RF.
          for (const re of state.rfEdges as Array<{ id: string; selected?: boolean }>) {
            const want = re.id === id
            if (!!re.selected !== want) re.selected = want
          }
          if (id) {
            for (const rn of state.rfNodes as Array<{ selected?: boolean }>) {
              if (rn.selected) rn.selected = false
            }
          }
        })
      },

      setSelectedNodeIds(ids) {
        set((state) => {
          // De-dup while preserving order.
          const seen = new Set<string>()
          const clean: string[] = []
          for (const id of ids) {
            if (state.c4Nodes[id] && !seen.has(id)) { seen.add(id); clean.push(id) }
          }
          state.selectedNodeIds = clean
          state.selectedNodeId = clean[0] ?? null
          if (clean.length > 0) state.selectedEdgeId = null
          // Mirror into rfNodes so React Flow paints its selection ring.
          // Without this, programmatic selection (Quick Search, multi-select
          // bar) updates the store but the canvas wouldn't reflect it.
          const selSet = new Set(clean)
          for (const rn of state.rfNodes as Array<{ id: string; selected?: boolean }>) {
            const want = selSet.has(rn.id)
            if (!!rn.selected !== want) rn.selected = want
          }
          if (clean.length > 0) {
            for (const re of state.rfEdges as Array<{ selected?: boolean }>) {
              if (re.selected) re.selected = false
            }
          }
        })
      },

      wrapSelectionInNewParent(parentTypeId) {
        const state0 = get()
        const ids = state0.selectedNodeIds.length
          ? state0.selectedNodeIds
          : (state0.selectedNodeId ? [state0.selectedNodeId] : [])
        if (ids.length === 0) {
          state0.pushNotification('Nothing selected to wrap.', 'warning')
          return
        }
        const nodes = ids.map(id => state0.c4Nodes[id]).filter(Boolean) as C4Node[]
        if (nodes.length === 0) return

        const mm = state0.metamodel
        const parentDef = mm?.nodeTypes[parentTypeId]
        if (!parentDef) {
          state0.pushNotification(`Unknown wrapper type "${parentTypeId}".`, 'error')
          return
        }
        const wrapperLabel = parentDef.label

        // All selected nodes must currently share the same parent — otherwise
        // wrapping would break the existing containment hierarchy.
        const commonParentId = nodes[0].parentId ?? null
        if (!nodes.every(n => (n.parentId ?? null) === commonParentId)) {
          state0.pushNotification(
            'Cannot wrap: selected nodes have different parents. Select siblings only.',
            'error',
          )
          return
        }
        const commonParent = commonParentId ? state0.c4Nodes[commonParentId] : undefined

        // Wrapper must be allowed inside the common parent.
        if (!isPlacementAllowed(mm, parentTypeId, commonParent, state0.c4Nodes)) {
          const allowedStr = allowedPlacesText(mm, parentTypeId)
          const where = commonParent
            ? (mm?.nodeTypes[commonParent.type]?.label ?? commonParent.type)
            : 'the canvas root'
          state0.pushNotification(
            `Cannot create ${wrapperLabel} inside ${where}. Allowed parents: ${allowedStr}.`,
            'error',
          )
          return
        }

        // Each selected child type must be allowed inside the new wrapper.
        for (const n of nodes) {
          if (!isParentAllowed(mm, n.type, parentTypeId)) {
            const childDef = mm?.nodeTypes[n.type]
            const childLabel = childDef?.label ?? n.type
            const allowedStr = allowedPlacesText(mm, n.type)
            state0.pushNotification(
              `Cannot place ${childLabel} "${n.label}" inside ${wrapperLabel}. Allowed parents: ${allowedStr}.`,
              'error',
            )
            return
          }
        }

        // Bounding box (relative to common parent) + padding & header room,
        // of what the canvas draws: a container with nothing in it is drawn
        // at its folded size.
        const sets = activeCanvasSets(state0)
        const canvas = canvasBoxes(state0.c4Nodes, sets.viewFilter, sets.viewCollapsedSet, sets.expandedSet)
        const PAD = 30
        const HEADER = 40
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const n of nodes) {
          const b = canvas.boxOf(n)
          minX = Math.min(minX, b.x)
          minY = Math.min(minY, b.y)
          maxX = Math.max(maxX, b.x + b.w)
          maxY = Math.max(maxY, b.y + b.h)
        }
        const newX = minX - PAD
        const newY = minY - PAD - HEADER
        // Hug the children — don't inflate to parentDef defaults, otherwise a
        // freshly-wrapped group looks much larger than its content and may
        // overflow its own parent.
        const newW = maxX - minX + 2 * PAD
        const newH = maxY - minY + 2 * PAD + HEADER

        // The room each parent round the selection leaves round its children
        // on each side, up to what the store leaves when it fits a parent
        // (as the live layout keeps a frame): what it keeps as it grows to
        // hold the new parent.
        const ancestors: { id: string; frame: CanvasBox; room: { x: number; X: number; y: number; Y: number } }[] = []
        for (let cur = commonParent; cur && !ancestors.some((a) => a.id === cur!.id); cur = cur.parentId ? state0.c4Nodes[cur.parentId] : undefined) {
          const pad = compoundPadding(cur.type)
          const room = { x: pad.side, X: pad.side, y: LIVE_CHILD_TOP_MIN, Y: pad.bottom }
          const frame = canvas.boxOf(cur)
          for (const c of Object.values(state0.c4Nodes)) {
            if (c.parentId !== cur.id || !canvas.shown(c)) continue
            const b = canvas.boxOf(c)
            room.x = Math.min(room.x, b.x)
            room.X = Math.min(room.X, frame.w - b.x - b.w)
            room.y = Math.min(room.y, b.y)
            room.Y = Math.min(room.Y, frame.h - b.y - b.h)
          }
          ancestors.push({ id: cur.id, frame, room: { x: Math.max(0, room.x), X: Math.max(0, room.X), y: Math.max(0, room.y), Y: Math.max(0, room.Y) } })
        }

        // One undo step for the whole wrap. addNode and each updateNode below
        // push their own, so one Undo used to leave part of the selection in
        // the new parent and part of it out.
        // The live layout hears of the wrap once it is done (below): told of
        // each step, it took the new parent for an element added empty, and
        // the steps after it for edits that move nothing, and the parent
        // stayed over the elements beside the selection (F-0020).
        const layout = _liveLayout
        _liveLayout = null
        let wrapped: string[] = []
        try {
        _asOneStep(() => {
        // Create the wrapper. addNode will re-validate metamodel; we already
        // checked but it's a defensive double-check.
        const newId = get().addNode({
          type: parentTypeId,
          label: `New ${wrapperLabel}`,
          description: '',
          technology: '',
          collapsed: false,
          external: false,
          parentId: commonParentId ?? undefined,
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        } as Omit<C4Node, 'id'>)
        if (!newId) return

        // Reparent each selected node into the wrapper. updateNode also
        // re-validates.
        for (const n of nodes) {
          get().updateNode(n.id, {
            parentId: newId,
            x: n.x - newX,
            y: n.y - newY,
          } as Partial<Omit<C4Node, 'id'>>)
        }

        // What it wraps stays where it is drawn, and the wrapper hugs it
        // there. addNode kept the wrapper below its parent's header (a place
        // for an element dropped there) and fitted it to its type's size:
        // the selection moved down with it, and the wrapper, 520×360 round
        // one container, lay over the elements beside it, which were pushed
        // away and grew the frames round them (F-0028). Each parent grows
        // only as far as it needs to hold the one in it that grew, with the
        // room it had, left and up included (moving its children back by as
        // much); the parents above it the same, up to the canvas.
        const grown: string[] = []
        set((state) => {
          const all = state.c4Nodes as Record<string, C4Node>
          const w = all[newId]
          if (!w) return
          w.x = newX
          w.y = newY
          w.width = newW
          w.height = newH
          for (const n of nodes) {
            const c = all[n.id]
            if (c) { c.x = n.x - newX; c.y = n.y - newY }
          }
          let inner = { x: newX, y: newY, w: newW, h: newH }
          // From the frames as they were: addNode fitted them to the
          // wrapper it placed.
          for (const { id, frame, room } of ancestors) {
            const a = all[id]
            if (!a) break
            const dx = Math.max(0, room.x - inner.x)
            const dy = Math.max(0, room.y - inner.y)
            if (dx || dy) {
              for (const c of Object.values(all)) {
                if (c.parentId === id) { c.x += dx; c.y += dy }
              }
            }
            a.x = frame.x - dx
            a.y = frame.y - dy
            a.width = Math.max(frame.w + dx, inner.x + dx + inner.w + room.X)
            a.height = Math.max(frame.h + dy, inner.y + dy + inner.h + room.Y)
            if (a.width !== frame.w || a.height !== frame.h) grown.push(id)
            inner = { x: a.x, y: a.y, w: a.width, h: a.height }
          }
        })
        get()._sync()

        // Promote the new wrapper to the active selection.
        get().setSelectedNodeIds([newId])
        get().pushNotification(
          `Wrapped ${nodes.length} ${nodes.length === 1 ? 'node' : 'nodes'} into ${wrapperLabel}.`,
          'info',
        )
        wrapped = [newId, ...grown]
        })
        } finally {
          _liveLayout = layout
        }
        // It makes room as an element added does: what the new parent, or
        // a parent it grew, covers is pushed clear, and nothing else moves.
        // Only what it lies on: an element 50 px beside the selection, 20
        // px from the new parent's frame, went 4 px aside with its parent.
        if (wrapped.length) _liveLayout?.invalidate(wrapped, true)
      },

      unwrapNode(id) {
        const state0 = get()
        const node = state0.c4Nodes[id]
        if (!node) return
        const mm = state0.metamodel
        const grandparentId = node.parentId ?? undefined

        // Direct children only — grandchildren stay nested in their existing
        // parents, which themselves get re-parented one level up.
        const directChildren = Object.values(state0.c4Nodes).filter(
          (n) => n.parentId === id,
        ) as C4Node[]

        // Each direct child must be allowed in the grandparent (or at the
        // root), and a group among them must still hold only what its new
        // place allows: a system unwrapped around a group of containers left
        // the group at the top of the model, where containers have no place
        // ("Move to… → Canvas root" refuses the same).
        const refused = model.checkUnwrap(state0, id)
        if (refused) {
          state0.pushNotification(refused, 'error')
          return
        }

        get()._pushUndo()
        get()._markMilestoneEdit()
        const removedLabel = mm?.nodeTypes[node.type]?.label ?? node.type
        const childCount = directChildren.length
        const nodeAbsX = node.x
        const nodeAbsY = node.y

        set((state) => {
          // Re-parent direct children, preserving their on-screen position by
          // converting child-local coords (relative to the removed node) to
          // grandparent-local coords (relative to grandparent or root).
          for (const c of directChildren) {
            const sn = state.c4Nodes[c.id]
            if (!sn) continue
            sn.parentId = grandparentId
            sn.x = c.x + nodeAbsX
            sn.y = c.y + nodeAbsY
          }
          // Drop the node itself.
          delete state.c4Nodes[id]
          // Drop only relations that touched the removed node directly;
          // children's relations survive unchanged.
          for (const [rid, rel] of Object.entries(state.c4Relations)) {
            if (rel.sourceId === id || rel.targetId === id) {
              delete state.c4Relations[rid]
            }
          }
          // Remove the node from every view; its children stay in views they
          // were already part of. In a milestone the views wait for
          // Propagate (keepingSharedViews).
          if (!state.activeSnapshotId) {
            for (const view of Object.values(state.views)) {
              removeFromViewList(view as DiagramView, new Set([id]))
            }
          }
        })

        // Refit the grandparent (and on up) so containment stays tight.
        let cur: string | undefined = grandparentId
        const seen = new Set<string>()
        while (cur && !seen.has(cur)) {
          seen.add(cur)
          get().fitParentToChildren(cur)
          cur = get().c4Nodes[cur]?.parentId
        }

        // Selection: promote the now-unparented children so the user can see
        // what survived.
        get().setSelectedNodeIds(directChildren.map((c) => c.id))

        get()._sync()
        _liveLayout?.invalidate()
        get().pushNotification(
          childCount === 0
            ? `Removed ${removedLabel} "${node.label}".`
            : `Removed ${removedLabel} "${node.label}", kept ${childCount} ${childCount === 1 ? 'child' : 'children'}.`,
          'info',
        )
      },

      reparentNodes(ids, newParentId, options) {
        const state0 = get()
        if (!editsModel(state0)) return
        const nodes = ids
          .map((id) => state0.c4Nodes[id])
          .filter((n): n is C4Node => !!n)
        if (nodes.length === 0) return
        const oldParentId = nodes[0].parentId ?? null
        // Same parent for every selected node: nothing to do.
        if ((newParentId ?? null) === oldParentId && nodes.every((n) => (n.parentId ?? null) === oldParentId)) return

        const refused = model.checkReparent(state0, ids, newParentId)
        if (refused) {
          state0.pushNotification(refused, 'error')
          return
        }
        const newParent = newParentId ? state0.c4Nodes[newParentId] : undefined
        const newParentLabel = newParent
          ? (state0.metamodel?.nodeTypes[newParent.type]?.label ?? newParent.type)
          : 'the canvas root'

        get()._pushUndo()
        // It rebases the element's place on every canvas: in a milestone,
        // on the live views too, which Discard and Save as new left so.
        get()._milestoneViewEdit('every')
        // Its relations with what now holds it go: containment joins them.
        let removed: string[] = []
        set((state) => {
          const label = (id: string): string => state.c4Nodes[id]?.label || id
          removed = model.reparentNodes(state, ids, newParentId).map((r) =>
            `${label(r.sourceId)} ${(() => { const type = relationTypeForProse(r as C4Relation, state.c4Nodes as Record<string, C4Node>, state.metamodel as Metamodel | undefined); return type ? relationTypeName(state.metamodel as Metamodel | undefined, type, true) : 'relates to' })()} ${label(r.targetId)}`)
        })
        if (removed.length) {
          get().pushNotification(`Removed ${removed.length === 1 ? 'the relation' : `${removed.length} relations`} ${removed.join('; ')}: containment already joins ${removed.length === 1 ? 'them' : 'each pair'}.`, 'warning')
        }

        // On the canvas shown (model.reparentNodes saw to the others).
        const shownNodes = settleMoveOnShownCanvas(get(), ids, oldParentId ? [oldParentId] : [])
        set((state) => { writeGeometry(state, shownNodes) })
        // And on the others, where it lost its place.
        _placeOnOtherCanvases(ids, false)
        // In a milestone, its own All elements (kept aside while a view is
        // shown) had the place relative to the old parent: read against the
        // new one, it lay on a sibling there. Without one, it is placed
        // beside its siblings when All elements opens (placeUnplaced).
        if (get().activeSnapshotId && get().activeViewId !== null && _milestoneAllPositions) {
          for (const id of ids) delete _milestoneAllPositions[id]
        }

        get().setSelectedNodeIds(ids)
        get()._sync()
        // A row or column it stays in (with what is no ancestor of it)
        // holds now, as a reload would draw it.
        get()._enforceLayoutConstraints()
        _liveLayout?.invalidate()
        if (options?.quiet) return
        get().pushNotification(
          `Moved ${nodes.length} ${nodes.length === 1 ? 'node' : 'nodes'} into ${newParentLabel}.`,
          'info',
        )
      },

      // ── views ────────────────────────────────────────────────────────────
      // Adding, renaming and deleting a view are undo steps. They were not,
      // yet a history entry carries the views: Undo of the step before
      // removed a new view (or brought back a deleted one) along with it,
      // and Redo was still offered after a view was added.
      addView(name, kind, empty) {
        const id = uid()
        get()._pushUndo()
        set((state) => {
          model.insertView(state, id, name, empty)
          if (kind && kind !== 'static') state.views[id].kind = kind
        })
        return id
      },
      removeView(id) {
        if (!get().views[id]) return
        get()._pushUndo()
        let positionsRestored = false
        let placed: string[] = []
        set((state) => {
          delete state.views[id]
          if (state.activeViewId === id) {
            // Restore default positions before switching away
            placed = showCanvasPositions(state.c4Nodes as Record<string, C4Node>, state.defaultPositions as Record<string, NodePosition>, undefined, state.c4Relations as Record<string, C4Relation>)
            state.activeViewId = null
            positionsRestored = true
          }
        })
        get()._sync()
        if (positionsRestored) _liveLayout?.reset(placed)
      },
      renameView(id, name) {
        if (!get().views[id] || get().views[id].name === name) return
        get()._pushUndo()
        set((state) => {
          if (state.views[id]) state.views[id].name = name
        })
      },
      setActiveView(newId) {
        // A group of views per element is never a canvas of its own: it
        // opens on its first view (none: nothing opens). Quick Search, a
        // link and Back drew it as one, and saved positions into it.
        if (newId && model.isViewGroup(get().views[newId], get().metamodel)) {
          const first = model.firstViewOfGroup(get().views, newId)
          if (!first) return
          newId = first.id
        }
        const { activeViewId, c4Nodes, appMode } = get()
        if (newId === activeViewId) return

        // Viewer and Presenter show each view as it was laid out: the
        // incoming view's positions and camera are loaded, as in designer.
        // (Keeping the outgoing view's positions scattered every view whose
        // nodes differ.) Nothing is saved into the outgoing view: drags here
        // are for exploring only, and the pre-mode snapshot in setAppMode
        // restores the designer layout on the way back.
        if (appMode !== 'designer') {
          // Viewer's exploration keeps its places (they are its own); a view
          // of type Explore grown there is as it was saved again.
          if (onExploration(get())) get()._saveShownCanvas()
          if (activeViewId && _viewerExplorations.has(activeViewId)) set((state) => { restoreViewerExplorations(state as DiagramStore, activeViewId) })
          // Read outside the producer: a draft taken out of set() is revoked
          // when it returns, and placeCamera threw on reading it (no fit).
          const incomingViewport = (newId === null ? get().defaultViewport : viewById(get(), newId)?.viewport) ?? null
          let placed: string[] = []
          set((state) => {
            const view = viewById(state as DiagramStore, newId)
            const incoming = newId === null
              ? state.defaultPositions as Record<string, NodePosition>
              : firstCanvasPositions(view, state.defaultPositions as Record<string, NodePosition>, null)
                ?? view?.positions as Record<string, NodePosition> | undefined
            if (incoming && (Object.keys(incoming).length > 0 || isExploration(view))) {
              placed = showCanvasPositions(state.c4Nodes as Record<string, C4Node>, incoming, view, state.c4Relations as Record<string, C4Relation>, liveWhileInMilestone(state as DiagramStore))
            }
            state.activeViewId = newId
            if (incomingViewport) state.lowDetail = lowDetailAt(incomingViewport.zoom, state.lowDetail)
          })
          get()._sync()
          clearViewSelection(newId)
          arrangeOnFirstOpen()
          const shown = get().rfNodes.filter((n) => !n.hidden).map((n) => n.id)
          ;(window as any).__rfPlaceCamera?.(incomingViewport, shown)
          _liveLayout?.reset(placed)
          return
        }

        // 1. Snapshot current positions from c4Nodes
        const currentPos = snapshotPositions(c4Nodes)
        // 1b. Snapshot current camera (pan + zoom). Canvas keeps this fresh
        //     in window.__rfCurrentViewport via React Flow's onMove handler.
        const rawVP = (window as any).__rfCurrentViewport
        const currentViewport: { x: number; y: number; zoom: number } | null = rawVP
          ? { x: rawVP.x, y: rawVP.y, zoom: rawVP.zoom }
          : null

        // A milestone shown: its All elements keeps its own positions, and
        // nothing of it goes into the live views (see _milestoneAllPositions).
        const inMilestone = !!get().activeSnapshotId
        let placed: string[] = []
        set((state) => {
          // 2. Save to outgoing context
          if (inMilestone) {
            if (activeViewId === null) _milestoneAllPositions = currentPos
          } else if (activeViewId === null) {
            state.defaultPositions = currentPos as any
            const camera = allElementsCamera(currentViewport)
            if (camera) state.defaultViewport = camera
          } else if (viewById(state as DiagramStore, activeViewId)) {
            // A view of the document's, or the exploration.
            const view = viewById(state as DiagramStore, activeViewId)!
            if (activeViewId !== _firstLayoutOf) view.positions = viewCanvasPositions(view, c4Nodes, currentPos, viewDrawnIds(view as DiagramView, c4Nodes as Record<string, C4Node>, state.c4Relations as Record<string, C4Relation>)) as any
            if (currentViewport) view.viewport = currentViewport
          }

          // 3. Load from incoming context
          let incoming: Record<string, NodePosition> | undefined
          let incomingViewport: { x: number; y: number; zoom: number } | null = null
          if (newId === null) {
            incoming = (inMilestone && _milestoneAllPositions) || state.defaultPositions as Record<string, NodePosition>
            incomingViewport = state.defaultViewport as typeof incomingViewport
          } else {
            const view = viewById(state as DiagramStore, newId)
            if (view && Object.keys(view.positions ?? {}).length > 0) {
              incoming = view.positions as Record<string, NodePosition>
            }
            if (view?.viewport) incomingViewport = view.viewport
            // A canvas with no positions yet opens on All elements' places.
            incoming ??= firstCanvasPositions(view as DiagramView | undefined, state.defaultPositions as Record<string, NodePosition>, inMilestone ? _milestoneAllPositions : null)
          }

          if (incoming) {
            placed = showCanvasPositions(state.c4Nodes as Record<string, C4Node>, incoming, viewById(state as DiagramStore, newId), state.c4Relations as Record<string, C4Relation>, liveWhileInMilestone(state as DiagramStore))
          }

          state.activeViewId = newId
          // Drawn as blocks or cards for the camera it opens with.
          if (incomingViewport) state.lowDetail = lowDetailAt(incomingViewport.zoom, state.lowDetail)
          // Stash for the post-set effect below; we apply the viewport AFTER
          // _sync() so React Flow has already re-rendered nodes.
          ;(state as any).__pendingViewport = incomingViewport
        })
        get()._sync()
        clearViewSelection(newId)
        arrangeOnFirstOpen()
        // The camera for the incoming view, in one step: no flight from the
        // outgoing view's camera (see Canvas placeCamera).
        const pending = (get() as any).__pendingViewport as
          | { x: number; y: number; zoom: number }
          | null
        const shown = get().rfNodes.filter((n) => !n.hidden).map((n) => n.id)
        ;(window as any).__rfPlaceCamera?.(pending ?? null, shown)
        set((state) => { delete (state as any).__pendingViewport })
        // Alignments added elsewhere (the MCP server, another window) hold
        // from the moment the canvas shows.
        get()._enforceLayoutConstraints()
        // Drop cola's cached positions so the live layout doesn't immediately
        // overwrite the just-restored coordinates with stale ones. What was
        // given a place just now settles there, with its surroundings.
        _liveLayout?.reset(placed)
      },
      // ── Explore from here ──────────────────────────────────────────────
      // Nothing here is saved or a milestone edit: the exploration is never
      // in `views` (see viewById). In Designer its +, − and drags are undo
      // steps of its own (ExplorationStep), gone with it.
      exploreFrom(nodeId) {
        const s = get()
        const node = s.c4Nodes[nodeId]
        // Designer's on the live model (a milestone shown there is edited, and
        // closes it), and Viewer's on the model it shows. Not Presenter's.
        const here = (s.appMode === 'designer' && !s.activeSnapshotId) || s.appMode === 'viewer'
        if (!node || !here || s.presentationActive) return
        // The one open goes without a question, with its steps; the way
        // back stays the canvas the first was opened from.
        if (!onExploration(s)) _exploredFrom = s.activeViewId && s.views[s.activeViewId] ? s.activeViewId : null
        _dropExplorationSteps()
        // The element alone, where it is drawn now.
        const x = newExploration(uid(), node)
        const positions = layExploration(x, s.c4Nodes, s.c4Relations, drawnAt(nodeId, s.c4Nodes))
        // Its + menu opens at once, to choose the next level (none when
        // there is nothing to add).
        const menu = (explorationLinks(x, s.c4Nodes, s.c4Relations).get(nodeId)?.length ?? 0) > 0 ? nodeId : null
        set((state) => {
          state.exploration = { ...x, positions } as any
          state.exploreMenuFor = null
          state.canUndo = _undoStack.length > 0
          state.canRedo = _redoStack.length > 0
        })
        get().setActiveView(x.id)
        if (menu) set((state) => { state.exploreMenuFor = menu })
        ;(window as any).__rfShowAdded?.([nodeId], [])
      },

      openExploreMenu(nodeId) {
        if (get().exploreMenuFor !== nodeId) set((state) => { state.exploreMenuFor = nodeId })
      },

      exploreNeighbours(nodeId, choice) {
        const s = get()
        const x = shownExploration(s)
        if (!x || s.presentationActive || (s.appMode !== 'designer' && s.appMode !== 'viewer') || !x.nodeIds.includes(nodeId)) return
        const links = explorationLinks(x, s.c4Nodes, s.c4Relations).get(nodeId) ?? []
        const expansion = uid()
        const next = grown(x, nodeId, links, choice, expansion)
        if (!next) return
        _reshapeExploration(next, next.nodeIds.filter((id) => !x.nodeIds.includes(id)), [nodeId], true, expansion)
      },

      foldExploration(nodeId) {
        const s = get()
        const x = shownExploration(s)
        if (!x || s.presentationActive || (s.appMode !== 'designer' && s.appMode !== 'viewer')) return
        const next = folded(x, nodeId)
        if (next.nodeIds.length === x.nodeIds.length) return
        _reshapeExploration(next, [nodeId], [])
      },

      saveExploration(name, folder) {
        const s = get()
        if (!s.exploration || !name.trim() || s.appMode !== 'designer' || s.activeSnapshotId) return null
        // Its places are on the nodes while it is shown.
        if (!onExploration(s)) get().setActiveView(s.exploration.id)
        const kept = explorationNow(get())!
        const id = uid()
        // Its own steps go with it; then one step: Undo takes the view away
        // (no step keeps an exploration), Redo brings it back.
        _dropExplorationSteps()
        get()._pushUndo()
        set((state) => {
          const nodes = state.c4Nodes as Record<string, C4Node>
          model.insertView(state as unknown as model.ModelState, id, name.trim())
          const view = state.views[id]
          // A view of type Explore: what it lists, how it grew, where it
          // draws each element (flat), drawn as the exploration was.
          view.kind = 'explore'
          view.nodeIds = listedIds(kept, nodes)
          const listed = new Set(view.nodeIds)
          const only = <T,>(record: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(record).filter(([n]) => listed.has(n)))
          view.explore = { ...kept.explore, levels: only(kept.explore.levels), addedBy: only(kept.explore.addedBy) } as any
          view.positions = only(kept.positions as Record<string, NodePosition>) as any
          if (kept.viewport) view.viewport = { ...kept.viewport }
          // What it draws: the relations it does not draw stay hidden (a
          // reader that knows no Explore draws it as a structure view).
          const hidden = explorationLines(kept, nodes, state.c4Relations as Record<string, C4Relation>).hidden
          if (hidden.length) view.hiddenRelationIds = hidden
          model.setViewFolder(state as unknown as model.ModelState, id, folder)
          state.exploration = null
          state.exploreMenuFor = null
          // Shown in its place: the nodes hold its places already.
          state.activeViewId = id
          state.canUndo = _undoStack.length > 0
          state.canRedo = _redoStack.length > 0
        })
        _exploredFrom = null
        get()._sync()
        _liveLayout?.reset()
        return id
      },

      closeExploration() {
        const s = get()
        if (!s.exploration) return
        const shown = onExploration(s)
        const back = _exploredFrom && s.views[_exploredFrom] ? _exploredFrom : null
        _exploredFrom = null
        // Gone first, with its steps: leaving it saves nothing of it.
        _dropExplorationSteps()
        set((state) => {
          state.exploration = null
          state.exploreMore = null
          state.exploreFoldable = null
          state.exploreMenuFor = null
          state.canUndo = _undoStack.length > 0
          state.canRedo = _redoStack.length > 0
        })
        if (shown) get().setActiveView(back)
        else get()._sync()
      },

      addNodeToView(viewId, nodeId) {
        const view = get().views[viewId]
        // A group's views show what their element holds: nothing is picked by hand.
        if (!view || view.nodeIds.includes(nodeId) || setByGroup(get(), viewId)) return
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        set((state) => {
          state.views[viewId].nodeIds.push(nodeId)
          delete state.views[viewId].empty
        })
        get()._sync()
      },
      removeNodeFromView(viewId, nodeIds) {
        const { c4Nodes } = get()
        const ids = (typeof nodeIds === 'string' ? [nodeIds] : nodeIds).filter((id) => !!c4Nodes[id])
        const view = get().views[viewId]
        // A group's views show what their element holds, a view listing
        // nothing what its filter gives: nothing is hidden from them by hand.
        if (!view || ids.length === 0 || hideRefusal(get(), viewId)) return
        // Remove the nodes AND all their descendants as one unit.
        // Without cascading, children remaining in nodeIds cause
        // computeViewNodeSet to re-include the parent (ancestor walk),
        // so the parent would keep appearing even after its eye was toggled off.
        const toRemove = new Set(ids.flatMap((id) => [id, ...getDescendants(id, c4Nodes)]))
        const hide = (v: DiagramView): void => {
          if (viewShowsEveryNode(v)) {
            // Empty nodeIds means "show all". First removal transitions to
            // "show all except this subtree" by explicitly listing every other node.
            v.nodeIds = Object.keys(c4Nodes).filter(id => !toRemove.has(id))
            if (v.nodeIds.length === 0) v.empty = true
          } else {
            removeFromViewList(v, toRemove)
          }
          // Also clean up per-view collapse state for all removed nodes
          if (v.collapsedNodeIds?.length)
            v.collapsedNodeIds = v.collapsedNodeIds.filter((nid) => !toRemove.has(nid))
          if (v.expandedNodeIds?.length)
            v.expandedNodeIds = v.expandedNodeIds.filter((nid) => !toRemove.has(nid))
        }
        // Nothing it would take out of the view (an element it does not
        // list): no undo step. One that changed nothing dropped the redo.
        const probe = { ...view } as DiagramView
        hide(probe)
        const fields = (v: DiagramView) => JSON.stringify([v.nodeIds, v.empty ?? false, v.collapsedNodeIds ?? [], v.expandedNodeIds ?? []])
        if (fields(probe) === fields(view)) return
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        set((state) => { hide(state.views[viewId] as DiagramView) })
        get()._sync()
        // A container whose children it hid is drawn at its folded size: a
        // row or column through it holds again, as a reload would draw it,
        // and the physics takes the canvas as it is now.
        if (viewId === get().activeViewId) {
          get()._enforceLayoutConstraints()
          _liveLayout?.reset()
        }
      },
      setViewNodes(viewId, nodeIds) {
        if (!get().views[viewId]) return
        const refused = model.groupViewNodesRefusal(get(), viewId)
        if (refused) {
          get().pushNotification(`${refused}.`, 'error')
          return
        }
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        // Unknown ids are dropped (the AI may emit a stale one) and the rest deduplicated
        set((state) => { model.setViewNodeIds(state, viewId, nodeIds) })
        get()._sync()
        _liveLayout?.invalidate()
      },
      hideRelationFromView(viewId, relationId) {
        const view = get().views[viewId]
        if (!view || view.hiddenRelationIds?.includes(relationId)) return
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        set((state) => {
          const v = state.views[viewId]
          v.hiddenRelationIds = [...(v.hiddenRelationIds ?? []), relationId]
        })
        get()._sync()
      },
      unhideRelationInView(viewId, relationId) {
        const view = get().views[viewId]
        if (!view?.hiddenRelationIds?.includes(relationId)) return
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        set((state) => {
          const v = state.views[viewId]
          v.hiddenRelationIds = (v.hiddenRelationIds ?? []).filter((id) => id !== relationId)
        })
        get()._sync()
      },
      setViewHiddenRelations(viewId, relationIds) {
        if (!get().views[viewId]) return
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        set((state) => { model.setViewHiddenRelations(state, viewId, relationIds) })
        get()._sync()
      },

      _showLiveCanvasPositions() {
        set((state) => {
          const view = viewById(state as DiagramStore, state.activeViewId)
          const positions = view ? view.positions : (_milestoneAllPositions ?? state.defaultPositions)
          if (positions && Object.keys(positions).length > 0) showCanvasPositions(state.c4Nodes as Record<string, C4Node>, positions as Record<string, NodePosition>, view, state.c4Relations as Record<string, C4Relation>, liveWhileInMilestone(state as DiagramStore))
        })
      },

      _placeOnAllElements() {
        const { activeViewId, activeSnapshotId, defaultPositions, c4Nodes } = get()
        if (activeViewId === null || activeSnapshotId || !defaultPositions || !Object.keys(defaultPositions).length) return
        if (Object.keys(c4Nodes).every((id) => id in defaultPositions)) return
        const all = Object.fromEntries(Object.entries(c4Nodes).map(([id, n]) => [id, { ...n, ...(defaultPositions[id] ?? {}) }]))
        placeUnplaced(all, defaultPositions)
        set((state) => {
          const kept = state.defaultPositions as Record<string, NodePosition>
          for (const n of Object.values(all)) {
            const was = kept[n.id]
            if (was && was.x === n.x && was.y === n.y && was.width === n.width && was.height === n.height) continue
            kept[n.id] = { x: n.x, y: n.y, width: n.width, height: n.height }
          }
        })
      },

      _saveShownCanvas() {
        const currentPos = snapshotPositions(get().c4Nodes)
        const rawVP = (window as any).__rfCurrentViewport as { x: number; y: number; zoom: number } | undefined
        const camera = rawVP ? { x: rawVP.x, y: rawVP.y, zoom: rawVP.zoom } : null
        set((state) => {
          const viewId = state.activeViewId
          if (viewId === null) {
            state.defaultPositions = currentPos as any
            const shown = allElementsCamera(camera)
            if (shown) state.defaultViewport = shown
          } else if (viewById(state as DiagramStore, viewId)) {
            // A view of the document's, or the exploration.
            const view = viewById(state as DiagramStore, viewId)!
            if (viewId !== _firstLayoutOf) view.positions = viewCanvasPositions(view, get().c4Nodes, currentPos, viewDrawnIds(view as DiagramView, get().c4Nodes, get().c4Relations)) as any
            if (camera) view.viewport = camera
          }
        })
      },

      setViewEdgeStyle(viewId, style) {
        const view = get().views[viewId]
        if (!view || (view.edgeStyle ?? null) === style) return
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        set((state) => { model.setViewEdgeStyle(state, viewId, style) })
        get()._sync()
      },

      applyViewpoint(viewId, typeId, subjectId) {
        if (setByGroup(get(), viewId)) return false
        const view = get().views[viewId]
        const type = viewpointsOf(get().metamodel).find((t) => t.id === typeId)
        if (!view || !type) return false
        if (subjectId && !canBeSubject(type, get().c4Nodes[subjectId])) return false
        if (view.viewpoint === typeId && (subjectId === undefined || (subjectId ?? undefined) === view.subject)) return true
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        set((state) => { model.applyViewpoint(state as unknown as model.ModelState, viewId, typeId, subjectId) })
        get()._sync()
        return true
      },
      addViewOfViewpoint(typeId) {
        const type = viewpointsOf(get().metamodel).find((t) => t.id === typeId)
        if (!type) return null
        const id = uid()
        get()._pushUndo()
        set((state) => {
          model.insertView(state as unknown as model.ModelState, id, newViewName(type, state.views as Record<string, DiagramView>))
          model.applyViewpoint(state as unknown as model.ModelState, id, typeId, null)
        })
        // A group gets its views at once.
        get()._sync()
        return id
      },
      detachViewpoint(viewId) {
        if (!get().views[viewId]?.viewpoint || setByGroup(get(), viewId)) return
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        set((state) => { model.detachViewpoint(state as unknown as model.ModelState, viewId) })
      },
      setViewPipeline(viewId, pipeline) {
        const view = get().views[viewId]
        if (!view || setByGroup(get(), viewId)) return
        // Nothing changes: no undo step.
        const probe = { views: { [viewId]: { ...view } } } as unknown as model.ModelState
        model.setViewPipeline(probe, viewId, pipeline)
        if (JSON.stringify(probe.views[viewId].pipeline ?? {}) === JSON.stringify(view.pipeline ?? {})) return
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        set((state) => { model.setViewPipeline(state, viewId, pipeline) })
        get()._sync()
      },

      setDefaultEdgeStyle(style) {
        if (get().defaultEdgeStyle === style) return
        get()._pushUndo()
        set((state) => { state.defaultEdgeStyle = style })
        get()._sync()
      },

      orderViews(viewIds) {
        const views = get().views
        const before = Object.keys(views)
        const probe = { views: { ...views } } as Parameters<typeof model.orderViews>[0]
        model.orderViews(probe, viewIds)
        if (Object.keys(probe.views).every((id, i) => id === before[i])) return
        get()._pushUndo()
        set((state) => { model.orderViews(state, viewIds) })
        get()._sync()
      },

      moveViewFolder(path, direction) {
        const probe = { views: { ...get().views } } as Parameters<typeof model.moveViewFolder>[0]
        if (!model.moveViewFolder(probe, path, direction)) return
        get()._pushUndo()
        set((state) => { model.moveViewFolder(state, path, direction) })
        get()._sync()
      },

      renameViewFolder(path, name) {
        const to = viewFolderRenameTarget(Object.values(get().views), path, name)
        if (to === null || to === model.normalizeViewFolder(path)) return to
        get()._pushUndo()
        set((state) => { model.renameViewFolder(state, path, name) })
        get()._sync()
        return to
      },

      setViewFolder(viewId, folder) {
        const view = get().views[viewId]
        if (!view || (view.folder ?? '') === model.normalizeViewFolder(folder)) return
        get()._pushUndo()
        set((state) => { model.setViewFolder(state, viewId, folder) })
        get()._sync()
      },

      setViewCollapsed(viewId, nodeIds, collapsed) {
        const view = get().views[viewId]
        if (!view) return
        // On the canvas shown, as its −/+ does: the box shrinks to its
        // middle, or opens round it and makes room. The lists alone opened
        // it at the folded box's corner, over its neighbours.
        if (get().activeViewId === viewId && (view.kind ?? 'static') === 'static') {
          const toggled = nodeIds.filter((id) => {
            const n = get().c4Nodes[id]
            return !!n && isContainerType(n.type) && nodeEffectivelyCollapsedInView(n, viewId, get().views[viewId]) !== collapsed
          })
          if (toggled.length === nodeIds.length) {
            _asOneStep(() => { for (const id of toggled) get().toggleCollapse(id) })
            return
          }
        }
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        set((state) => { model.setViewCollapsed(state, viewId, nodeIds, collapsed) })
        get()._sync()
      },

      setViewKind(viewId, kind) {
        const view = get().views[viewId]
        if (!view || setByGroup(get(), viewId)) return
        // Nothing changes: no undo step.
        if ((view.kind ?? 'static') === kind && !view.viewpoint && !view.subject) return
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        let placed: string[] | null = null
        const wasCanvas = (view.kind ?? 'static') === 'static'
        const explored = isExploration(view) ? view : null
        // Turned into an exploration on screen: the camera shows its start.
        let framed: string | null = null
        set((state) => {
          const shown = state.activeViewId === viewId
          const nodes = state.c4Nodes as Record<string, C4Node>
          const relations = state.c4Relations as Record<string, C4Relation>
          // An exploration turned into another view keeps its elements and
          // its places, as a structure view keeps them: relative to their
          // parents, round what they hold (a child it listed with its parent
          // goes in it), where it drew them; for its canvas when it is not one.
          if (explored && kind !== 'explore') {
            const flat = shown ? snapshotPositions(nodes) : explored.positions as Record<string, NodePosition>
            const places = viewPlaces(explored, flat, nodes)
            model.setViewKind(state, viewId, kind)
            const now = state.views[viewId] as DiagramView
            now.positions = places
            if (shown && kind === 'static') placed = showCanvasPositions(nodes, places, now, relations)
            return
          }
          // A view turned into an exploration: of the elements it shows, grown
          // from the one selected on it (else its first) as each element's +
          // would have grown it within them, laid out level by level with
          // that element where it is drawn.
          if (kind === 'explore') {
            const v = state.views[viewId] as DiagramView
            const drawnIds = viewShownNodes(v, nodes, relations)
            const ids = drawnIds ? [...v.nodeIds.filter((id) => drawnIds.has(id)), ...[...drawnIds].filter((id) => !v.nodeIds.includes(id))] : Object.keys(nodes)
            const selected = shown ? state.selectedNodeId : null
            const start = selected && ids.includes(selected) ? selected : ids.find((id) => !!nodes[id])
            model.setViewKind(state, viewId, kind)
            if (!start) {
              Object.assign(v, { nodeIds: [], empty: true, positions: {}, explore: { start: '', levels: {}, addedBy: {}, expansions: {} } })
              return
            }
            const grownView = explorationOf(v, ids, start, nodes, relations, uid)
            // Where the start is drawn: on its canvas, or the one it kept.
            const kept = shown && wasCanvas ? snapshotPositions(nodes) : (v.positions ?? {}) as Record<string, NodePosition>
            let at: { x: number; y: number } | undefined
            if (kept[start]) {
              at = { x: 0, y: 0 }
              for (let id: string | undefined = start; id && nodes[id]; id = nodes[id].parentId) {
                const p = kept[id] ?? nodes[id]
                at.x += p.x
                at.y += p.y
              }
            }
            const places = layExploration(grownView, nodes, relations, at)
            v.nodeIds = grownView.nodeIds
            delete v.empty
            v.explore = grownView.explore
            v.positions = places
            const hidden = explorationLines(grownView, nodes, relations).hidden
            if (hidden.length) v.hiddenRelationIds = hidden
            else delete v.hiddenRelationIds
            if (shown) {
              placed = showCanvasPositions(nodes, places, v, relations)
              framed = start
            }
            return
          }
          // Shown as a table (or another kind with no canvas), the view keeps
          // the layout its canvas had until now, for when it is a canvas again.
          if (shown && wasCanvas && kind !== 'static' && !state.activeSnapshotId) {
            const view = state.views[viewId] as DiagramView
            const nodes = state.c4Nodes as Record<string, C4Node>
            view.positions = viewCanvasPositions(view, nodes, snapshotPositions(nodes), viewDrawnIds(view, nodes, state.c4Relations as Record<string, C4Relation>))
          }
          model.setViewKind(state, viewId, kind)
          if (!shown) return
          // Turned into a canvas, a view shows the positions it kept; one
          // with none of its own shows All elements' places, not the canvas
          // shown before it.
          const view = state.views[viewId] as DiagramView
          const first = firstCanvasPositions(view, state.defaultPositions as Record<string, NodePosition>, state.activeSnapshotId ? _milestoneAllPositions : null)
            ?? (!wasCanvas && kind === 'static' ? view.positions : undefined)
          if (first) placed = showCanvasPositions(state.c4Nodes as Record<string, C4Node>, first, view, state.c4Relations as Record<string, C4Relation>, liveWhileInMilestone(state as DiagramStore))
        })
        get()._sync()
        // The live layout drops what it had of the canvas shown before (and,
        // shown as no canvas, lays nothing out).
        if (placed) _liveLayout?.reset(placed)
        else if (get().activeViewId === viewId) _liveLayout?.reset()
        if (framed && typeof window !== 'undefined') (window as any).__rfShowAdded?.(get().views[viewId]?.nodeIds ?? [], [framed])
      },

      setTreemapFocus(viewId, focusId) {
        set((state) => {
          const view = state.views[viewId]
          if (!view) return
          view.treemapFocusId = focusId
        })
        get()._sync()
      },

      setWikiFocus(viewId, focusId) {
        set((state) => {
          const view = state.views[viewId]
          if (!view) return
          view.wikiFocusId = focusId
        })
        get()._sync()
      },

      setWikiPageMode(viewId, mode) {
        // Kept with the view: a step of its own, as the Depth.
        const view = get().views[viewId]
        if (!view || (view.wikiPageMode ?? 'single') === mode) return
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        set((state) => {
          const view = state.views[viewId]
          if (!view) return
          view.wikiPageMode = mode
        })
        get()._sync()
      },

      setWikiDepth(viewId, depth) {
        const view = get().views[viewId]
        if (!view || wikiDepthOf(view) === wikiDepthOf({ wikiDepth: depth })) return
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        set((state) => {
          const view = state.views[viewId]
          if (!view) return
          view.wikiDepth = wikiDepthOf({ wikiDepth: depth })
        })
        get()._sync()
      },

      // Size and Levels are steps of their own, as Multi page and Depth
      // are: Undo of an earlier step gave back the old ones with it (saved).
      setTreemapSizeBy(viewId, mode) {
        const view = get().views[viewId]
        if (!view || (view.treemapSizeBy ?? 'leaves') === mode) return
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        set((state) => {
          const view = state.views[viewId]
          if (!view) return
          view.treemapSizeBy = mode
        })
        get()._sync()
      },

      setTreemapMaxDepth(viewId, depth) {
        const view = get().views[viewId]
        // Unset is 2 levels (TreemapView); null is all of them.
        const levels = (d: number | null | undefined): number | null => d === null ? null : typeof d === 'number' && d > 0 ? d : 2
        if (!view || levels(view.treemapMaxDepth) === levels(depth)) return
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        set((state) => {
          const view = state.views[viewId]
          if (!view) return
          view.treemapMaxDepth = depth
        })
        get()._sync()
      },

      // A step of its own, as Size and Levels are: Undo of an earlier step
      // gave back the old mode with it (saved).
      setViewLayoutMode(viewId, mode) {
        const view = get().views[viewId]
        if (!view || (view.layoutMode ?? 'auto') === mode) return
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        set((state) => {
          const view = state.views[viewId]
          if (!view) return
          view.layoutMode = mode
        })
        get()._sync()
      },

      addAlignment(axis, nodeIds, options = {}) {
        const viewId = get().activeViewId
        const ordered = !!options.ordered
        const ids = [...new Set(nodeIds)]
        const refused = model.checkAddAlignment(get(), viewId, axis, ids, ordered)
        if (refused) {
          get().pushNotification(refused, 'error')
          return null
        }
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        const id = uid()
        set((state) => { model.insertAlignment(state, viewId, id, axis, ids, ordered) })
        get()._enforceLayoutConstraints()
        // The members were snapped onto their line: what they now cover is
        // pushed clear; the rest of the diagram stays.
        _liveLayout?.reset([], ids)
        return id
      },

      addGrid(nodeIds, columns) {
        const viewId = get().activeViewId
        const ids = [...new Set(nodeIds)]
        const cols = columns ?? defaultGridColumns(ids.length)
        const refused = model.checkAddGrid(get(), viewId, ids, cols)
        if (refused) {
          get().pushNotification(refused, 'error')
          return null
        }
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        const id = uid()
        set((state) => { model.insertGrid(state, viewId, id, ids, cols) })
        get()._arrangeGrid(id)
        _liveLayout?.reset([], ids)
        return id
      },

      setGridColumns(id, columns, viewIdArg) {
        const viewId = viewIdArg === undefined ? get().activeViewId : viewIdArg
        const c = model.layoutConstraintsOf(get(), viewId).find((x) => x.id === id)
        if (!c || c.type !== 'grid' || c.columns === columns) return
        const refused = model.checkGridColumns(get(), viewId, id, columns)
        if (refused) {
          get().pushNotification(refused, 'error')
          return
        }
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        set((state) => { model.setGridColumns(state, viewId, id, columns) })
        if (viewId === get().activeViewId) {
          get()._arrangeGrid(id)
          _liveLayout?.reset([], c.nodeIds)
        }
      },

      _arrangeGrid(id) {
        const c = activeLayoutConstraints(get()).find((x) => x.id === id)
        if (!c || c.type !== 'grid') return
        const input = layoutInputForView(get())
        // Members inside a collapsed container are laid out as if it were
        // open, so the grid is in place when it is expanded.
        const open = { ...input.nodes }
        for (const member of c.nodeIds) {
          for (let p = open[member]?.parentId; p && open[p]; p = open[p].parentId) {
            if (open[p].collapsed) open[p] = { ...open[p], collapsed: false }
          }
        }
        const { nodes } = projectToVisibleGraph(open, input.relations)
        const positions = arrangeGrid(nodes, {}, c)
        set((state) => {
          for (const member of c.nodeIds) {
            const n = state.c4Nodes[member]
            const p = positions[member]
            if (n && p) { n.x = p.x; n.y = p.y }
          }
        })
        get()._sync()
        get()._enforceLayoutConstraints()
      },

      setAlignmentOrdered(id, ordered, viewIdArg) {
        const viewId = viewIdArg === undefined ? get().activeViewId : viewIdArg
        const c = model.layoutConstraintsOf(get(), viewId).find((x) => x.id === id)
        if (!c || c.type !== 'align' || !!c.ordered === ordered) return
        const ids = ordered ? c.nodeIds : null
        if (ids) {
          const refused = model.checkAlignmentOrder(get(), viewId, id, ids)
          if (refused) {
            get().pushNotification(refused, 'error')
            return
          }
        }
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        set((state) => { model.setAlignmentOrder(state, viewId, id, ids) })
        if (viewId === get().activeViewId) {
          get()._enforceLayoutConstraints()
          _liveLayout?.reset([], c.nodeIds)
        }
      },

      unpinNodes(ids) {
        const viewId = get().activeViewId
        const pinned = pinnedNodeIds(model.layoutConstraintsOf(get(), viewId))
        if (!ids.some((id) => pinned.includes(id))) return
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        set((state) => { model.setPinned(state, viewId, ids, false, uid) })
        _liveLayout?.invalidate()
      },

      removeLayoutConstraint(ids, viewIdArg) {
        const viewId = viewIdArg === undefined ? get().activeViewId : viewIdArg
        const remove = new Set(typeof ids === 'string' ? [ids] : ids)
        if (!model.layoutConstraintsOf(get(), viewId).some((c) => remove.has(c.id))) return
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        set((state) => { for (const id of remove) model.deleteLayoutConstraint(state, viewId, id) })
        if (viewId === get().activeViewId) _liveLayout?.invalidate()
      },

      _enforceLayoutConstraints() {
        const input = layoutInputForView(get())
        if (!input.alignments.length) return
        let moved = false
        set((state) => { moved = applyAlignments(state.c4Nodes, input) })
        if (moved) get()._sync()
      },

      setViewSequence(viewId, sequenceId) {
        const view = get().views[viewId]
        if (!view || (view.sequenceId ?? null) === (sequenceId ?? null)) return
        get()._pushUndo()
        get()._milestoneViewEdit(viewId)
        set((state) => {
          const view = state.views[viewId]
          if (!view) return
          view.sequenceId = sequenceId ?? undefined
        })
        get()._sync()
      },

      addViewFromSequence(sequenceId) {
        const { sequences, c4Relations } = get()
        const seq = sequences[sequenceId]
        const viewId = uid()
        // Collect unique node ids (source + target) for all relations in the sequence
        const nodeSet = new Set<string>()
        for (const relId of (seq?.relationIds ?? [])) {
          const rel = c4Relations[relId]
          if (rel) { nodeSet.add(rel.sourceId); nodeSet.add(rel.targetId) }
        }
        const name = seq ? `${seq.name} view` : 'Sequence view'
        get()._pushUndo()
        const view: DiagramView = { id: viewId, name, kind: 'dynamic', sequenceId, nodeIds: Array.from(nodeSet), positions: {} }
        // Made in a milestone, the view is made (views are the live model's),
        // but what it names of the milestone only (a sequence added there,
        // its elements) is not the live view's: that is parked without it,
        // as Propagate would find it. It was saved naming what the live
        // model lacks, also after Discard.
        const { activeSnapshotId, liveBackup } = get()
        const liveIds = liveBackup ? view.nodeIds.filter((id) => liveBackup.nodes[id]) : view.nodeIds
        const liveSequence = !liveBackup || !!liveBackup.sequences?.[sequenceId]
        const parked = activeSnapshotId && liveBackup && (!liveSequence || liveIds.length < view.nodeIds.length)
          ? { ...view, nodeIds: liveIds, sequenceId: liveSequence ? sequenceId : undefined }
          : null
        set((state) => {
          state.views[viewId] = view as any
          if (parked) state.liveBackup!.views = { ...state.liveBackup!.views, [viewId]: parked } as any
        })
        get().setActiveView(viewId)
        return viewId
      },

      // ── sequences ───────────────────────────────────────────────────────
      // Each edit of a sequence is an undo step (history entries carry the
      // sequences): Undo after one used to take back the edit before it.
      addSequence(name) {
        const id = uid()
        get()._pushUndo()
        set((state) => {
          state.sequences[id] = { id, name, relationIds: [] }
        })
        get()._markMilestoneEdit()
        return id
      },

      removeSequence(id) {
        if (!get().sequences[id]) return
        get()._pushUndo()
        // In a milestone, an edit of the views it unlinks too (they are the
        // live model's): a flow view lost its sequence for good, also after
        // Discard.
        for (const view of Object.values(get().views)) {
          if (view.sequenceId === id) get()._milestoneViewEdit(view.id)
        }
        set((state) => {
          delete state.sequences[id]
          // Unlink views that referenced this sequence
          for (const view of Object.values(state.views)) {
            if ((view as DiagramView).sequenceId === id) {
              (view as DiagramView).sequenceId = undefined
            }
          }
          if (state.activeSequenceId === id) state.activeSequenceId = null
        })
        get()._markMilestoneEdit()
        get()._sync()
      },

      renameSequence(id, name) {
        if (!get().sequences[id] || get().sequences[id].name === name) return
        get()._pushUndo()
        set((state) => {
          if (state.sequences[id]) state.sequences[id].name = name
        })
        get()._markMilestoneEdit()
      },

      setActiveSequence(id) {
        set((state) => { state.activeSequenceId = id })
        get()._sync()
      },

      toggleRelationInSequence(sequenceId, relationId) {
        if (!get().sequences[sequenceId]) return
        get()._pushUndo()
        set((state) => {
          const seq = state.sequences[sequenceId]
          if (!seq) return
          // Always append — the same relation may appear multiple times in a
          // sequence (e.g. step 2 and step 9). Use removeFromSequence to delete
          // individual occurrences via the step list in the right panel.
          seq.relationIds.push(relationId)
        })
        get()._markMilestoneEdit()
        get()._sync()
      },

      removeFromSequence(sequenceId, idx) {
        if (!get().sequences[sequenceId]) return
        get()._pushUndo()
        set((state) => {
          const seq = state.sequences[sequenceId]
          if (!seq) return
          seq.relationIds.splice(idx, 1)
          if (seq.stepDescriptions) seq.stepDescriptions.splice(idx, 1)
          if (seq.stepBackward) {
            seq.stepBackward.splice(idx, 1)
            const back = trimStepBackward(seq.stepBackward)
            if (back) seq.stepBackward = back
            else delete seq.stepBackward
          }
        })
        get()._markMilestoneEdit()
        get()._sync()
      },

      reorderSequence(sequenceId, fromIdx, toIdx) {
        const steps = get().sequences[sequenceId]?.relationIds.length ?? 0
        if (fromIdx < 0 || fromIdx >= steps || toIdx < 0 || toIdx >= steps || fromIdx === toIdx) return
        get()._pushUndo()
        set((state) => {
          const seq = state.sequences[sequenceId]
          if (!seq) return
          const arr = seq.relationIds
          const [item] = arr.splice(fromIdx, 1)
          arr.splice(toIdx, 0, item)
          if (seq.stepDescriptions) {
            // The notes are kept only up to the last step that has one.
            // Moved as they were, a step beyond them took nothing with it
            // and shifted the others: a note ended on another step.
            const notes = seq.stepDescriptions
            while (notes.length < arr.length) notes.push(undefined)
            const [desc] = notes.splice(fromIdx, 1)
            notes.splice(toIdx, 0, desc)
            while (notes.length > 0 && notes[notes.length - 1] === undefined) notes.pop()
          }
          if (seq.stepBackward) {
            // Each step keeps its way, as its note.
            const ways = arr.map((_, i) => isBackwardStep(seq, i))
            const [way] = ways.splice(fromIdx, 1)
            ways.splice(toIdx, 0, way)
            const back = trimStepBackward(ways)
            if (back) seq.stepBackward = back
            else delete seq.stepBackward
          }
        })
        get()._markMilestoneEdit()
        get()._sync()
      },

      clearSequence(sequenceId) {
        if (!get().sequences[sequenceId]) return
        get()._pushUndo()
        set((state) => {
          const seq = state.sequences[sequenceId]
          if (!seq) return
          seq.relationIds = []
          seq.stepDescriptions = []
          delete seq.stepBackward
        })
        get()._markMilestoneEdit()
        get()._sync()
      },

      updateStepDescription(sequenceId, idx, description) {
        const current = get().sequences[sequenceId]
        if (!current || idx < 0 || idx >= current.relationIds.length) return
        // A note left as it was is no edit: a click into it and out made an
        // undo step, and in a milestone asked how to save it.
        if ((current.stepDescriptions?.[idx] || undefined) === (description || undefined)) return
        get()._pushUndo()
        set((state) => {
          const seq = state.sequences[sequenceId]
          if (!seq) return
          if (!seq.stepDescriptions) seq.stepDescriptions = []
          // Pad with undefined if necessary
          while (seq.stepDescriptions.length <= idx) seq.stepDescriptions.push(undefined)
          seq.stepDescriptions[idx] = description || undefined
        })
        get()._markMilestoneEdit()
        get()._sync()
      },

      setStepBackward(sequenceId, idx, backward) {
        const current = get().sequences[sequenceId]
        if (!current || idx < 0 || idx >= current.relationIds.length) return
        if (isBackwardStep(current, idx) === backward) return
        get()._pushUndo()
        set((state) => {
          const seq = state.sequences[sequenceId]
          if (!seq) return
          const ways = seq.relationIds.map((_, i) => (i === idx ? backward : isBackwardStep(seq, i)))
          const back = trimStepBackward(ways)
          if (back) seq.stepBackward = back
          else delete seq.stepBackward
        })
        get()._markMilestoneEdit()
        get()._sync()
      },

      // ── React Flow sync ──────────────────────────────────────────────────
      onNodesChange(changes) {
        // Intercept Delete-key removals — show a confirmation prompt instead
        // of silently dropping nodes from the canvas (which previously left
        // them in the model and out-of-sync with rfNodes).
        const removals = changes.filter((c) => c.type === 'remove') as Array<{ type: 'remove'; id: string }>
        // Deleting is Designer's, and not while a presentation plays.
        if (removals.length > 0 && (get().appMode !== 'designer' || get().presentationActive)) return
        if (removals.length > 0) {
          const ids = removals.map((c) => c.id)
          set((state) => {
            const prev = state.pendingDelete ?? { nodeIds: [], edgeIds: [] }
            state.pendingDelete = {
              nodeIds: Array.from(new Set([...prev.nodeIds, ...ids])),
              edgeIds: prev.edgeIds,
            }
          })
        }
        const passthrough = changes.filter((c) => c.type !== 'remove')
        set((state) => {
          // During live layout, Cola controls non-dragged node positions.
          // But we MUST let ReactFlow's own drag position changes through
          // so the user sees immediate feedback (no 1-frame delay via Cola).
          // Filter out dimension changes from Cola — rfNodes get those via applyPositions.
          const effectiveChanges = state.liveLayoutActive
            ? passthrough.filter((c) => c.type !== 'dimensions')
            : passthrough
          state.rfNodes = applyNodeChanges(effectiveChanges, state.rfNodes) as any

          // Track multi-selection driven by ReactFlow (shift/cmd-click,
          // selection box). We rebuild selectedNodeIds from the current
          // rfNodes' selected flag so it reflects the true UI state, in
          // selection order: nodes still selected keep their place, newly
          // selected ones follow in the order of the changes.
          const hasSelectChange = passthrough.some(c => c.type === 'select')
          if (hasSelectChange) {
            const selectedNow = new Set<string>()
            for (const rn of state.rfNodes) {
              if ((rn as any).selected) selectedNow.add(rn.id)
            }
            const ids = state.selectedNodeIds.filter((id) => selectedNow.has(id))
            for (const c of passthrough) {
              if (c.type === 'select' && c.selected && selectedNow.has(c.id) && !ids.includes(c.id)) ids.push(c.id)
            }
            for (const id of selectedNow) if (!ids.includes(id)) ids.push(id)
            state.selectedNodeIds = ids
            state.selectedNodeId = ids[0] ?? state.selectedNodeId
            // Compatibility with single-select consumers: when nothing is
            // selected on canvas, also clear the primary id.
            if (ids.length === 0) state.selectedNodeId = null
            if (ids.length > 0) state.selectedEdgeId = null
          }

          for (const change of passthrough) {
            if (change.type === 'select' && change.id) {
              if (change.selected) state.selectedNodeId = change.id
            }
          }
        })
      },

      onEdgesChange(changes) {
        const removals = changes.filter((c) => c.type === 'remove') as Array<{ type: 'remove'; id: string }>
        // Deleting is Designer's, and not while a presentation plays.
        if (removals.length > 0 && (get().appMode !== 'designer' || get().presentationActive)) return
        if (removals.length > 0) {
          const ids = removals.map((c) => c.id)
          set((state) => {
            const prev = state.pendingDelete ?? { nodeIds: [], edgeIds: [] }
            state.pendingDelete = {
              nodeIds: prev.nodeIds,
              edgeIds: Array.from(new Set([...prev.edgeIds, ...ids])),
            }
          })
        }
        const passthrough = changes.filter((c) => c.type !== 'remove')
        set((state) => {
          state.rfEdges = applyEdgeChanges(passthrough, state.rfEdges) as any
          for (const change of passthrough) {
            if (change.type === 'select' && change.id && change.selected) {
              // Don't select edge when a sequence is being edited — clicks are sequence toggles
              if (!state.activeSequenceId) {
                state.selectedEdgeId = change.id
              }
            }
          }
        })
      },

      resolvePendingDelete(action) {
        const pending = get().pendingDelete
        if (!pending) return
        // Always clear pending first so the modal closes immediately.
        set((state) => { state.pendingDelete = null })
        if (action === 'cancel') return

        const { nodeIds, edgeIds } = pending
        // One undo step for the whole delete. Each element and relation used
        // to take its own, and the relations React Flow hands over with the
        // elements were gone already with them: the first Undos did nothing,
        // then the elements came back one at a time.
        const removeFromModel = (): void => {
          for (const id of nodeIds) if (get().c4Nodes[id]) get().removeNode(id)
          for (const id of edgeIds) if (get().c4Relations[id]) get().removeRelation(id)
        }
        _asOneStep(() => {
          if (action === 'view') {
            const viewId = get().activeViewId
            if (viewId) {
              // Hide nodes from the active view only. Edges follow their
              // endpoints, so we don't need a separate edge-hide step.
              for (const id of nodeIds) get().removeNodeFromView(viewId, id)
            } else {
              // No active view → fall back to model deletion.
              removeFromModel()
            }
            return
          }
          removeFromModel()
        })
      },

      resolveOverlaps(draggedId) {
        // 1. Separate direct siblings of the dragged node
        const siblingUpdates = separateSiblings(draggedId, get().c4Nodes)
        if (Object.keys(siblingUpdates).length > 0) {
          set((state) => {
            for (const [id, pos] of Object.entries(siblingUpdates)) {
              const n = state.c4Nodes[id]
              if (n) { n.x = pos.x; n.y = pos.y }
            }
          })
        }
        // 2. Walk up ancestors: refit parent, then separate parent's siblings
        let curId: string | undefined = get().c4Nodes[draggedId]?.parentId ?? undefined
        while (curId) {
          get().fitParentToChildren(curId)
          const updates = separateSiblings(curId, get().c4Nodes)
          if (Object.keys(updates).length > 0) {
            set((state) => {
              for (const [id, pos] of Object.entries(updates)) {
                const n = state.c4Nodes[id]
                if (n) { n.x = pos.x; n.y = pos.y }
              }
            })
          }
          curId = get().c4Nodes[curId]?.parentId ?? undefined
        }
        get()._sync()
      },

      fitParentToChildren(parentId, viewFilter, viewCollapsedSet, expandedSet) {
        const { c4Nodes } = get()
        const parent = c4Nodes[parentId]
        if (!parent || !isContainerType(parent.type)) return
        // Don't resize a collapsed node (model-collapsed or view-collapsed)
        if (isEffectivelyCollapsed(parent, viewCollapsedSet, expandedSet)) return

        let children = Object.values(c4Nodes).filter((c) => c.parentId === parentId)
        // When a view filter is active, only consider children in the view
        if (viewFilter) children = children.filter((c) => viewFilter.has(c.id))
        if (children.length === 0) return

        const { width: newW, height: newH } = fittedParentSize(parent, children.map((child) => ({
          x: child.x,
          y: child.y,
          width: effectiveNodeWidth(child, viewCollapsedSet, expandedSet),
          height: effectiveNodeHeight(child, viewCollapsedSet, expandedSet),
        })))

        set((state) => {
          const n = state.c4Nodes[parentId]
          if (!n) return
          n.width = newW
          n.height = newH
          const rfIdx = state.rfNodes.findIndex((rn) => rn.id === parentId)
          if (rfIdx !== -1) {
            ;(state.rfNodes[rfIdx] as any).style = {
              ...(state.rfNodes[rfIdx].style ?? {}),
              width: newW,
              height: newH,
            }
            ;(state.rfNodes[rfIdx] as any).width = newW
            ;(state.rfNodes[rfIdx] as any).height = newH
          }
        })
        // A parent that grew (or shrank) changes its own parent: a step
        // added to a process inside a system grew the process past the
        // system's frame. Refit up the tree, as fitAncestors does headlessly.
        if ((newW !== parent.width || newH !== parent.height) && parent.parentId && parent.parentId !== parentId) {
          get().fitParentToChildren(parent.parentId, viewFilter, viewCollapsedSet, expandedSet)
        }
      },

      // ── layout ───────────────────────────────────────────────────────────

      /** Resize every parent container bottom-up after children have moved. */
      _resizeParentsBottomUp(viewFilter, viewCollapsedSet, expandedSet) {
        const allNodes = Object.values(get().c4Nodes)
        // Only process parents that are in the view (or all if no filter)
        const relevantNodes = viewFilter
          ? allNodes.filter((n) => viewFilter.has(n.id))
          : allNodes
        const parentIds = [...new Set(
          relevantNodes.filter((n) => n.parentId).map((n) => n.parentId!)
        )]
        const nodeDepth = (id: string): number => {
          const n = get().c4Nodes[id]
          return n?.parentId ? 1 + nodeDepth(n.parentId) : 0
        }
        parentIds.sort((a, b) => nodeDepth(b) - nodeDepth(a)) // deepest first
        for (const pid of parentIds) {
          get().fitParentToChildren(pid, viewFilter, viewCollapsedSet, expandedSet)
        }
      },

      runRadicalLayout() {
        if (get().appMode !== 'designer') return
        set((state) => { state.isLayoutRunning = true })
        try {
          const input = layoutInputForView(get())
          const { viewFilter: vf, viewCollapsedSet: vcs, expandedSet } = input
          const positions = applyRadicalLayout(input.nodes, input.relations)
          set((state) => {
            applyLayoutPositions(state.c4Nodes, positions, input)
            unpinLaidOut(state, get().appMode)
          })

          // Resize parents bottom-up for any compound nodes not sized by radical
          get()._resizeParentsBottomUp(vf, vcs, expandedSet)
          get()._sync()

          // Crossing minimisation: swap siblings to reduce edge crossings/overlaps
          const { nodes: viewNodes, relations: viewRels } = layoutInputForView(get())
          const crossOpt = minimizeCrossings(viewNodes, viewRels)
          if (Object.keys(crossOpt).length > 0) {
            set((state) => {
              for (const [id, pos] of Object.entries(crossOpt)) {
                const n = state.c4Nodes[id]
                if (n) { n.x = pos.x; n.y = pos.y }
              }
            })
            get()._resizeParentsBottomUp(vf, vcs, expandedSet)
            get()._sync()
          }

          // Post-layout collision safety
          const { nodes: safetyNodes } = layoutInputForView(get())
          const rootIds = Object.values(safetyNodes)
            .filter((n) => !n.parentId)
            .map((n) => n.id)
          for (const id of rootIds) {
            const updates = separateSiblings(id, safetyNodes)
            if (Object.keys(updates).length > 0) {
              set((state) => {
                for (const [sid, pos] of Object.entries(updates)) {
                  const n = state.c4Nodes[sid]
                  if (n) { n.x = pos.x; n.y = pos.y }
                }
              })
            }
          }
          if (rootIds.length > 0) get()._sync()
          get()._enforceLayoutConstraints()
        } finally {
          set((state) => { state.isLayoutRunning = false })
        }
      },

      async runTreeLayout() {
        if (get().appMode === 'metamodel') return
        set((state) => { state.isLayoutRunning = true })
        try {
          const input = layoutInputForView(get())
          const { viewFilter: vf, viewCollapsedSet: vcs, expandedSet } = input
          const target = layoutTarget(get())
          const present = parentsOf(get().c4Nodes)
          const positions = await applyTreeLayout(input.nodes, input.relations)
          if (layoutTarget(get()) !== target) {
            layoutMissedItsCanvas(get().pushNotification)
            return
          }
          // One undo step for the whole layout. Viewer reverts positions on
          // exit anyway; the exploration's places are no step's.
          if (get().appMode === 'designer' && !onExploration(get())) get()._pushUndo()
          get()._milestoneViewEdit(get().activeViewId)
          // Added or moved into another parent by an outside write meanwhile.
          const added = layoutChangedMeanwhile(present, get().c4Nodes)
          set((state) => {
            applyLayoutPositions(state.c4Nodes, positionsWithout(positions, added), input)
            if (added.length) placeAddedDuringLayout(state, added)
            // A container the refit grows past what ELK laid it out at lay
            // on its neighbour: siblings are parted, level by level.
            fitAndSeparateBottomUp(state.c4Nodes, input)
            unpinLaidOut(state, get().appMode)
          })
          get()._resizeParentsBottomUp(vf, vcs, expandedSet)

          // Final collision-safety pass at root level.
          const { nodes: safetyNodes } = layoutInputForView(get())
          const rootIds = Object.values(safetyNodes)
            .filter((n) => !n.parentId)
            .map((n) => n.id)
          for (const id of rootIds) {
            const updates = separateSiblings(id, safetyNodes)
            if (Object.keys(updates).length > 0) {
              set((state) => {
                for (const [sid, pos] of Object.entries(updates)) {
                  const n = state.c4Nodes[sid]
                  if (n) { n.x = pos.x; n.y = pos.y }
                }
              })
            }
          }
          get()._sync()
          get()._enforceLayoutConstraints()

          // Drop cola caches so the live layout doesn't snap nodes back to
          // their pre-layout positions on the next rebuild.
          _liveLayout?.reset()
          saveLayoutNow(get().appMode)
          if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(() => { _getFitViewFn()?.() })
          } else {
            _getFitViewFn()?.()
          }
          get().pushNotification('Hierarchical tree layout applied.', 'info')
        } finally {
          set((state) => { state.isLayoutRunning = false })
        }
      },

      async runSmartLayout() {
        // Allowed in designer and viewer (viewer = explore: positions are
        // reverted on exit by the __preModeLayout snapshot in setAppMode).
        // Disallowed in metamodel where the canvas isn't shown.
        // The first layout of the view shown (arrangeOnFirstOpen).
        const firstOpen = _firstLayoutOf !== null && _firstLayoutOf === get().activeViewId ? _firstLayoutOf : null
        if (get().appMode === 'metamodel') {
          if (firstOpen) _firstLayoutOf = null
          return
        }
        // Per-view layout-mode override: views configured for the
        // hierarchical nested-tree strategy delegate here. Default is
        // unchanged (ensemble Smart Layout).
        {
          const s = get()
          const v = s.activeViewId ? s.views[s.activeViewId] : undefined
          if (v?.layoutMode === 'tree') {
            if (firstOpen) _firstLayoutOf = null
            await get().runTreeLayout()
            return
          }
        }
        set((state) => { state.isLayoutRunning = true; state.smartLayoutProgress = { phase: 'candidates', done: 0, total: 10 } })
        try {
          const input = layoutInputForView(get())
          // A view that shows nothing yet (a new model's views) has nothing
          // to lay out, and nothing to warn about: its first layout waits.
          if (!Object.keys(input.nodes).length) {
            if (firstOpen && _firstLayoutOf === firstOpen) _firstLayoutOf = null
            return
          }
          const { viewFilter: vf, viewCollapsedSet: vcs, expandedSet } = input
          const target = layoutTarget(get())
          const present = parentsOf(get().c4Nodes)
          const result = await runSmartLayout(input.nodes, input.relations, get().metamodel as Metamodel | undefined, (progress) => {
            set((s) => { s.smartLayoutProgress = progress })
          }, { alignments: input.alignments, edgeStyle: model.edgeStyleOf(get(), get().activeViewId) })
          if (layoutTarget(get()) !== target) {
            layoutMissedItsCanvas(get().pushNotification)
            return
          }
          if (result.candidates.length === 0) {
            get().pushNotification('Smart layout: no candidate produced a result.', 'warning')
            return
          }
          if (result.keptCurrent) {
            // A view's first layout that keeps the places it opened with:
            // they become its own, with no notice. It kept no positions,
            // and the view stayed one never laid out.
            if (firstOpen) {
              if (_firstLayoutOf === firstOpen) _firstLayoutOf = null
              get()._saveShownCanvas()
              const view = get().views[firstOpen]
              if (view) _historyKeepsFirstLayout(firstOpen, view.positions)
              return
            }
            get().pushNotification('Smart layout: the current layout already scores best — nothing changed.', 'info')
            return
          }
          // One undo step for the whole layout. Viewer reverts positions on
          // exit anyway; a view's first layout is none (_firstLayoutOf).
          if (get().appMode === 'designer' && !firstOpen && !onExploration(get())) get()._pushUndo()
          get()._milestoneViewEdit(get().activeViewId)
          // Added while the layout ran: its drop point was a place in the
          // layout this one replaces (893 px from anything on 300
          // elements). It is placed as a new element here, in the layout's
          // undo step (D11). One moved into another parent meanwhile, here
          // or by an outside write, has a place in the old parent in the
          // layout: it keeps the one the move gave it, by the rule for moves.
          const changed = layoutChangedMeanwhile(present, get().c4Nodes)
          const added = changed.filter((id) => !present.has(id))
          const reparented = changed.filter((id) => present.has(id))
          set((state) => {
            applyLayoutPositions(state.c4Nodes, positionsWithout(result.winner.positions, changed), input)
            unpinLaidOut(state, get().appMode)
          })
          if (added.length) set((state) => { placeAddedDuringLayout(state, added) })
          if (reparented.length) {
            const oldParents = [...new Set(reparented.map((id) => present.get(id)).filter((p): p is string => !!p))]
            const settled = settleMoveOnShownCanvas(get(), reparented, oldParents)
            set((state) => { writeGeometry(state, settled) })
          }
          get()._resizeParentsBottomUp(vf, vcs, expandedSet)

          // Final collision-safety pass at root level (same as ELK/Radical paths).
          const { nodes: safetyNodes } = layoutInputForView(get())
          const rootIds = Object.values(safetyNodes)
            .filter((n) => !n.parentId)
            .map((n) => n.id)
          for (const id of rootIds) {
            const updates = separateSiblings(id, safetyNodes)
            if (Object.keys(updates).length > 0) {
              set((state) => {
                for (const [sid, pos] of Object.entries(updates)) {
                  const n = state.c4Nodes[sid]
                  if (n) { n.x = pos.x; n.y = pos.y }
                }
              })
            }
          }
          get()._sync()
          // The parent refit and root separation above know nothing of the
          // user's alignments; put them back.
          get()._enforceLayoutConstraints()
          if (firstOpen) {
            if (_firstLayoutOf === firstOpen) _firstLayoutOf = null
            get()._saveShownCanvas()
            const view = get().views[firstOpen]
            if (view) _historyKeepsFirstLayout(firstOpen, view.positions)
          }

          // The live layout takes the new positions as they are: it does
          // not relax a diagram Smart Layout arranged (Smart Layout scored
          // that relaxation itself, as one of its candidates).
          _liveLayout?.reset()

          saveLayoutNow(get().appMode)

          // Friendly summary so the user sees what happened.
          const before = result.baseline
          const after = result.winner.metrics
          const pct = before.weightedCost > 0
            ? Math.max(0, Math.round((1 - after.weightedCost / before.weightedCost) * 100))
            : 0
          const planarTag = result.planarity.verdict === 'planar'
            ? 'planar ✓'
            : `${Math.round((1 - result.planarity.ratio) * 100)}% planar`
          const arrow = '\u2009\u2192\u2009'
          const msg = before.weightedCost === 0
            ? `Smart layout: ${result.winner.name} — ${after.crossings} crossings, ${after.overdraws} overdraws · ${planarTag}.`
            : `Smart layout: ${result.winner.name} — crossings ${before.crossings}${arrow}${after.crossings}, overdraws ${before.overdraws}${arrow}${after.overdraws} (${pct}% better) · ${planarTag}.`
          get().pushNotification(msg, 'info')
          // Auto fit-all so the user immediately sees the freshly-laid-out
          // diagram framed in the viewport. Defer one paint so React Flow
          // has applied the new node positions before fitView measures them.
          if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(() => { _getFitViewFn()?.() })
          } else {
            _getFitViewFn()?.()
          }
          // Console breadcrumb with full ranking + SA stats — useful for tuning.
          console.info(
            '[smartLayout]', result.winner.name,
            'crossings', after.crossings, 'overdraws', after.overdraws,
            '· SA', result.refinement.before.toFixed(0), arrow, result.refinement.after.toFixed(0),
            `(${result.refinement.iterations} iters)`,
            '· planarity', result.planarity.verdict, `(${result.planarity.crossingEdges}/${result.planarity.totalEdges})`,
            '· winner score', result.winner.score,
            '· ranking:', result.candidates.map((c) =>
              `${c.name} [composite=${c.score.composite.toFixed(0)} cross=${c.metrics.crossings}(rend${c.score.renderedCrossings}) over=${c.metrics.overdraws}(rend${c.score.renderedOverdraws}) loop=${c.score.stubLoopPenalty.toFixed(2)} olap=${c.score.nodeOverlap.toFixed(1)} long=${c.score.edgeLengthExcess.toFixed(1)} lmean=${c.score.edgeLengthMean.toFixed(2)} leaf=${c.score.leafCentrality.toFixed(2)} ar=${c.score.aspectPenalty.toFixed(2)} sym=${c.score.symmetryDeficit.toFixed(2)} lbl=${c.score.labelCrowding.toFixed(2)}]`,
            ).join(' | '),
          )
          // Same ranking, surfaced to the UI (previously console-only) so a
          // "why this layout?" panel can show it without opening DevTools.
          const report: SmartLayoutReport = {
            timestamp: Date.now(),
            winnerName: result.winner.name,
            candidates: result.candidates.map((c) => ({
              name: c.name,
              composite: c.score.composite,
              crossings: c.metrics.crossings,
              renderedCrossings: c.score.renderedCrossings,
              overdraws: c.metrics.overdraws,
              renderedOverdraws: c.score.renderedOverdraws,
              nodeOverlap: c.score.nodeOverlap,
              edgeLengthMean: c.score.edgeLengthMean,
              aspectPenalty: c.score.aspectPenalty,
              symmetryDeficit: c.score.symmetryDeficit,
            })),
            before: { crossings: before.crossings, overdraws: before.overdraws },
            after: { crossings: after.crossings, overdraws: after.overdraws },
            refinement: result.refinement,
            planarity: {
              verdict: result.planarity.verdict,
              crossingEdges: result.planarity.crossingEdges,
              totalEdges: result.planarity.totalEdges,
            },
          }
          set((state) => { state.lastSmartLayoutReport = report })
        } catch (err) {
          console.error('[smartLayout] failed:', err)
          get().pushNotification('Smart layout failed — see console.', 'error')
        } finally {
          if (firstOpen && _firstLayoutOf === firstOpen) _firstLayoutOf = null
          set((state) => { state.isLayoutRunning = false; state.smartLayoutProgress = null })
        }
      },

      setLayoutMode(mode) {
        set((state) => { state.layoutMode = mode })
      },

      startLiveLayout(opts?: { skipBulk?: boolean }) {
        const skipBulk = opts?.skipBulk ?? false
        if (_liveLayout?.running) return
        // Reuse existing instance if present so its _bulkDone flag persists
        // across pause/resume cycles (mode switches, presentation exit).
        // Re-creating would always do a full bulk re-arrange and visibly
        // shift the diagram.
        if (_liveLayout) {
          _liveLayout.start(skipBulk)
          set((state) => { state.liveLayoutActive = true })
          return
        }
        _liveLayout = new LiveColaLayout({
          // The same graph Smart Layout and the canvas see: the view's own
          // collapsed/expanded overrides included, so a node collapsed on All
          // elements but expanded in this view is a group here, not a leaf.
          getModel: () => {
            // Only a canvas is laid out. Behind a table, wiki, Warnier,
            // matrix or treemap view nobody sees the layout: it moved
            // nodes[].x/y for many seconds after an add, holding the save.
            const shown = get().activeViewId ? get().views[get().activeViewId!] : undefined
            if (shown && (shown.kind ?? 'static') !== 'static' && !isExploration(shown)) return { nodes: {}, relations: {}, alignments: [], pinned: [] }
            const { nodes, relations, alignments } = layoutInputForView(get())
            return { nodes, relations, alignments, pinned: pinnedNodeIds(activeLayoutConstraints(get())) }
          },
          onSettled: () => {
            set((state) => { state.liveLayoutMoving = false })
          },
          applyPositions: (positions) => {
            set((state) => {
              state.liveLayoutMoving = true
              // Update c4Nodes (source of truth) and patch rfNodes positions
              // in-place. Avoids full _sync() re-derive which would rebuild
              // all rfNodes/rfEdges arrays every animation frame.
              for (const [id, pos] of Object.entries(positions)) {
                const node = state.c4Nodes[id]
                if (!node) continue
                node.x = pos.x
                node.y = pos.y
                if (pos.width != null)  node.width  = pos.width
                if (pos.height != null) node.height = pos.height
              }
              // Patch rfNodes positions directly (O(n) but no new array refs)
              for (const rfNode of state.rfNodes) {
                const pos = positions[rfNode.id]
                if (!pos) continue
                rfNode.position = { x: pos.x, y: pos.y }
                const data = rfNode.data as C4NodeRFData
                // The layout sizes only groups that show children. A size for
                // a node drawn collapsed is a stale group box (a tick from
                // before the collapse) and would leave a big empty rectangle.
                if (data.collapsed || !data.hasChildren) continue
                if (pos.width != null || pos.height != null) {
                  if (pos.width != null) {
                    data.width = pos.width
                    rfNode.width = pos.width
                    if (!rfNode.style) rfNode.style = {}
                    ;(rfNode.style as any).width = pos.width
                  }
                  if (pos.height != null) {
                    data.height = pos.height
                    rfNode.height = pos.height
                    if (!rfNode.style) rfNode.style = {}
                    ;(rfNode.style as any).height = pos.height
                  }
                }
              }
            })
          },
        })
        _liveLayout.start(skipBulk)
        set((state) => { state.liveLayoutActive = true })
      },

      stopLiveLayout() {
        // Keep the LiveColaLayout instance around so a subsequent
        // startLiveLayout() doesn't redo the heavy first-time bulk
        // arrangement (which would shift every node from its current
        // position). The instance internally tracks _bulkDone.
        _liveLayout?.stop()
        set((state) => { state.liveLayoutActive = false })
      },

      liveGrab(nodeId, x, y, mode = 'calm', abs, withIds) {
        // Viewer and Presenter have no undo: what is moved there is put back
        // on the way out.
        // A drag on the exploration is a step of its own (ExplorationStep).
        const designer = get().appMode === 'designer'
        _beforeDrag = designer && !onExploration(get()) ? _captureState(get()) : null
        _explorationBeforeDrag = designer && onExploration(get()) ? explorationNow(get()) : null
        _liveLayout?.grab(nodeId, x, y, mode, abs, withIds)
        if (_dropLanding !== null) clearTimeout(_dropLanding)
        _dropLanding = null
        _dragHeld = true
      },

      liveDrag(nodeId, x, y, abs) {
        _liveLayout?.drag(nodeId, x, y, abs)
      },

      liveRelease(nodeId, withIds = [], moved = true) {
        // Where the drop landed comes from the layout, a frame or more later
        // (its worker answers): what waits for the drop (afterDrag) runs then.
        const landing = moved && !!_liveLayout?.running
        if (landing) _dropLanding = setTimeout(_dragLanded, DROP_LANDING_MS)
        _liveLayout?.release(nodeId, () => { if (_dropLanding !== null) _dragLanded() })
        // One undo step for the drag: the elements it moved or pushed go
        // back, and the pins it set come off. It used to have none, so the
        // next undo took back the drag together with whatever was done
        // before it.
        const before = _beforeDrag
        _beforeDrag = null
        if (moved && before && get().appMode === 'designer') {
          _pushUndoEntry(before)
          set((state) => { state.canUndo = true; state.canRedo = false })
        }
        const explored = _explorationBeforeDrag
        _explorationBeforeDrag = null
        if (moved && explored && get().exploration?.id === explored.id && get().appMode === 'designer') {
          _pushExplorationStep({ explored })
          set((state) => { state.canUndo = true; state.canRedo = false })
        }
        // The physics already holds it (release); the rule keeps it held
        // after a rebuild and in the saved file.
        // Not on an exploration: it is laid out level by level, and pins nothing.
        if (moved && get().appMode === 'designer' && !onExploration(get())) {
          get()._milestoneViewEdit(get().activeViewId)
          if (!shownExploration(get())) set((state) => { model.setPinned(state, state.activeViewId, [nodeId, ...withIds], true, uid) })
        }
        // A drag while editing a milestone is a real edit too — mark dirty
        // so the user is asked how to persist it (propagate / save as new).
        // Without this, positions never make it into the snapshot and switching
        // milestones reverts the move. A click (nothing moved) is no edit: it
        // asked how to save changes nobody had made.
        if (moved) get()._markMilestoneEdit()
        if (!landing) _dragLanded()
      },

      toggleSelectionFocus() {
        const next = !get().selectionFocus
        set((state) => { state.selectionFocus = next })
        updateStudioSettings({ selectionFocus: next })
      },

      setConnectionModifier(mod) {
        set((state) => { state.connectionModifier = mod })
      },

      setRelinking(relinking) {
        set((state) => { state.relinking = relinking })
      },

      startConnection(sourceId) {
        if (!editsModel(get())) return
        set((state) => { state.connectSource = sourceId })
      },

      cancelConnection() {
        set((state) => { state.connectSource = null })
      },

      // ── undo / redo ─────────────────────────────────────────────────────
      undo() {
        // Undo belongs to Designer: from Viewer or Presenter it took one of
        // Designer's steps, unseen (the canvas there is put back on return).
        if (get().appMode !== 'designer') return
        if (_undoStack.length === 0) return
        const item = _undoStack.pop()!
        // A step of the exploration's: it is put back as it was, the way it
        // is now going to Redo.
        if (isExplorationStep(item)) {
          const now = explorationNow(get())
          if (!now || now.id !== item.explored.id) return
          _redoStack.push({ explored: now })
          const changedSince = !!item.after && !sameExplorationShape(now, item.after)
          if (item.expansion && changedSince) {
            if (!onExploration(get())) get().setActiveView(now.id)
            _reshapeExploration(withoutExpansions(now, [item.expansion]), [], [], false)
          }
          else _restoreExploration(item.explored)
          return
        }
        _historyMark++
        // push current state to redo, on the step's canvas, where Undo goes
        const now = _captureState(get())
        // Redo goes there too, unless the view shown is one the step made:
        // Redo of "+ New view" stayed on the view it was made from.
        const after = isStepChange(item) ? item.from : now
        const before = isStepChange(item) ? item.to : item
        const made = after.activeViewId !== null && !before.views[after.activeViewId]
        const canvas = made ? after.activeViewId : before.activeViewId
        _redoStack.push(isStepChange(item) ? { from: item.to, to: _entryOnCanvas(item.from, canvas) } : _entryOnCanvas(now, canvas))
        _restoreHistoryItem(item, now, 'Undo')
      },

      clearModel() {
        _dropExplorationSteps()
        _pushUndo(get())
        get()._markMilestoneEdit()
        set((state) => {
          state.c4Nodes = {} as any
          state.c4Relations = {} as any
          state.views = {} as any
          state.exploration = null
          state.exploreMenuFor = null
          state.defaultLayoutConstraints = []
          state.defaultEdgeStyle = 'curved'
          state.sequences = {} as any
          state.activeViewId = null
          state.selectedNodeId = null
          state.selectedNodeIds = []
          state.selectedEdgeId = null
          state.canUndo = true
          state.canRedo = false
        })
        get()._sync()
        _liveLayout?.reset()
      },

      redo() {
        if (get().appMode !== 'designer') return
        if (_redoStack.length === 0) return
        const item = _redoStack.pop()!
        if (isExplorationStep(item)) {
          const now = explorationNow(get())
          if (now) _undoStack.push({ explored: now })
          _restoreExploration(item.explored)
          return
        }
        _historyMark++
        // push current state to undo, on the step's canvas, where Redo goes
        const now = _captureState(get())
        const canvas = (isStepChange(item) ? item.to : item).activeViewId
        _undoStack.push(isStepChange(item) ? { from: item.to, to: _entryOnCanvas(item.from, canvas) } : _entryOnCanvas(now, canvas))
        _restoreHistoryItem(item, now, 'Redo')
      },

      // ── snapshots (versions) ────────────────────────────────────────────
      createSnapshot(name) {
        const id = uid()
        // Reference the live model directly — safe under immer's copy-on-write
        // (see _captureState). Avoids cloning the whole model per snapshot.
        // With a view shown the nodes hold its positions: a milestone keeps
        // All elements' (what is not there yet keeps where it is).
        // With a milestone shown it is the live model that is captured
        // (decided 2026-10-22), at All elements' live places: the milestone
        // on the canvas was saved again as the newest one.
        const { c4Nodes, activeViewId, defaultPositions, activeSnapshotId, liveBackup } = get()
        const live = activeSnapshotId && liveBackup ? liveBackup : null
        const snap: DiagramSnapshot = {
          id,
          name,
          timestamp: Date.now(),
          nodes: live
            ? atDefaultPositions(Object.values(live.nodes), live.defaultPositions ?? defaultPositions)
            : activeViewId === null ? c4Nodes : atDefaultPositions(Object.values(c4Nodes), defaultPositions),
          relations: live ? live.relations : get().c4Relations,
          sequences: live ? live.sequences : get().sequences,
        }
        get()._pushUndo()
        set((state) => { state.snapshots.push(snap as any) })
        return id
      },

      restoreSnapshot(id) {
        const snap = get().snapshots.find(s => s.id === id)
        if (!snap) return
        // Edits of the milestone shown that were not kept or dropped yet:
        // that question comes first, as when another milestone is picked.
        if (get().activeSnapshotId && get().milestoneDirty) {
          set((state) => { state.milestonePromptOpen = true })
          return
        }
        // It is the live model that is replaced: show it again first, so
        // that the step below is one of its own (Undo gives it back). This
        // used to mark the milestone as the one shown instead: the next edit
        // of the live model asked about "editing a milestone", and with
        // another milestone shown the live model did not change at all.
        const fromMilestone = !!get().activeSnapshotId
        if (fromMilestone) {
          // The view on screen is laid out (arrangeOnFirstOpen) on the model
          // restored, not on the one it replaces.
          _arrangeOnLeavingMilestone = false
          try { get().discardMilestoneChanges() } finally { _arrangeOnLeavingMilestone = true }
        }
        _pushUndo(get())
        set((state) => {
          // The Hub template values its texts hold become the live ones.
          state.hubTemplates = milestoneHubTemplates(state.hubTemplates as Record<string, HubImportRecord>, snap.nodes as Record<string, C4Node>) as any
          // What the milestone lacks goes out of the views, as a delete
          // takes it: they kept its id (a view listing 23 drew 3).
          const gone = new Set(Object.keys(state.c4Nodes).filter((id) => !(snap.nodes as Record<string, C4Node>)[id]))
          state.c4Nodes = snap.nodes as any
          state.c4Relations = snap.relations as any
          if (gone.size) model.forgetNodesInViews(state as unknown as model.ModelState, gone)
          // What the milestone has: none when it was saved without them.
          state.sequences = (snap.sequences ?? {}) as any
          if (state.activeSequenceId && !state.sequences[state.activeSequenceId]) state.activeSequenceId = null
          state.canUndo = _undoStack.length > 0
          state.canRedo = _redoStack.length > 0
        })
        // The milestone's nodes hold its All elements positions; a view shown
        // keeps its own layout.
        get()._showLiveCanvasPositions()
        get()._sync()
        _liveLayout?.reset()
        if (fromMilestone) arrangeOnFirstOpen()
      },

      removeSnapshot(id) {
        const milestone = get().snapshots.find((m) => m.id === id)
        if (!milestone) return
        // The milestone shown is left first, as Discard leaves it: the step
        // is one of the live model's, and Undo gives the milestone back.
        if (get().activeSnapshotId === id) get().discardMilestoneChanges()
        get()._pushUndo()
        let unlinked = 0
        set((state) => {
          state.snapshots = state.snapshots.filter(s => s.id !== id) as any
          // The slides that showed it show the live model (as the MCP
          // server's delete_milestone does): they kept its id, a "?".
          for (const pres of state.presentations) {
            for (const slide of pres.slides) {
              if (slide.snapshotId === id) { unlinkSlide(slide); unlinked++ }
            }
            if (pres.id === state.activePresentationId) state.presentationSlides = pres.slides
          }
          state.canUndo = _undoStack.length > 0
          state.canRedo = _redoStack.length > 0
        })
        if (unlinked) {
          get().pushNotification(`Deleted milestone "${milestone.name}": ${unlinked === 1 ? 'the slide that showed it shows' : `the ${unlinked} slides that showed it show`} the live model now.`, 'info')
        }
      },

      renameSnapshot(id, name) {
        const milestone = get().snapshots.find((m) => m.id === id)
        if (!milestone || milestone.name === name) return
        get()._pushUndo()
        set((state) => {
          const snap = state.snapshots.find(s => s.id === id)
          if (snap) snap.name = name
        })
      },

      // ── Milestone editing workflow ───────────────────────────────────────
      selectMilestone(id) {
        // Designer's exploration is the live model's: a milestone shown
        // closes it. Viewer's follows the model shown, at its places.
        if (get().appMode === 'designer' && get().snapshots.some((m) => m.id === id)) get().closeExploration()
        if (onExploration(get())) get()._saveShownCanvas()
        const { snapshots, activeSnapshotId, milestoneDirty, c4Nodes, c4Relations, sequences } = get()
        // If selecting the already-active milestone, just close any open prompt.
        if (activeSnapshotId === id) {
          set((state) => { state.milestonePromptOpen = false })
          return
        }
        // Block switching with unsaved milestone edits — user must commit/discard first.
        if (activeSnapshotId && milestoneDirty) {
          set((state) => { state.milestonePromptOpen = true })
          return
        }
        // The milestone's diff takes the overlay over from the branch's.
        if (id && get().branch) set((state) => { state.branch = null; state.showDiff = false })
        const snap = snapshots.find(s => s.id === id)
        if (!snap) return
        // Coming from the live model in Designer: the canvas shown keeps its
        // positions in the nodes until it is left; save them first, as
        // nothing of the milestone will be saved into the live views.
        if (!activeSnapshotId && get().appMode === 'designer') get()._saveShownCanvas()
        // Backup live HEAD if we don't already have one: in Presenter, the
        // live model under a slide card's copy of it, not the copy.
        const live = !activeSnapshotId && _beforeSlidePreview
        _beforeSlidePreview = null
        const backup = activeSnapshotId
          ? get().liveBackup
          : { nodes: live ? live.nodes : c4Nodes, relations: live ? live.relations : c4Relations, sequences, hubTemplates: get().hubTemplates as Record<string, HubImportRecord> }

        // In viewer (explore mode) keep the user's currently-arranged
        // positions for any node that still exists in the new milestone
        // snapshot. Only nodes that didn't exist before take their
        // position from the snapshot. The pre-mode snapshot in setAppMode
        // restores everything cleanly when the user returns to designer.
        const preserveLayout = get().appMode !== 'designer'
        const livePosByLabel = new Map<string, { x: number; y: number; width: number; height: number; collapsed?: boolean }>()
        if (preserveLayout) {
          for (const n of Object.values(c4Nodes)) {
            livePosByLabel.set(n.id, { x: n.x, y: n.y, width: n.width, height: n.height, collapsed: n.collapsed })
          }
        }
        // Compute diff vs previous milestone so the user can see what
        // changed at this point in time. The very first/oldest milestone
        // (idx === 0) is the baseline itself — there is no "before", so we
        // skip the diff overlay entirely (otherwise it would highlight
        // everything that diverged from the live HEAD, which is confusing
        // because v1 is supposed to be the original state).
        const idx = snapshots.findIndex(s => s.id === id)
        const prev = idx > 0 ? snapshots[idx - 1] : null
        const diff = prev
          ? computeSnapDiff(
              prev.nodes as Record<string, C4Node>,
              snap.nodes as Record<string, C4Node>,
              prev.relations as Record<string, C4Relation>,
              snap.relations as Record<string, C4Relation>,
            )
          : {}
        // Augment with sequence membership changes (structural diff takes priority).
        if (prev) {
          const seqDiff = computeSeqDiff(
            prev.sequences as Record<string, DiagramSequence> | undefined,
            snap.sequences as Record<string, DiagramSequence> | undefined,
          )
          for (const [rid, action] of Object.entries(seqDiff)) {
            if (!diff[rid]) diff[rid] = action
          }
        }
        const ghosts = prev
          ? computeDiffGhosts(
              prev.nodes as Record<string, C4Node>,
              snap.nodes as Record<string, C4Node>,
              prev.relations as Record<string, C4Relation>,
              snap.relations as Record<string, C4Relation>,
            )
          : { nodes: {}, relations: {} }
        // Designer's steps only: Viewer and Presenter have none, and what
        // they pick is put back on return (setAppMode).
        if (get().appMode === 'designer') _historyEntersMilestone(!activeSnapshotId, _captureState(get()))
        set((state) => {
          // `snap.nodes` is shared (never mutated in place, see _captureState).
          // When preserving layout, shallow-copy the map and only build a
          // fresh object for the specific nodes getting a position override —
          // everything else stays a shared reference with the snapshot.
          let nextNodes: Record<string, C4Node>
          if (preserveLayout) {
            nextNodes = { ...(snap.nodes as Record<string, C4Node>) }
            for (const [nid, live] of livePosByLabel) {
              const n = nextNodes[nid]
              if (!n) continue
              nextNodes[nid] = {
                ...n,
                x: live.x, y: live.y,
                width: live.width, height: live.height,
                ...(live.collapsed !== undefined ? { collapsed: live.collapsed } : {}),
              }
            }
          } else {
            nextNodes = snap.nodes as Record<string, C4Node>
          }
          state.c4Nodes = nextNodes as any
          state.c4Relations = snap.relations as any
          // A milestone saved without sequences has none: it showed the live
          // ones, and Save as new and Propagate then stored them in it.
          state.sequences = (snap.sequences ?? {}) as any
          if (state.activeSequenceId && !state.sequences[state.activeSequenceId]) state.activeSequenceId = null
          // The Hub template values its texts hold, not the live model's.
          // Read from the store, not the draft: _milestoneHubBase outlives
          // this set, and a draft kept is revoked (Propagate threw).
          _milestoneHubBase = milestoneHubTemplates((backup?.hubTemplates ?? get().hubTemplates) as Record<string, HubImportRecord>, snap.nodes as Record<string, C4Node>)
          state.hubTemplates = _milestoneHubBase as any
          state.activeSnapshotId = id
          // Coming from another milestone: its views (its own, or edits
          // kept by Save as new) are the live ones again first.
          if (activeSnapshotId && backup) {
            unparkLiveViews(state as DiagramStore, backup)
            const { views: _views, defaultPositions: _positions, defaultLayoutConstraints: _constraints, ...live } = backup
            state.liveBackup = live as any
          } else {
            state.liveBackup = backup as any
          }
          showMilestoneViews(state as DiagramStore, snap)
          state.milestoneDirty = false
          state.milestonePromptOpen = false
          state.diffHighlight = diff as any
          state.diffBaseSnapshotId = prev ? prev.id : null
          state.diffGhostNodes = ghosts.nodes as any
          state.diffGhostRelations = ghosts.relations as any
          state.canUndo = _undoStack.length > 0
          state.canRedo = _redoStack.length > 0
        })
        // The milestone's nodes hold its All elements positions; a view shows
        // the layout it has for every milestone.
        if (!preserveLayout) {
          _milestoneAllPositions = snapshotPositions(snap.nodes as Record<string, C4Node>)
          get()._showLiveCanvasPositions()
        } else if (shownExploration(get())) {
          // Viewer's exploration: what this milestone has and it had no place
          // for gets one (showCanvasPositions).
          get()._showLiveCanvasPositions()
        }
        get()._sync()
        // Reseed cola from the freshly-loaded milestone positions so the        // Reseed cola from the freshly-loaded milestone positions so the
        // live layout continues from there (instead of carrying over the
        // previous canvas's cached coords). Physics keeps running so the
        // user can still drag / nudge nodes around on the milestone.
        _liveLayout?.reset()
      },

      dismissMilestonePrompt() {
        set((state) => { state.milestonePromptOpen = false })
      },

      discardMilestoneChanges() {
        // A slide playing draws its own model: the milestone's is put back
        // first (stopPresentation), or the slide's became the live model.
        if (get().presentationActive && get().activeSnapshotId) get().stopPresentation()
        // Viewer's exploration follows the live model, at its places.
        if (onExploration(get())) get()._saveShownCanvas()
        const { liveBackup } = get()
        const backOnLive = !!get().activeSnapshotId && get().appMode === 'designer'
        const parked = backOnLive && _liveHistory ? [_liveHistory.undo, _liveHistory.redo] : null
        if (parked) _liveHistoryKeepsVisit(_sharedNow(get(), liveBackup), parked)
        if (backOnLive) _historyBackOnLive()
        set((state) => {
          state.canUndo = _undoStack.length > 0
          state.canRedo = _redoStack.length > 0
          if (liveBackup) {
            state.c4Nodes = liveBackup.nodes as any
            state.c4Relations = liveBackup.relations as any
            if ((liveBackup as any).sequences) {
              state.sequences = (liveBackup as any).sequences as any
            }
            if (liveBackup.hubTemplates) state.hubTemplates = liveBackup.hubTemplates as any
            unparkLiveViews(state as DiagramStore, liveBackup)
          }
          state.activeSnapshotId = null
          state.liveBackup = null
          state.milestoneDirty = false
          state.milestonePromptOpen = false
          state.diffHighlight = {} as any
          state.diffBaseSnapshotId = null
          state.diffGhostNodes = {} as any
          state.diffGhostRelations = {} as any
        })
        // The live nodes are where the canvas shown when the milestone was
        // opened had them; show the canvas shown now.
        _milestoneAllPositions = null
        get()._showLiveCanvasPositions()
        get()._sync()
        _liveLayout?.reset()
        // A view per element first opened in the milestone is laid out now.
        if (_arrangeOnLeavingMilestone) arrangeOnFirstOpen()
      },

      commitMilestoneChanges(mode, newName) {
        if (!get().activeSnapshotId) return
        // A slide playing draws its own model (a milestone it is linked to,
        // its copy, or the live one): the milestone's edits are put back on
        // the canvas first. Diffed against the milestone, the slide's model
        // went into it, every later milestone and the live model.
        if (get().presentationActive) get().stopPresentation()
        const { activeSnapshotId, snapshots, c4Nodes, c4Relations, sequences, liveBackup } = get()
        if (!activeSnapshotId) return
        const idx = snapshots.findIndex(s => s.id === activeSnapshotId)
        if (idx < 0) return

        // Reference the current (edited) canvas state directly — read-only use
        // below (diffing, or embedding whole into a snapshot); safe under
        // immer's copy-on-write (see _captureState).
        // With a view shown the nodes hold its (shared) layout: what is kept
        // in the milestone, or carried on as a change, is its All elements'.
        const editedNodes = get().activeViewId === null
          ? c4Nodes as Record<string, C4Node>
          : atDefaultPositions(Object.values(c4Nodes), _milestoneAllPositions ?? snapshotPositions(snapshots[idx].nodes as Record<string, C4Node>))
        const editedRels = c4Relations as Record<string, C4Relation>
        _milestoneAllPositions = snapshotPositions(editedNodes)
        const editedSeqs = sequences as Record<string, DiagramSequence>
        // Snapshot of the milestone BEFORE edits — used to compute the diff.
        const baseSnap = snapshots[idx]
        const baseNodes = baseSnap.nodes as Record<string, C4Node>
        const baseRels = baseSnap.relations as Record<string, C4Relation>
        const baseSeqs = (baseSnap.sequences ?? {}) as Record<string, DiagramSequence>

        if (mode === 'new') {
          // Insert a new milestone immediately after the active one with the edited state.
          const newId = uid()
          const namePrefix = newName?.trim() || `${baseSnap.name} (edited)`
          // The views as shown in the milestone, where they are not the live
          // ones: the new milestone shows them so when opened again.
          const ownViews: Record<string, DiagramView> = {}
          for (const [viewId, live] of Object.entries(liveBackup?.views ?? {})) {
            const shown = get().views[viewId]
            if (shown && !sameOwnView(shown, live as DiagramView)) ownViews[viewId] = milestoneOwnView(shown)
          }
          const newSnap: DiagramSnapshot = {
            id: newId,
            name: namePrefix,
            timestamp: Date.now(),
            nodes: editedNodes,
            relations: editedRels,
            sequences: editedSeqs,
            ...(Object.keys(ownViews).length ? { views: ownViews } : {}),
          }
          // The edits are the new milestone now: there is nothing behind
          // them to undo to.
          _undoStack.length = 0
          _redoStack.length = 0
          set((state) => {
            state.snapshots.splice(idx + 1, 0, newSnap as any)
            // The live model is as it was: so are its Hub template records.
            // The new milestone shown has the values its texts hold.
            _milestoneHubBase = milestoneHubTemplates((liveBackup?.hubTemplates ?? get().hubTemplates) as Record<string, HubImportRecord>, editedNodes)
            state.hubTemplates = _milestoneHubBase as any
            // Stay viewing the freshly-created milestone (canvas already shows its content).
            // liveBackup is preserved so the user can still discard back to live HEAD.
            state.activeSnapshotId = newId
            state.milestoneDirty = false
            state.milestonePromptOpen = false
            state.canUndo = false
            state.canRedo = false
          })
          get()._sync()
          _liveLayout?.reset()
          void liveBackup
          return
        }

        // mode === 'propagate':
        // Compute element-level diff: added / removed / per-field updated.
        const addedNodes: C4Node[] = []
        const updatedNodes: { id: string; updates: Partial<C4Node> }[] = []
        const removedNodeIds: string[] = []
        for (const id of Object.keys(editedNodes)) {
          if (!baseNodes[id]) {
            addedNodes.push(editedNodes[id])
          } else {
            const before = baseNodes[id]
            const after = editedNodes[id]
            // Every field: a property of the metamodel (a status, an EARS
            // clause) is a field of the node like a label. A fixed list of
            // fields left them behind in later milestones and the live model.
            const updates: Partial<C4Node> = {}
            for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
              if (k === 'id') continue
              const a = (before as any)[k], b = (after as any)[k]
              if (a !== b && JSON.stringify(a) !== JSON.stringify(b)) (updates as any)[k] = b
            }
            if (Object.keys(updates).length > 0) updatedNodes.push({ id, updates })
          }
        }
        for (const id of Object.keys(baseNodes)) {
          if (!editedNodes[id]) removedNodeIds.push(id)
        }

        const addedRels: C4Relation[] = []
        const updatedRels: { id: string; updates: Partial<C4Relation> }[] = []
        const removedRelIds: string[] = []
        for (const id of Object.keys(editedRels)) {
          if (!baseRels[id]) {
            addedRels.push(editedRels[id])
          } else {
            const before = baseRels[id]
            const after = editedRels[id]
            const updates: Partial<C4Relation> = {}
            for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
              if (k === 'id') continue
              const a = (before as any)[k], b = (after as any)[k]
              if (a !== b && JSON.stringify(a) !== JSON.stringify(b)) (updates as any)[k] = b
            }
            if (Object.keys(updates).length > 0) updatedRels.push({ id, updates })
          }
        }
        for (const id of Object.keys(baseRels)) {
          if (!editedRels[id]) removedRelIds.push(id)
        }

        // Sequence diff for propagation: the fields changed, and the steps
        // as they were and became. A later model may have steps the edited
        // milestone never had: the whole sequence copied took them out.
        const addedSeqs: DiagramSequence[] = []
        const updatedSeqs: { id: string; updates: Partial<DiagramSequence>; steps?: { before: DiagramSequence; after: DiagramSequence } }[] = []
        const removedSeqIds: string[] = []
        for (const id of Object.keys(editedSeqs)) {
          if (!baseSeqs[id]) {
            addedSeqs.push(editedSeqs[id])
          } else {
            const before = baseSeqs[id]
            const after = editedSeqs[id]
            const updates: Partial<DiagramSequence> = {}
            let steps = false
            for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
              if (k === 'id') continue
              const a = (before as any)[k], b = (after as any)[k]
              if (a === b || JSON.stringify(a) === JSON.stringify(b)) continue
              if (k === 'relationIds' || k === 'stepDescriptions' || k === 'stepBackward') steps = true
              else (updates as any)[k] = b
            }
            if (steps || Object.keys(updates).length > 0) updatedSeqs.push({ id, updates, ...(steps ? { steps: { before, after } } : {}) })
          }
        }
        for (const id of Object.keys(baseSeqs)) {
          if (!editedSeqs[id]) removedSeqIds.push(id)
        }

        // Apply diff to active milestone + every later milestone + live HEAD backup.
        const applyDiff = (
          targetNodes: Record<string, C4Node>,
          targetRels: Record<string, C4Relation>,
          targetSeqs: Record<string, DiagramSequence>,
        ) => {
          for (const n of addedNodes) targetNodes[n.id] = JSON.parse(JSON.stringify(n))
          for (const { id, updates } of updatedNodes) {
            if (!targetNodes[id]) continue
            // A move into a parent this model does not have leaves the
            // element where it is here (its place is its parent's): it went
            // under a parent that did not exist.
            if ('parentId' in updates && updates.parentId && !targetNodes[updates.parentId]) {
              const { parentId: _parentId, x: _x, y: _y, ...rest } = updates
              Object.assign(targetNodes[id], rest)
              continue
            }
            Object.assign(targetNodes[id], updates)
          }
          // What lies inside a removed element there goes with it, and so do
          // the relations to anything removed: a later model can hold children
          // and relations the edited milestone never had. Left behind, a child
          // kept a parent that was gone (Studio could not draw the model).
          const gone = new Set<string>()
          for (const id of removedNodeIds) {
            if (!targetNodes[id]) continue
            gone.add(id)
            for (const d of model.descendantIds(id, targetNodes)) gone.add(d)
          }
          for (const id of gone) delete targetNodes[id]
          // So does an element added under a parent this model does not have.
          for (let stray = true; stray;) {
            stray = false
            for (const n of addedNodes) {
              const there = targetNodes[n.id]
              if (there?.parentId && !targetNodes[there.parentId]) { delete targetNodes[n.id]; stray = true }
            }
          }
          for (const r of addedRels) targetRels[r.id] = JSON.parse(JSON.stringify(r))
          for (const { id, updates } of updatedRels) {
            if (targetRels[id]) Object.assign(targetRels[id], updates)
          }
          for (const id of removedRelIds) delete targetRels[id]
          for (const [rid, r] of Object.entries(targetRels)) {
            if (!targetNodes[r.sourceId] || !targetNodes[r.targetId]) delete targetRels[rid]
          }
          for (const seq of addedSeqs) targetSeqs[seq.id] = JSON.parse(JSON.stringify(seq))
          for (const { id, updates, steps } of updatedSeqs) {
            const target = targetSeqs[id]
            if (!target) continue
            Object.assign(target, JSON.parse(JSON.stringify(updates)))
            if (!steps) continue
            // The edited milestone's own changes of the steps and notes, made
            // to the steps this model has (the edit wins where both changed).
            const merged = mergeSteps(steps.before, target, steps.after).steps
            target.relationIds = merged.relationIds
            if (merged.stepDescriptions) target.stepDescriptions = merged.stepDescriptions
            else delete target.stepDescriptions
            if (merged.stepBackward) target.stepBackward = merged.stepBackward
            else delete target.stepBackward
          }
          for (const id of removedSeqIds) delete targetSeqs[id]
          // The steps of the relations gone here go with them, as a delete
          // takes them: a later model can step through relations the edited
          // milestone deleted with an element while it had no such sequence.
          const missing = new Set(Object.values(targetSeqs).flatMap((q) => q.relationIds.filter((rid) => !targetRels[rid])))
          model.forgetRelationsInSequences({ sequences: targetSeqs } as unknown as model.ModelState, missing)
        }

        // The views the milestone keeps its own way stay its own: what was
        // edited in them now goes to the live views, the rest of them stays
        // parked (a view not its own becomes the live one, as it is shown).
        const ownViews = baseSnap.views ?? {}
        const keptLiveViews: Record<string, DiagramView> = {}
        const ownViewsAfter: Record<string, DiagramView> = { ...ownViews }
        for (const [viewId, live] of Object.entries((liveBackup?.views ?? {}) as Record<string, DiagramView>)) {
          const shown = get().views[viewId]
          const mine = ownViews[viewId]
          if (!shown || !mine) continue
          if (sameOwnView(shown, mine)) { keptLiveViews[viewId] = live; continue }
          const was = milestoneOwnView(mine) as unknown as Record<string, unknown>
          const now = milestoneOwnView(shown) as unknown as Record<string, unknown>
          const next = { ...live } as unknown as Record<string, unknown>
          for (const key of new Set([...Object.keys(was), ...Object.keys(now)])) {
            if (key === 'positions' || key === 'name' || key === 'folder' || JSON.stringify(was[key]) === JSON.stringify(now[key])) continue
            if (now[key] === undefined) delete next[key]
            else next[key] = now[key]
          }
          keptLiveViews[viewId] = next as unknown as DiagramView
          ownViewsAfter[viewId] = now as unknown as DiagramView
        }

        // The view on screen was the view of an element the edits deleted.
        let lostShownView = false
        set((state) => {
          // Apply to active milestone (overwrite to be exact) and to all later milestones (diff).
          for (let i = idx; i < state.snapshots.length; i++) {
            const snap = state.snapshots[i] as any
            if (i === idx) {
              snap.nodes = editedNodes
              snap.relations = editedRels
              snap.sequences = editedSeqs
              if (Object.keys(ownViewsAfter).length) snap.views = ownViewsAfter
            } else {
              if (!snap.sequences) snap.sequences = {}
              applyDiff(snap.nodes, snap.relations, snap.sequences)
            }
          }
          // Apply to the live HEAD backup so it picks up future-facing changes too,
          // but DO NOT swap the canvas to live HEAD — keep showing the milestone the
          // user just edited (otherwise the canvas appears to "jump back" to current).
          if (state.liveBackup) {
            if (!(state.liveBackup as any).sequences) (state.liveBackup as any).sequences = {}
            // The views are the live model's: what the edits do to them
            // (keepingSharedViews left it out) happens now, with the edits.
            const live = { c4Nodes: state.liveBackup.nodes, c4Relations: state.liveBackup.relations, views: state.views, activeViewId: null } as unknown as model.ModelState
            for (const { id, updates } of updatedNodes) {
              if (typeof updates.label === 'string') model.renameViewsOf(live, id, updates.label)
            }
            const before = Object.keys(state.liveBackup.nodes)
            applyDiff(state.liveBackup.nodes as any, state.liveBackup.relations as any, (state.liveBackup as any).sequences)
            // The Hub template records go with the texts they wrote: what an
            // Apply in the milestone changed, not the milestone's values.
            state.liveBackup.hubTemplates = propagatedHubTemplates(
              (state.liveBackup.hubTemplates ?? {}) as Record<string, HubImportRecord>,
              _milestoneHubBase ?? {},
              state.hubTemplates as Record<string, HubImportRecord>,
            ) as any
            // What was done on the views in the milestone is the live
            // views' now: nothing of them is put back on leaving it but the
            // views the milestone keeps its own way.
            if (Object.keys(keptLiveViews).length) state.liveBackup.views = keptLiveViews as any
            else delete state.liveBackup.views
            delete state.liveBackup.defaultPositions
            delete state.liveBackup.defaultLayoutConstraints
            const gone = new Set(before.filter((id) => !state.liveBackup!.nodes[id]))
            if (gone.size) {
              const shown = state.activeViewId
              model.forgetNodesInViews(state as unknown as model.ModelState, gone)
              if (shown && !state.activeViewId) lostShownView = true
            }
          }
          state.milestoneDirty = false
          state.milestonePromptOpen = false
          state.canUndo = false
          state.canRedo = false
          // Keep activeSnapshotId + liveBackup so user can still discard / switch later.
        })
        _milestoneHubBase = get().hubTemplates as Record<string, HubImportRecord>
        // The edits are in this milestone, the later ones and the live model
        // now: no step from before, here or on the live model, leads back.
        _undoStack.length = 0
        _redoStack.length = 0
        _liveHistory = null
        _liveAtVisit = null
        if (lostShownView) get()._showLiveCanvasPositions()
        get()._sync()
        _liveLayout?.reset()
      },

      setDiffHighlight(diff) {
        set((state) => { state.diffHighlight = diff as any })
      },

      toggleShowDiff() {
        set((state) => { state.showDiff = !state.showDiff })
        get()._sync()
      },

      showBranchChanges(branch) {
        const { activeSnapshotId, branch: shown } = get()
        // A milestone's diff owns the overlay while it is shown.
        if (activeSnapshotId && branch) return
        if (!branch && !shown) return
        set((state) => {
          state.branch = branch as any
          state.diffHighlight = (branch ? { ...branch.nodes, ...branch.relations } : {}) as any
          state.diffGhostNodes = (branch?.ghostNodes ?? {}) as any
          state.diffGhostRelations = (branch?.ghostRelations ?? {}) as any
          state.showDiff = !!branch
        })
        get()._sync()
      },

      /** Set (or clear) the milestone used as the diff base. Pass `null` to
       *  return to the auto pick (the milestone immediately before the
       *  active one). Recomputes `diffHighlight` and ghost overlays. */
      setDiffBase(id) {
        const { activeSnapshotId, snapshots, c4Nodes, c4Relations, liveBackup } = get()
        if (!activeSnapshotId) return
        const idx = snapshots.findIndex(s => s.id === activeSnapshotId)
        if (idx < 0) return
        // Resolve effective base: explicit id > previous milestone.
        // For the very first/oldest milestone (idx === 0) there is no
        // previous one — it is itself the baseline, so we clear the diff
        // overlay instead of diffing against the live HEAD (which would
        // misleadingly highlight everything that has been edited since).
        let baseNodes: Record<string, C4Node>
        let baseRels: Record<string, C4Relation>
        let resolvedBaseId: string | null = null
        if (id) {
          const baseSnap = snapshots.find(s => s.id === id)
          if (!baseSnap) return
          baseNodes = baseSnap.nodes as Record<string, C4Node>
          baseRels = baseSnap.relations as Record<string, C4Relation>
          resolvedBaseId = id
        } else if (idx > 0) {
          const prev = snapshots[idx - 1]
          baseNodes = prev.nodes as Record<string, C4Node>
          baseRels = prev.relations as Record<string, C4Relation>
          resolvedBaseId = prev.id
        } else {
          // First milestone (or no base available) — clear overlays.
          set((state) => {
            state.diffHighlight = {} as any
            state.diffBaseSnapshotId = null
            state.diffGhostNodes = {} as any
            state.diffGhostRelations = {} as any
          })
          get()._sync()
          return
        }
        void liveBackup
        const diff = computeSnapDiff(baseNodes, c4Nodes as Record<string, C4Node>, baseRels, c4Relations as Record<string, C4Relation>)
        // Augment with sequence membership changes.
        const baseSnap2 = snapshots.find(s => s.id === resolvedBaseId)
        if (baseSnap2) {
          const seqDiff = computeSeqDiff(
            baseSnap2.sequences as Record<string, DiagramSequence> | undefined,
            get().sequences,
          )
          for (const [rid, action] of Object.entries(seqDiff)) {
            if (!diff[rid]) diff[rid] = action
          }
        }
        const ghosts = computeDiffGhosts(baseNodes, c4Nodes as Record<string, C4Node>, baseRels, c4Relations as Record<string, C4Relation>)
        set((state) => {
          state.diffHighlight = diff as any
          state.diffBaseSnapshotId = resolvedBaseId
          state.diffGhostNodes = ghosts.nodes as any
          state.diffGhostRelations = ghosts.relations as any
        })
        get()._sync()
      },

      // ── Notifications (toasts) ─────────────────────────────────────
      pushNotification(message, severity = 'error') {
        const id = uid()
        set((state) => {
          state.notifications.push({ id, severity, message, ts: Date.now() })
        })
        // Auto-dismiss is handled by the toast component (so it can pause
        // on hover and play a leave animation before removal).
      },

      dismissNotification(id) {
        set((state) => {
          state.notifications = state.notifications.filter(n => n.id !== id)
        })
      },

      // ── App mode ─────────────────────────────────────────────────────
      setAppMode(mode) {
        // Skip if mode hasn't actually changed — avoids needless physics
        // restarts that visibly fight an active auto-fit loop.
        const prevMode = get().appMode
        if (prevMode === mode) return
        if (get().presentationActive) {
          // stopPresentation will restore __prePresState; let it run first
          // so the layout snapshot we take below is the user's true layout,
          // not whatever slide was being shown.
          get().stopPresentation()
        }
        // Snapshot positions whenever we leave designer so any
        // viewer/presenter side-effects (slide playback, future readers)
        // can't perturb the saved layout. Restore on the way back.
        //
        // We snapshot c4Nodes AND every view.positions / defaultPositions
        // because the auto-persist subscriber writes currentPos into the
        // active view's `positions` on every save — so even though cola is
        // stopped in read-only modes, a save tick during the read-only
        // window could capture mid-frame coordinates and overwrite the
        // user's curated view layout. Restoring the maps as a whole guards
        // against that and keeps named views as stable as the "All
        // elements" view (which writes to defaultPositions instead).
        const W = window as any
        // An exploration stays open between Designer, Viewer and the
        // metamodel editor (Designer explores the live model, Viewer the one
        // it shows); Presenter and the Inspector close it, back on the canvas
        // it was opened from. Its places go with it.
        const keepsExploration = (m: DiagramStore['appMode']): boolean => m === 'designer' || m === 'viewer' || m === 'metamodel'
        if (get().exploration && !keepsExploration(mode)) get().closeExploration()
        else if (onExploration(get())) get()._saveShownCanvas()
        // Views of type Explore grown in Viewer are as they were saved again.
        if (_viewerExplorations.size) set((state) => { restoreViewerExplorations(state as DiagramStore) })
        // The view on screen when Designer is entered again: Designer stays
        // on it (with its own layout) rather than going back to the one it left.
        const shownViewId = get().activeViewId
        // The metamodel editor edits Designer's model, as Designer does: from
        // Viewer or Presenter it gets Designer's back first. Parked there as
        // well, a drag made in Viewer was saved by the first metamodel edit
        // (autosave saves in the editor), and what a metamodel edit made of
        // the views was put back as it had been on the way to Designer.
        const editing = (m: DiagramStore['appMode']): boolean => m === 'designer' || m === 'metamodel'
        const backToDesigner = !editing(prevMode) && mode === 'designer'
        let parkedCamera: { camera: { x: number; y: number; zoom: number } | null; keep: boolean } | null = null
        if (editing(prevMode) && !editing(mode)) {
          // The canvas shown keeps its positions in the nodes until it is
          // left or saved: put them, and its camera, into its view (or All
          // elements') first. Parked without them, the save a slide asks for
          // in Presenter wrote the view's layout from when it was opened.
          if (!get().activeSnapshotId) get()._saveShownCanvas()
          W.__preModeLayout = parkDesigner(get())
          // And its camera, put back with the rest: a camera moved in
          // Presenter or Viewer stayed in Designer (40 px, or a zoom).
          W.__preModeCamera = W.__rfCurrentViewport ? { ...W.__rfCurrentViewport } : undefined
          // Edits of a milestone not yet kept or dropped stay Designer's
          // question: Viewer and Presenter browse without being asked.
          set((state) => { state.milestoneDirty = false; state.milestonePromptOpen = false })
        } else if (!editing(prevMode) && (editing(mode) || prevMode === 'presenter') && W.__preModeLayout) {
          // Back to Designer: its parked model. From Presenter to Viewer as
          // well, kept parked: what the last slide showed (its places, its
          // folds, its model) stayed in Viewer until a view switch.
          const pre = W.__preModeLayout as ParkedDesigner
          set((state) => {
            state.c4Nodes = pre.c4Nodes as any
            state.c4Relations = pre.c4Relations as any
            state.sequences = pre.sequences as any
            state.views = pre.views as any
            state.defaultPositions = pre.defaultPositions as any
            state.activeViewId = pre.activeViewId
            state.activeSnapshotId = pre.activeSnapshotId
            state.liveBackup = pre.liveBackup as any
            state.milestoneDirty = editing(mode) && pre.milestoneDirty
            state.milestonePromptOpen = false
            state.diffHighlight = pre.diffHighlight as any
            state.diffBaseSnapshotId = pre.diffBaseSnapshotId
            state.diffGhostNodes = pre.diffGhostNodes as any
            state.diffGhostRelations = pre.diffGhostRelations as any
            if (pre.hubTemplates) state.hubTemplates = pre.hubTemplates as any
            if (state.activeSequenceId && !pre.sequences[state.activeSequenceId]) state.activeSequenceId = null
          })
          if (pre.milestoneHubBase !== undefined) _milestoneHubBase = pre.milestoneHubBase
          if (editing(mode)) W.__preModeLayout = undefined
          _beforeSlidePreview = null
          // Physics kept running during viewer (explore mode), so cola's
          // internal cache reflects the explored positions — *not* the
          // snapshot we just restored. reset() drops that cache so the
          // next start() rebuilds against the restored c4Nodes.
          _liveLayout?.reset()
          const x = get().exploration
          // Still in the explore mode, setActiveView loads the view's
          // Designer positions and camera and saves nothing of the one left.
          if (x && shownViewId === x.id) {
            // The exploration shown stays shown, as it is, over Designer's
            // model (the live one: what a milestone shown had and the live
            // model has not is left out). Designer showing a milestone
            // closes it.
            if (editing(mode) && get().activeSnapshotId) get().closeExploration()
            else if (get().activeViewId === x.id) {
              set((state) => { applyPositions(state.c4Nodes as Record<string, C4Node>, x.positions as Record<string, NodePosition>) })
            } else get().setActiveView(x.id)
          } else if (shownViewId !== get().activeViewId && (shownViewId === null || get().views[shownViewId])) {
            get().setActiveView(shownViewId)
          } else if (editing(mode) && W.__preModeCamera) {
            parkedCamera = { camera: { ...W.__preModeCamera }, keep: true }
          } else if (!editing(mode)) {
            // Viewer opens the view as it opens any view: its own camera.
            const id = get().activeViewId
            const own = id ? get().views[id]?.viewport : get().defaultViewport
            parkedCamera = { camera: own ? { ...own } : null, keep: false }
          }
          if (editing(mode)) W.__preModeCamera = undefined
        }
        // Physics runs in *both* designer and viewer. In viewer the user
        // can drag/collapse to explore — mutations are sandboxed by the
        // snapshot above (restored on return) and by the auto-persist
        // subscriber gating writes on appMode === 'designer'. We stop it
        // only in metamodel mode where the canvas isn't shown.
        if (mode === 'metamodel' || mode === 'inspector') {
          get().stopLiveLayout()
        } else {
          get().startLiveLayout()
        }
        set((state) => { state.appMode = mode as any; state.slideTreemapFocus = null; state.slideWikiPage = null })
        // Rebuild rfNodes so per-node draggable/selectable flags reflect
        // the new mode (designer = editable, viewer/presenter = locked).
        get()._sync()
        // Designer's camera, with what it shows: given the nodes the canvas
        // drew before (a container folded in Presenter), Smart fit took the
        // ones Designer shows again for new and moved the camera.
        if (parkedCamera) {
          const shown = get().rfNodes.filter((n) => !n.hidden).map((n) => n.id)
          ;(W.__rfPlaceCamera as ((vp: { x: number; y: number; zoom: number } | null, ids?: string[], opts?: { keep?: boolean }) => void) | undefined)?.(parkedCamera.camera, shown, { keep: parkedCamera.keep })
        }
        // The view Designer shows was opened above, or first in Viewer or
        // Presenter, before appMode was designer: one never laid out (a view
        // per element, a view of a viewpoint) gets its Smart Layout now. It
        // kept All elements' places, and the next view switch saved them.
        if (backToDesigner) arrangeOnFirstOpen()
      },

      // ── Metamodel ──────────────────────────────────────────────────────
      setMetamodel(m) {
        const before = get().metamodel as unknown as Record<string, unknown>
        const changed = Object.keys({ ...before, ...m }).filter((k) => before[k] !== (m as unknown as Record<string, unknown>)[k]).sort()
        if (changed.length === 0) return
        // A step of its own (typed into a field: one for what is typed).
        _pushTextEdit(get(), `metamodel:${changed.join(',')}`, (state) => {
          state.metamodel = { ...state.metamodel, ...Object.fromEntries(changed.map((k) => [k, (m as unknown as Record<string, unknown>)[k]])) } as Metamodel
        })
        set((state) => { state.metamodel = m as any })
        get()._syncViewpoints()
      },
      _syncViewpoints() {
        let changed: string[] = []
        set((state) => { changed = syncViewpointsOfLive(state as DiagramStore) })
        if (changed.length) get()._sync()
      },
      resetMetamodelToC4(confirm) {
        // On a model with governance elements this left them as unknown
        // types, and the editor has nothing to bring the types back with.
        const preset = builtInC4Metamodel()
        const [live, , milestones] = _typeHolders('')
        const refused = model.checkReplaceMetamodel(live, preset, milestones)
        if (refused) {
          get().pushNotification(`Cannot reset the metamodel: ${refused}`, 'error')
          return
        }
        if (confirm && !confirm(preset)) return
        get()._pushUndo()
        set((state) => { state.metamodel = preset as any })
        get()._syncViewpoints()
      },
      _historyMark() {
        return _undoStack.length
      },
      _mergeStepsSince(mark) {
        if (mark < 0 || _undoStack.length <= mark + 1) return
        _undoStack.splice(mark + 1)
        set((state) => { state.canUndo = _undoStack.length > 0; state.canRedo = _redoStack.length > 0 })
      },
      _forgetStepsOfLostTypes() {
        _historyKeepsTypes(get().metamodel)
        set((state) => { state.canUndo = _undoStack.length > 0; state.canRedo = _redoStack.length > 0 })
      },
      // Editing a built-in preset works on a custom copy: on load,
      // documentMetamodel swaps a preset id back to the preset, which would
      // silently drop the edit.
      upsertNodeType(def) {
        const now = get().metamodel.nodeTypes[def.id] as unknown as Record<string, unknown> | undefined
        const keys = Object.keys({ ...now, ...def }).filter((k) => !now || JSON.stringify(now[k]) !== JSON.stringify((def as unknown as Record<string, unknown>)[k])).sort()
        if (now && keys.length === 0) return
        _pushTextEdit(get(), `nodeType:${def.id}:${keys.join(',')}`, (state) => {
          const mm = state.metamodel as Metamodel
          state.metamodel = { ...mm, nodeTypes: { ...mm.nodeTypes, [def.id]: def } }
        })
        set((state) => {
          state.metamodel = (model.forkPresetMetamodel(state.metamodel as Metamodel) ?? state.metamodel) as any
          ;(state.metamodel as Metamodel).nodeTypes[def.id] = def
        })
      },
      removeNodeType(id, confirm) {
        // Elements of a type the metamodel no longer has would be left
        // behind as "unknown type"; the MCP server refuses this too.
        const refused = model.checkRemoveNodeType(..._typeHolders(id))
        if (refused) {
          get().pushNotification(`Cannot delete this type: ${refused}`, 'error')
          return
        }
        if (!get().metamodel.nodeTypes[id] || get().metamodel.nodeTypes[id].builtin) return
        if (confirm && !confirm(model.metamodelWithoutNodeType(get().metamodel, id))) return
        get()._pushUndo()
        set((state) => {
          const forked = model.forkPresetMetamodel(state.metamodel as Metamodel) ?? (state.metamodel as Metamodel)
          state.metamodel = model.metamodelWithoutNodeType(forked, id) as any
        })
      },
      upsertRelationType(def) {
        const now = get().metamodel.relationTypes[def.id] as unknown as Record<string, unknown> | undefined
        const keys = Object.keys({ ...now, ...def }).filter((k) => !now || JSON.stringify(now[k]) !== JSON.stringify((def as unknown as Record<string, unknown>)[k])).sort()
        if (now && keys.length === 0) return
        _pushTextEdit(get(), `relationType:${def.id}:${keys.join(',')}`, (state) => {
          const mm = state.metamodel as Metamodel
          state.metamodel = { ...mm, relationTypes: { ...mm.relationTypes, [def.id]: def } }
        })
        set((state) => {
          state.metamodel = (model.forkPresetMetamodel(state.metamodel as Metamodel) ?? state.metamodel) as any
          ;(state.metamodel as Metamodel).relationTypes[def.id] = def
        })
      },
      removeRelationType(id, confirm) {
        const refused = model.checkRemoveRelationType(..._typeHolders(id))
        if (refused) {
          get().pushNotification(`Cannot delete this type: ${refused}`, 'error')
          return
        }
        if (!get().metamodel.relationTypes[id] || get().metamodel.relationTypes[id].builtin) return
        if (confirm) {
          const { [id]: _removed, ...relationTypes } = get().metamodel.relationTypes
          if (!confirm({ ...get().metamodel, relationTypes })) return
        }
        get()._pushUndo()
        set((state) => {
          state.metamodel = (model.forkPresetMetamodel(state.metamodel as Metamodel) ?? state.metamodel) as any
          delete (state.metamodel as Metamodel).relationTypes[id]
        })
      },

      // ── Hub import templates ────────────────────────────────────────────
      applyHubTemplate(id, given) {
        const record = get().hubTemplates[id] as HubImportRecord | undefined
        if (!record) return
        // A value left blank takes the template's default.
        const values = resolveParamValues(record.templateParams, given)
        const redo = (current: unknown, original: string): string =>
          retemplateText(typeof current === 'string' ? current : '', original, record.paramValues, values)
        _asOneStep(() => {
          get()._pushUndo()
          // In a milestone: an edit of it, kept or dropped as the question
          // after it says (the record with it).
          get()._markMilestoneEdit()
          set((state) => {
            // Only the fields the Hub's text gave a parameter, and in them
            // only the old value: the rest may have been edited since (a
            // rename was lost to "Apply").
            for (const [nodeId, original] of Object.entries(record.originalNodes)) {
              const n = state.c4Nodes[nodeId] as unknown as Record<string, unknown> | undefined
              if (!n) continue
              for (const [key, value] of Object.entries(original)) {
                if (typeof value === 'string' && /\{\{[A-Z0-9_]+\}\}/.test(value)) n[key] = redo(n[key], value)
              }
            }
            // The relations' texts and the flows' names and step notes too.
            for (const [relId, original] of Object.entries(record.originalRelations ?? {})) {
              const r = state.c4Relations[relId] as unknown as Record<string, unknown> | undefined
              if (!r) continue
              for (const [key, value] of Object.entries(original)) if (typeof value === 'string') r[key] = redo(r[key], value)
            }
            for (const [seqId, original] of Object.entries(record.originalSequences ?? {})) {
              const seq = state.sequences[seqId]
              if (!seq) continue
              if (original.name) seq.name = redo(seq.name, original.name)
              original.stepDescriptions?.forEach((note, i) => {
                if (typeof note !== 'string' || !seq.stepDescriptions) return
                seq.stepDescriptions[i] = redo(seq.stepDescriptions[i], note)
              })
            }
            ;(state.hubTemplates as Record<string, HubImportRecord>)[id] = { ...record, paramValues: { ...values } }
            state.canUndo = _undoStack.length > 0
            state.canRedo = _redoStack.length > 0
          })
        })
        get()._sync()
      },
      upsertHubTemplate(id, record) {
        set((state) => { (state.hubTemplates as Record<string, HubImportRecord>)[id] = record })
      },
      deleteHubTemplate(id) {
        set((state) => { delete (state.hubTemplates as Record<string, HubImportRecord>)[id] })
      },

      // ── Presentation mode ──────────────────────────────────────────────
      addPresentation(name) {
        const id = uid()
        const presName = name ?? `Presentation ${get().presentations.length + 1}`
        set((state) => {
          state.presentations.push({ id, name: presName, slides: [] })
          state.activePresentationId = id
          state.presentationSlides = state.presentations[state.presentations.length - 1].slides
          state.presentationSlideIndex = 0
        })
        return id
      },

      setPresentations(presentations) {
        set((state) => {
          // The slide shown stays the current one wherever it moved: by its
          // place, Presenter highlighted another card than the canvas showed
          // after an agent reordered the slides.
          const shownId = state.presentationSlides[state.presentationSlideIndex]?.id
          state.presentations = (presentations.length ? presentations : [{ id: uid(), name: 'Presentation 1', slides: [] }]) as any
          if (!state.presentations.some((p) => p.id === state.activePresentationId)) {
            state.activePresentationId = state.presentations[0].id
            state.presentationSlideIndex = 0
          }
          const active = state.presentations.find((p) => p.id === state.activePresentationId)!
          state.presentationSlides = active.slides
          const moved = shownId ? active.slides.findIndex((slide) => slide.id === shownId) : -1
          state.presentationSlideIndex = moved >= 0 ? moved : Math.min(state.presentationSlideIndex, Math.max(0, active.slides.length - 1))
        })
      },

      removePresentation(id) {
        set((state) => {
          state.presentations = state.presentations.filter(p => p.id !== id)
          // Always keep at least one presentation
          if (state.presentations.length === 0) {
            const newId = uid()
            state.presentations.push({ id: newId, name: 'Presentation 1', slides: [] })
            state.activePresentationId = newId
          } else if (state.activePresentationId === id) {
            state.activePresentationId = state.presentations[0].id
          }
          const active = state.presentations.find(p => p.id === state.activePresentationId)!
          state.presentationSlides = active.slides
          state.presentationSlideIndex = 0
        })
      },

      renamePresentation(id, name) {
        set((state) => {
          const p = state.presentations.find(p => p.id === id)
          if (p) p.name = name
        })
      },

      setActivePresentation(id) {
        set((state) => {
          const p = state.presentations.find(p => p.id === id)
          if (!p) return
          state.activePresentationId = id
          state.presentationSlides = p.slides
          state.presentationSlideIndex = 0
        })
      },

      addPresentationSlide(name) {
        const raw = (window as any).__rfCurrentViewport
        const viewport: { x: number; y: number; zoom: number } = raw
          ? { x: raw.x, y: raw.y, zoom: raw.zoom }
          : (_getViewportFn()?.() ?? { x: 0, y: 0, zoom: 1 })
        const { presentationSlides, activeSnapshotId, activeViewId } = get()
        const canvasState = captureCanvasState(get().c4Nodes as Record<string, C4Node>, activeViewId ? get().views[activeViewId] : undefined, get().c4Relations as Record<string, C4Relation>)
        // Inline full model snapshot — guarantees the slide replays exactly
        // what was on screen at creation time, even if the user later edits
        // nodes/relations or switches the active milestone. On a milestone
        // the slide shows the milestone it is linked to: a copy of it
        // outlived the link, and the slide drew the milestone after it was
        // deleted or unlinked.
        const modelSnapshot = activeSnapshotId ? undefined : {
          nodes: get().c4Nodes as Record<string, C4Node>,
          relations: get().c4Relations as Record<string, C4Relation>,
        }
        const id = uid()
        const slideName = name ?? `Slide ${presentationSlides.length + 1}`
        set((state) => {
          const pres = state.presentations.find(p => p.id === state.activePresentationId)
          if (!pres) return
          pres.slides.push({ id, name: slideName, snapshotId: activeSnapshotId, viewId: activeViewId, viewport, canvasState, ...(modelSnapshot ? { modelSnapshot } : {}), ...slideViewFields(state, activeViewId) } as any)
          state.presentationSlides = pres.slides
        })
      },

      removePresentationSlide(id) {
        set((state) => {
          const pres = state.presentations.find(p => p.id === state.activePresentationId)
          if (!pres) return
          pres.slides = pres.slides.filter(s => s.id !== id)
          state.presentationSlides = pres.slides
          if (state.presentationSlideIndex >= pres.slides.length) {
            state.presentationSlideIndex = Math.max(0, pres.slides.length - 1)
          }
        })
      },

      renamePresentationSlide(id, name) {
        set((state) => {
          const pres = state.presentations.find(p => p.id === state.activePresentationId)
          if (!pres) return
          const slide = pres.slides.find(s => s.id === id)
          if (slide) slide.name = name
          state.presentationSlides = pres.slides
        })
      },

      updatePresentationSlideViewport(id, vp) {
        set((state) => {
          const pres = state.presentations.find(p => p.id === state.activePresentationId)
          if (!pres) return
          const slide = pres.slides.find(s => s.id === id)
          if (slide) slide.viewport = vp
          state.presentationSlides = pres.slides
        })
      },

      startPresentation() {
        const { presentationSlides } = get()
        if (presentationSlides.length === 0) return
        // The question how to save the milestone's edits is answered first:
        // started behind it, its Propagate took the playing slide's model.
        if (get().milestonePromptOpen && get().milestoneDirty && get().appMode === 'designer') return
        get().stopLiveLayout()
        // Snapshot full model + active view so we can restore on exit.
        // (goToSlide replaces c4Nodes/c4Relations from a slide snapshot,
        // so restoring just positions wouldn't be enough.)
        // The views too: a slide puts its folds into its view, and from
        // Designer (F5) a drill or fold made while it played was Designer's.
        ;(window as any).__prePresState = {
          c4Nodes: get().c4Nodes,
          c4Relations: get().c4Relations,
          activeViewId: get().activeViewId,
          // The slides colour what changed between them; the milestone's
          // diff comes back after (Esc cleared it, the toggle still on).
          diffHighlight: get().diffHighlight,
          views: get().views,
        }
        set((state) => { state.presentationActive = true })
        // Re-derive rfNodes immediately so the per-node `draggable` flag
        // flips off before the user can grab anything (rfNodes carry
        // draggable per-node, which would otherwise override the
        // ReactFlow nodesDraggable prop until the next _sync).
        get()._sync()
        setTimeout(() => get().goToSlide(get().presentationSlideIndex), 50)
      },

      stopPresentation() {
        set((state) => { state.presentationActive = false; state.slideTreemapFocus = null; state.slideWikiPage = null })
        const pre = (window as any).__prePresState as
          | { c4Nodes: Record<string, C4Node>; c4Relations: Record<string, C4Relation>; activeViewId: string | null; diffHighlight?: DiagramStore['diffHighlight']; views?: Record<string, DiagramView> }
          | undefined
        get().setDiffHighlight(pre?.diffHighlight ?? {})
        if (pre) {
          set((state) => {
            state.c4Nodes = pre.c4Nodes as any
            state.c4Relations = pre.c4Relations as any
            state.activeViewId = pre.activeViewId
            if (pre.views) state.views = pre.views as any
          })
          ;(window as any).__prePresState = undefined
        }
        get()._sync()
        // Resume live layout when returning to any non-metamodel mode
        // (designer or viewer). Reset the cola cache so it picks up the
        // restored c4Nodes positions instead of the slide-shown ones.
        if (get().appMode !== 'metamodel' && get().appMode !== 'inspector') {
          _liveLayout?.reset()
          get().startLiveLayout()
        }
      },

      goToSlide(index) {
        const { presentationSlides } = get()
        if (!presentationSlides.length) return
        const i = Math.max(0, Math.min(index, presentationSlides.length - 1))
        const slide = presentationSlides[i]
        const targetViewId = slideViewIdOf(slide, get().views)
        set((state) => { state.presentationSlideIndex = i })

        // Disable physics while presenting
        get().stopLiveLayout()

        const shown = slideModel(slide, get().snapshots, liveUnderMilestone(get()))
        if (shown) {
          set((state) => {
            state.c4Nodes = shown.nodes as any
            state.c4Relations = shown.relations as any
          })
        } else {
          // A slide without its own model shows the live one — undo whatever
          // a previous milestone slide swapped in.
          const pre = (window as any).__prePresState as
            | { c4Nodes: Record<string, C4Node>; c4Relations: Record<string, C4Relation> }
            | undefined
          if (pre) {
            set((state) => {
              state.c4Nodes = pre.c4Nodes as any
              state.c4Relations = pre.c4Relations as any
            })
          }
        }

        // Apply saved canvas state (positions + collapsed) — overrides snapshot positions.
        // Mutates via the `state.c4Nodes[id]` draft, so it copy-on-writes only
        // the touched nodes and leaves the shared snapshot/slide data intact.
        if (slide.canvasState) {
          set((state) => { applySlideCanvas(state, slide.canvasState!, targetViewId) })
        } else if (targetViewId) {
          // No captured canvas (generated / imported slides): show the view's
          // saved layout, the same positions setActiveView would load.
          set((state) => { showSlideView(state, targetViewId, shown) })
        }

        // Activate the view linked to this slide (or reset to "all" if none)
        const currentViewId = get().activeViewId
        if (targetViewId !== currentViewId) {
          set((state) => { state.activeViewId = targetViewId })
        }

        // A slide of a hierarchy view shows the element it was drilled into.
        set((state) => {
          state.slideTreemapFocus = slideTreemapFocusOf(slide, targetViewId, state.views as Record<string, DiagramView>)
          // And one of a wiki view the page it was added on.
          state.slideWikiPage = slideWikiPageOf(slide, targetViewId)
        })

        // Re-derive rfNodes / rfEdges (always needed: view filter or canvas state may have changed)
        get()._sync()

        // Compute diff highlight between the models of the previous and the
        // current slide, as each shows it: a linked milestone wins over the
        // copy (preferred here, the colours were of models not shown).
        {
          const prevSlide = i > 0 ? presentationSlides[i - 1] : null
          const currModel = slideModel(slide, get().snapshots)
          const prevModel = prevSlide ? slideModel(prevSlide, get().snapshots) : undefined
          if (currModel && prevModel) {
            get().setDiffHighlight(computeSnapDiff(prevModel.nodes, currModel.nodes, prevModel.relations, currModel.relations))
          } else {
            get().setDiffHighlight({})
          }
        }

        // Animate viewport transition — defer to next frame so React re-render
        // finishes first. We replay the per-slide captured {x,y,zoom} so the
        // user has full control over framing (capture viewport on the slide
        // sets it; "Capture viewport" button updates it). If a slide has no
        // captured viewport at all (legacy data), fall back to fitView.
        const vp = slide.viewport
        if (vp && (vp.zoom || vp.x || vp.y)) {
          // Slide switch just changed the visible node/view set — block the
          // 300ms auto-fit interval from reacting to that as "new content"
          // and dragging the camera to a fit-all framing right after we set
          // the slide's own captured viewport below.
          ;(window as any).__rfSuppressAutoFit?.(600 + 1200)
          setSlideCamera({ x: vp.x, y: vp.y, zoom: vp.zoom }, 600)
        } else if (slide.focusNodeIds?.length) {
          // No captured camera: zoom onto the slide's focus elements.
          setSlideFocus(slide.focusNodeIds, 600)
        } else {
          clearSlideCamera()
          requestAnimationFrame(() => {
            requestAnimationFrame(() => _getFitViewFn()?.())
          })
        }
      },

      previewSlide(index) {
        const { presentationSlides } = get()
        if (!presentationSlides.length) return
        const i = Math.max(0, Math.min(index, presentationSlides.length - 1))
        const slide = presentationSlides[i]
        set((state) => { state.presentationSlideIndex = i })

        // The live model the card of a slide with its own copy replaced
        // goes back first: every slide's model is set from it.
        if (_beforeSlidePreview) {
          const live = _beforeSlidePreview
          _beforeSlidePreview = null
          set((state) => {
            state.c4Nodes = live.nodes as any
            state.c4Relations = live.relations as any
          })
        }
        // The milestone a slide shows is the one shown: the chip, the
        // address and the Milestones list name it, and none over a slide
        // that shows the live model or its own copy. A milestone picked
        // before stayed named over the slide's model (F-0029).
        const own = slide.snapshotId && get().snapshots.some((m) => m.id === slide.snapshotId) ? slide.snapshotId : null
        if (own) {
          if (get().activeSnapshotId !== own) get().selectMilestone(own)
        } else if (get().activeSnapshotId) {
          get().discardMilestoneChanges()
        }
        const shown = slideModel(slide, get().snapshots)
        if (shown && !own) {
          _beforeSlidePreview = { nodes: get().c4Nodes, relations: get().c4Relations }
          set((state) => {
            state.c4Nodes = shown.nodes as any
            state.c4Relations = shown.relations as any
          })
        }

        // Apply saved canvas state (positions + collapsed).
        const targetViewId = slideViewIdOf(slide, get().views)
        if (slide.canvasState) {
          set((state) => { applySlideCanvas(state, slide.canvasState!, targetViewId) })
        } else if (targetViewId) {
          // No captured canvas (generated / imported slides): show the view's
          // saved layout, the same positions setActiveView would load.
          let placed: string[] = []
          set((state) => { placed = showSlideView(state, targetViewId, shown) })
          _liveLayout?.reset(placed)
        }

        // Navigate to the view linked to this slide (or reset to "all" if none).
        if (targetViewId !== get().activeViewId) {
          set((state) => { state.activeViewId = targetViewId })
        }

        set((state) => {
          state.slideTreemapFocus = slideTreemapFocusOf(slide, targetViewId, state.views as Record<string, DiagramView>)
          // And one of a wiki view the page it was added on.
          state.slideWikiPage = slideWikiPageOf(slide, targetViewId)
        })

        // Re-derive rfNodes / rfEdges.
        get()._sync()

        // Restore saved viewport, or fit view if none captured.
        const vp = slide.viewport
        if (vp && (vp.zoom || vp.x || vp.y)) {
          // See goToSlide — same auto-fit race, same fix.
          ;(window as any).__rfSuppressAutoFit?.(400 + 1200)
          setSlideCamera({ x: vp.x, y: vp.y, zoom: vp.zoom }, 400)
        } else if (slide.focusNodeIds?.length) {
          // No captured camera: zoom onto the slide's focus elements.
          setSlideFocus(slide.focusNodeIds, 400)
        } else {
          clearSlideCamera()
          requestAnimationFrame(() => {
            requestAnimationFrame(() => _getFitViewFn()?.())
          })
        }
      },

      setViewportFns(getVP, setVP) {
        ;(window as any).__rfGetViewport = getVP
        ;(window as any).__rfSetViewport = setVP
      },

      captureSlideViewport(id: string) {
        const raw = (window as any).__rfCurrentViewport
        const vp: { x: number; y: number; zoom: number } | null = raw
          ? { x: raw.x, y: raw.y, zoom: raw.zoom }
          : (_getViewportFn()?.() ?? null)
        if (!vp) return
        const currentViewId = get().activeViewId
        const canvasState = captureCanvasState(get().c4Nodes as Record<string, C4Node>, currentViewId ? get().views[currentViewId] : undefined, get().c4Relations as Record<string, C4Relation>)
        // Re-capture the full inline model snapshot too — "Capture viewport"
        // semantically means "this slide should look like the screen does now".
        const modelSnapshot = {
          nodes: get().c4Nodes as Record<string, C4Node>,
          relations: get().c4Relations as Record<string, C4Relation>,
        }
        const { activeSnapshotId } = get()
        set((state) => {
          const pres = state.presentations.find(p => p.id === state.activePresentationId)
          if (!pres) return
          const slide = pres.slides.find(s => s.id === id)
          if (slide) {
            slide.viewport = vp
            ;(slide as any).canvasState = canvasState
            ;(slide as any).viewId = currentViewId
            // A slide linked to a milestone shows it, and keeps no copy of
            // it, as one added on a milestone: the copy outlived the link.
            // One that showed none, captured on a milestone, is linked to it
            // as Add slide links one: with a copy of it, it went on drawing
            // the milestone once that was deleted.
            if (!slide.snapshotId && activeSnapshotId) slide.snapshotId = activeSnapshotId
            if (slide.snapshotId) delete slide.modelSnapshot
            else (slide as any).modelSnapshot = modelSnapshot
            // The drill level or wiki page shown now, as Add slide takes it:
            // the old one stayed, and the slide played where it was added.
            delete slide.treemapFocusId; delete slide.wikiFocusId; delete slide.wikiPageMode
            Object.assign(slide, slideViewFields(state, currentViewId))
          }
          state.presentationSlides = pres.slides
        })
      },

      linkSnapshotToSlide(slideId: string, snapshotId: string | null) {
        set((state) => {
          const pres = state.presentations.find(p => p.id === state.activePresentationId)
          if (!pres) return
          const slide = pres.slides.find(s => s.id === slideId)
          if (slide) slide.snapshotId = snapshotId
          state.presentationSlides = pres.slides
        })
      },

      linkViewToSlide(slideId: string, viewId: string | null) {
        set((state) => {
          const pres = state.presentations.find(p => p.id === state.activePresentationId)
          if (!pres) return
          const slide = pres.slides.find(s => s.id === slideId)
          if (slide && (slide.viewId ?? null) !== viewId) {
            slide.viewId = viewId
            // What was captured on the old view is not this one's: kept, the
            // linked view was drawn at the old view's places. It fits the view
            // instead, as a slide made over MCP does.
            delete slide.canvasState
            delete slide.focusNodeIds
            delete slide.treemapFocusId; delete slide.wikiFocusId; delete slide.wikiPageMode
            slide.viewport = { x: 0, y: 0, zoom: 0 }
          }
          state.presentationSlides = pres.slides
        })
      },

      // ── I/O ─────────────────────────────────────────────────────────────
      loadDiagram(loaded, opts) {
        // A Hub concept file opened as a model: its template filled in.
        const data = conceptFileAsModel(loaded)
        if (!opts?.outsideChange) _modelLoads++
        get().stopLiveLayout()
        // The exploration shown keeps its places through an outside change;
        // another model drops it.
        if (opts?.outsideChange && onExploration(get())) get()._saveShownCanvas()
        if (!opts?.outsideChange) _exploredFrom = null
        // The history is Designer's live model's: a milestone shown, a slide
        // played or Viewer's model in the store is not the one it rebases on.
        const st = get()
        // Studio's live model at All elements' places, for what the change
        // placed on it (_settleOutsidePlaces).
        const wasLive = opts?.outsideChange && (st.appMode === 'designer' || st.appMode === 'metamodel') && !st.presentationActive
          ? (() => { const doc = st.saveDiagram(); return atDefaultPositions(doc.nodes, doc.defaultPositions) })()
          : null
        // A milestone shown stays shown, with its edits (ShownMilestone).
        const shownBefore = opts?.outsideChange && st.activeSnapshotId && st.liveBackup ? st.snapshots.find((m) => m.id === st.activeSnapshotId) : undefined
        const shownMilestone: ShownMilestone | null = shownBefore ? {
          id: shownBefore.id,
          before: shownBefore,
          nodes: st.c4Nodes,
          relations: st.c4Relations,
          sequences: st.sequences,
          dirty: st.milestoneDirty,
          promptOpen: st.milestonePromptOpen,
          activeViewId: st.activeViewId,
          diffHighlight: st.diffHighlight,
          diffBaseSnapshotId: st.diffBaseSnapshotId,
          diffGhostNodes: st.diffGhostNodes,
          diffGhostRelations: st.diffGhostRelations,
        } : null
        const milestone = shownMilestone ? _milestoneAfterOutsideChange(shownMilestone, data.snapshots ?? []) : null
        /** Says that the milestone with edits not saved is gone. */
        const lostMilestone = (id: string): void => {
          const name = st.snapshots.find((m) => m.id === id)?.name ?? id
          get().pushNotification(`The milestone "${name}" was deleted outside Studio: the edits made in it and not saved are gone.`, 'warning')
        }
        // The metamodel editor edits Designer's model in the store; Viewer,
        // Presenter and the Inspector park it (ParkedDesigner). The history
        // was forgotten when the agent wrote while one of them was open.
        const designerShown = st.appMode === 'designer' || st.appMode === 'metamodel'
        const parked = typeof window !== 'undefined' && !designerShown ? (window as any).__preModeLayout as ParkedDesigner | undefined : undefined
        if (opts?.outsideChange && designerShown && !st.activeSnapshotId && !st.presentationActive) {
          _historyRebased(_captureState(st))
        } else if (opts?.outsideChange && parked) {
          const live = parked.activeSnapshotId && parked.liveBackup ? parked.liveBackup : null
          const now: HistoryEntry = {
            c4Nodes: live ? atDefaultPositions(Object.values(live.nodes), parked.defaultPositions) : parked.c4Nodes,
            c4Relations: live ? live.relations : parked.c4Relations,
            views: parked.views,
            defaultLayoutConstraints: st.defaultLayoutConstraints,
            defaultEdgeStyle: st.defaultEdgeStyle,
            activeViewId: live ? null : parked.activeViewId,
            defaultPositions: parked.defaultPositions,
            sequences: live ? live.sequences ?? parked.sequences : parked.sequences,
            hubTemplates: st.hubTemplates,
            metamodel: st.metamodel as Metamodel,
          }
          // A milestone shown in Designer: its own steps start again, the
          // live model's make their change on it as it is now.
          if (!live) _historyRebased(now)
          else {
            _undoStack.length = 0
            _redoStack.length = 0
            if (_liveHistory) {
              _liveHistoryKeepsVisit(_sharedNow({ ...st, views: parked.views }, parked.liveBackup), [_liveHistory.undo, _liveHistory.redo])
              _historyRebased(now, [_liveHistory.undo, _liveHistory.redo])
            }
          }
        } else if (opts?.outsideChange && designerShown && milestone && !st.presentationActive) {
          // The milestone's steps stay, unless it was changed too; the live
          // model's, parked, make their change on it as it is now. So do
          // the milestone's: they hold the views, the metamodel and the
          // milestones, which are the live model's too, and put back whole,
          // Undo took back what the change did to them (Web App's place on
          // Containers after the agent moved it: item 262).
          if (milestone.changed) { _undoStack.length = 0; _redoStack.length = 0 }
          else _historyRebased(_captureState(st))
          if (_liveHistory) {
            const live = st.liveBackup!
            _liveHistoryKeepsVisit(_sharedNow(st, live), [_liveHistory.undo, _liveHistory.redo])
            _historyRebased({
              c4Nodes: atDefaultPositions(Object.values(live.nodes), st.defaultPositions),
              c4Relations: live.relations,
              views: st.views,
              defaultLayoutConstraints: st.defaultLayoutConstraints,
              defaultEdgeStyle: st.defaultEdgeStyle,
              activeViewId: null,
              defaultPositions: st.defaultPositions,
              sequences: live.sequences ?? st.sequences,
              hubTemplates: st.hubTemplates,
              metamodel: st.metamodel as Metamodel,
              snapshots: st.snapshots,
              slideMilestones: slideMilestonesOf(st.presentations),
            }, [_liveHistory.undo, _liveHistory.redo])
          }
        } else {
          _historyForgotten()
        }
        let nodes = atDefaultPositions(data.nodes, data.defaultPositions)
        // What was added on a view since All elements was last shown has no
        // place there yet, and what was moved into another parent outside
        // Studio (a node file into another folder) lies outside it (on
        // copies: `data` may hold the store's own nodes).
        let placedOnLoad: string[] = []
        if (data.defaultPositions && (data.nodes.some((n) => !(n.id in data.defaultPositions!)) || strayNodeIds(nodes, data.defaultPositions).size > 0)) {
          nodes = Object.fromEntries(Object.entries(nodes).map(([id, n]) => [id, { ...n }]))
          placedOnLoad = placeUnplaced(nodes, data.defaultPositions)
        }
        let settledOnLoad: string[] = []
        if (wasLive) {
          nodes = Object.fromEntries(Object.entries(nodes).map(([id, n]) => [id, { ...n }]))
          settledOnLoad = _settleOutsidePlaces(nodes, wasLive)
          placedOnLoad = [...new Set([...placedOnLoad, ...settledOnLoad])]
        }
        const relations: Record<string, C4Relation> = {}
        const views: Record<string, DiagramView> = {}
        const sequences: Record<string, DiagramSequence> = {}
        for (const r of data.relations) relations[r.id] = r
        // Older documents kept every node's position in each view.
        // A view of type Explore with what a file left out of it filled in.
        if (data.views) for (const v of withCanvasPositions(data.views.map(withExploreState), nodes, (view) => viewDrawnIds(view, nodes, relations))) views[v.id] = v
        _viewerExplorations.clear()
        if (data.sequences) for (const s of data.sequences) sequences[s.id] = s

        // Restore snapshots (backward compat: old files won't have them)
        const snapshots: DiagramSnapshot[] = data.snapshots ?? []
        const presInit = buildPresentationsFromData(data.presentations, data.presentationSlides)

        // Restore per-view positions (backward compat: old files won't have them)
        const settledPos = settledOnLoad.length ? Object.fromEntries(Object.entries(snapshotPositions(nodes)).filter(([id]) => settledOnLoad.includes(id))) : {}
        const defaultPos = data.defaultPositions ? { ...data.defaultPositions, ...settledPos } : snapshotPositions(nodes)
        const defaultVP: { x: number; y: number; zoom: number } | null = data.defaultViewport ?? null

        const activeDocId = documentBackend()?.getActiveId()
        // Another document forgets the views' selections; the same one read
        // again (an outside change) keeps them, the open canvas's included.
        if ((activeDocId ?? null) !== _viewSelectionsDoc) {
          _viewSelections = new Map()
          _viewSelectionsDoc = activeDocId ?? null
        } else {
          const { activeViewId, selectedNodeIds, selectedEdgeId } = get()
          _viewSelections.set(activeViewId ?? '', { nodeIds: [...selectedNodeIds], edgeId: selectedEdgeId })
        }

        set((state) => {
          state.c4Nodes = nodes as any
          state.c4Relations = relations as any
          state.sequences = sequences as any
          // An outside change keeps the sequence open, while it is there:
          // an agent's write closed its card.
          state.activeSequenceId = opts?.outsideChange && st.activeSequenceId && (sequences as Record<string, unknown>)[st.activeSequenceId] ? st.activeSequenceId : null
          state.views = views as any
          state.exploration = opts?.outsideChange ? prunedExploration(st.exploration, nodes) as any : null
          state.defaultPositions = defaultPos as any
          state.defaultViewport = defaultVP
          const rawVP = typeof window !== 'undefined' ? (window as any).__rfCurrentViewport as { x: number; y: number; zoom: number } | undefined : undefined
          _cameraAtLoad = rawVP ? { x: rawVP.x, y: rawVP.y, zoom: rawVP.zoom } : null
          state.defaultLayoutConstraints = (data.defaultLayoutConstraints ?? []) as any
          state.defaultEdgeStyle = data.defaultEdgeStyle ?? 'curved'
          state.activeViewId = null
          state.selectedNodeId = null
          state.selectedEdgeId = null
          state.nodeWizard = null
          state.canUndo = _undoStack.length > 0
          state.canRedo = _redoStack.length > 0
          state.snapshots = snapshots as any
          state.activeSnapshotId = null
          // A milestone viewed before the load belongs to the model it left:
          // drop its parked live model and diff, or they would show (ghosts)
          // or come back (discard) in the loaded one.
          state.liveBackup = null
          state.milestoneDirty = false
          state.milestonePromptOpen = false
          state.diffHighlight = {} as any
          state.diffBaseSnapshotId = null
          state.diffGhostNodes = {} as any
          state.diffGhostRelations = {} as any
          // Studio shows the loaded model's branch changes again once it has them.
          if (state.branch) { state.branch = null; state.showDiff = false }
          state.presentations = presInit.presentations as any
          // The same document read again keeps the presentation picked and
          // its slide (Presenter went back to the first presentation).
          const keptPres = opts?.outsideChange ? presInit.presentations.find((p) => p.id === st.activePresentationId) : undefined
          const pres = keptPres ?? presInit.presentations[0]
          state.activePresentationId = pres.id
          state.presentationSlides = pres.slides as any
          state.presentationActive = false
          state.presentationSlideIndex = keptPres ? Math.max(0, Math.min(st.presentationSlideIndex, pres.slides.length - 1)) : 0
          state.metamodel = model.documentMetamodel(data.metamodel, data.nodes) as any
          model.syncViewpoints(state as unknown as model.ModelState)
          state.hubTemplates = (data.hubTemplates ?? {}) as any
          state.hubMeta = data.hub ?? null
        })
        if (opts?.outsideChange) get()._forgetStepsOfLostTypes()
        // Outside designer, setAppMode parked the model to put back on return.
        // A load (an outside edit reloaded from disk, a document switch) is the
        // new baseline: park it instead, or returning to designer would bring
        // back — and the next autosave write — the model from before the load.
        const W = window as any
        _beforeSlidePreview = null
        if (W.__preModeLayout) {
          const pre = W.__preModeLayout as ParkedDesigner
          const parkedViewId = pre.activeViewId && views[pre.activeViewId] ? pre.activeViewId : null
          // The nodes just loaded are where All elements has them. Parked
          // under a view's id as they are, the return to Designer drew the
          // view with All elements' layout and the next edit saved it as the
          // view's: they go back where that view has them.
          const viewPositions = parkedViewId ? views[parkedViewId].positions as Record<string, NodePosition> : undefined
          const liveNodes = viewPositions && Object.keys(viewPositions).length > 0
            ? atDefaultPositions(Object.values(get().c4Nodes), viewPositions)
            : get().c4Nodes
          const loaded = parkDesigner(get())
          // Designer's milestone stays too, over the live model as it is now.
          const parkedShown = pre.activeSnapshotId && pre.liveBackup ? snapshots.find((m) => m.id === pre.activeSnapshotId) : undefined
          const parkedMilestone = opts?.outsideChange && parkedShown ? _milestoneAfterOutsideChange({
            id: parkedShown.id,
            before: st.snapshots.find((m) => m.id === parkedShown.id) ?? parkedShown,
            nodes: pre.c4Nodes,
            relations: pre.c4Relations,
            sequences: pre.sequences,
            dirty: pre.milestoneDirty,
            promptOpen: false,
            activeViewId: pre.activeViewId,
            diffHighlight: pre.diffHighlight,
            diffBaseSnapshotId: pre.diffBaseSnapshotId,
            diffGhostNodes: pre.diffGhostNodes,
            diffGhostRelations: pre.diffGhostRelations,
          }, snapshots) : null
          W.__preModeLayout = (parkedMilestone ? {
            ...pre,
            c4Nodes: parkedMilestone.nodes,
            c4Relations: parkedMilestone.relations,
            sequences: parkedMilestone.sequences,
            views,
            defaultPositions: defaultPos,
            activeViewId: parkedViewId,
            liveBackup: { nodes: liveNodes, relations, sequences },
          } : {
            ...loaded,
            c4Nodes: liveNodes,
            activeViewId: parkedViewId,
          }) satisfies ParkedDesigner
          if (opts?.outsideChange && pre.activeSnapshotId && pre.milestoneDirty && !parkedMilestone) lostMilestone(pre.activeSnapshotId)
        }
        // The milestone shown stays, over the live model just read. Its
        // elements are where the canvas shown has them; on All elements when
        // that view is gone.
        if (shownMilestone && milestone) {
          const viewId = shownMilestone.activeViewId && views[shownMilestone.activeViewId] ? shownMilestone.activeViewId : null
          const shownNodes = shownMilestone.activeViewId && !viewId && _milestoneAllPositions
            ? atDefaultPositions(Object.values(milestone.nodes), _milestoneAllPositions)
            : milestone.nodes
          set((state) => {
            state.liveBackup = { nodes: state.c4Nodes, relations: state.c4Relations, sequences: state.sequences, hubTemplates: state.hubTemplates } as any
            showMilestoneViews(state as DiagramStore, snapshots.find((m) => m.id === shownMilestone.id))
            // From the store, not the draft: a draft kept past this set is
            // revoked, and Propagate threw on it.
            _milestoneHubBase = milestoneHubTemplates(get().hubTemplates as Record<string, HubImportRecord>, shownNodes as Record<string, C4Node>)
            state.hubTemplates = _milestoneHubBase as any
            state.c4Nodes = shownNodes as any
            state.c4Relations = milestone.relations as any
            state.sequences = milestone.sequences as any
            state.activeSnapshotId = shownMilestone.id
            state.milestoneDirty = shownMilestone.dirty
            state.milestonePromptOpen = shownMilestone.promptOpen
            state.diffHighlight = shownMilestone.diffHighlight as any
            state.diffBaseSnapshotId = shownMilestone.diffBaseSnapshotId
            state.diffGhostNodes = shownMilestone.diffGhostNodes as any
            state.diffGhostRelations = shownMilestone.diffGhostRelations as any
            state.activeViewId = viewId
            state.canUndo = _undoStack.length > 0
            state.canRedo = _redoStack.length > 0
          })
          if (milestone.conflicts.length) {
            get().pushNotification(`The milestone "${shownMilestone.before.name}" was changed outside Studio too. Where both changed the same value, the folder's was kept: ${milestone.conflicts.slice(0, 5).join('; ')}.`, 'warning')
          }
        } else if (shownMilestone?.dirty) {
          lostMilestone(shownMilestone.id)
        }
        get()._sync()
        // The document opens on All elements, with what was selected there.
        const allSelection = _viewSelections.get('')
        if (allSelection) set((state) => showSelection(state as DiagramStore, allSelection.nodeIds, allSelection.edgeId))
        get()._enforceLayoutConstraints()
        // skipBulk=true: the loaded positions stand, the live layout only
        // moves what is added or dragged from here on.
        get().startLiveLayout({ skipBulk: true })
        if (placedOnLoad.length > 0) _liveLayout?.reset(placedOnLoad)
        suggestSmartLayoutIfUnarranged(true)
        // Apply restored camera (loaded as activeViewId=null → default view).
        const shown = get().rfNodes.filter((n) => !n.hidden).map((n) => n.id)
        ;(window as any).__rfPlaceCamera?.(defaultVP ?? null, shown)
      },

      saveDiagram() {
        const { c4Nodes, c4Relations, sequences, views, activeViewId, defaultPositions, defaultViewport, snapshots, presentations, metamodel, activeSnapshotId, liveBackup } = get()

        // While a milestone is being viewed, c4Nodes / c4Relations hold the
        // *snapshot*; the real model is parked in liveBackup. Persist that —
        // otherwise a reload while time-travelling would overwrite the live
        // model with the milestone. Committed milestone edits are applied to
        // liveBackup too, so nothing is lost by reading from it.
        const timeTravelling = !!activeSnapshotId && !!liveBackup
        const liveNodes = timeTravelling ? liveBackup.nodes : c4Nodes
        const liveRelations = timeTravelling ? liveBackup.relations : c4Relations
        const liveSequences = timeTravelling ? (liveBackup.sequences ?? sequences) : sequences

        // Snapshot current positions into the active context before saving —
        // but not from the milestone's nodes, whose layout is not the live one.
        const currentPos = timeTravelling ? null : snapshotPositions(c4Nodes)
        const savedDefaultPos = activeViewId === null && currentPos ? currentPos : (timeTravelling && liveBackup.defaultPositions) || defaultPositions
        // Same for camera state so on reload each view restores its framing.
        const rawVP = (window as any).__rfCurrentViewport
        const currentVP: { x: number; y: number; zoom: number } | null = rawVP && !timeTravelling
          ? { x: rawVP.x, y: rawVP.y, zoom: rawVP.zoom }
          : null
        const savedDefaultVP = activeViewId === null ? (currentVP ?? defaultViewport) : defaultViewport
        // A view a milestone's edit changed is saved as the live model has it.
        const parked = timeTravelling ? liveBackup.views ?? {} : {}
        const savedViews = Object.values(views).map((shown) => parked[shown.id] ?? shown).map(v => ({
          ...v,
          positions: v.id === activeViewId && currentPos && v.id !== _firstLayoutOf ? viewCanvasPositions(v, liveNodes, currentPos, viewDrawnIds(v, liveNodes, liveRelations)) : v.positions,
          viewport: v.id === activeViewId ? (currentVP ?? v.viewport) : v.viewport,
        }))

        const liveConstraints = (timeTravelling && liveBackup.defaultLayoutConstraints) || get().defaultLayoutConstraints
        return {
          // On the exploration the nodes hold its places: they are saved
          // where All elements has them.
          nodes: shownExploration(get()) ? Object.values(atDefaultPositions(Object.values(liveNodes), defaultPositions)) : Object.values(liveNodes),
          relations: Object.values(liveRelations),
          sequences: Object.values(liveSequences),
          views: savedViews,
          defaultPositions: savedDefaultPos,
          defaultViewport: savedDefaultVP,
          ...(liveConstraints.length ? { defaultLayoutConstraints: liveConstraints as LayoutConstraint[] } : {}),
          ...(get().defaultEdgeStyle !== 'curved' ? { defaultEdgeStyle: get().defaultEdgeStyle } : {}),
          snapshots: snapshots as DiagramSnapshot[],
          presentations: presentations as Presentation[],
          metamodel: metamodel as Metamodel,
          hubTemplates: (timeTravelling && liveBackup.hubTemplates ? liveBackup.hubTemplates : get().hubTemplates) as Record<string, HubImportRecord>,
          ...(get().hubMeta ? { hub: get().hubMeta as HubConceptMeta } : {}),
        }
      },

      resetDiagram() {
        _modelLoads++
        get().stopLiveLayout()
        _historyForgotten()
        const sample = buildSampleDiagram()
        const presInit = buildPresentationsFromData(undefined, [])
        set((state) => {
          state.c4Nodes = sample.nodes as any
          state.c4Relations = sample.relations as any
          state.sequences = {} as any
          state.activeSequenceId = null
          state.views = {} as any
          state.exploration = null
          state.activeViewId = null
          state.defaultPositions = snapshotPositions(sample.nodes) as any
          state.defaultLayoutConstraints = []
          state.defaultEdgeStyle = 'curved'
          state.selectedNodeId = null
          state.selectedEdgeId = null
          state.nodeWizard = null
          state.canUndo = false
          state.canRedo = false
          state.snapshots = sample.snapshots as any
          state.activeSnapshotId = null
          state.diffHighlight = {} as any
          state.diffBaseSnapshotId = null
          state.diffGhostNodes = {} as any
          state.diffGhostRelations = {} as any
          state.presentations = presInit.presentations as any
          state.activePresentationId = presInit.activeId
          state.presentationSlides = presInit.presentations[0].slides as any
          state.presentationActive = false
          state.presentationSlideIndex = 0
          state.metamodel = builtInC4Metamodel() as any
          state.hubTemplates = {} as any
          state.hubMeta = null
        })
        get()._sync()
        get().startLiveLayout()
      },

      newDiagram() {
        _modelLoads++
        get().stopLiveLayout()
        _historyForgotten()
        const presInit = buildPresentationsFromData(undefined, [])
        set((state) => {
          state.c4Nodes = {}
          state.c4Relations = {}
          state.sequences = {} as any
          state.activeSequenceId = null
          state.views = {} as any
          state.exploration = null
          state.activeViewId = null
          state.defaultPositions = {} as any
          state.defaultLayoutConstraints = []
          state.defaultEdgeStyle = 'curved'
          state.selectedNodeId = null
          state.selectedEdgeId = null
          state.nodeWizard = null
          state.canUndo = false
          state.canRedo = false
          state.snapshots = [] as any
          state.activeSnapshotId = null
          state.presentations = presInit.presentations as any
          state.activePresentationId = presInit.activeId
          state.presentationSlides = presInit.presentations[0].slides as any
          state.presentationActive = false
          state.presentationSlideIndex = 0
          state.metamodel = builtInC4Metamodel() as any
          state.hubTemplates = {} as any
          state.hubMeta = null
        })
        get()._sync()
        get().startLiveLayout()
      },

      // ── viewport ────────────────────────────────────────────────────────
      setFitViewFn(fn, instantFn) {
        _setFitViewFnRef(fn)
        _setFitViewInstantFnRef(instantFn ?? fn)
        // If autofit is currently on (e.g. survived HMR or appMode switch), the
        // running interval might be referencing a dead closure from the previous
        // ReactFlow instance. Restart it cleanly with the new fns.
        if (get().autoFitActive) {
          const stale = _getAutoFitTimer()
          if (stale !== null) {
            clearInterval(stale)
            _setAutoFitTimer(null)
          }
          if (fn) {
            // Animated re-fit so the user sees that autofit is still alive.
            fn()
            const t = setInterval(() => {
              if (!get().autoFitActive) { clearInterval(t); _setAutoFitTimer(null); return }
              if (get().presentationActive) return
              _getFitViewInstantFn()?.()
            }, 300)
            _setAutoFitTimer(t)
          }
        } else {
          // HMR cleanup: drop any orphan timer left behind.
          const stale = _getAutoFitTimer()
          if (stale !== null) {
            clearInterval(stale)
            _setAutoFitTimer(null)
          }
        }
      },
      fitAll() {
        // Sequence view (dynamic) has its own fit registered via __radicalSeqFitFn.
        const activeView = get().activeViewId ? get().views[get().activeViewId!] : null
        if (activeView?.kind === 'dynamic') {
          ;(window as any).__radicalSeqFitFn?.()
          return
        }
        // Explicit one-shot fit-all: use the *animated* (force) fn so the
        // user always sees the camera move, even if smart-fit decided
        // nothing changed since the last tick.
        _getFitViewFn()?.()
      },
      zoomIn() {
        ;(window as any).__radicalZoomIn?.()
      },
      zoomOut() {
        ;(window as any).__radicalZoomOut?.()
      },
      toggleAutoFit() {
        // Always cancel any existing timer first
        const existing = _getAutoFitTimer()
        if (existing !== null) {
          clearInterval(existing)
          _setAutoFitTimer(null)
        }
        const next = !get().autoFitActive
        set((state) => { state.autoFitActive = next })
        updateStudioSettings({ smartFit: next })
        if (next) {
          _getFitViewFn()?.()  // start immediately (animated)
          const t = setInterval(() => {
            if (!get().autoFitActive) { clearInterval(t); _setAutoFitTimer(null); return }
            // Don't fight with slide viewport transitions during playback
            if (get().presentationActive) return
            _getFitViewInstantFn()?.()  // instant snap — no animation fighting physics
          }, 300)
          _setAutoFitTimer(t)
        }
      },
    }
  })
)

// Auto-start live cola layout (skip in test/SSR environments)
if (typeof requestAnimationFrame !== 'undefined') {
  // skipBulk=true when the store was initialised from localStorage: the
  // persisted positions stand.
  useDiagramStore.getState().startLiveLayout({ skipBulk: _initLoadedFromDisk })
  if (_initLoadedFromDisk) suggestSmartLayoutIfUnarranged(true)
}
