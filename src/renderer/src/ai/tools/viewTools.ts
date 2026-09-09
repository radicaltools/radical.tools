// ─── View tools: create_view / set_view_nodes / delete_view / set_active_view

import type { DiagramView } from '../../types/c4'
import type { ToolDef } from '../types'
import { fail, type ToolHandler } from './types'

// 'dynamic' is deliberately excluded: it needs a sequenceId, and there is no
// tool here to create one — exposing it would let the model build a broken view.
const VIEW_KIND_ENUM = ['static', 'table', 'treemap', 'matrix', 'wiki'] as const

export function buildViewToolDefs(): ToolDef[] {
  return [
    {
      name: 'create_view',
      description: 'Create a new named view — a filtered/specialized way to look at the model.',
      inputSchema: {
        type: 'object',
        properties: {
          tempId: { type: 'string' },
          name: { type: 'string' },
          kind: {
            type: 'string',
            enum: [...VIEW_KIND_ENUM],
            description: "'table' for governance record types (ADR/Fitness Function/Requirement), 'treemap' for hierarchy overviews, 'wiki' for docs, 'matrix' for relation grids, 'static' (default) otherwise.",
          },
          nodeIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Real node ids or tempIds from this run. Omit or leave empty to show every node.',
          },
          active: { type: 'boolean', description: 'Switch to this view immediately after creating it.' },
        },
        required: ['tempId', 'name'],
        additionalProperties: false,
      },
    },
    {
      name: 'set_view_nodes',
      description: "Replace a view's visible-node set.",
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          nodeIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'nodeIds'],
        additionalProperties: false,
      },
    },
    {
      name: 'delete_view',
      description: 'Delete a view.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
    {
      name: 'set_active_view',
      description: 'Switch the active view, or pass null to clear the filter (show every node).',
      inputSchema: {
        type: 'object',
        properties: { id: { type: ['string', 'null'] } },
        required: ['id'],
        additionalProperties: false,
      },
    },
  ]
}

export function buildViewToolHandlers(): Record<string, ToolHandler> {
  return {
    create_view: (rawInput, ctx) => {
      const input = rawInput as { tempId?: unknown; name?: unknown; kind?: unknown; nodeIds?: unknown; active?: unknown }
      if (typeof input.tempId !== 'string' || !input.tempId) return fail('create_view: tempId is required')
      if (typeof input.name !== 'string' || !input.name.trim()) return fail('create_view: name is required')
      if (!ctx.diagram.addView || !ctx.diagram.setViewNodes) return fail('create_view: views are not editable in this context')

      const realId = ctx.diagram.addView(input.name.trim())
      if (!realId) return fail(`create_view "${input.name}" was rejected by the store`)
      ctx.registerTempId(input.tempId, realId)

      if (Array.isArray(input.nodeIds) && input.nodeIds.length > 0) {
        const resolved = input.nodeIds.filter((x): x is string => typeof x === 'string').map((id) => ctx.resolveId(id))
        ctx.diagram.setViewNodes(realId, resolved)
      }
      if (typeof input.kind === 'string' && input.kind !== 'static') {
        if (!ctx.diagram.setViewKind) return fail('create_view: view kind cannot be set in this context')
        ctx.diagram.setViewKind(realId, input.kind as DiagramView['kind'])
      }
      if (input.active === true && ctx.diagram.setActiveView) ctx.diagram.setActiveView(realId)

      return { ok: true, resultText: `Created view ${realId}.`, added: { views: 1 } }
    },

    set_view_nodes: (rawInput, ctx) => {
      const input = rawInput as { id?: unknown; nodeIds?: unknown }
      if (typeof input.id !== 'string' || !input.id) return fail('set_view_nodes: id is required')
      if (!Array.isArray(input.nodeIds)) return fail('set_view_nodes: nodeIds must be an array')
      if (!ctx.diagram.setViewNodes || !ctx.diagram.getViews) return fail('set_view_nodes: views are not editable in this context')
      const vId = ctx.resolveId(input.id)
      if (!(vId in ctx.diagram.getViews())) return fail(`set_view_nodes: unknown view id "${input.id}"`)
      const resolved = input.nodeIds.filter((x): x is string => typeof x === 'string').map((id) => ctx.resolveId(id))
      ctx.diagram.setViewNodes(vId, resolved)
      return { ok: true, resultText: `Updated view ${vId}.`, updated: { views: 1 } }
    },

    delete_view: (rawInput, ctx) => {
      const input = rawInput as { id?: unknown }
      if (typeof input.id !== 'string' || !input.id) return fail('delete_view: id is required')
      if (!ctx.diagram.removeView || !ctx.diagram.getViews) return fail('delete_view: views are not editable in this context')
      const vId = ctx.resolveId(input.id)
      if (!(vId in ctx.diagram.getViews())) return fail(`delete_view: unknown view id "${input.id}"`)
      ctx.diagram.removeView(vId)
      return { ok: true, resultText: `Deleted view ${vId}.`, deleted: { views: 1 } }
    },

    set_active_view: (rawInput, ctx) => {
      const input = rawInput as { id?: unknown }
      if (!ctx.diagram.setActiveView) return fail('set_active_view: views are not editable in this context')
      if (input.id === null) {
        ctx.diagram.setActiveView(null)
        return { ok: true, resultText: 'Cleared the active view filter.' }
      }
      if (typeof input.id !== 'string' || !input.id) return fail('set_active_view: id must be a string or null')
      const vId = ctx.resolveId(input.id)
      if (ctx.diagram.getViews && !(vId in ctx.diagram.getViews())) return fail(`set_active_view: unknown view id "${input.id}"`)
      ctx.diagram.setActiveView(vId)
      return { ok: true, resultText: `Switched to view ${vId}.` }
    },
  }
}
