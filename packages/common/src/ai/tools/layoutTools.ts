// ─── Layout tool: smart_layout ───────────────────────────────────────────────
// Smart Layout lives in @radical/layout, which depends on this package, so
// the facade runs it: Studio through its store, the MCP server headlessly.

import { fail, type AsyncToolHandler, type ToolDef } from './types'

export function buildLayoutToolDefs(): ToolDef[] {
  return [
    {
      name: 'smart_layout',
      description: "Run Smart Layout and keep the new positions and container sizes. Without viewId it arranges the All elements canvas; with the id of a static or dynamic view it arranges that view's own positions. Call it after adding or moving several nodes.",
      inputSchema: {
        type: 'object',
        properties: { viewId: { type: 'string', description: 'A static or dynamic view (real id or tempId); omit for All elements.' } },
        additionalProperties: false,
      },
    },
  ]
}

export function buildLayoutToolHandlers(): Record<string, AsyncToolHandler> {
  return {
    smart_layout: async (rawInput, ctx) => {
      const input = (rawInput ?? {}) as { viewId?: unknown }
      if (!ctx.diagram.runLayout) return fail('smart_layout: layout is not available in this context')
      if (input.viewId !== undefined && (typeof input.viewId !== 'string' || !input.viewId)) return fail('smart_layout: viewId must be a view id')
      let viewId: string | undefined
      if (typeof input.viewId === 'string') {
        viewId = ctx.resolveId(input.viewId)
        const view = ctx.diagram.getViews?.()[viewId]
        if (!view) return fail(`smart_layout: unknown view id "${input.viewId}"`)
        if (view.kind && view.kind !== 'static' && view.kind !== 'dynamic') {
          return fail(`smart_layout: "${view.name}" is a ${view.kind} view; only static and dynamic views have a canvas layout`)
        }
      }
      const outcome = await ctx.diagram.runLayout(viewId)
      return { ok: outcome.ok, resultText: outcome.text }
    },
  }
}
