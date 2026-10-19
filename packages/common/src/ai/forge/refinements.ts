// ─── What a Radical Forge stage did to earlier stages, and the gaps left ────
// Every stage from the domain model on may close gaps in earlier stages: a
// process shows a step no requirement asks for, a state machine a timeout no
// scenario covers. It adds the missing element right away, as its own stage
// would have, or corrects a wrong one (see the gaps block in ./prompts.ts).
// The user consents afterwards: stageRefinements compares the model before
// and after the stage and lists what it did outside its own output, and
// rejectRefinements takes the chosen ones back (an addition is removed, a
// change gets its old values). A deletion is only reported: the prompt
// forbids it, and Studio's Undo restores it.
//
// forgeGaps runs radical check's completeness rules, and a few of Forge's
// own, for the stages that are done only: a requirement has no scenario
// before the Scenarios stage by design. The gaps go to the user after a
// stage and into the next stage's task; the Review stage closes the rest.

import type { C4Node, C4Relation } from '../../c4'
import { CHECK_RULES, type CheckModel } from '../../check/rules'
import type { Metamodel } from '../../metamodel'
import type { DiagramFacade } from '../diagramFacade'
import { PRIMARY_TYPE_IDS_FOR_STAGE, type ForgeStageId } from './prompts'

/** The model's elements at one moment, copied. */
export interface ModelSnapshot {
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export function snapshotOf(model: { getNodes(): Record<string, C4Node>; getRelations(): Record<string, C4Relation> }): ModelSnapshot {
  return { nodes: clone(model.getNodes()), relations: clone(model.getRelations()) }
}

/** One thing a stage did to the model outside its own output. */
export interface ForgeRefinement {
  /** The node's or relation's id. */
  id: string
  element: 'node' | 'relation'
  change: 'added' | 'changed' | 'removed'
  /** The node's type, or the relation's type. */
  type: string
  /** The node's label, or a relation's "source → target". */
  label: string
  /** Changed: the fields that changed. */
  fields?: string[]
  /** Changed or removed: the element as it was before the stage. */
  before?: C4Node | C4Relation
}

/** Node fields that only place a node, which a stage does not refine. */
const LAYOUT_FIELDS = new Set(['x', 'y', 'width', 'height', 'collapsed'])

/** The fields whose values differ, layout left out, in a stable order. */
function changedFields(before: object, after: object): string[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => !LAYOUT_FIELDS.has(k))
  const value = (o: object, k: string): string => JSON.stringify((o as Record<string, unknown>)[k] ?? null)
  return keys.filter((k) => value(before, k) !== value(after, k)).sort()
}

function relationLabel(rel: C4Relation, ...models: ModelSnapshot[]): string {
  const name = (id: string): string => models.map((m) => m.nodes[id]?.label).find(Boolean) ?? id
  return `${name(rel.sourceId)} → ${name(rel.targetId)}`
}

/** What `stage` did to the model outside its own output, between `before`
 *  and `after`: the nodes it added of types it does not make (every node,
 *  for the Review stage), the relations it added between elements that were
 *  there before, and the elements it changed or deleted, in that order.
 *  Relations that went with a deleted node are not listed apart from it. */
export function stageRefinements(stage: ForgeStageId, before: ModelSnapshot, after: ModelSnapshot): ForgeRefinement[] {
  const own = new Set(PRIMARY_TYPE_IDS_FOR_STAGE[stage])
  const out: ForgeRefinement[] = []
  for (const node of Object.values(after.nodes)) {
    const old = before.nodes[node.id]
    if (!old) {
      if (!own.has(node.type)) out.push({ id: node.id, element: 'node', change: 'added', type: node.type, label: node.label })
      continue
    }
    const fields = changedFields(old, node)
    if (fields.length) out.push({ id: node.id, element: 'node', change: 'changed', type: node.type, label: node.label, fields, before: old })
  }
  for (const node of Object.values(before.nodes)) {
    if (!after.nodes[node.id]) out.push({ id: node.id, element: 'node', change: 'removed', type: node.type, label: node.label, before: node })
  }
  for (const rel of Object.values(after.relations)) {
    const type = rel.relationType ?? 'relation'
    const old = before.relations[rel.id]
    if (!old) {
      if (before.nodes[rel.sourceId] && before.nodes[rel.targetId]) {
        out.push({ id: rel.id, element: 'relation', change: 'added', type, label: relationLabel(rel, after) })
      }
      continue
    }
    const fields = changedFields(old, rel)
    if (fields.length) out.push({ id: rel.id, element: 'relation', change: 'changed', type, label: relationLabel(rel, after), fields, before: old })
  }
  for (const rel of Object.values(before.relations)) {
    if (after.relations[rel.id] || !after.nodes[rel.sourceId] || !after.nodes[rel.targetId]) continue
    out.push({ id: rel.id, element: 'relation', change: 'removed', type: rel.relationType ?? 'relation', label: relationLabel(rel, before), before: rel })
  }
  // Additions first, then changes, then deletions; nodes before relations.
  const rank = { added: 0, changed: 1, removed: 2 }
  return out.sort((a, b) => rank[a.change] - rank[b.change] || Number(a.element === 'relation') - Number(b.element === 'relation'))
}

/** Whether a refinement can be taken back: a deletion cannot. */
export const isRejectable = (refinement: ForgeRefinement): boolean => refinement.change !== 'removed'

/** Takes `refinements` back: removes what was added and gives what was
 *  changed its old values. Returns the ids taken back; a deletion, or an
 *  element the model no longer has, is left as it is. */
export function rejectRefinements(facade: DiagramFacade, refinements: ForgeRefinement[]): string[] {
  const done: string[] = []
  const restore = (fields: string[], before: object): Record<string, unknown> =>
    Object.fromEntries(fields.filter((f) => f !== 'id').map((f) => [f, (before as Record<string, unknown>)[f]]))
  // Relations first: removing a node takes its relations along.
  const ordered = [...refinements].sort((a, b) => Number(a.element === 'node') - Number(b.element === 'node'))
  for (const r of ordered) {
    if (!isRejectable(r)) continue
    if (r.element === 'relation') {
      if (!facade.getRelations()[r.id]) continue
      if (r.change === 'added') facade.removeRelation(r.id)
      else facade.updateRelation?.(r.id, restore(r.fields ?? [], r.before!))
      done.push(r.id)
      continue
    }
    const node = facade.getNodes()[r.id]
    if (!node) continue
    if (r.change === 'added') {
      facade.removeNode(r.id)
    } else {
      const fields = r.fields ?? []
      const oldParent = (r.before as C4Node).parentId ?? null
      if (fields.includes('parentId') && (node.parentId ?? null) !== oldParent) facade.moveNodes?.([r.id], oldParent)
      facade.updateNode(r.id, restore(fields.filter((f) => f !== 'parentId'), r.before!) as Partial<C4Node>)
    }
    done.push(r.id)
  }
  return done
}

/** One line per refinement, for the MCP server's answers and the prompts. */
export function describeRefinement(r: ForgeRefinement): string {
  const what = r.element === 'node' ? `${r.type} "${r.label}"` : `${r.type} ${r.label}`
  if (r.change === 'added') return `added ${what}`
  if (r.change === 'removed') return `deleted ${what}`
  return `changed ${what} (${(r.fields ?? []).join(', ')})`
}

// ─── Gaps ────────────────────────────────────────────────────────────────────

export interface ForgeGap {
  /** The rule: a radical check rule id, or one of Forge's own. */
  rule: string
  message: string
  nodeId?: string
}

/** The radical check rules that apply once a stage is done. */
const CHECK_RULES_AFTER: Partial<Record<ForgeStageId, string[]>> = {
  requirements: ['requirement-incomplete', 'requirement-without-origin', 'need-without-requirement'],
  fitness: ['fitness-fn-without-threshold'],
  scenarios: ['requirement-without-scenario', 'scenario-verifies-nothing'],
  c4: ['requirement-unsatisfied', 'fitness-fn-unlinked'],
}

type Model = { nodes: Record<string, C4Node>; relations: Record<string, C4Relation>; metamodel: Metamodel }

/** Nodes of `type` with no relation of `relationType` at that end. */
function without(model: Model, type: string, relationType: string, end: 'out' | 'in'): C4Node[] {
  if (!model.metamodel.nodeTypes[type] || !model.metamodel.relationTypes[relationType]) return []
  const linked = new Set(Object.values(model.relations)
    .filter((r) => r.relationType === relationType)
    .map((r) => (end === 'out' ? r.sourceId : r.targetId)))
  return Object.values(model.nodes).filter((n) => n.type === type && !linked.has(n.id))
}

/** Forge's own rules, by the stage after which they apply. */
const FORGE_RULES: Partial<Record<ForgeStageId, { rule: string; run: (model: Model) => ForgeGap[] }[]>> = {
  states: [
    {
      rule: 'machine-without-entity',
      run: (m) => without(m, 'state-machine', 'lifecycle-of', 'out')
        .map((n) => ({ rule: 'machine-without-entity', nodeId: n.id, message: `State machine "${n.label}" is the lifecycle of no entity.` })),
    },
    {
      rule: 'event-unused',
      run: (m) => {
        const used = new Set<string>()
        for (const r of Object.values(m.relations)) {
          if (r.relationType === 'emits') used.add(r.targetId)
          if (r.relationType !== 'transition') continue
          const props = r as unknown as { event?: unknown; raises?: unknown }
          if (typeof props.event === 'string') used.add(props.event)
          if (Array.isArray(props.raises)) for (const e of props.raises) if (typeof e === 'string') used.add(e)
        }
        return m.metamodel.nodeTypes.event
          ? Object.values(m.nodes).filter((n) => n.type === 'event' && !used.has(n.id))
            .map((n) => ({ rule: 'event-unused', nodeId: n.id, message: `No transition is triggered by or raises event "${n.label}".` }))
          : []
      },
    },
  ],
  c4: [
    {
      rule: 'step-without-performer',
      run: (m) => without(m, 'step', 'performed-by', 'out')
        // A step made of steps is performed by its parts.
        .filter((n) => !Object.values(m.nodes).some((c) => c.parentId === n.id && c.type === 'step'))
        .map((n) => ({ rule: 'step-without-performer', nodeId: n.id, message: `Nobody performs step "${n.label}".` })),
    },
    {
      rule: 'mockup-not-presented',
      run: (m) => without(m, 'mockup', 'presented-by', 'out')
        .map((n) => ({ rule: 'mockup-not-presented', nodeId: n.id, message: `No front-end presents screen "${n.label}".` })),
    },
    {
      rule: 'machine-not-implemented',
      run: (m) => without(m, 'state-machine', 'implements', 'in')
        .map((n) => ({ rule: 'machine-not-implemented', nodeId: n.id, message: `No element implements state machine "${n.label}".` })),
    },
    {
      rule: 'entity-not-realised',
      run: (m) => without(m, 'entity', 'realises', 'in')
        .map((n) => ({ rule: 'entity-not-realised', nodeId: n.id, message: `No element owns the data of entity "${n.label}" (realises).` })),
    },
  ],
}

/** The gaps the model has by the rules of the stages in `done`. */
export function forgeGaps(
  done: ForgeStageId[],
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  metamodel: Metamodel | undefined,
): ForgeGap[] {
  if (!metamodel) return []
  const model: CheckModel = { nodes, relations, metamodel }
  const gaps: ForgeGap[] = []
  for (const stage of done) {
    for (const id of CHECK_RULES_AFTER[stage] ?? []) {
      const rule = CHECK_RULES.find((r) => r.id === id)
      if (rule) gaps.push(...rule.run(model).map((f) => ({ rule: id, message: f.message, ...(f.nodeId ? { nodeId: f.nodeId } : {}) })))
    }
    for (const rule of FORGE_RULES[stage] ?? []) gaps.push(...rule.run(model))
  }
  return gaps
}

/** At most this many gaps are listed in a prompt or an answer. */
export const FORGE_GAP_LIMIT = 30

/** The gaps as lines, cut at `limit` with a line saying how many more. */
export function formatForgeGaps(gaps: ForgeGap[], limit = FORGE_GAP_LIMIT): string[] {
  const lines = gaps.slice(0, limit).map((g) => `- ${g.message}${g.nodeId ? ` (${g.nodeId})` : ''}`)
  if (gaps.length > limit) lines.push(`- … and ${gaps.length - limit} more`)
  return lines
}
