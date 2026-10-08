// ─── Layout tools: smart_layout / align_nodes / remove_alignment ─────────────
// Smart Layout lives in @radical/layout, which depends on this package, so
// the facade runs it: Studio through its store, the MCP server headlessly.
// Alignments are layout constraints every later layout keeps.

import { defaultGridColumns, type AlignConstraint, type LayoutConstraint } from '../../c4'
import { fail, type AsyncToolHandler, type ToolDef, type ToolHandler, type ToolRunContext } from './types'

const AXIS_ENUM = ['horizontal', 'vertical'] as const

/** The canvas a layout tool targets: a static or dynamic view, or All elements (null). */
function canvasFor(ctx: ToolRunContext, tool: string, raw: unknown): { viewId: string | null } | { error: string } {
  if (raw === undefined) return { viewId: null }
  if (typeof raw !== 'string' || !raw) return { error: `${tool}: viewId must be a view id` }
  const viewId = ctx.resolveId(raw)
  const view = ctx.diagram.getViews?.()[viewId]
  if (!view) return { error: `${tool}: unknown view id "${raw}"` }
  if (view.kind && view.kind !== 'static' && view.kind !== 'dynamic') {
    return { error: `${tool}: "${view.name}" is a ${view.kind} view; only static and dynamic views have a canvas layout` }
  }
  return { viewId }
}

const describeConstraint = (c: LayoutConstraint): string => c.type === 'grid'
  ? `${c.id} (grid of ${c.columns} columns: ${c.nodeIds.join(', ')})`
  : c.type === 'pin'
    ? `${c.id} (pinned where they stand: ${c.nodeIds.join(', ')})`
    : `${c.id} (${c.axis === 'horizontal' ? 'row' : 'column'}${c.ordered ? ' in order' : ''}: ${c.nodeIds.join(', ')})`

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
    {
      name: 'align_nodes',
      description: "Keep two or more elements on one line on a canvas: a row (axis 'horizontal', equal centre y) or a column (axis 'vertical', equal centre x). Every later layout keeps it: drags and the live physics in Studio, Smart Layout. Without viewId it applies to the All elements canvas; with the id of a static or dynamic view, to that view only. Elements hidden on the canvas are skipped until shown. Studio lines them up when it shows the canvas; smart_layout does too.",
      inputSchema: {
        type: 'object',
        properties: {
          nodeIds: { type: 'array', items: { type: 'string' }, description: 'Two or more node ids or tempIds; none inside another. With keepOrder, listed left to right (row) or top to bottom (column).' },
          axis: { type: 'string', enum: [...AXIS_ENUM], description: "'horizontal' = a row, 'vertical' = a column." },
          keepOrder: { type: 'boolean', description: 'Also keep the elements in the order of nodeIds along the line; no layout may swap them.' },
          viewId: { type: 'string', description: 'A static or dynamic view (real id or tempId); omit for All elements.' },
        },
        required: ['nodeIds', 'axis'],
        additionalProperties: false,
      },
    },
    {
      name: 'grid_nodes',
      description: "Keep elements in a grid on a canvas: `columns` columns, filled row by row in the order of nodeIds (left to right, then the next row). Every row stays a row and every column a column, in that order, through every later layout. Without viewId it applies to the All elements canvas; with the id of a static or dynamic view, to that view only. Studio arranges them when it shows the canvas; smart_layout keeps the grid. Remove it with remove_alignment.",
      inputSchema: {
        type: 'object',
        properties: {
          nodeIds: { type: 'array', items: { type: 'string' }, description: 'Two or more node ids or tempIds, in reading order; none inside another.' },
          columns: { type: 'number', description: 'Columns of the grid. Defaults to the smallest that makes it about square (ceil of the square root of the count).' },
          viewId: { type: 'string', description: 'A static or dynamic view (real id or tempId); omit for All elements.' },
        },
        required: ['nodeIds'],
        additionalProperties: false,
      },
    },
    {
      name: 'remove_alignment',
      description: 'Stop keeping elements aligned on a canvas: remove one alignment or grid by id, or every alignment and grid whose elements are all among nodeIds. The positions stay as they are. The id of a canvas\'s pin (the elements a Studio user dropped after a drag, kept still by the live physics) unpins them all.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Alignment id, as align_nodes returned it.' },
          nodeIds: { type: 'array', items: { type: 'string' }, description: 'Removes the alignments made only of these elements.' },
          viewId: { type: 'string', description: 'A static or dynamic view (real id or tempId); omit for All elements.' },
        },
        additionalProperties: false,
      },
    },
  ]
}

export function buildAlignmentToolHandlers(): Record<string, ToolHandler> {
  return {
    align_nodes: (rawInput, ctx) => {
      const input = (rawInput ?? {}) as { nodeIds?: unknown; axis?: unknown; viewId?: unknown; keepOrder?: unknown }
      if (!ctx.diagram.addAlignment) return fail('align_nodes: alignments are not editable in this context')
      if (input.keepOrder !== undefined && typeof input.keepOrder !== 'boolean') return fail('align_nodes: keepOrder must be true or false')
      if (!Array.isArray(input.nodeIds) || input.nodeIds.some((id) => typeof id !== 'string')) return fail('align_nodes: nodeIds must be an array of node ids')
      if (!(AXIS_ENUM as readonly unknown[]).includes(input.axis)) return fail(`align_nodes: axis must be 'horizontal' or 'vertical'`)
      const canvas = canvasFor(ctx, 'align_nodes', input.viewId)
      if ('error' in canvas) return fail(canvas.error)
      const nodeIds = (input.nodeIds as string[]).map((id) => ctx.resolveId(id))
      const added = ctx.diagram.addAlignment(canvas.viewId, input.axis as AlignConstraint['axis'], nodeIds, input.keepOrder === true)
      if ('error' in added) return fail(`align_nodes: ${added.error}`)
      const order = input.keepOrder === true ? ', in the order given' : ''
      return { ok: true, resultText: `Aligned ${nodeIds.length} elements in a ${input.axis === 'horizontal' ? 'row' : 'column'}${order}. Alignment ID: ${added.id}.`, updated: { views: 1 } }
    },
    grid_nodes: (rawInput, ctx) => {
      const input = (rawInput ?? {}) as { nodeIds?: unknown; columns?: unknown; viewId?: unknown }
      if (!ctx.diagram.addGrid) return fail('grid_nodes: grids are not editable in this context')
      if (!Array.isArray(input.nodeIds) || input.nodeIds.some((id) => typeof id !== 'string')) return fail('grid_nodes: nodeIds must be an array of node ids')
      if (input.columns !== undefined && (typeof input.columns !== 'number' || !Number.isInteger(input.columns) || input.columns < 1)) return fail('grid_nodes: columns must be a whole number, at least 1')
      const canvas = canvasFor(ctx, 'grid_nodes', input.viewId)
      if ('error' in canvas) return fail(canvas.error)
      const nodeIds = (input.nodeIds as string[]).map((id) => ctx.resolveId(id))
      const columns = (input.columns as number | undefined) ?? defaultGridColumns(nodeIds.length)
      const added = ctx.diagram.addGrid(canvas.viewId, nodeIds, columns)
      if ('error' in added) return fail(`grid_nodes: ${added.error}`)
      return { ok: true, resultText: `Kept ${nodeIds.length} elements in a grid of ${columns} columns. Alignment ID: ${added.id}.`, updated: { views: 1 } }
    },
    remove_alignment: (rawInput, ctx) => {
      const input = (rawInput ?? {}) as { id?: unknown; nodeIds?: unknown; viewId?: unknown }
      if (!ctx.diagram.getLayoutConstraints || !ctx.diagram.removeLayoutConstraints) return fail('remove_alignment: alignments are not editable in this context')
      if (input.id === undefined && input.nodeIds === undefined) return fail('remove_alignment: pass id or nodeIds')
      if (input.id !== undefined && (typeof input.id !== 'string' || !input.id)) return fail('remove_alignment: id must be an alignment id')
      if (input.nodeIds !== undefined && (!Array.isArray(input.nodeIds) || input.nodeIds.some((id) => typeof id !== 'string'))) return fail('remove_alignment: nodeIds must be an array of node ids')
      const canvas = canvasFor(ctx, 'remove_alignment', input.viewId)
      if ('error' in canvas) return fail(canvas.error)
      const among = input.nodeIds ? new Set((input.nodeIds as string[]).map((id) => ctx.resolveId(id))) : null
      // Pins (elements dropped after a drag in Studio) go only by id.
      const matches = ctx.diagram.getLayoutConstraints(canvas.viewId).filter((c) =>
        (input.id === undefined ? c.type !== 'pin' : c.id === input.id) && (!among || c.nodeIds.every((id) => among.has(id))))
      if (!matches.length) {
        const existing = ctx.diagram.getLayoutConstraints(canvas.viewId)
        return fail(`remove_alignment: no such alignment on this canvas.${existing.length ? ` It has: ${existing.map(describeConstraint).join('; ')}.` : ' It has none.'}`)
      }
      ctx.diagram.removeLayoutConstraints(canvas.viewId, matches.map((c) => c.id))
      return { ok: true, resultText: `Removed ${matches.map(describeConstraint).join('; ')}.`, updated: { views: 1 } }
    },
  }
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
