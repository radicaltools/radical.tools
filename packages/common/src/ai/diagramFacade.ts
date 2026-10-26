// ─── Diagram facade + apply report ──────────────────────────────────────────
// The interface every tool handler (ai/tools/*.ts) mutates the live diagram
// through, plus the aggregate report the UI shows after a run. Renamed from
// applyPatch.ts — there is no single "apply a whole patch" function anymore,
// each tool applies its own single change.

import type {
  EdgeStyle, AlignConstraint, C4Node, C4Relation, DiagramSequence, DiagramSnapshot, DiagramView, LayoutConstraint, Presentation, ViewPipeline } from '../c4'
import type { Metamodel } from '../metamodel'

export interface ApplyReport {
  added: { nodes: number; relations: number; views: number }
  updated: { nodes: number; relations: number; views: number }
  deleted: { nodes: number; relations: number; views: number }
  errors: string[]
  /** Node id to pan/zoom to after the run, if a focus_node tool was called. */
  focusNodeId?: string
}

export function emptyReport(): ApplyReport {
  return {
    added: { nodes: 0, relations: 0, views: 0 },
    updated: { nodes: 0, relations: 0, views: 0 },
    deleted: { nodes: 0, relations: 0, views: 0 },
    errors: [],
  }
}

/** Merges one tool call's counts into the run's aggregate report. */
export function mergeReport(into: ApplyReport, delta: {
  added?: Partial<ApplyReport['added']>
  updated?: Partial<ApplyReport['updated']>
  deleted?: Partial<ApplyReport['deleted']>
  focusNodeId?: string
}): void {
  if (delta.added) {
    into.added.nodes += delta.added.nodes ?? 0
    into.added.relations += delta.added.relations ?? 0
    into.added.views += delta.added.views ?? 0
  }
  if (delta.updated) {
    into.updated.nodes += delta.updated.nodes ?? 0
    into.updated.relations += delta.updated.relations ?? 0
    into.updated.views += delta.updated.views ?? 0
  }
  if (delta.deleted) {
    into.deleted.nodes += delta.deleted.nodes ?? 0
    into.deleted.relations += delta.deleted.relations ?? 0
    into.deleted.views += delta.deleted.views ?? 0
  }
  if (delta.focusNodeId !== undefined) into.focusNodeId = delta.focusNodeId
}

export interface DiagramFacade {
  getNodes(): Record<string, C4Node>
  getRelations(): Record<string, C4Relation>
  /** Optional — used to build tool schemas + inject metamodel rules into the system prompt. */
  getMetamodel?(): Metamodel | undefined
  /** Optional — active view info, used to tell the AI where new nodes land. */
  getActiveView?(): { id: string; name: string; nodeIds: string[] } | null
  /** Optional — returns all views so the AI can list / replace / delete them. */
  getViews?(): Record<string, DiagramView>
  addNode(node: Omit<C4Node, 'id'>): string
  updateNode(id: string, updates: Partial<Omit<C4Node, 'id'>>): void
  removeNode(id: string): void
  /** Optional — moves sibling nodes under a new parent (null = the root),
   *  keeping their canvas position. move_node checks the move first. */
  moveNodes?(ids: string[], parentId: string | null): void
  addRelation(rel: Omit<C4Relation, 'id'>): void
  updateRelation?(id: string, updates: Partial<Omit<C4Relation, 'id'>>): void
  removeRelation(id: string): void
  /** Optional view actions — omitted = AI view tools report a clear error. */
  /** `empty`: the view lists no element yet, instead of showing every one. */
  addView?(name: string, opts?: { empty?: boolean }): string
  setViewNodes?(viewId: string, nodeIds: string[]): void
  removeView?(id: string): void
  setActiveView?(id: string | null): void
  /** Optional — sets a view's kind (table/treemap/wiki/matrix/static/dynamic). */
  setViewKind?(id: string, kind: DiagramView['kind']): void
  renameView?(id: string, name: string): void
  /** Optional — links a dynamic view to a sequence (null unlinks it). */
  setViewSequence?(id: string, sequenceId: string | null): void
  /** Optional — hides exactly these relations in the view. */
  setViewHiddenRelations?(id: string, relationIds: string[]): void
  /** Optional — shows these elements folded (`collapsed`) or open in the
   *  view only, over their fold on the model. */
  setViewCollapsed?(id: string, nodeIds: string[], collapsed: boolean): void
  /** Optional — puts the view into a folder of the list of views ("C4/Components"); null or "" for none. */
  setViewFolder?(id: string, folder: string | null): void
  /** Optional — orders the listed views among the places they hold in the list of views. */
  orderViews?(ids: string[]): void
  /** Optional — how a view draws relations ('curved' | 'orthogonal'); null for the model's. */
  setViewEdgeStyle?(id: string, style: EdgeStyle | null): void
  /** Optional — whether Studio keeps the view tidied after each change. */
  setViewContinuousLayout?(id: string, on: boolean): void
  /** Optional — how a wiki view writes its pages: one element per page
   *  ('single') or its children as chapters ('multi'), `depth` levels deep. */
  setWikiPages?(id: string, mode: 'single' | 'multi', depth: number): void
  /** Optional — what a view does with its elements: its filter chain (viewPipeline.ts); {} removes it. */
  setViewPipeline?(id: string, pipeline: ViewPipeline): void
  /** Makes the view one of the metamodel's viewpoint `typeId` (its kind and
   *  chain, kept to `subjectId` for a viewpoint that draws one element;
   *  undefined keeps the view's element); false if there is none, or the
   *  element cannot be what it draws. */
  applyViewpoint?(id: string, typeId: string, subjectId?: string | null): boolean
  /** The view keeps its kind and chain (kept to its element), of no viewpoint. */
  detachViewpoint?(id: string): void
  /** Optional layout constraints of a canvas: a view, or All elements (null). */
  getLayoutConstraints?(viewId: string | null): LayoutConstraint[]
  /** Keeps nodes on one line on a canvas (with `ordered`, in the order of
   *  `nodeIds`); the new constraint's id, or why it was refused. */
  addAlignment?(viewId: string | null, axis: AlignConstraint['axis'], nodeIds: string[], ordered?: boolean): { id: string } | { error: string }
  /** Keeps nodes in a grid of `columns` columns, filled row by row in the
   *  order of `nodeIds`; the new constraint's id, or why it was refused. */
  addGrid?(viewId: string | null, nodeIds: string[], columns: number): { id: string } | { error: string }
  removeLayoutConstraints?(viewId: string | null, ids: string[]): void
  /** Optional sequence actions — omitted = AI sequence tools report a clear error. */
  getSequences?(): Record<string, DiagramSequence>
  addSequence?(name: string): string
  renameSequence?(id: string, name: string): void
  /** Replaces the steps, in order; a relation may repeat. */
  setSequenceSteps?(id: string, steps: Array<{ relationId: string; description?: string; backward?: boolean }>): void
  removeSequence?(id: string): void
  /** Optional — replaces the document's metamodel (metamodel tools). */
  setMetamodel?(metamodel: Metamodel): void
  /** Optional milestone access — omitted = milestone tools report a clear
   *  error. Milestones are named copies of the model, oldest first. */
  getMilestones?(): DiagramSnapshot[]
  /** The milestone Studio's timeline has loaded over the current model, if
   *  any: getNodes and the editing tools then see it, not the current model. */
  openMilestone?(): DiagramSnapshot | null
  /** Saves the current nodes, relations and sequences as the latest milestone; its id. */
  createMilestone?(name: string): string
  renameMilestone?(id: string, name: string): void
  removeMilestone?(id: string): void
  /** Optional presentation access — omitted = presentation tools report a clear error. */
  getPresentations?(): Presentation[]
  setPresentations?(presentations: Presentation[]): void
  /** Optional — runs Smart Layout over All elements (no viewId) or one
   *  static/dynamic view, and keeps the result. */
  runLayout?(viewId?: string, around?: readonly string[]): Promise<{ ok: boolean; text: string }>
  /** Optional — clears the diagram (nodes, relations, views, sequences) so the
   *  AI can build a fresh model from scratch. Omitting it means reset_diagram
   *  calls fail with a descriptive error. */
  clearDiagram?(): void
}
