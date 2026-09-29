// ─── Model tools: search_model / focus_node / reset_diagram ─────────────────

import { MODEL_QUERY_LANGUAGE_HELP, runModelQuery } from '../queryLanguage'
import type { ToolDef } from '../types'
import { fail, type ToolHandler } from './types'

export function buildModelToolDefs(): ToolDef[] {
  return [
    {
      name: 'search_model',
      description: MODEL_QUERY_LANGUAGE_HELP,
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
        additionalProperties: false,
      },
    },
    {
      name: 'focus_node',
      description: 'Pan and zoom the canvas to a node. Use as the last call when the user asks to "show", "find", "navigate to", or "highlight" something.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
    {
      name: 'reset_diagram',
      description: 'Erase EVERY node, relation and view. Use ONLY when the user explicitly asks to start from scratch or replace the whole model. Call this before any other tool in the same task.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
  ]
}

export function buildModelToolHandlers(): Record<string, ToolHandler> {
  return {
    search_model: (rawInput, ctx) => {
      const input = rawInput as { query?: unknown }
      if (typeof input.query !== 'string' || !input.query.trim()) return fail('search_model: query is required')
      try {
        const result = runModelQuery(input.query, {
          nodes: ctx.diagram.getNodes(),
          relations: ctx.diagram.getRelations(),
          views: ctx.diagram.getViews?.(),
        })
        return { ok: true, resultText: JSON.stringify(result.result) }
      } catch (err) {
        return fail((err as Error).message)
      }
    },

    focus_node: (rawInput, ctx) => {
      const input = rawInput as { id?: unknown }
      if (typeof input.id !== 'string' || !input.id) return fail('focus_node: id is required')
      const nId = ctx.resolveId(input.id)
      if (!(nId in ctx.diagram.getNodes())) return fail(`focus_node: unknown node id "${input.id}"`)
      return { ok: true, resultText: `Focused ${nId}.`, focusNodeId: nId }
    },

    reset_diagram: (_rawInput, ctx) => {
      if (!ctx.diagram.clearDiagram) return fail('reset_diagram: clearDiagram is not wired in this context')
      ctx.diagram.clearDiagram()
      ctx.resetTempIds()
      return { ok: true, resultText: 'Diagram reset.' }
    },
  }
}
