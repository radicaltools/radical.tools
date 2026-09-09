// ─── Node tools: add_node / update_node / delete_node ───────────────────────

import { NODE_SIZES, type C4ElementType, type C4Node } from '../../types/c4'
import type { Metamodel } from '../../types/metamodel'
import type { ToolDef } from '../types'
import { fail, type ToolHandler } from './types'
import { validateProperties } from './propertyBag'

export function buildNodeToolDefs(mm: Metamodel | undefined): ToolDef[] {
  const typeEnum = mm ? Object.keys(mm.nodeTypes) : []
  const typeSchema = typeEnum.length ? { type: 'string', enum: typeEnum } : { type: 'string' }
  return [
    {
      name: 'add_node',
      description: 'Add a new node (element) to the model.',
      inputSchema: {
        type: 'object',
        properties: {
          tempId: { type: 'string', description: 'Reusable id for this node in later tool calls in this run, before the real id is known.' },
          type: typeSchema,
          label: { type: 'string', description: 'Short (1-4 words). Put detail in description.' },
          description: { type: 'string' },
          technology: { type: 'string' },
          parentId: { type: 'string', description: 'Real node id or a tempId used earlier in this run. Omit for a root node.' },
          external: { type: 'boolean' },
          properties: {
            type: 'object',
            description: 'Custom/governance values keyed by property id for this type — see the metamodel context message for the exact keys/types/enum options per type (e.g. requirement: ears_type/trigger/action/rationale; adr: status/decision/consequences).',
            additionalProperties: true,
          },
        },
        required: ['tempId', 'type', 'label'],
        additionalProperties: false,
      },
    },
    {
      name: 'update_node',
      description: 'Update fields on an existing node.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          description: { type: 'string' },
          technology: { type: 'string' },
          external: { type: 'boolean' },
          type: typeSchema,
          properties: { type: 'object', additionalProperties: true },
        },
        required: ['id'],
        additionalProperties: false,
      },
    },
    {
      name: 'delete_node',
      description: 'Delete an existing node.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
  ]
}

export function buildNodeToolHandlers(): Record<string, ToolHandler> {
  return {
    add_node: (rawInput, ctx) => {
      const input = rawInput as {
        tempId?: unknown; type?: unknown; label?: unknown; description?: unknown
        technology?: unknown; parentId?: unknown; external?: unknown; properties?: unknown
      }
      if (typeof input.tempId !== 'string' || !input.tempId) return fail('add_node: tempId is required')
      if (typeof input.type !== 'string' || !input.type) return fail('add_node: type is required')
      if (typeof input.label !== 'string' || !input.label.trim()) return fail('add_node: label is required')

      const mm = ctx.diagram.getMetamodel?.()
      const { values: propValues, notes } = validateProperties(input.properties, mm?.nodeTypes[input.type]?.properties)

      const size = NODE_SIZES[input.type as C4ElementType] ?? { width: 240, height: 140 }
      const pos = ctx.placeNext()
      const parentReal = typeof input.parentId === 'string' && input.parentId ? ctx.resolveId(input.parentId) : undefined
      if (parentReal && !(parentReal in ctx.diagram.getNodes())) {
        return fail(`add_node "${input.label}": unknown parentId "${input.parentId}"`)
      }

      const nodeInput = {
        type: input.type as C4ElementType,
        label: input.label.trim(),
        description: typeof input.description === 'string' ? input.description : undefined,
        technology: typeof input.technology === 'string' ? input.technology : undefined,
        parentId: parentReal,
        external: input.external === true ? true : undefined,
        collapsed: false,
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
        ...propValues,
      } as Omit<C4Node, 'id'>

      const realId = ctx.diagram.addNode(nodeInput)
      if (!realId) return fail(`add_node "${input.label}" was rejected by the metamodel — check allowedParents/cardinality`)
      ctx.registerTempId(input.tempId, realId)
      const resultText = notes.length ? `Created node ${realId}. ${notes.join('; ')}` : `Created node ${realId}.`
      return { ok: true, resultText, added: { nodes: 1 } }
    },

    update_node: (rawInput, ctx) => {
      const input = rawInput as {
        id?: unknown; label?: unknown; description?: unknown; technology?: unknown
        external?: unknown; type?: unknown; properties?: unknown
      }
      if (typeof input.id !== 'string' || !input.id) return fail('update_node: id is required')
      const realId = ctx.resolveId(input.id)
      const nodes = ctx.diagram.getNodes()
      if (!(realId in nodes)) return fail(`update_node: unknown id "${input.id}"`)
      if (input.type !== undefined && typeof input.type !== 'string') return fail('update_node: type must be a string')

      const mm = ctx.diagram.getMetamodel?.()
      const effectiveType = typeof input.type === 'string' ? input.type : nodes[realId].type
      const { values: propValues, notes } = validateProperties(input.properties, mm?.nodeTypes[effectiveType]?.properties)

      const updates = {
        label: typeof input.label === 'string' ? input.label : undefined,
        description: typeof input.description === 'string' ? input.description : undefined,
        technology: typeof input.technology === 'string' ? input.technology : undefined,
        external: typeof input.external === 'boolean' ? input.external : undefined,
        type: typeof input.type === 'string' ? (input.type as C4ElementType) : undefined,
        ...propValues,
      } as Partial<Omit<C4Node, 'id'>>

      ctx.diagram.updateNode(realId, updates)
      const resultText = notes.length ? `Updated node ${realId}. ${notes.join('; ')}` : `Updated node ${realId}.`
      return { ok: true, resultText, updated: { nodes: 1 } }
    },

    delete_node: (rawInput, ctx) => {
      const input = rawInput as { id?: unknown }
      if (typeof input.id !== 'string' || !input.id) return fail('delete_node: id is required')
      const realId = ctx.resolveId(input.id)
      if (!(realId in ctx.diagram.getNodes())) return fail(`delete_node: unknown id "${input.id}"`)
      ctx.diagram.removeNode(realId)
      return { ok: true, resultText: `Deleted node ${realId}.`, deleted: { nodes: 1 } }
    },
  }
}
