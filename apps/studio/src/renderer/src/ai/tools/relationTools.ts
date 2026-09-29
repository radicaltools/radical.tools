// ─── Relation tools: add_relation / update_relation / delete_relation ───────

import type { C4Relation } from '../../types/c4'
import type { Metamodel } from '../../types/metamodel'
import type { ToolDef } from '../types'
import { fail, type ToolHandler } from './types'
import { validateProperties } from './propertyBag'

export function buildRelationToolDefs(mm: Metamodel | undefined): ToolDef[] {
  const relTypeEnum = mm ? Object.keys(mm.relationTypes) : []
  const relTypeSchema = relTypeEnum.length
    ? {
        type: 'string',
        enum: relTypeEnum,
        description: 'Omit to auto-infer a type when exactly one relation type permits this pair of node types.',
      }
    : { type: 'string' }
  return [
    {
      name: 'add_relation',
      description: 'Add a relation (edge) between two existing nodes.',
      inputSchema: {
        type: 'object',
        properties: {
          sourceId: { type: 'string', description: 'Real node id or a tempId from an add_node call earlier in this run.' },
          targetId: { type: 'string' },
          relationType: relTypeSchema,
          label: { type: 'string' },
          technology: { type: 'string' },
          properties: {
            type: 'object',
            description: 'Custom values for this relation type — see the metamodel context message for exact keys/types.',
            additionalProperties: true,
          },
        },
        required: ['sourceId', 'targetId'],
        additionalProperties: false,
      },
    },
    {
      name: 'update_relation',
      description: 'Update fields on an existing relation.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          technology: { type: 'string' },
          relationType: relTypeSchema,
          properties: { type: 'object', additionalProperties: true },
        },
        required: ['id'],
        additionalProperties: false,
      },
    },
    {
      name: 'delete_relation',
      description: 'Delete an existing relation.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
  ]
}

export function buildRelationToolHandlers(): Record<string, ToolHandler> {
  return {
    add_relation: (rawInput, ctx) => {
      const input = rawInput as {
        sourceId?: unknown; targetId?: unknown; relationType?: unknown
        label?: unknown; technology?: unknown; properties?: unknown
      }
      if (typeof input.sourceId !== 'string' || !input.sourceId) return fail('add_relation: sourceId is required')
      if (typeof input.targetId !== 'string' || !input.targetId) return fail('add_relation: targetId is required')
      const sId = ctx.resolveId(input.sourceId)
      const tId = ctx.resolveId(input.targetId)
      const nodes = ctx.diagram.getNodes()
      if (!(sId in nodes)) return fail(`add_relation: unknown sourceId "${input.sourceId}"`)
      if (!(tId in nodes)) return fail(`add_relation: unknown targetId "${input.targetId}"`)

      const mm = ctx.diagram.getMetamodel?.()
      let relationType: string | undefined
      if (typeof input.relationType === 'string' && input.relationType) {
        const def = mm?.relationTypes[input.relationType]
        if (!def) return fail(`add_relation: unknown relationType "${input.relationType}"`)
        const srcType = nodes[sId].type
        const dstType = nodes[tId].type
        const pairOk = def.allowedPairs.length === 0 || def.allowedPairs.some((p) => p.from === srcType && p.to === dstType)
        if (!pairOk) return fail(`add_relation: relationType "${input.relationType}" does not allow ${srcType} → ${dstType}`)
        relationType = input.relationType
      }

      let propValues: Record<string, string | number | boolean> = {}
      let notes: string[] = []
      if (relationType) {
        const validated = validateProperties(input.properties, mm?.relationTypes[relationType]?.properties)
        propValues = validated.values
        notes = validated.notes
      } else if (input.properties && typeof input.properties === 'object') {
        // Type wasn't given (will be auto-inferred by the store) — pass values
        // through as-is since we can't validate against an unknown type's schema.
        propValues = input.properties as Record<string, string | number | boolean>
      }

      const beforeCount = Object.keys(ctx.diagram.getRelations()).length
      ctx.diagram.addRelation({
        sourceId: sId,
        targetId: tId,
        label: typeof input.label === 'string' ? input.label : undefined,
        technology: typeof input.technology === 'string' ? input.technology : undefined,
        ...(relationType ? { relationType } : {}),
        ...propValues,
      } as Omit<C4Relation, 'id'>)
      const afterCount = Object.keys(ctx.diagram.getRelations()).length
      if (afterCount === beforeCount) {
        const srcType = nodes[sId]?.type
        const dstType = nodes[tId]?.type
        return fail(`add_relation "${input.sourceId}" → "${input.targetId}" rejected by the metamodel (pair ${srcType} → ${dstType} is not in allowedPairs)`)
      }
      const resultText = notes.length ? `Created relation. ${notes.join('; ')}` : 'Created relation.'
      return { ok: true, resultText, added: { relations: 1 } }
    },

    update_relation: (rawInput, ctx) => {
      const input = rawInput as {
        id?: unknown; label?: unknown; technology?: unknown; relationType?: unknown; properties?: unknown
      }
      if (typeof input.id !== 'string' || !input.id) return fail('update_relation: id is required')
      const realId = ctx.resolveId(input.id)
      const rels = ctx.diagram.getRelations()
      if (!(realId in rels)) return fail(`update_relation: unknown id "${input.id}"`)
      if (!ctx.diagram.updateRelation) return fail('update_relation: relations are not editable in this context')

      const mm = ctx.diagram.getMetamodel?.()
      const effectiveType = typeof input.relationType === 'string' ? input.relationType : rels[realId].relationType
      const { values: propValues, notes } = validateProperties(
        input.properties,
        effectiveType ? mm?.relationTypes[effectiveType]?.properties : undefined,
      )

      const updates = {
        label: typeof input.label === 'string' ? input.label : undefined,
        technology: typeof input.technology === 'string' ? input.technology : undefined,
        relationType: typeof input.relationType === 'string' ? input.relationType : undefined,
        ...propValues,
      } as Partial<Omit<C4Relation, 'id'>>

      ctx.diagram.updateRelation(realId, updates)
      const resultText = notes.length ? `Updated relation ${realId}. ${notes.join('; ')}` : `Updated relation ${realId}.`
      return { ok: true, resultText, updated: { relations: 1 } }
    },

    delete_relation: (rawInput, ctx) => {
      const input = rawInput as { id?: unknown }
      if (typeof input.id !== 'string' || !input.id) return fail('delete_relation: id is required')
      const realId = ctx.resolveId(input.id)
      if (!(realId in ctx.diagram.getRelations())) return fail(`delete_relation: unknown id "${input.id}"`)
      ctx.diagram.removeRelation(realId)
      return { ok: true, resultText: `Deleted relation ${realId}.`, deleted: { relations: 1 } }
    },
  }
}
