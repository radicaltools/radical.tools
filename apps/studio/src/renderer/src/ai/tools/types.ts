// ─── Tool handler plumbing ───────────────────────────────────────────────────

import type { DiagramFacade } from '../diagramFacade'

export interface ToolRunContext {
  diagram: DiagramFacade
  /** tempId or real id -> real id (identity when not a known tempId). */
  resolveId(id: string): string
  /** Record a newly created real id under a model-chosen tempId, for later
   *  tool calls in the same run to reference. */
  registerTempId(tempId: string, realId: string): void
  /** Clears the tempId map — call after reset_diagram, since prior tempIds
   *  point at nodes that no longer exist. */
  resetTempIds(): void
  /** Simple grid placement for a newly created node; live layout reshuffles. */
  placeNext(): { x: number; y: number }
}

export interface ToolResult {
  ok: boolean
  /** Fed back to the model as this call's tool_result content. */
  resultText: string
  added?: Partial<{ nodes: number; relations: number; views: number }>
  updated?: Partial<{ nodes: number; relations: number; views: number }>
  deleted?: Partial<{ nodes: number; relations: number; views: number }>
  focusNodeId?: string
}

export type ToolHandler = (input: unknown, ctx: ToolRunContext) => ToolResult

export function fail(resultText: string): ToolResult {
  return { ok: false, resultText }
}
