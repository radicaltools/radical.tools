// ─── Diagram facade + apply report ──────────────────────────────────────────
// The interface every tool handler (ai/tools/*.ts) mutates the live diagram
// through, plus the aggregate report the UI shows after a run. Renamed from
// applyPatch.ts — there is no single "apply a whole patch" function anymore,
// each tool applies its own single change.

import type { C4Node, C4Relation, DiagramView } from '../types/c4'
import type { Metamodel } from '../types/metamodel'

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
  addRelation(rel: Omit<C4Relation, 'id'>): void
  updateRelation?(id: string, updates: Partial<Omit<C4Relation, 'id'>>): void
  removeRelation(id: string): void
  /** Optional view actions — omitted = AI view tools report a clear error. */
  addView?(name: string): string
  setViewNodes?(viewId: string, nodeIds: string[]): void
  removeView?(id: string): void
  setActiveView?(id: string | null): void
  /** Optional — sets a view's kind (table/treemap/wiki/matrix/static). */
  setViewKind?(id: string, kind: DiagramView['kind']): void
  /** Optional — clears the entire diagram (nodes, relations, views) so the
   *  AI can build a fresh model from scratch. Omitting it means reset_diagram
   *  calls fail with a descriptive error. */
  clearDiagram?(): void
}
