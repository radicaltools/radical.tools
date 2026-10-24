// ─── Metamodel tools: upsert_/delete_ node and relation types ───────────────
// Edit the document's metamodel. A built-in preset is copied to a custom id
// on the first edit (forkPresetMetamodel); otherwise loading the document
// would swap the preset back in and drop the change. Tool schemas are built
// from the metamodel, so callers rebuild them after these run.

import { LAYOUT_AXES, LAYOUT_FLOWS, LAYOUT_ROLES, builtInC4Metamodel, propertyKeyProblem, type Metamodel, type NodeTypeDef, type PropertyDef, type RelationPair, type RelationTypeDef, type LayoutFlow, type LayoutRole, type LayoutSide, type RelationLayoutHint } from '../../metamodel'
import { checkRemoveNodeTypeFromMetamodel, checkRemoveRelationTypeFromMetamodel, forkPresetMetamodel, isViewGroup, metamodelWithoutNodeType, milestoneHoldsType, viewNamesType } from '../../model'
import { pipelineOf } from '../../viewPipeline'
import { isViewpointKind, newViewpointId, VIEWPOINT_KINDS, viewpointsOf, withViewpoint, withoutViewpoint } from '../../viewpoints'
import { fail, type ToolDef, type ToolHandler, type ToolResult, type ToolRunContext } from './types'
import { PIPELINE_SCHEMA, pipelineFor } from './viewTools'

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
      visibleWhen: {
        type: ['object', 'null'],
        description: 'Show the property only while another property of the type has one of these values. Left out, a property keeps the rule it has; null removes it.',
        properties: { key: { type: 'string' }, values: { type: 'array', items: { type: 'string' } } },
        required: ['key', 'values'],
        additionalProperties: false,
      },
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
          description: { type: 'string', description: 'What an element of this type is, in a sentence or two. The wiki view shows it under the type and in its glossary. "" clears it.' },
          baseType: { type: 'string', description: 'New types only: copy shape, size and icon from this existing type (default: a system-like box).' },
          color: { type: 'string', description: 'Fill colour, e.g. "#0ea5e9".' },
          fg: { type: 'string', description: 'Text colour.' },
          allowedParents: { type: 'array', items: { type: 'string' }, description: 'Node types it may sit inside. [] = none.' },
          allowedAtRoot: { type: 'boolean' },
          maxCount: { type: ['number', 'null'], description: 'Maximum number of nodes of this type; null removes the limit.' },
          layoutRole: { type: 'string', enum: ['element', 'actor', 'store', 'note', 'start', 'end', 'broker', 'screen'], description: 'What Smart Layout takes an element of this type for: element (placed by its lines), actor (above what it uses), store (beside its one user, on the right), note (beside its one anchor, on the left: an ADR, a requirement at the element it is about), start (above what it leads to), end (below what leads to it), broker (between the two sides it joins: a queue), screen (in a row with the screens it navigates to).' },
          layoutSide: { type: ['string', 'null'], enum: ['top', 'bottom', 'left', 'right', null], description: 'Where the role is placed when not on its own side; null restores the role\'s side.' },
          summary: { type: 'string', description: 'How the table sums up an element of this type in one line, from data it has: a template of tokens — {key} a property (or label, description, technology), {ears} a requirement\'s EARS sentence, {obligation} who shall do what and {condition} when it holds, {transitions} where a state or event leads, {out:type}/{in:type} the elements linked by relations of a type, {key.sentence} its first sentence, {key.phrase} its first phrase, {key.cap} capitalised, {a|b} the first with a value; a part in [ ] is left out when a token in it is empty; the template may use inline Markdown. E.g. "[{status.cap}: ]{decision.sentence}". "" restores the default.' },
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
          label: { type: 'string', description: 'The name of the type, read from source to target: "Constrains".' },
          description: { type: 'string', description: 'What a relation of this type says about its two ends, in a sentence or two. The wiki view shows it. "" clears it.' },
          forwardLabel: { type: 'string', description: 'How it reads in a sentence from source to target, when the label is a name rather than a verb ("Uses" for "Interacts"). "" clears it.' },
          inverseLabel: { type: 'string', description: 'How it reads from target to source: "Constrained by". The wiki view uses it; the canvas does not show it. "" clears it.' },
          color: { type: 'string' },
          layoutFlow: { type: 'string', enum: ['forward', 'reverse', 'side'], description: 'Which way Smart Layout draws a relation of this type: forward from source to target (down or right), reverse (the target above the source: a requirement derives from the need above it), or side (no direction: a decision beside what it constrains).' },
          layoutAxis: { type: 'string', enum: ['free', 'vertical', 'horizontal'], description: 'The axis the relation reads along: free (down or across; the default), vertical (a transition runs down, a flat one is off), horizontal (screens navigate to the right).' },
          governance: { type: 'boolean', description: 'true for a governance relation, which ties a requirement, decision, check or screen to the element it is about (satisfies, constrains, verifies): it may join an element and what holds it, and moving an element into the other keeps it. false (the default) for a structural one (uses, part of), which containment already says: refused between an element and what holds it, and removed when one is moved into the other.' },
          allowedPairs: {
            type: 'array',
            description: 'The complete list of allowed source → target node-type pairs. [] allows any pair. A pair may read its own way: forwardLabel ("Delivers to" for Interacts to a person) and inverseLabel ("Receives from").',
            items: {
              type: 'object',
              properties: { from: { type: 'string' }, to: { type: 'string' }, forwardLabel: { type: 'string' }, inverseLabel: { type: 'string' } },
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
    {
      name: 'upsert_viewpoint',
      description: "Add a viewpoint to the metamodel, or change one (only the fields you pass): a view type (kind) and a filter chain under a name (\"Traceability\": a table of needs, the requirements refined from them, the scenarios verifying those). Studio's New view offers it; create_view/update_view take it as `viewpoint`. Views of the viewpoint follow its changes. Give the chain as pipeline, or copy a view's kind and chain (fromViewId).",
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The viewpoint to change; omit to add one (its id is made from the label).' },
          label: { type: 'string' },
          description: { type: 'string', description: 'What a view of this viewpoint shows; New view shows it. "" clears it.' },
          group: { type: 'string', description: 'The concern it serves ("C4", "Requirements", …): New view lists the viewpoints by group. "" clears it.' },
          kind: { type: 'string', enum: [...VIEWPOINT_KINDS], description: "How its views show the chain: 'table', 'wiki', 'treemap' (hierarchy), 'matrix', 'warnier' (a Warnier–Orr diagram of the hierarchy) or 'static' (canvas)." },
          pipeline: { ...PIPELINE_SCHEMA, type: 'object' },
          fromViewId: { type: 'string', description: 'A view whose kind and filter chain the viewpoint takes (kind and pipeline given here win).' },
          subjectTypes: { type: 'array', items: { type: 'string' }, description: 'Node types it draws one element of: create_view with the viewpoint makes a group holding a view of each such element, named after it, its first level kept to the element and what lies inside it; a view of it already there becomes such a group and lists no elements picked by hand. [] makes it draw the whole model again: each group becomes one view, and its views per element are deleted (the reply names them).' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'delete_viewpoint',
      description: 'Delete a viewpoint from the metamodel. Its views keep their kind and filter chain, of no viewpoint; a group of views per element (a viewpoint with subjectTypes) becomes one such view, and its views per element are deleted (the reply names them).',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
  ]
}

function parseProperties(tool: string, raw: unknown, of: 'node' | 'relation'): PropertyDef[] | string {
  if (!Array.isArray(raw)) return `${tool}: properties must be an array`
  const seen = new Set<string>()
  const out: PropertyDef[] = []
  for (const [i, item] of raw.entries()) {
    const p = item as Partial<PropertyDef>
    if (typeof p?.key !== 'string' || !/^[a-z_][a-z0-9_]*$/i.test(p.key)) return `${tool}: property ${i + 1} needs a key (letters, digits, _)`
    const reserved = propertyKeyProblem(p.key, of)
    if (reserved) return `${tool}: property key ${reserved}`
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
    const when = p.visibleWhen as { key?: unknown; values?: unknown } | undefined
    if (when != null && (typeof when.key !== 'string' || !Array.isArray(when.values) || !when.values.every((v) => typeof v === 'string'))) {
      return `${tool}: property "${p.key}" has a visibleWhen that is not { key, values: [strings] }`
    }
    out.push({
      key: p.key,
      label: p.label.trim(),
      type: p.type as PropertyDef['type'],
      ...(p.type === 'enum' ? { options: p.options } : {}),
      ...(p.type === 'ref' ? { refType: p.refType, ...(p.multiple ? { multiple: true } : {}) } : {}),
      ...(p.default !== undefined ? { default: p.default } : {}),
      ...(p.required ? { required: true } : {}),
      ...(when ? { visibleWhen: { key: when.key as string, values: [...(when.values as string[])] } } : {}),
    })
  }
  return out
}

/** `properties` as parsed, where a property sent without a visibleWhen keeps
 *  the one the type's property of its key has (`raw` left it out; null
 *  removes it): sent as the summary lists them but for the rules, the
 *  requirement's fields all showed at once. */
function keepVisibility(properties: PropertyDef[], raw: unknown, current: PropertyDef[] | undefined): PropertyDef[] {
  const items = raw as Array<Record<string, unknown>>
  return properties.map((p, i) => {
    if (p.visibleWhen || items[i]?.visibleWhen !== undefined) return p
    const had = current?.find((c) => c.key === p.key)?.visibleWhen
    return had ? { ...p, visibleWhen: { key: had.key, values: [...had.values] } } : p
  })
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

/** Sets the metamodel, and says what it took from the views: a viewpoint
 *  deleted or without its subject ends its groups of views per element, and
 *  their views are deleted; a viewpoint given a subject makes its views
 *  groups, which list no elements picked by hand. */
function save(ctx: ToolRunContext, mm: Metamodel, text: string): ToolResult {
  // Copies: a facade edits its views in place.
  const before = Object.values(ctx.diagram.getViews?.() ?? {}).map((v) => ({ id: v.id, name: v.name, listed: v.nodeIds.length }))
  ctx.diagram.setMetamodel!(mm)
  const after = ctx.diagram.getViews?.() ?? {}
  const gone = before.filter((v) => !(v.id in after))
  const unlisted = before.filter((v) => v.listed > 0 && after[v.id] && after[v.id].nodeIds.length === 0 && isViewGroup(after[v.id], mm))
  const notes = [
    ...(gone.length ? [`Deleted ${gone.length} ${gone.length === 1 ? 'view per element with its group' : 'views per element with their group'}: ${gone.map((v) => `"${v.name}" (${v.id})`).join(', ')}.`] : []),
    ...unlisted.map((v) => `${v.name} (${v.id}) is now a group of views per element and no longer lists the ${v.listed} element(s) picked for it.`),
  ]
  return { ok: true, resultText: [text, ...notes].join(' '), ...(gone.length ? { deleted: { views: gone.length } } : {}) }
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
      const properties = input.properties === undefined ? undefined : parseProperties('upsert_node_type', input.properties, 'node')
      if (typeof properties === 'string') return fail(properties)

      const { mm, note } = editable(current)
      let def: NodeTypeDef
      if (existing) {
        def = { ...mm.nodeTypes[id] }
      } else {
        const base = input.baseType ? mm.nodeTypes[input.baseType as string] : builtInC4Metamodel().nodeTypes.system
        const { wizard: _wizard, hierarchyRelation: _hierarchy, hubOnly: _hubOnly, ...look } = base
        def = { ...look, id, label: '', description: undefined, builtin: false, color: '#6b7280', fg: '#ffffff', allowedParents: undefined, properties: [] }
      }
      if (typeof input.label === 'string') def.label = input.label.trim()
      if (input.description !== undefined) {
        if (typeof input.description !== 'string') return fail('upsert_node_type: description must be a string')
        def.description = input.description.trim() || undefined
      }
      if (typeof input.color === 'string') def.color = input.color
      if (typeof input.fg === 'string') def.fg = input.fg
      if (Array.isArray(input.allowedParents)) def.allowedParents = input.allowedParents as string[]
      if (typeof input.allowedAtRoot === 'boolean') def.allowedAtRoot = input.allowedAtRoot
      if (input.maxCount === null) def.cardinality = def.cardinality?.min !== undefined ? { min: def.cardinality.min } : undefined
      else if (typeof input.maxCount === 'number') def.cardinality = { ...def.cardinality, max: input.maxCount }
      if (input.summary !== undefined) {
        if (typeof input.summary !== 'string') return fail('upsert_node_type: summary must be a string')
        def.summary = input.summary.trim() || undefined
      }
      if (input.layoutRole !== undefined) {
        if (typeof input.layoutRole !== 'string' || !(LAYOUT_ROLES as string[]).includes(input.layoutRole)) return fail(`upsert_node_type: layoutRole must be one of ${LAYOUT_ROLES.join(', ')}`)
        def.layout = { ...def.layout, role: input.layoutRole as LayoutRole }
      }
      if (input.layoutSide === null) { const { side: _side, ...rest } = def.layout ?? {}; def.layout = rest }
      else if (input.layoutSide !== undefined) {
        if (typeof input.layoutSide !== 'string' || !['top', 'bottom', 'left', 'right'].includes(input.layoutSide)) return fail('upsert_node_type: layoutSide must be top, bottom, left, right or null')
        def.layout = { ...def.layout, side: input.layoutSide as LayoutSide }
      }
      if (properties) def.properties = keepVisibility(properties, input.properties, existing?.properties)
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
      const refused = milestoneHoldsType(ctx.diagram.getMilestones?.() ?? [], def.id, 'node', current)
        ?? checkRemoveNodeTypeFromMetamodel(current, def.id)
        ?? viewNamesType(ctx.diagram.getViews?.() ?? {}, def.id, 'node', current)
      if (refused) return fail(`delete_node_type: ${refused}`)
      const { mm: editableMm, note } = editable(current)
      const mm = metamodelWithoutNodeType(editableMm, def.id)
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
        for (const pair of input.allowedPairs as Array<{ from?: unknown; to?: unknown; forwardLabel?: unknown; inverseLabel?: unknown }>) {
          if (typeof pair?.from !== 'string' || !current.nodeTypes[pair.from]) return fail(`upsert_relation_type: unknown source type "${String(pair?.from)}"`)
          if (typeof pair.to !== 'string' || !current.nodeTypes[pair.to]) return fail(`upsert_relation_type: unknown target type "${String(pair.to)}"`)
          const reads = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
          const forwardLabel = reads(pair.forwardLabel), inverseLabel = reads(pair.inverseLabel)
          pairs.push({ from: pair.from, to: pair.to, ...(forwardLabel ? { forwardLabel } : {}), ...(inverseLabel ? { inverseLabel } : {}) })
        }
      }
      const properties = input.properties === undefined ? undefined : parseProperties('upsert_relation_type', input.properties, 'relation')
      if (typeof properties === 'string') return fail(properties)

      const { mm, note } = editable(current)
      const def: RelationTypeDef = existing ? { ...mm.relationTypes[id] } : { id, label: '', allowedPairs: [], builtin: false }
      if (typeof input.label === 'string') def.label = input.label.trim()
      for (const key of ['description', 'forwardLabel', 'inverseLabel'] as const) {
        const value = input[key]
        if (value === undefined) continue
        if (typeof value !== 'string') return fail(`upsert_relation_type: ${key} must be a string`)
        if (value.trim()) def[key] = value.trim()
        else delete def[key]
      }
      if (typeof input.color === 'string') def.color = input.color
      if (input.governance !== undefined) {
        if (typeof input.governance !== 'boolean') return fail('upsert_relation_type: governance must be true or false')
        if (input.governance) def.governance = true
        else delete def.governance
      }
      if (pairs) def.allowedPairs = pairs
      if (properties) def.properties = keepVisibility(properties, input.properties, existing?.properties)
      if (input.layoutFlow !== undefined) {
        if (typeof input.layoutFlow !== 'string' || !(LAYOUT_FLOWS as string[]).includes(input.layoutFlow)) return fail(`upsert_relation_type: layoutFlow must be one of ${LAYOUT_FLOWS.join(', ')}`)
        def.layout = { ...def.layout, flow: input.layoutFlow as LayoutFlow }
      }
      if (input.layoutAxis !== undefined) {
        if (typeof input.layoutAxis !== 'string' || !(LAYOUT_AXES as string[]).includes(input.layoutAxis)) return fail(`upsert_relation_type: layoutAxis must be one of ${LAYOUT_AXES.join(', ')}`)
        def.layout = { flow: def.layout?.flow ?? 'forward', axis: input.layoutAxis as RelationLayoutHint['axis'] }
      }
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
      const refused = milestoneHoldsType(ctx.diagram.getMilestones?.() ?? [], def.id, 'relation', current)
        ?? checkRemoveRelationTypeFromMetamodel(current, def.id)
        ?? viewNamesType(ctx.diagram.getViews?.() ?? {}, def.id, 'relation', current)
      if (refused) return fail(`delete_relation_type: ${refused}`)
      const { mm, note } = editable(current)
      delete mm.relationTypes[def.id]
      return save(ctx, mm, `Deleted relation type "${def.id}".${note}`)
    },

    // A built-in metamodel is not copied for a viewpoint: documentMetamodel
    // keeps a document's viewpoints when it swaps the preset in.
    upsert_viewpoint: (rawInput, ctx) => {
      const input = rawInput as { id?: unknown; label?: unknown; description?: unknown; group?: unknown; kind?: unknown; pipeline?: unknown; fromViewId?: unknown; subjectTypes?: unknown }
      const current = currentMetamodel('upsert_viewpoint', ctx)
      if (typeof current === 'string') return fail(current)
      const types = viewpointsOf(current)
      const existing = input.id === undefined ? undefined : types.find((t) => t.id === input.id)
      if (input.id !== undefined && !existing) return fail(`upsert_viewpoint: unknown viewpoint "${String(input.id)}"${types.length ? ` (the metamodel has ${types.map((t) => `"${t.id}"`).join(', ')})` : ''}`)
      if (input.label !== undefined && (typeof input.label !== 'string' || !input.label.trim())) return fail('upsert_viewpoint: label must be a non-empty string')
      if (!existing && input.label === undefined) return fail('upsert_viewpoint: a new viewpoint needs a label')
      if (input.description !== undefined && typeof input.description !== 'string') return fail('upsert_viewpoint: description must be a string')
      if (input.group !== undefined && typeof input.group !== 'string') return fail('upsert_viewpoint: group must be a string')
      if (input.kind !== undefined && !isViewpointKind(input.kind)) return fail(`upsert_viewpoint: kind must be one of ${VIEWPOINT_KINDS.join(', ')}`)
      let subject = existing?.subject
      if (input.subjectTypes !== undefined) {
        if (!Array.isArray(input.subjectTypes) || input.subjectTypes.some((t) => typeof t !== 'string')) return fail('upsert_viewpoint: subjectTypes must be a list of node type ids')
        const unknownTypes = (input.subjectTypes as string[]).filter((t) => !current.nodeTypes[t])
        if (unknownTypes.length) return fail(`upsert_viewpoint: unknown node type(s) ${unknownTypes.join(', ')} in subjectTypes`)
        subject = input.subjectTypes.length ? { types: [...new Set(input.subjectTypes as string[])] } : undefined
      }
      let kind = existing?.kind
      let pipeline = existing?.pipeline
      if (input.fromViewId !== undefined) {
        const viewId = typeof input.fromViewId === 'string' ? ctx.resolveId(input.fromViewId) : ''
        const view = ctx.diagram.getViews?.()[viewId]
        if (!view) return fail(`upsert_viewpoint: unknown view "${String(input.fromViewId)}"`)
        if (!isViewpointKind(view.kind ?? 'static')) return fail(`upsert_viewpoint: a ${view.kind} view cannot be a viewpoint`)
        kind = (view.kind ?? 'static') as typeof kind
        pipeline = pipelineOf(view) ?? {}
        // Checked as a chain given here is: one that keeps an element that is
        // gone was copied, and create_view then refused it.
        if (input.pipeline === undefined && pipeline.levels?.length) {
          const chain = pipelineFor(ctx, 'upsert_viewpoint', pipeline)
          if ('error' in chain) return fail(`${chain.error} (in the chain of the view "${view.name}")`)
        }
      }
      if (input.kind !== undefined) kind = input.kind as typeof kind
      if (input.pipeline !== undefined) {
        if (input.pipeline === null) return fail('upsert_viewpoint: pipeline must be an object')
        const chain = pipelineFor(ctx, 'upsert_viewpoint', input.pipeline)
        if ('error' in chain) return fail(chain.error)
        pipeline = chain.pipeline
      }
      if (!kind) return fail('upsert_viewpoint: a new viewpoint needs a kind (or fromViewId)')
      const label = typeof input.label === 'string' ? input.label.trim() : existing!.label
      const clash = types.find((t) => t.id !== existing?.id && t.label.trim().toLowerCase() === label.toLowerCase())
      if (clash) return fail(`upsert_viewpoint: the viewpoint "${clash.id}" already has the name "${clash.label}"`)
      const description = input.description === undefined ? existing?.description : (input.description as string).trim() || undefined
      const group = input.group === undefined ? existing?.group : (input.group as string).trim() || undefined
      const id = existing?.id ?? newViewpointId(label, types)
      const mm = withViewpoint(current, { id, label, ...(group ? { group } : {}), ...(description ? { description } : {}), kind, pipeline: JSON.parse(JSON.stringify(pipeline ?? {})), ...(subject ? { subject } : {}) })
      const following = Object.values(ctx.diagram.getViews?.() ?? {}).filter((v) => v.viewpoint === id).length
      return save(ctx, mm, `${existing ? 'Updated' : 'Added'} viewpoint "${id}".${existing && following ? ` ${following} view(s) of it follow.` : ''}`)
    },

    delete_viewpoint: (rawInput, ctx) => {
      const input = rawInput as { id?: unknown }
      const current = currentMetamodel('delete_viewpoint', ctx)
      if (typeof current === 'string') return fail(current)
      if (!viewpointsOf(current).some((t) => t.id === input.id)) return fail(`delete_viewpoint: unknown viewpoint "${String(input.id)}"`)
      return save(ctx, withoutViewpoint(current, input.id as string), `Deleted viewpoint "${String(input.id)}".`)
    },
  }
}
