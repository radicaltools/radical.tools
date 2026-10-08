// ─── Milestone tools: list / create / update / delete / compare ──────────────
// A milestone is a named copy of the model (elements, relations, sequences)
// at one phase of the system, e.g. "As-is" and "Target 2027". Milestones keep
// the order they were made in, and later edits leave them as they were. A
// presentation slide can show one instead of the current model.
//
// The tools never load a milestone over the current model: that is Studio's
// milestone timeline, where the user sees what they are switching to.

import type { C4Node, C4Relation, DiagramSnapshot } from '../../c4'
import { fail, type ToolDef, type ToolHandler, type ToolRunContext } from './types'

export function buildMilestoneToolDefs(): ToolDef[] {
  return [
    {
      name: 'list_milestones',
      description: 'List the milestones, oldest first: named copies of the model at phases of the system (e.g. "As-is", "Target 2027"), with their element and relation counts.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'create_milestone',
      description: 'Save the current model (elements, relations, sequences) as a new, latest milestone: a named phase of the system. Later edits do not change it. To record several phases, build the first, save it, then change the model into the next and save again.',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string', description: 'The phase, e.g. "As-is", "MVP", "Target 2027".' } },
        required: ['name'],
        additionalProperties: false,
      },
    },
    {
      name: 'update_milestone',
      description: 'Rename a milestone. Its content stays as it was saved.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' } },
        required: ['id', 'name'],
        additionalProperties: false,
      },
    },
    {
      name: 'delete_milestone',
      description: 'Delete a milestone. The current model does not change; slides that showed it show the current model.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
    {
      name: 'compare_milestones',
      description: 'What changed between a milestone and a later one, or the current model: elements and relations added, removed and changed (with the changed fields).',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Milestone id to compare from.' },
          to: { type: 'string', description: 'Milestone id to compare to; omit for the current model.' },
        },
        required: ['from'],
        additionalProperties: false,
      },
    },
  ]
}

/** Layout fields, which a milestone also keeps but which are not changes to the system. */
const LAYOUT_KEYS = new Set(['id', 'x', 'y', 'width', 'height', 'collapsed'])

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** Fields that differ between two versions of an element or relation, layout left out. */
function changedFields(before: object, after: object): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const a = before as Record<string, unknown>
  const b = after as Record<string, unknown>
  return [...keys].filter((key) => !LAYOUT_KEYS.has(key) && !same(a[key], b[key])).sort()
}

interface ModelCopy {
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
}

export interface ModelChanges {
  nodes: { added: string[]; removed: string[]; changed: Array<{ id: string; fields: string[] }> }
  relations: { added: string[]; removed: string[]; changed: Array<{ id: string; fields: string[] }> }
}

/** Elements and relations added, removed and changed from `before` to `after`. */
export function compareModels(before: ModelCopy, after: ModelCopy): ModelChanges {
  const diff = <T extends object>(from: Record<string, T>, to: Record<string, T>) => ({
    added: Object.keys(to).filter((id) => !(id in from)),
    removed: Object.keys(from).filter((id) => !(id in to)),
    changed: Object.keys(to)
      .filter((id) => id in from)
      .map((id) => ({ id, fields: changedFields(from[id], to[id]) }))
      .filter((change) => change.fields.length > 0),
  })
  return { nodes: diff(before.nodes, after.nodes), relations: diff(before.relations, after.relations) }
}

/** The changes as text an agent can read, naming elements by label: what
 *  was removed as it was in `before`, the rest as it is in `after`. */
function describeChanges(changes: ModelChanges, before: ModelCopy, after: ModelCopy): string {
  const namer = (first: ModelCopy, second: ModelCopy) => {
    const nodeOf = (id: string) => first.nodes[id] ?? second.nodes[id]
    return {
      node: (id: string) => {
        const n = nodeOf(id)
        return n ? `${n.label} (${n.type}, ${id})` : id
      },
      relation: (id: string) => {
        const r = first.relations[id] ?? second.relations[id]
        if (!r) return id
        const end = (nodeId: string) => nodeOf(nodeId)?.label ?? nodeId
        return `${end(r.sourceId)} → ${end(r.targetId)}${r.label ? ` "${r.label}"` : ''}${r.relationType ? ` [${r.relationType}]` : ''} (${id})`
      },
    }
  }
  const now = namer(after, before)
  const then = namer(before, after)
  const lines: string[] = []
  const section = (title: string, items: string[]) => {
    if (items.length) lines.push(`${title}:`, ...items.map((item) => `- ${item}`))
  }
  section('Elements added', changes.nodes.added.map(now.node))
  section('Elements removed', changes.nodes.removed.map(then.node))
  section('Elements changed', changes.nodes.changed.map((c) => `${now.node(c.id)}: ${c.fields.join(', ')}`))
  section('Relations added', changes.relations.added.map(now.relation))
  section('Relations removed', changes.relations.removed.map(then.relation))
  section('Relations changed', changes.relations.changed.map((c) => `${now.relation(c.id)}: ${c.fields.join(', ')}`))
  return lines.join('\n')
}

function milestonesOf(tool: string, ctx: ToolRunContext): DiagramSnapshot[] | string {
  if (!ctx.diagram.getMilestones) return `${tool}: milestones are not available in this context`
  return ctx.diagram.getMilestones()
}

const nameOf = (raw: unknown): string | null =>
  typeof raw === 'string' && raw.trim() ? raw.trim() : null

export function buildMilestoneToolHandlers(): Record<string, ToolHandler> {
  return {
    list_milestones: (_rawInput, ctx) => {
      const list = milestonesOf('list_milestones', ctx)
      if (typeof list === 'string') return fail(list)
      if (!list.length) return { ok: true, resultText: 'There are no milestones yet; create_milestone saves the current model as one.' }
      return {
        ok: true,
        resultText: JSON.stringify(list.map((m) => ({
          id: m.id,
          name: m.name,
          savedAt: new Date(m.timestamp).toISOString(),
          nodes: Object.keys(m.nodes).length,
          relations: Object.keys(m.relations).length,
        }))),
      }
    },

    create_milestone: (rawInput, ctx) => {
      const input = rawInput as { name?: unknown }
      const list = milestonesOf('create_milestone', ctx)
      if (typeof list === 'string') return fail(list)
      if (!ctx.diagram.createMilestone) return fail('create_milestone: milestones are read-only in this context')
      const name = nameOf(input.name)
      if (!name) return fail('create_milestone: name is required')
      const id = ctx.diagram.createMilestone(name)
      const nodes = Object.keys(ctx.diagram.getNodes()).length
      const relations = Object.keys(ctx.diagram.getRelations()).length
      return { ok: true, resultText: `Saved milestone "${name}" (${id}): ${nodes} element(s), ${relations} relation(s).` }
    },

    update_milestone: (rawInput, ctx) => {
      const input = rawInput as { id?: unknown; name?: unknown }
      const list = milestonesOf('update_milestone', ctx)
      if (typeof list === 'string') return fail(list)
      if (!ctx.diagram.renameMilestone) return fail('update_milestone: milestones are read-only in this context')
      if (!list.some((m) => m.id === input.id)) return fail(`update_milestone: unknown milestone id "${String(input.id)}"`)
      const name = nameOf(input.name)
      if (!name) return fail('update_milestone: name must be a non-empty string')
      ctx.diagram.renameMilestone(input.id as string, name)
      return { ok: true, resultText: `Renamed milestone ${String(input.id)} to "${name}".` }
    },

    delete_milestone: (rawInput, ctx) => {
      const input = rawInput as { id?: unknown }
      const list = milestonesOf('delete_milestone', ctx)
      if (typeof list === 'string') return fail(list)
      if (!ctx.diagram.removeMilestone) return fail('delete_milestone: milestones are read-only in this context')
      const milestone = list.find((m) => m.id === input.id)
      if (!milestone) return fail(`delete_milestone: unknown milestone id "${String(input.id)}"`)
      ctx.diagram.removeMilestone(milestone.id)
      return { ok: true, resultText: `Deleted milestone "${milestone.name}" (${milestone.id}).` }
    },

    compare_milestones: (rawInput, ctx) => {
      const input = rawInput as { from?: unknown; to?: unknown }
      const list = milestonesOf('compare_milestones', ctx)
      if (typeof list === 'string') return fail(list)
      const from = list.find((m) => m.id === input.from)
      if (!from) return fail(`compare_milestones: unknown milestone id "${String(input.from)}"`)
      const to = input.to === undefined ? undefined : list.find((m) => m.id === input.to)
      if (input.to !== undefined && !to) return fail(`compare_milestones: unknown milestone id "${String(input.to)}"`)
      const before: ModelCopy = { nodes: from.nodes, relations: from.relations }
      const after: ModelCopy = to
        ? { nodes: to.nodes, relations: to.relations }
        : { nodes: ctx.diagram.getNodes(), relations: ctx.diagram.getRelations() }
      const changes = compareModels(before, after)
      const target = to ? `milestone "${to.name}"` : 'the current model'
      const count = (group: ModelChanges['nodes']) => group.added.length + group.removed.length + group.changed.length
      if (!count(changes.nodes) && !count(changes.relations)) {
        return { ok: true, resultText: `No changes from milestone "${from.name}" to ${target}.` }
      }
      return { ok: true, resultText: `From milestone "${from.name}" to ${target}:\n${describeChanges(changes, before, after)}` }
    },
  }
}
