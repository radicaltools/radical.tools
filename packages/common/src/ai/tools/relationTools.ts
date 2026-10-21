// ─── Relation tools: add_relation / update_relation / delete_relation ───────

import type { C4Relation } from '../../c4'
import { inferRelationType, isReservedPropertyKey, type Metamodel } from '../../metamodel'
import { fail, sequenceStepCount, stepsGone, type ToolDef, type ToolHandler } from './types'
import { validateProperties, type PropertyValue } from './propertyBag'

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
          relationType: { ...relTypeSchema, description: 'Another type: the properties the new type does not have are removed. An empty string leaves the relation with no type.' },
          properties: { type: 'object', additionalProperties: true, description: 'Values for the relation type\'s properties; null clears one.' },
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

      // No type given: the one the store infers for the pair, where a single
      // type fits. The bag is checked against it, as against a type given;
      // with none, a bag stored unchecked was a value no type has and no
      // check saw.
      const checkedType = relationType ?? (mm ? inferRelationType(mm, nodes[sId].type, nodes[tId].type) : undefined)
      let propValues: Record<string, PropertyValue> = {}
      let notes: string[] = []
      if (checkedType) {
        const validated = validateProperties(input.properties, mm?.relationTypes[checkedType]?.properties, { nodes, resolveId: ctx.resolveId })
        propValues = validated.values
        notes = validated.notes
      } else if (input.properties && typeof input.properties === 'object') {
        for (const key of Object.keys(input.properties)) {
          notes.push(isReservedPropertyKey(key, 'relation') || key === 'label' || key === 'technology'
            ? `ignored property "${key}" — give it as an argument of its own`
            : `ignored property "${key}" — the relation has no type to define it; give relationType`)
        }
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
      // The type asked for must have this pair, as in add_relation.
      if (typeof input.relationType === 'string' && input.relationType && input.relationType !== rels[realId].relationType) {
        const def = mm?.relationTypes[input.relationType]
        if (mm && !def) return fail(`update_relation: unknown relationType "${input.relationType}"`)
        const nodes = ctx.diagram.getNodes()
        const srcType = nodes[rels[realId].sourceId]?.type
        const dstType = nodes[rels[realId].targetId]?.type
        const pairOk = !def || def.allowedPairs.length === 0 || def.allowedPairs.some((p) => p.from === srcType && p.to === dstType)
        if (!pairOk) return fail(`update_relation: relationType "${input.relationType}" does not allow ${srcType} → ${dstType}`)
      }
      const oldType = rels[realId].relationType
      const effectiveType = typeof input.relationType === 'string' ? input.relationType || undefined : oldType
      const newDefs = effectiveType ? mm?.relationTypes[effectiveType]?.properties : undefined
      // A property given as null is cleared, where the type has it.
      const bag = input.properties && typeof input.properties === 'object' ? input.properties as Record<string, unknown> : {}
      const cleared = Object.keys(bag).filter((key) => bag[key] === null && newDefs?.some((d) => d.key === key))
      const { values: propValues, notes } = validateProperties(
        Object.fromEntries(Object.entries(bag).filter(([key]) => !cleared.includes(key))),
        newDefs,
        { nodes: ctx.diagram.getNodes(), resolveId: ctx.resolveId },
      )
      // Another type: the old type's properties the new one does not have
      // go. They stayed, shown nowhere and out of reach of this tool.
      const removed = effectiveType !== oldType && oldType
        ? (mm?.relationTypes[oldType]?.properties ?? [])
            .filter((d) => !newDefs?.some((n) => n.key === d.key) && (rels[realId] as unknown as Record<string, unknown>)[d.key] !== undefined)
            .map((d) => d.key)
        : []
      for (const key of removed) notes.push(`removed property "${key}" — the new type does not have it`)

      const updates = {
        ...Object.fromEntries(Object.entries({
          label: typeof input.label === 'string' ? input.label : undefined,
          technology: typeof input.technology === 'string' ? input.technology : undefined,
          relationType: effectiveType !== oldType ? effectiveType : undefined,
          ...propValues,
        }).filter(([, value]) => value !== undefined)),
        // Keys with no value are taken off the relation (patchRelation).
        ...(effectiveType !== oldType && !effectiveType ? { relationType: undefined } : {}),
        ...Object.fromEntries([...cleared, ...removed].map((key) => [key, undefined])),
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
      const steps = sequenceStepCount(ctx)
      ctx.diagram.removeRelation(realId)
      return { ok: true, resultText: `Deleted relation ${realId}${stepsGone(steps - sequenceStepCount(ctx))}.`, deleted: { relations: 1 } }
    },
  }
}
