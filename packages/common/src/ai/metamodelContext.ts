// ─── Metamodel context message ──────────────────────────────────────────────
// The tool schemas (ai/tools) only enumerate type ids. This message carries
// the rest of the metamodel — each type's property keys/enum options,
// allowedParents/allowedAtRoot/cardinality and relation allowedPairs — and is
// what the tool descriptions call "the metamodel context message". Studio
// sends it as a system message; the MCP server returns it from
// get_model_summary.

import type { C4Node } from '../c4'
import type { Metamodel, PropertyDef, RelationPair } from '../metamodel/types'
import { viewpointsOf } from '../viewpoints'

const FALLBACK_TYPES = [
  'person', 'system', 'container', 'component', 'database', 'webapp', 'queue',
] as const

/** Build a compact, machine-readable summary of the metamodel rules —
 *  including each type's custom `properties`, which is how the model learns
 *  what keys are valid in add_node/add_relation's `properties` bag.
 *
 *  `relevantTypeIds` (when given — Radical Forge passes its current stage's
 *  primary type(s); QuickSearch's freeform chat has no "stage" and omits it,
 *  keeping today's always-full-detail behavior) trims the verbose
 *  `properties` array for node types that are both irrelevant to the active
 *  stage AND not yet used anywhere in `nodes` — a type already present in the
 *  diagram keeps full detail regardless, since the model may still need to
 *  reference/link to it correctly. This never removes a type from the tool
 *  schema's own `type` enum (ai/tools/nodeTools.ts) — the model can still
 *  create any type, just with less up-front documentation for the unlikely
 *  ones. Abbreviated entries keep id/label/allowedParents/allowedAtRoot/
 *  cardinality — enough to know the type exists and roughly where it fits. */
export function buildMetamodelMessage(
  mm: Metamodel | undefined,
  relevantTypeIds?: Set<string>,
  nodes?: Record<string, C4Node>,
): string {
  if (!mm) {
    return [
      'Metamodel: (none loaded — falling back to default C4 types)',
      'Allowed node types: ' + FALLBACK_TYPES.map(t => `"${t}"`).join(', '),
    ].join('\n')
  }
  const typesInUse = new Set<string>(Object.values(nodes ?? {}).map((n) => n.type))
  const types = Object.values(mm.nodeTypes).map((t) => {
    // Mirror the same defaulting that diagramStore uses: when allowedParents is
    // empty/undefined the type is allowed at the root unless explicitly false.
    const allowedParents = t.allowedParents && t.allowedParents.length > 0 ? t.allowedParents : []
    const rootDefault = allowedParents.length === 0
    const atRoot = t.allowedAtRoot ?? rootDefault
    const fullDetail = !relevantTypeIds || relevantTypeIds.has(t.id) || typesInUse.has(t.id)
    return {
      id: t.id,
      label: t.label,
      allowedParents,
      allowedAtRoot: atRoot,
      cardinality: t.cardinality,
      ...(t.layout ? { layout: t.layout } : {}),
      ...(fullDetail ? { properties: t.properties } : {}),
    }
  })
  const relations = Object.values(mm.relationTypes).map((r) => ({
    id: r.id,
    label: r.label,
    allowedPairs: r.allowedPairs,
    properties: r.properties,
    ...(r.governance ? { governance: true } : {}),
    ...(r.layout ? { layout: r.layout } : {}),
  }))
  const viewpoints = viewpointsOf(mm).map((t) => ({ id: t.id, label: t.label, ...(t.group ? { group: t.group } : {}), kind: t.kind, ...(t.subject ? { subjectTypes: t.subject.types } : {}), ...(t.description ? { description: t.description } : {}) }))
  return [
    `Metamodel "${mm.name}". Use ONLY the node/relation types listed below; respect`,
    '`allowedParents` (empty ⇒ requires `allowedAtRoot: true` to be a root node),',
    '`cardinality.max`, and `allowedPairs`. A `group` only gathers elements and',
    'holds what its place allows: at the root, the types with `allowedAtRoot`;',
    'inside a system, what a system can hold at any depth (a component fits in a',
    'group inside a system, not in a group at the root). Between an element and one that',
    'holds it, only a relation type with `governance: true` may be added (a requirement',
    'inside the system that satisfies it); move_node removes the other relations',
    'between an element and what then holds it. Each type\'s `properties` array (where',
    'present) is the exact set of keys valid in that type\'s `properties` tool-call',
    'bag — key, label, type, and (for enums) the allowed `options`. A type with no',
    '`properties` array here still exists and can be created — its property schema',
    'was just omitted here as unlikely to be needed; call search_model or add_node',
    'without a `properties` bag if unsure (unknown keys are dropped with a note,',
    'not a hard failure). A property of type `ref` takes the id of a node of type',
    '`refType` (or a tempId from this run); with `multiple: true`, an array of them.',
    ...(viewpoints.length ? ['`viewpoints` are a view type (kind) with a filter chain under a name: create_view and', 'update_view take one as `viewpoint` (id or name); the view follows the viewpoint. One with `subjectTypes`', 'draws one element: its view is a group holding a view of each element of those types (partOf).'] : []),
    'A type\'s `layout` says what Smart Layout takes it for (a node type\'s role: actor above what it uses,',
    'store beside its user, note beside its anchor, start, end, broker between its sides, screen; a relation',
    'type\'s flow: forward, reverse or side, along a free, vertical or horizontal axis); upsert_node_type and',
    'upsert_relation_type set it for a custom type.',
    '```json',
    JSON.stringify({ nodeTypes: types, relationTypes: relations, ...(viewpoints.length ? { viewpoints } : {}) }),
    '```',
  ].join('\n')
}

// ─── The metamodel in brief, and a type in full ─────────────────────────────
// What an agent's get_model_summary carries (ADR Agent answers brief, details
// on request): each type in one line, the viewpoints by name. A type's whole
// definition comes from metamodelDetail, for the ids the agent names.

/** Enum options shown inline in the brief when they fit in this many characters. */
const BRIEF_ENUM_CHARS = 90

function briefProperty(p: PropertyDef): string {
  if (p.type === 'enum' && p.options?.length) {
    const options = p.options.join('|')
    return options.length <= BRIEF_ENUM_CHARS ? `${p.key} (${options})` : `${p.key} (enum, ${p.options.length} options)`
  }
  if (p.type === 'ref') return `${p.key} (→ ${p.refType ?? 'node'}${p.multiple ? '[]' : ''})`
  return p.key
}

/** The pairs of a relation type, sources with the same targets together:
 *  "adr, fitness-fn → container, component". */
function briefPairs(pairs: RelationPair[]): string {
  const targets = new Map<string, string[]>()
  for (const p of pairs) targets.set(p.from, [...targets.get(p.from) ?? [], p.to])
  const bySet = new Map<string, string[]>()
  for (const [from, to] of targets) {
    const key = to.join(', ')
    bySet.set(key, [...bySet.get(key) ?? [], from])
  }
  return [...bySet].map(([to, from]) => `${from.join(', ')} → ${to}`).join('; ')
}

/** Each node and relation type of `mm` in one line, and its viewpoints by
 *  name, with the rules the lines rest on. */
export function buildMetamodelBrief(mm: Metamodel | undefined): string {
  if (!mm) return buildMetamodelMessage(mm)
  const nodeLines = Object.values(mm.nodeTypes).map((t) => {
    const parents = t.allowedParents?.length ? t.allowedParents : []
    const atRoot = t.allowedAtRoot ?? parents.length === 0
    const where = [parents.length ? `in ${parents.join(', ')}` : '', atRoot ? 'at the root' : ''].filter(Boolean).join(' or ')
    const props = (t.properties ?? []).map(briefProperty)
    const max = t.cardinality?.max !== undefined ? `; at most ${t.cardinality.max}` : ''
    return `- ${t.id} (${t.label}): ${where || 'nowhere'}${max}${props.length ? `; properties: ${props.join(', ')}` : ''}`
  })
  const relationLines = Object.values(mm.relationTypes).map((r) => {
    const props = (r.properties ?? []).map(briefProperty)
    return `- ${r.id} (${r.label}${r.governance ? ', governance' : ''}): ${briefPairs(r.allowedPairs ?? []) || 'any pair'}${props.length ? `; properties: ${props.join(', ')}` : ''}`
  })
  const viewpoints = viewpointsOf(mm)
  const groups = new Map<string, string[]>()
  for (const v of viewpoints) groups.set(v.group ?? '', [...groups.get(v.group ?? '') ?? [], v.label])
  return [
    `Metamodel "${mm.name}", in brief. Use ONLY these node and relation types. A node type`,
    'goes where its line says (in a parent of those types, or at the root); a relation only',
    'between the pairs its line names. A `group` only gathers elements and holds what its',
    'place allows. Between an element and one that holds it, only a governance relation may',
    'be added. `properties` lists the keys valid in a type\'s `properties` bag, with enum',
    'options when short and `→ type` for a reference (the id of a node of that type).',
    'get_model_summary with `types` (node, relation or viewpoint ids or names) gives those',
    'types in full: labels, every enum option, visibility, layout, a viewpoint\'s chain.',
    '',
    'Node types:',
    ...nodeLines,
    '',
    'Relation types:',
    ...relationLines,
    ...(viewpoints.length ? ['', 'Viewpoints (create_view and update_view take one as `viewpoint`, by id or name):', ...[...groups].map(([group, labels]) => `- ${group ? `${group}: ` : ''}${labels.join(', ')}`)] : []),
  ].join('\n')
}

/** The whole definition of the node types, relation types and viewpoints
 *  `ids` names (by id or label), and the ids it does not know. */
export function metamodelDetail(mm: Metamodel | undefined, ids: string[]): { text: string; unknown: string[] } {
  const wanted = ids.map((id) => id.trim()).filter(Boolean)
  const nodeTypes = Object.values(mm?.nodeTypes ?? {})
  const relationTypes = Object.values(mm?.relationTypes ?? {})
  const viewpoints = viewpointsOf(mm)
  const matches = (t: { id: string; label: string }, id: string) => t.id === id || t.label.toLowerCase() === id.toLowerCase()
  const unknown = wanted.filter((id) => ![...nodeTypes, ...relationTypes, ...viewpoints].some((t) => matches(t, id)))
  const pick = <T extends { id: string; label: string }>(list: T[]) => list.filter((t) => wanted.some((id) => matches(t, id)))
  const detail = {
    ...(pick(nodeTypes).length ? { nodeTypes: pick(nodeTypes) } : {}),
    ...(pick(relationTypes).length ? { relationTypes: pick(relationTypes) } : {}),
    ...(pick(viewpoints).length ? { viewpoints: pick(viewpoints) } : {}),
  }
  const text = [
    ...(Object.keys(detail).length ? ['```json', JSON.stringify(detail), '```'] : []),
    ...(unknown.length ? [`Not in the metamodel "${mm?.name ?? 'none'}": ${unknown.join(', ')}.`] : []),
  ].join('\n')
  return { text, unknown }
}
