// ─── Metamodel tools: upsert_/delete_ node and relation types ───────────────
// Edit the document's metamodel. A built-in preset is copied to a custom id
// on the first edit (forkPresetMetamodel); otherwise loading the document
// would swap the preset back in and drop the change. Tool schemas are built
// from the metamodel, so callers rebuild them after these run.

import { builtInC4Metamodel, type Metamodel, type NodeTypeDef, type PropertyDef, type RelationPair, type RelationTypeDef } from '../../metamodel'
import { forkPresetMetamodel } from '../../model'
import { fail, type ToolDef, type ToolHandler, type ToolResult, type ToolRunContext } from './types'

const PROPERTY_TYPES = ['text', 'textarea', 'boolean', 'number', 'enum', 'ref']
const TYPE_ID = /^[a-z][a-z0-9-]*$/

const PROPERTIES_SCHEMA = {
  type: 'array',
  description: 'The complete list of custom properties (replaces the current one).',
  items: {
    type: 'object',
    properties: {
      key: { type: 'string' },
      label: { type: 'string' },
      type: { type: 'string', enum: PROPERTY_TYPES },
      options: { type: 'array', items: { type: 'string' }, description: "Allowed values, for type 'enum'." },
      refType: { type: 'string', description: "The node type a 'ref' property points at (its value is that node's id)." },
      multiple: { type: 'boolean', description: "For type 'ref': an array of node ids instead of one." },
      default: { type: ['string', 'number', 'boolean'] },
      required: { type: 'boolean' },
    },
    required: ['key', 'label', 'type'],
    additionalProperties: false,
  },
}

export function buildMetamodelToolDefs(): ToolDef[] {
  return [
    {
      name: 'upsert_node_type',
      description: 'Add a node type to the metamodel, or change an existing one (only the fields you pass). Use only when the user asks for new or different element types or fields. A built-in metamodel is first copied to a custom one.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Lowercase id, e.g. "service" or "risk".' },
          label: { type: 'string' },
          baseType: { type: 'string', description: 'New types only: copy shape, size and icon from this existing type (default: a system-like box).' },
          color: { type: 'string', description: 'Fill colour, e.g. "#0ea5e9".' },
          fg: { type: 'string', description: 'Text colour.' },
          allowedParents: { type: 'array', items: { type: 'string' }, description: 'Node types it may sit inside. [] = none.' },
          allowedAtRoot: { type: 'boolean' },
          maxCount: { type: ['number', 'null'], description: 'Maximum number of nodes of this type; null removes the limit.' },
          tableTab: { type: 'boolean', description: 'Give the type its own tab in table views (record-like types).' },
          properties: PROPERTIES_SCHEMA,
        },
        required: ['id'],
        additionalProperties: false,
      },
    },
    {
      name: 'delete_node_type',
      description: 'Delete a custom node type that no node uses. Built-in types cannot be deleted.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
    {
      name: 'upsert_relation_type',
      description: 'Add a relation type to the metamodel, or change an existing one (only the fields you pass). Use only when the user asks for new or different relation types. Copies a built-in metamodel first, like upsert_node_type.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          color: { type: 'string' },
          allowedPairs: {
            type: 'array',
            description: 'The complete list of allowed source → target node-type pairs. [] allows any pair.',
            items: {
              type: 'object',
              properties: { from: { type: 'string' }, to: { type: 'string' } },
              required: ['from', 'to'],
              additionalProperties: false,
            },
          },
          properties: PROPERTIES_SCHEMA,
        },
        required: ['id'],
        additionalProperties: false,
      },
    },
    {
      name: 'delete_relation_type',
      description: 'Delete a custom relation type that no relation uses. Built-in types cannot be deleted.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
  ]
}

function parseProperties(tool: string, raw: unknown): PropertyDef[] | string {
  if (!Array.isArray(raw)) return `${tool}: properties must be an array`
  const seen = new Set<string>()
  const out: PropertyDef[] = []
  for (const [i, item] of raw.entries()) {
    const p = item as Partial<PropertyDef>
    if (typeof p?.key !== 'string' || !/^[a-z_][a-z0-9_]*$/i.test(p.key)) return `${tool}: property ${i + 1} needs a key (letters, digits, _)`
    if (seen.has(p.key)) return `${tool}: duplicate property key "${p.key}"`
    seen.add(p.key)
    if (typeof p.label !== 'string' || !p.label.trim()) return `${tool}: property "${p.key}" needs a label`
    if (!PROPERTY_TYPES.includes(p.type as string)) return `${tool}: property "${p.key}" has unknown type "${String(p.type)}"`
    if (p.type === 'enum' && (!Array.isArray(p.options) || !p.options.length || !p.options.every((o) => typeof o === 'string'))) {
      return `${tool}: enum property "${p.key}" needs string options`
    }
    if (p.type === 'ref' && (typeof p.refType !== 'string' || !p.refType)) {
      return `${tool}: ref property "${p.key}" needs a refType (a node type id)`
    }
    out.push({
      key: p.key,
      label: p.label.trim(),
      type: p.type as PropertyDef['type'],
      ...(p.type === 'enum' ? { options: p.options } : {}),
      ...(p.type === 'ref' ? { refType: p.refType, ...(p.multiple ? { multiple: true } : {}) } : {}),
      ...(p.default !== undefined ? { default: p.default } : {}),
      ...(p.required ? { required: true } : {}),
    })
  }
  return out
}

/** The live metamodel, or the reason it cannot be edited here. */
function currentMetamodel(tool: string, ctx: ToolRunContext): Metamodel | string {
  if (!ctx.diagram.setMetamodel) return `${tool}: the metamodel is not editable in this context`
  return ctx.diagram.getMetamodel?.() ?? builtInC4Metamodel()
}

/** A deep copy to edit (a custom copy of a preset), and the result text note. */
function editable(current: Metamodel): { mm: Metamodel; note: string } {
  const fork = forkPresetMetamodel(current)
  const mm = fork ?? (JSON.parse(JSON.stringify(current)) as Metamodel)
  return { mm, note: fork ? ` The built-in metamodel was copied to the custom metamodel "${mm.name}" (${mm.id}).` : '' }
}

function save(ctx: ToolRunContext, mm: Metamodel, text: string): ToolResult {
  ctx.diagram.setMetamodel!(mm)
  return { ok: true, resultText: text }
}

export function buildMetamodelToolHandlers(): Record<string, ToolHandler> {
  return {
    upsert_node_type: (rawInput, ctx) => {
      const input = rawInput as Record<string, unknown>
      const current = currentMetamodel('upsert_node_type', ctx)
      if (typeof current === 'string') return fail(current)
      const id = input.id
      if (typeof id !== 'string' || !TYPE_ID.test(id)) return fail('upsert_node_type: id must be lowercase letters, digits and dashes')
      const existing = current.nodeTypes[id]
      if (!existing && (typeof input.label !== 'string' || !input.label.trim())) return fail('upsert_node_type: a new type needs a label')
      if (input.label !== undefined && (typeof input.label !== 'string' || !input.label.trim())) return fail('upsert_node_type: label must be a non-empty string')
      const typeIds = new Set([...Object.keys(current.nodeTypes), id])
      if (input.allowedParents !== undefined) {
        if (!Array.isArray(input.allowedParents)) return fail('upsert_node_type: allowedParents must be an array')
        const unknown = input.allowedParents.filter((t) => typeof t !== 'string' || !typeIds.has(t))
        if (unknown.length) return fail(`upsert_node_type: unknown parent type(s) ${unknown.join(', ')}`)
      }
      if (input.baseType !== undefined && (typeof input.baseType !== 'string' || !current.nodeTypes[input.baseType])) {
        return fail(`upsert_node_type: unknown baseType "${String(input.baseType)}"`)
      }
      if (input.maxCount !== undefined && input.maxCount !== null && (typeof input.maxCount !== 'number' || input.maxCount < 1)) {
        return fail('upsert_node_type: maxCount must be a positive number or null')
      }
      const properties = input.properties === undefined ? undefined : parseProperties('upsert_node_type', input.properties)
      if (typeof properties === 'string') return fail(properties)

      const { mm, note } = editable(current)
      let def: NodeTypeDef
      if (existing) {
        def = { ...mm.nodeTypes[id] }
      } else {
        const base = input.baseType ? mm.nodeTypes[input.baseType as string] : builtInC4Metamodel().nodeTypes.system
        const { wizard: _wizard, hierarchyRelation: _hierarchy, hubOnly: _hubOnly, ...look } = base
        def = { ...look, id, label: '', builtin: false, color: '#6b7280', fg: '#ffffff', allowedParents: undefined, properties: [] }
      }
      if (typeof input.label === 'string') def.label = input.label.trim()
      if (typeof input.color === 'string') def.color = input.color
      if (typeof input.fg === 'string') def.fg = input.fg
      if (Array.isArray(input.allowedParents)) def.allowedParents = input.allowedParents as string[]
      if (typeof input.allowedAtRoot === 'boolean') def.allowedAtRoot = input.allowedAtRoot
      if (input.maxCount === null) def.cardinality = def.cardinality?.min !== undefined ? { min: def.cardinality.min } : undefined
      else if (typeof input.maxCount === 'number') def.cardinality = { ...def.cardinality, max: input.maxCount }
      if (typeof input.tableTab === 'boolean') def.tableTab = input.tableTab
      if (properties) def.properties = properties
      mm.nodeTypes[id] = def
      return save(ctx, mm, `${existing ? 'Updated' : 'Added'} node type "${id}".${note}`)
    },

    delete_node_type: (rawInput, ctx) => {
      const input = rawInput as { id?: unknown }
      const current = currentMetamodel('delete_node_type', ctx)
      if (typeof current === 'string') return fail(current)
      const def = typeof input.id === 'string' ? current.nodeTypes[input.id] : undefined
      if (!def) return fail(`delete_node_type: unknown node type "${String(input.id)}"`)
      if (def.builtin) return fail(`delete_node_type: "${def.id}" is built in and cannot be deleted`)
      const used = Object.values(ctx.diagram.getNodes()).filter((node) => node.type === def.id).length
      if (used) return fail(`delete_node_type: ${used} node(s) still use "${def.id}"; retype or delete them first`)
      const { mm, note } = editable(current)
      delete mm.nodeTypes[def.id]
      for (const type of Object.values(mm.nodeTypes)) {
        if (type.allowedParents?.includes(def.id)) type.allowedParents = type.allowedParents.filter((t) => t !== def.id)
      }
      for (const rel of Object.values(mm.relationTypes)) {
        rel.allowedPairs = rel.allowedPairs.filter((pair) => pair.from !== def.id && pair.to !== def.id)
      }
      return save(ctx, mm, `Deleted node type "${def.id}".${note}`)
    },

    upsert_relation_type: (rawInput, ctx) => {
      const input = rawInput as Record<string, unknown>
      const current = currentMetamodel('upsert_relation_type', ctx)
      if (typeof current === 'string') return fail(current)
      const id = input.id
      if (typeof id !== 'string' || !TYPE_ID.test(id)) return fail('upsert_relation_type: id must be lowercase letters, digits and dashes')
      const existing = current.relationTypes[id]
      if (!existing && (typeof input.label !== 'string' || !input.label.trim())) return fail('upsert_relation_type: a new type needs a label')
      if (input.label !== undefined && (typeof input.label !== 'string' || !input.label.trim())) return fail('upsert_relation_type: label must be a non-empty string')
      let pairs: RelationPair[] | undefined
      if (input.allowedPairs !== undefined) {
        if (!Array.isArray(input.allowedPairs)) return fail('upsert_relation_type: allowedPairs must be an array')
        pairs = []
        for (const pair of input.allowedPairs as Array<{ from?: unknown; to?: unknown }>) {
          if (typeof pair?.from !== 'string' || !current.nodeTypes[pair.from]) return fail(`upsert_relation_type: unknown source type "${String(pair?.from)}"`)
          if (typeof pair.to !== 'string' || !current.nodeTypes[pair.to]) return fail(`upsert_relation_type: unknown target type "${String(pair.to)}"`)
          pairs.push({ from: pair.from, to: pair.to })
        }
      }
      const properties = input.properties === undefined ? undefined : parseProperties('upsert_relation_type', input.properties)
      if (typeof properties === 'string') return fail(properties)

      const { mm, note } = editable(current)
      const def: RelationTypeDef = existing ? { ...mm.relationTypes[id] } : { id, label: '', allowedPairs: [], builtin: false }
      if (typeof input.label === 'string') def.label = input.label.trim()
      if (typeof input.color === 'string') def.color = input.color
      if (pairs) def.allowedPairs = pairs
      if (properties) def.properties = properties
      mm.relationTypes[id] = def
      return save(ctx, mm, `${existing ? 'Updated' : 'Added'} relation type "${id}".${note}`)
    },

    delete_relation_type: (rawInput, ctx) => {
      const input = rawInput as { id?: unknown }
      const current = currentMetamodel('delete_relation_type', ctx)
      if (typeof current === 'string') return fail(current)
      const def = typeof input.id === 'string' ? current.relationTypes[input.id] : undefined
      if (!def) return fail(`delete_relation_type: unknown relation type "${String(input.id)}"`)
      if (def.builtin) return fail(`delete_relation_type: "${def.id}" is built in and cannot be deleted`)
      const used = Object.values(ctx.diagram.getRelations()).filter((relation) => relation.relationType === def.id).length
      if (used) return fail(`delete_relation_type: ${used} relation(s) still use "${def.id}"; change or delete them first`)
      const { mm, note } = editable(current)
      delete mm.relationTypes[def.id]
      return save(ctx, mm, `Deleted relation type "${def.id}".${note}`)
    },
  }
}
