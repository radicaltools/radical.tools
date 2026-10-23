// ─── View tools: create_view / update_view / set_view_nodes / delete_view / set_active_view

import type { DiagramView, ViewPipeline } from '../../c4'
import { readPipeline } from '../../viewPipeline'
import { groupViewNodesRefusal, isViewGroup } from '../../model'
import { findViewpoint, viewpointsOf } from '../../viewpoints'
import type { ViewpointDef } from '../../metamodel/types'
import { fail, type ToolDef, type ToolHandler, type ToolRunContext } from './types'

// 'dynamic' needs a sequence (create_sequence) — the handlers refuse it without one.
const VIEW_KIND_ENUM = ['static', 'table', 'treemap', 'matrix', 'wiki', 'warnier', 'dynamic'] as const

const KIND_DESCRIPTION = "'table' for governance record types (ADR/Fitness Function/Requirement), 'treemap' for hierarchy overviews, 'wiki' for docs, 'matrix' for relation grids, 'warnier' for processes and any hierarchy as a Warnier–Orr diagram (braces left to right), 'dynamic' to play a sequence (needs sequenceId), 'static' (default) otherwise."

/** The real id of an existing sequence, or the reason there is none. */
function sequenceFor(ctx: ToolRunContext, tool: string, raw: unknown): { id: string } | { error: string } {
  if (typeof raw !== 'string' || !raw) return { error: `${tool}: a dynamic view needs a sequenceId` }
  if (!ctx.diagram.getSequences || !ctx.diagram.setViewSequence) return { error: `${tool}: sequences are not editable in this context` }
  const id = ctx.resolveId(raw)
  if (!(id in ctx.diagram.getSequences())) return { error: `${tool}: unknown sequenceId "${raw}"` }
  return { id }
}

const VIA_SCHEMA = {
  type: 'object',
  description: 'How the level hangs under the level above: {relationType, direction} along a relation — direction "in" takes the elements whose relation points at the element above (requirements that derive from a need: {"relationType":"derives","direction":"in"}), "out" the ones it points at — {anyRelation: true} along any relation of any type either way, or {contains: true} for the children the element above contains. Not on the first level.',
}
const FILTER_SCHEMA = {
  type: 'object',
  description: 'One of {kind:"type",types:[…]}, {kind:"property",key,op:"is"|"is-not"|"set"|"unset",values?:[…]}, {kind:"relation",relationType,direction:"out"|"in",has:boolean}, {kind:"within",nodeId} (the element sits inside nodeId, at any depth), {kind:"text",text}. Add join:"or" to join it to the filter before with or (and by default), off:true to keep it switched off.',
}
export const PIPELINE_SCHEMA = {
  type: ['object', 'null'],
  description: `What the view shows, as a chain of levels among the view's elements (all of them when its node list is empty): the first level's elements are the roots, each next level's hang under an element of the level above. A table and the Structure tree show the chain as a tree, a wiki as chapters; a canvas, matrix or hierarchy draws its elements and the relations it follows (every relation between them with edges:"all"). Example — needs inside a domain, the requirements refined from each, the scenarios verifying those: {levels:[{ways:[{types:["need"]}],filters:[{kind:"within",nodeId:"<domain id>"}]},{ways:[{via:{relationType:"derives",direction:"in"},types:["requirement"]}]},{ways:[{via:{relationType:"verifies",direction:"in"},types:["scenario"]}]}]}. null removes the chain.`,
  properties: {
    levels: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ways: { type: 'array', description: 'Ways into the level, joined with or. On the first level a way takes no via, and one with no types takes every element; on a later level every way needs a via.', items: { type: 'object', properties: { types: { type: 'array', items: { type: 'string' }, description: 'Node type ids; omit for any type.' }, via: VIA_SCHEMA } } },
          filters: { type: 'array', items: FILTER_SCHEMA },
        },
        required: ['ways'],
      },
    },
    sort: { type: 'object', description: '{by:"label"|"type"|"property", key? (for property), desc?: true}' },
    edges: { type: 'string', enum: ['all'], description: 'On a canvas, matrix or hierarchy: draw every relation between the elements, not only the ones the chain follows.' },
  },
}

/** Fields every element has that a property filter may test. */
const BUILT_IN_FIELDS = ['label', 'description', 'technology', 'external']

/** A chain given to a tool, read and checked against the model: element ids
 *  (tempIds too) resolved, unknown types, relation types and elements
 *  refused, and so is what the chain would read otherwise than written. */
export function pipelineFor(ctx: ToolRunContext, tool: string, raw: unknown): { pipeline: ViewPipeline } | { error: string } {
  if (raw === null) return { pipeline: {} }
  const pipeline = readPipeline(raw)
  if (!pipeline) return { error: `${tool}: pipeline has no level or sort it can read` }
  const metamodel = ctx.diagram.getMetamodel?.()
  const nodes = ctx.diagram.getNodes()
  const problems: string[] = []
  // What readPipeline would read otherwise than written (a via it cannot
  // read is dropped, a filter is matched as far as it goes) is refused: a
  // step written as one thing was saved as another and showed other elements.
  const rawLevels = Array.isArray((raw as { levels?: unknown }).levels) ? (raw as { levels: unknown[] }).levels : []
  rawLevels.forEach((l, i) => {
    const level = (l ?? {}) as { ways?: unknown; filters?: unknown }
    const at = `level ${i + 1}`
    for (const w of Array.isArray(level.ways) ? level.ways : []) {
      const via = (w as { via?: Record<string, unknown> } | null)?.via
      if (via === undefined) { if (i > 0) problems.push(`${at}: a way needs a via (how its elements hang under the level above)`); continue }
      if (i === 0) { problems.push(`${at}: the first level takes no via (it has no level above)`); continue }
      const readable = !!via && typeof via === 'object' && (via.contains === true || via.anyRelation === true
        || (typeof via.relationType === 'string' && (via.direction === 'in' || via.direction === 'out')))
      if (!readable) problems.push(`${at}: a via is {relationType, direction:"in"|"out"}, {anyRelation:true} or {contains:true}`)
    }
    for (const f of Array.isArray(level.filters) ? level.filters as Array<Record<string, unknown>> : []) {
      const kind = f?.kind
      if (kind === 'type') { if (!Array.isArray(f.types) || !f.types.length) problems.push(`${at}: a type filter needs types`) }
      else if (kind === 'property') {
        if (!['is', 'is-not', 'set', 'unset'].includes(f.op as string)) problems.push(`${at}: a property filter's op is "is", "is-not", "set" or "unset", not "${String(f.op)}"`)
        else if ((f.op === 'is' || f.op === 'is-not') && (!Array.isArray(f.values) || !f.values.length)) problems.push(`${at}: a property filter with op "${f.op}" needs values`)
        const known = !metamodel || BUILT_IN_FIELDS.includes(f.key as string)
          || Object.values(metamodel.nodeTypes).some((t) => t.properties?.some((p) => p.key === f.key))
        if (!known) problems.push(`${at}: no node type has a property "${String(f.key)}"`)
      } else if (kind === 'relation') {
        if (f.direction !== 'in' && f.direction !== 'out') problems.push(`${at}: a relation filter needs direction "in" or "out"`)
        if (typeof f.has !== 'boolean') problems.push(`${at}: a relation filter needs has: true or false`)
      } else if (kind === 'within') { if (typeof f.nodeId !== 'string') problems.push(`${at}: a within filter needs a nodeId`) }
      else if (kind === 'text') { if (typeof f.text !== 'string') problems.push(`${at}: a text filter needs a text`) }
      else problems.push(`${at}: unknown filter kind "${String(kind)}"`)
    }
  })
  const type = (t: string) => { if (metamodel && !metamodel.nodeTypes[t]) problems.push(`unknown node type "${t}"`) }
  const relation = (r: string) => { if (metamodel && !metamodel.relationTypes[r]) problems.push(`unknown relation type "${r}"`) }
  for (const level of pipeline.levels ?? []) {
    for (const way of level.ways) {
      way.types?.forEach(type)
      if (way.via && 'relationType' in way.via) relation(way.via.relationType)
    }
    level.filters = level.filters?.map((f) => {
      if (f.kind === 'type') f.types.forEach(type)
      if (f.kind === 'relation') relation(f.relationType)
      if (f.kind !== 'within') return f
      const nodeId = ctx.resolveId(f.nodeId)
      if (!(nodeId in nodes)) problems.push(`unknown element "${f.nodeId}" in a within filter`)
      return { ...f, nodeId }
    })
  }
  if (problems.length) return { error: `${tool}: ${problems.join('; ')}` }
  return { pipeline }
}

const VIEWPOINT_SCHEMA = {
  type: ['string', 'null'],
  description: "One of the metamodel's viewpoints (its id or name, see get_model_summary): the view becomes one of that viewpoint, with the viewpoint's kind and filter chain, and follows the viewpoint when it changes; one that draws one element (subjectTypes in get_model_summary) makes the view a group holding a view of each such element, made and removed with the elements. Not with kind or pipeline. null (update_view) keeps the view's kind and chain, of no viewpoint. Setting kind or pipeline also leaves the viewpoint.",
}

/** The metamodel's viewpoint a tool names, or the reason there is none. */
function viewpointFor(ctx: ToolRunContext, tool: string, input: { viewpoint?: unknown; kind?: unknown; pipeline?: unknown }): { id: string; def: ViewpointDef } | { error: string } {
  if (input.kind !== undefined || input.pipeline !== undefined) return { error: `${tool}: give viewpoint, or kind and pipeline, not both` }
  if (!ctx.diagram.applyViewpoint) return { error: `${tool}: viewpoints are not available in this context` }
  const types = viewpointsOf(ctx.diagram.getMetamodel?.())
  const type = findViewpoint(types, input.viewpoint)
  if (!type) return { error: `${tool}: unknown viewpoint "${String(input.viewpoint)}"${types.length ? ` (the metamodel has ${types.map((t) => `"${t.id}"`).join(', ')})` : ' (the metamodel has none)'}` }
  return { id: type.id, def: type }
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
      description: "Create a new named view — a filtered/specialized way to look at the model. With viewpoint, a view of one of the metamodel's viewpoints (a kind and a filter chain under a name).",
      inputSchema: {
        type: 'object',
        properties: {
          edgeStyle: { type: 'string', enum: ['curved', 'orthogonal', 'model'], description: 'How the view draws relations: curved, orthogonal (horizontal and vertical segments), or "model" for the model\'s default.' },
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
          pipeline: PIPELINE_SCHEMA,
          viewpoint: VIEWPOINT_SCHEMA,
        },
        required: ['tempId', 'name'],
        additionalProperties: false,
      },
    },
    {
      name: 'update_view',
      description: "Rename a view, move it into a folder of the list of views, change its kind, line style or linked sequence, set which relations it hides, show elements open or folded in it, or set its filter chain (pipeline), or make it one of the metamodel's viewpoints (viewpoint). Use set_view_nodes to change its nodes; [] there makes the chain work among every element.",
      inputSchema: {
        type: 'object',
        properties: {
          edgeStyle: { type: 'string', enum: ['curved', 'orthogonal', 'model'], description: 'How the view draws relations: curved, orthogonal (horizontal and vertical segments), or "model" for the model\'s default.' },
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
          pipeline: PIPELINE_SCHEMA,
          viewpoint: VIEWPOINT_SCHEMA,
        },
        required: ['id'],
        additionalProperties: false,
      },
    },
    {
      name: 'set_view_nodes',
      description: "Replace a view's visible-node set; [] shows every element (a view's filter chain then works among all of them). Not for a group of views per element or one of its views: each shows what its element holds.",
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
      const input = rawInput as { tempId?: unknown; name?: unknown; kind?: unknown; sequenceId?: unknown; nodeIds?: unknown; active?: unknown; folder?: unknown; edgeStyle?: unknown; pipeline?: unknown; viewpoint?: unknown }
      if (typeof input.tempId !== 'string' || !input.tempId) return fail('create_view: tempId is required')
      if (typeof input.name !== 'string' || !input.name.trim()) return fail('create_view: name is required')
      const name = input.name.trim()
      if (!ctx.diagram.addView || !ctx.diagram.setViewNodes) return fail('create_view: views are not editable in this context')

      const sequence = input.kind === 'dynamic' ? sequenceFor(ctx, 'create_view', input.sequenceId) : undefined
      if (sequence && 'error' in sequence) return fail(sequence.error)
      const viewpoint = input.viewpoint === undefined || input.viewpoint === null ? undefined : viewpointFor(ctx, 'create_view', input)
      if (viewpoint && 'error' in viewpoint) return fail(viewpoint.error)
      const chain = input.pipeline === undefined ? undefined : pipelineFor(ctx, 'create_view', input.pipeline)
      if (chain && 'error' in chain) return fail(chain.error)
      if (chain && !ctx.diagram.setViewPipeline) return fail('create_view: filter chains are not available in this context')
      if (viewpoint?.def.subject && Array.isArray(input.nodeIds) && input.nodeIds.length > 0) {
        return fail(`create_view: viewpoint ${viewpoint.def.label} draws one element: its view is a group of views per element, each showing what its element holds, and lists no elements (leave out nodeIds)`)
      }

      const realId = ctx.diagram.addView(name)
      if (!realId) return fail(`create_view "${name}" was rejected by the store`)
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
      if (input.edgeStyle === 'curved' || input.edgeStyle === 'orthogonal') {
        if (!ctx.diagram.setViewEdgeStyle) return fail('create_view: line styles are not available in this context')
        ctx.diagram.setViewEdgeStyle(realId, input.edgeStyle)
      }
      if (typeof input.folder === 'string' && input.folder.trim()) {
        if (!ctx.diagram.setViewFolder) return fail('create_view: folders of views are not available in this context')
        ctx.diagram.setViewFolder(realId, input.folder)
      }
      if (chain) ctx.diagram.setViewPipeline!(realId, chain.pipeline)
      if (viewpoint) ctx.diagram.applyViewpoint!(realId, viewpoint.id, null)
      if (input.active === true && ctx.diagram.setActiveView) ctx.diagram.setActiveView(realId)

      // A viewpoint that draws one element: a group, with a view of each.
      const members = viewpoint?.def.subject ? Object.values(ctx.diagram.getViews?.() ?? {}).filter((v) => v.partOf === realId) : []
      return {
        ok: true,
        resultText: `Created view ${realId}.${viewpoint?.def.subject ? ` It is a group holding a view of each ${viewpoint.def.subject.types.join(' or ')} (${members.length} now: ${members.map((v) => `${v.name} ${v.id}`).join(', ') || 'none yet'}), kept in step with the model.` : ''}`,
        added: { views: 1 + members.length },
      }
    },

    update_view: (rawInput, ctx) => {
      const input = rawInput as { id?: unknown; name?: unknown; kind?: unknown; sequenceId?: unknown; hiddenRelationIds?: unknown; expand?: unknown; collapse?: unknown; folder?: unknown; edgeStyle?: unknown; pipeline?: unknown; viewpoint?: unknown }
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
      if (input.edgeStyle !== undefined) {
        if (input.edgeStyle !== 'curved' && input.edgeStyle !== 'orthogonal' && input.edgeStyle !== 'model') return fail('update_view: edgeStyle must be "curved", "orthogonal" or "model"')
        if (!ctx.diagram.setViewEdgeStyle) return fail('update_view: line styles are not available in this context')
        const style = input.edgeStyle === 'model' ? null : input.edgeStyle
        changes.push(() => ctx.diagram.setViewEdgeStyle!(vId, style))
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
      // One of a group's views follows the group: only its folding and lines are its own.
      if (view.partOf && (input.viewpoint !== undefined || input.kind !== undefined || input.pipeline !== undefined || input.folder !== undefined || input.name !== undefined)) {
        return fail(`update_view: ${view.name} is one of the views of the group ${ctx.diagram.getViews()[view.partOf]?.name ?? view.partOf}: its name follows its element, and its viewpoint, kind, filter and folder are the group's (move the group's folder instead)`)
      }
      // A group is one by its viewpoint: another kind, filter or viewpoint would end it.
      if (isViewGroup(view, ctx.diagram.getMetamodel?.()) && (input.viewpoint !== undefined || input.kind !== undefined || input.pipeline !== undefined)) {
        return fail(`update_view: ${view.name} is a group of views per element; its viewpoint sets its views. Delete it (delete_view) to make another kind of view`)
      }
      if (input.viewpoint === null) {
        if (!ctx.diagram.detachViewpoint) return fail('update_view: viewpoints are not available in this context')
        changes.push(() => ctx.diagram.detachViewpoint!(vId))
      } else if (input.viewpoint !== undefined) {
        const viewpoint = viewpointFor(ctx, 'update_view', input)
        if ('error' in viewpoint) return fail(viewpoint.error)
        changes.push(() => ctx.diagram.applyViewpoint!(vId, viewpoint.id, null))
      }
      const chain = input.pipeline === undefined ? undefined : pipelineFor(ctx, 'update_view', input.pipeline)
      if (chain) {
        if ('error' in chain) return fail(chain.error)
        if (!ctx.diagram.setViewPipeline) return fail('update_view: filter chains are not available in this context')
        changes.push(() => ctx.diagram.setViewPipeline!(vId, chain.pipeline))
      }
      if (!changes.length) return fail('update_view: nothing to change')
      // Read before: a facade edits the view in place.
      const listed = view.nodeIds.length
      const wasGroup = isViewGroup(view, ctx.diagram.getMetamodel?.())
      for (const change of changes) change()
      // A viewpoint of one element makes the view a group: it lists no
      // elements of its own, and holds a view of each such element.
      const now = ctx.diagram.getViews()[vId]
      const group = !wasGroup && !!now && isViewGroup(now, ctx.diagram.getMetamodel?.())
      const held = group ? Object.values(ctx.diagram.getViews()).filter((v) => v.partOf === vId).map((v) => v.name).sort() : []
      const note = group ? ` It is now a group holding a view per element (${held.length}${held.length ? `: ${held.join(', ')}` : ''})${listed ? `, and no longer lists the ${listed} element(s) picked for it` : ''}.` : ''
      return { ok: true, resultText: `Updated view ${vId}.${note}`, updated: { views: 1 } }
    },

    set_view_nodes: (rawInput, ctx) => {
      const input = rawInput as { id?: unknown; nodeIds?: unknown }
      if (typeof input.id !== 'string' || !input.id) return fail('set_view_nodes: id is required')
      if (!Array.isArray(input.nodeIds)) return fail('set_view_nodes: nodeIds must be an array')
      if (!ctx.diagram.setViewNodes || !ctx.diagram.getViews) return fail('set_view_nodes: views are not editable in this context')
      const vId = ctx.resolveId(input.id)
      if (!(vId in ctx.diagram.getViews())) return fail(`set_view_nodes: unknown view id "${input.id}"`)
      const refused = groupViewNodesRefusal({ views: ctx.diagram.getViews(), metamodel: ctx.diagram.getMetamodel?.() }, vId)
      if (refused) return fail(`set_view_nodes: ${refused}`)
      const resolved = input.nodeIds.filter((x): x is string => typeof x === 'string').map((id) => ctx.resolveId(id))
      ctx.diagram.setViewNodes(vId, resolved)
      return { ok: true, resultText: `Updated view ${vId}.`, updated: { views: 1 } }
    },

    delete_view: (rawInput, ctx) => {
      const input = rawInput as { id?: unknown }
      if (typeof input.id !== 'string' || !input.id) return fail('delete_view: id is required')
      if (!ctx.diagram.removeView || !ctx.diagram.getViews) return fail('delete_view: views are not editable in this context')
      const vId = ctx.resolveId(input.id)
      const view = ctx.diagram.getViews()[vId]
      if (!view) return fail(`delete_view: unknown view id "${input.id}"`)
      if (view.partOf) return fail(`delete_view: ${view.name} is one of the views of the group ${ctx.diagram.getViews()[view.partOf]?.name ?? view.partOf} and goes with its element; delete the element, or the group with all its views`)
      const members = Object.values(ctx.diagram.getViews()).filter((v) => v.partOf === vId).length
      ctx.diagram.removeView(vId)
      return { ok: true, resultText: `Deleted view ${vId}${members ? ` and the ${members} views of the group` : ''}.`, deleted: { views: 1 + members } }
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
