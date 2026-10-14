// ─── View tools: create_view / update_view / set_view_nodes / delete_view / set_active_view

import type { DiagramView } from '../../c4'
import { fail, type ToolDef, type ToolHandler, type ToolRunContext } from './types'

// 'dynamic' needs a sequence (create_sequence) — the handlers refuse it without one.
const VIEW_KIND_ENUM = ['static', 'table', 'treemap', 'matrix', 'wiki', 'dynamic'] as const

const KIND_DESCRIPTION = "'table' for governance record types (ADR/Fitness Function/Requirement), 'treemap' for hierarchy overviews, 'wiki' for docs, 'matrix' for relation grids, 'dynamic' to play a sequence (needs sequenceId), 'static' (default) otherwise."

/** The real id of an existing sequence, or the reason there is none. */
function sequenceFor(ctx: ToolRunContext, tool: string, raw: unknown): { id: string } | { error: string } {
  if (typeof raw !== 'string' || !raw) return { error: `${tool}: a dynamic view needs a sequenceId` }
  if (!ctx.diagram.getSequences || !ctx.diagram.setViewSequence) return { error: `${tool}: sequences are not editable in this context` }
  const id = ctx.resolveId(raw)
  if (!(id in ctx.diagram.getSequences())) return { error: `${tool}: unknown sequenceId "${raw}"` }
  return { id }
}

/** Step endpoints of a sequence — what a new dynamic view shows by default. */
function sequenceEndpoints(ctx: ToolRunContext, sequenceId: string): string[] {
  const relations = ctx.diagram.getRelations()
  const ids = new Set<string>()
  for (const relationId of ctx.diagram.getSequences?.()[sequenceId]?.relationIds ?? []) {
    const relation = relations[relationId]
    if (relation) { ids.add(relation.sourceId); ids.add(relation.targetId) }
  }
  return [...ids]
}

export function buildViewToolDefs(): ToolDef[] {
  return [
    {
      name: 'create_view',
      description: 'Create a new named view — a filtered/specialized way to look at the model.',
      inputSchema: {
        type: 'object',
        properties: {
          folder: { type: 'string', description: 'The folder the view sits in in the list of views, a path such as "C4/Components"; "" puts it at the top.' },
          tempId: { type: 'string' },
          name: { type: 'string' },
          kind: { type: 'string', enum: [...VIEW_KIND_ENUM], description: KIND_DESCRIPTION },
          sequenceId: { type: 'string', description: "For kind 'dynamic': the sequence (real id or tempId) the view plays." },
          nodeIds: {
            type: 'array',
            items: { type: 'string' },
            description: "Real node ids or tempIds from this run. Omit or leave empty to show every node (a dynamic view defaults to its sequence's nodes).",
          },
          active: { type: 'boolean', description: 'Switch to this view immediately after creating it.' },
        },
        required: ['tempId', 'name'],
        additionalProperties: false,
      },
    },
    {
      name: 'update_view',
      description: "Rename a view, move it into a folder of the list of views, change its kind or linked sequence, set which relations it hides, or show elements open or folded in it. Use set_view_nodes to change its nodes.",
      inputSchema: {
        type: 'object',
        properties: {
          folder: { type: 'string', description: 'The folder the view sits in in the list of views, a path such as "C4/Components"; "" puts it at the top.' },
          id: { type: 'string' },
          name: { type: 'string' },
          kind: { type: 'string', enum: [...VIEW_KIND_ENUM], description: KIND_DESCRIPTION },
          sequenceId: { type: ['string', 'null'], description: 'Sequence a dynamic view plays (real id or tempId); null unlinks it.' },
          hiddenRelationIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'The complete set of relations to hide in this view even though both endpoints are visible. [] shows them all.',
          },
          expand: {
            type: 'array',
            items: { type: 'string' },
            description: 'Elements (real ids or tempIds) to show open in this view, also when they are folded on the model or folded by someone in Studio; their children in the view become visible.',
          },
          collapse: {
            type: 'array',
            items: { type: 'string' },
            description: 'Elements to show folded in this view only.',
          },
        },
        required: ['id'],
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
      name: 'order_views',
      description: 'Order views in the list of views. The listed views take, in the order given, the places they held; the others keep theirs, so list every view to set the whole order. A folder stands where its first view does, so this orders folders too.',
      inputSchema: {
        type: 'object',
        properties: { ids: { type: 'array', items: { type: 'string' }, description: 'View ids (or tempIds), in the order wanted.' } },
        required: ['ids'],
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
      const input = rawInput as { tempId?: unknown; name?: unknown; kind?: unknown; sequenceId?: unknown; nodeIds?: unknown; active?: unknown; folder?: unknown }
      if (typeof input.tempId !== 'string' || !input.tempId) return fail('create_view: tempId is required')
      if (typeof input.name !== 'string' || !input.name.trim()) return fail('create_view: name is required')
      if (!ctx.diagram.addView || !ctx.diagram.setViewNodes) return fail('create_view: views are not editable in this context')

      const sequence = input.kind === 'dynamic' ? sequenceFor(ctx, 'create_view', input.sequenceId) : undefined
      if (sequence && 'error' in sequence) return fail(sequence.error)

      const realId = ctx.diagram.addView(input.name.trim())
      if (!realId) return fail(`create_view "${input.name}" was rejected by the store`)
      ctx.registerTempId(input.tempId, realId)

      if (Array.isArray(input.nodeIds) && input.nodeIds.length > 0) {
        const resolved = input.nodeIds.filter((x): x is string => typeof x === 'string').map((id) => ctx.resolveId(id))
        ctx.diagram.setViewNodes(realId, resolved)
      } else if (sequence) {
        ctx.diagram.setViewNodes(realId, sequenceEndpoints(ctx, sequence.id))
      }
      if (sequence) ctx.diagram.setViewSequence!(realId, sequence.id)
      if (typeof input.kind === 'string' && input.kind !== 'static') {
        if (!ctx.diagram.setViewKind) return fail('create_view: view kind cannot be set in this context')
        ctx.diagram.setViewKind(realId, input.kind as DiagramView['kind'])
      }
      if (typeof input.folder === 'string' && input.folder.trim()) {
        if (!ctx.diagram.setViewFolder) return fail('create_view: folders of views are not available in this context')
        ctx.diagram.setViewFolder(realId, input.folder)
      }
      if (input.active === true && ctx.diagram.setActiveView) ctx.diagram.setActiveView(realId)

      return { ok: true, resultText: `Created view ${realId}.`, added: { views: 1 } }
    },

    update_view: (rawInput, ctx) => {
      const input = rawInput as { id?: unknown; name?: unknown; kind?: unknown; sequenceId?: unknown; hiddenRelationIds?: unknown; expand?: unknown; collapse?: unknown; folder?: unknown }
      if (typeof input.id !== 'string' || !input.id) return fail('update_view: id is required')
      if (!ctx.diagram.getViews) return fail('update_view: views are not editable in this context')
      const vId = ctx.resolveId(input.id)
      const view = ctx.diagram.getViews()[vId]
      if (!view) return fail(`update_view: unknown view id "${input.id}"`)
      if (input.name !== undefined && (typeof input.name !== 'string' || !input.name.trim())) return fail('update_view: name must be a non-empty string')
      if (input.kind !== undefined && !(VIEW_KIND_ENUM as readonly unknown[]).includes(input.kind)) return fail(`update_view: unknown kind "${String(input.kind)}"`)
      if (input.hiddenRelationIds !== undefined && !Array.isArray(input.hiddenRelationIds)) return fail('update_view: hiddenRelationIds must be an array')

      const kind = (input.kind ?? view.kind ?? 'static') as DiagramView['kind']
      let sequenceId: string | null | undefined
      if (input.sequenceId === null) sequenceId = null
      else if (input.sequenceId !== undefined) {
        const sequence = sequenceFor(ctx, 'update_view', input.sequenceId)
        if ('error' in sequence) return fail(sequence.error)
        sequenceId = sequence.id
      }
      if (kind === 'dynamic' && (sequenceId === null || (sequenceId === undefined && !view.sequenceId))) {
        return fail('update_view: a dynamic view needs a sequenceId')
      }

      const changes: Array<() => void> = []
      if (typeof input.name === 'string') {
        if (!ctx.diagram.renameView) return fail('update_view: views cannot be renamed in this context')
        const name = input.name.trim()
        changes.push(() => ctx.diagram.renameView!(vId, name))
      }
      if (input.folder !== undefined) {
        if (typeof input.folder !== 'string') return fail('update_view: folder must be a string ("" for none)')
        if (!ctx.diagram.setViewFolder) return fail('update_view: folders of views are not available in this context')
        const folder = input.folder
        changes.push(() => ctx.diagram.setViewFolder!(vId, folder))
      }
      if (input.kind !== undefined) {
        if (!ctx.diagram.setViewKind) return fail('update_view: view kind cannot be set in this context')
        changes.push(() => ctx.diagram.setViewKind!(vId, kind))
      }
      if (sequenceId !== undefined) changes.push(() => ctx.diagram.setViewSequence!(vId, sequenceId))
      if (Array.isArray(input.hiddenRelationIds)) {
        if (!ctx.diagram.setViewHiddenRelations) return fail('update_view: hidden relations cannot be set in this context')
        const relations = ctx.diagram.getRelations()
        const ids = input.hiddenRelationIds.filter((x): x is string => typeof x === 'string').map((id) => ctx.resolveId(id))
        const unknown = ids.filter((id) => !(id in relations))
        if (unknown.length) return fail(`update_view: unknown relation id(s) ${unknown.join(', ')}`)
        changes.push(() => ctx.diagram.setViewHiddenRelations!(vId, ids))
      }
      for (const [key, collapsed] of [['expand', false], ['collapse', true]] as const) {
        const raw = input[key]
        if (raw === undefined) continue
        if (!Array.isArray(raw)) return fail(`update_view: ${key} must be an array`)
        if (!ctx.diagram.setViewCollapsed) return fail(`update_view: elements cannot be ${collapsed ? 'folded' : 'opened'} in this context`)
        const nodes = ctx.diagram.getNodes()
        const ids = raw.filter((x): x is string => typeof x === 'string').map((id) => ctx.resolveId(id))
        const unknown = ids.filter((id) => !(id in nodes))
        if (unknown.length) return fail(`update_view: unknown element id(s) ${unknown.join(', ')}`)
        changes.push(() => ctx.diagram.setViewCollapsed!(vId, ids, collapsed))
      }
      if (!changes.length) return fail('update_view: nothing to change')
      for (const change of changes) change()
      return { ok: true, resultText: `Updated view ${vId}.`, updated: { views: 1 } }
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

    order_views: (rawInput, ctx) => {
      const input = rawInput as { ids?: unknown }
      if (!Array.isArray(input.ids) || input.ids.some((id) => typeof id !== 'string')) return fail('order_views: ids must be a list of view ids')
      if (!ctx.diagram.orderViews || !ctx.diagram.getViews) return fail('order_views: views cannot be ordered in this context')
      const views = ctx.diagram.getViews()
      const ids = (input.ids as string[]).map((id) => ctx.resolveId(id))
      const unknown = ids.filter((id) => !(id in views))
      if (unknown.length) return fail(`order_views: unknown view id(s) ${unknown.join(', ')}`)
      if (new Set(ids).size !== ids.length) return fail('order_views: a view is listed twice')
      ctx.diagram.orderViews(ids)
      return { ok: true, resultText: `Ordered ${ids.length} view${ids.length === 1 ? '' : 's'}.` }
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
