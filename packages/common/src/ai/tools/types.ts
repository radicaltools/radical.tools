// ─── Tool handler plumbing ───────────────────────────────────────────────────

import type { DiagramFacade } from '../diagramFacade'

/** A tool as offered to a model (an AI chat provider or an MCP client). */
export interface ToolDef {
  name: string
  description: string
  /** Conservative common-subset JSON Schema (type/properties/required/enum/
   *  items/description/additionalProperties) — kept identical across every
   *  adapter so none has to translate a provider-specific schema dialect. */
  inputSchema: Record<string, unknown>
}

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
  /** Placement for a newly created node under `parentId` (undefined = the
   *  root), relative to that parent. Studio's grid ignores the parent, since
   *  its live layout reshuffles; the MCP server places it inside. */
  placeNext(parentId?: string): { x: number; y: number }
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

/** A tool that has to wait, e.g. for a layout run. */
export type AsyncToolHandler = (input: unknown, ctx: ToolRunContext) => Promise<ToolResult>

export function fail(resultText: string): ToolResult {
  return { ok: false, resultText }
}
