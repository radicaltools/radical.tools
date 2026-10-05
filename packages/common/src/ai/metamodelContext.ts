// ─── Metamodel context message ──────────────────────────────────────────────
// The tool schemas (ai/tools) only enumerate type ids. This message carries
// the rest of the metamodel — each type's property keys/enum options,
// allowedParents/allowedAtRoot/cardinality and relation allowedPairs — and is
// what the tool descriptions call "the metamodel context message". Studio
// sends it as a system message; the MCP server returns it from
// get_model_summary.

import type { C4Node } from '../c4'
import type { Metamodel } from '../metamodel'

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
      ...(fullDetail ? { properties: t.properties } : {}),
    }
  })
  const relations = Object.values(mm.relationTypes).map((r) => ({
    id: r.id,
    label: r.label,
    allowedPairs: r.allowedPairs,
    properties: r.properties,
  }))
  return [
    `Metamodel "${mm.name}". Use ONLY the node/relation types listed below; respect`,
    '`allowedParents` (empty ⇒ requires `allowedAtRoot: true` to be a root node),',
    '`cardinality.max`, and `allowedPairs`. Each type\'s `properties` array (where',
    'present) is the exact set of keys valid in that type\'s `properties` tool-call',
    'bag — key, label, type, and (for enums) the allowed `options`. A type with no',
    '`properties` array here still exists and can be created — its property schema',
    'was just omitted here as unlikely to be needed; call search_model or add_node',
    'without a `properties` bag if unsure (unknown keys are dropped with a note,',
    'not a hard failure).',
    '```json',
    JSON.stringify({ nodeTypes: types, relationTypes: relations }),
    '```',
  ].join('\n')
}
