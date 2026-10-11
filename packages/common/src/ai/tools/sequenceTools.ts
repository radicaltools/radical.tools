// ─── Sequence tools: create_sequence / update_sequence / delete_sequence ────
// A sequence is an ordered list of existing relations (the steps of a flow,
// e.g. "Checkout"). A view of kind 'dynamic' plays one — see create_view.

import { fail, type ToolDef, type ToolHandler, type ToolRunContext } from './types'

const STEPS_SCHEMA = {
  type: 'array',
  description: 'Ordered steps. Each step is an existing relation (real id or tempId); the same relation may appear more than once.',
  items: {
    type: 'object',
    properties: {
      relationId: { type: 'string' },
      description: { type: 'string', description: 'What happens in this step, shown instead of the relation label.' },
    },
    required: ['relationId'],
    additionalProperties: false,
  },
}

export function buildSequenceToolDefs(): ToolDef[] {
  return [
    {
      name: 'create_sequence',
      description: 'Create a named sequence (an ordered interaction flow) from existing relations. Show it with create_view kind "dynamic".',
      inputSchema: {
        type: 'object',
        properties: {
          tempId: { type: 'string' },
          name: { type: 'string' },
          steps: STEPS_SCHEMA,
        },
        required: ['tempId', 'name'],
        additionalProperties: false,
      },
    },
    {
      name: 'update_sequence',
      description: "Rename a sequence or replace its steps (the full ordered list).",
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          steps: STEPS_SCHEMA,
        },
        required: ['id'],
        additionalProperties: false,
      },
    },
    {
      name: 'delete_sequence',
      description: 'Delete a sequence. Dynamic views that played it stay, unlinked.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
  ]
}

type Steps = Array<{ relationId: string; description?: string }>

/** Validated steps with real relation ids, or the reason they are invalid. */
function parseSteps(tool: string, raw: unknown, ctx: ToolRunContext): { steps: Steps } | { error: string } {
  if (!Array.isArray(raw)) return { error: `${tool}: steps must be an array` }
  const relations = ctx.diagram.getRelations()
  const steps: Steps = []
  for (const [i, step] of raw.entries()) {
    const s = step as { relationId?: unknown; description?: unknown }
    if (typeof s?.relationId !== 'string' || !s.relationId) return { error: `${tool}: step ${i + 1} needs a relationId` }
    const relationId = ctx.resolveId(s.relationId)
    if (!(relationId in relations)) return { error: `${tool}: step ${i + 1} has unknown relationId "${s.relationId}"` }
    steps.push({ relationId, ...(typeof s.description === 'string' && s.description ? { description: s.description } : {}) })
  }
  return { steps }
}

export function buildSequenceToolHandlers(): Record<string, ToolHandler> {
  return {
    create_sequence: (rawInput, ctx) => {
      const input = rawInput as { tempId?: unknown; name?: unknown; steps?: unknown }
      if (typeof input.tempId !== 'string' || !input.tempId) return fail('create_sequence: tempId is required')
      if (typeof input.name !== 'string' || !input.name.trim()) return fail('create_sequence: name is required')
      if (!ctx.diagram.addSequence || !ctx.diagram.setSequenceSteps) return fail('create_sequence: sequences are not editable in this context')
      const parsed = input.steps === undefined ? { steps: [] } : parseSteps('create_sequence', input.steps, ctx)
      if ('error' in parsed) return fail(parsed.error)
      const id = ctx.diagram.addSequence(input.name.trim())
      if (!id) return fail(`create_sequence "${input.name}" was rejected by the store`)
      ctx.registerTempId(input.tempId, id)
      if (parsed.steps.length) ctx.diagram.setSequenceSteps(id, parsed.steps)
      return { ok: true, resultText: `Created sequence ${id} with ${parsed.steps.length} step(s).` }
    },

    update_sequence: (rawInput, ctx) => {
      const input = rawInput as { id?: unknown; name?: unknown; steps?: unknown }
      if (typeof input.id !== 'string' || !input.id) return fail('update_sequence: id is required')
      if (!ctx.diagram.getSequences) return fail('update_sequence: sequences are not editable in this context')
      const id = ctx.resolveId(input.id)
      if (!(id in ctx.diagram.getSequences())) return fail(`update_sequence: unknown sequence id "${input.id}"`)
      if (input.name !== undefined && (typeof input.name !== 'string' || !input.name.trim())) return fail('update_sequence: name must be a non-empty string')
      const parsed = input.steps === undefined ? undefined : parseSteps('update_sequence', input.steps, ctx)
      if (parsed && 'error' in parsed) return fail(parsed.error)
      if (input.name === undefined && !parsed) return fail('update_sequence: nothing to change')
      if (typeof input.name === 'string') {
        if (!ctx.diagram.renameSequence) return fail('update_sequence: sequences cannot be renamed in this context')
        ctx.diagram.renameSequence(id, input.name.trim())
      }
      if (parsed) {
        if (!ctx.diagram.setSequenceSteps) return fail('update_sequence: steps cannot be set in this context')
        ctx.diagram.setSequenceSteps(id, parsed.steps)
      }
      return { ok: true, resultText: `Updated sequence ${id}.` }
    },

    delete_sequence: (rawInput, ctx) => {
      const input = rawInput as { id?: unknown }
      if (typeof input.id !== 'string' || !input.id) return fail('delete_sequence: id is required')
      if (!ctx.diagram.getSequences || !ctx.diagram.removeSequence) return fail('delete_sequence: sequences are not editable in this context')
      const id = ctx.resolveId(input.id)
      if (!(id in ctx.diagram.getSequences())) return fail(`delete_sequence: unknown sequence id "${input.id}"`)
      ctx.diagram.removeSequence(id)
      return { ok: true, resultText: `Deleted sequence ${id}.` }
    },
  }
}
