// ─── System prompt & context builders ───────────────────────────────────────
// The model now gets its capabilities from real tool schemas (ai/tools), not
// from prose describing a JSON shape — this file only supplies domain/policy
// guidance plus the live metamodel + diagram-state context messages.

import type { C4Node, C4Relation, DiagramView } from '../types/c4'
import type { Metamodel } from '../types/metamodel'
import type { ChatMessage } from './types'

const FALLBACK_TYPES = [
  'person', 'system', 'container', 'component', 'database', 'webapp', 'queue',
] as const

export const AI_SYSTEM_PROMPT = `You are a C4 architecture diagram editor embedded in the Radical Diagram tool.

Use the provided tools to inspect and change the diagram. Call search_model when you need exact data from the live model before answering or acting — it is free to interleave with mutating tool calls in the same turn. When you have enough information, reply with a short final answer and make NO further tool calls — that ends the turn.

Rules:
- Keep labels short (1–4 words). Put detail in \`description\`.
- STRICTLY follow the metamodel rules in the context block below: a node/relation that violates allowedParents/allowedAtRoot/cardinality/allowedPairs will be rejected. Call search_model or re-read the metamodel context if unsure.
- Views are FILTERS over the model graph: a view only stores which nodes are visible. Relations whose both endpoints are visible are shown automatically.
- When decomposing a requirement into sub-requirements, create each child with add_node (type "requirement") and a \`properties\` bag setting \`ears_type\` plus the fields it implies (trigger/precondition/unwanted_condition/feature/action/rationale — see the metamodel context for the exact set), then link child → parent with add_relation using relationType "derives".
- Pick a view's \`kind\` deliberately: "table" for governance record types (ADR/Fitness Function/Requirement), "treemap" for hierarchy overviews, "wiki" for docs, "matrix" for relation grids, "static" otherwise.
- Cannot change the layout, themes, or the metamodel itself. If asked for any of those, say so in your final answer and make no tool calls.
- reset_diagram erases EVERYTHING. Use ONLY when explicitly asked to start from scratch or replace the whole model, and call it before any other tool in the same task.`.trim()

/** Build a compact, machine-readable summary of the metamodel rules —
 *  including each type's custom `properties`, which is how the model learns
 *  what keys are valid in add_node/add_relation's `properties` bag. */
export function buildMetamodelMessage(mm: Metamodel | undefined): string {
  if (!mm) {
    return [
      'Metamodel: (none loaded — falling back to default C4 types)',
      'Allowed node types: ' + FALLBACK_TYPES.map(t => `"${t}"`).join(', '),
    ].join('\n')
  }
  const types = Object.values(mm.nodeTypes).map((t) => {
    // Mirror the same defaulting that diagramStore uses: when allowedParents is
    // empty/undefined the type is allowed at the root unless explicitly false.
    const allowedParents = t.allowedParents && t.allowedParents.length > 0 ? t.allowedParents : []
    const rootDefault = allowedParents.length === 0
    const atRoot = t.allowedAtRoot ?? rootDefault
    return {
      id: t.id,
      label: t.label,
      allowedParents,
      allowedAtRoot: atRoot,
      cardinality: t.cardinality,
      properties: t.properties,
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
    '`cardinality.max`, and `allowedPairs`. Each type\'s `properties` array is the',
    'exact set of keys valid in that type\'s `properties` tool-call bag — key,',
    'label, type, and (for enums) the allowed `options`.',
    '```json',
    JSON.stringify({ nodeTypes: types, relationTypes: relations }, null, 2),
    '```',
  ].join('\n')
}

const LAYOUT_ONLY_NODE_KEYS = new Set(['collapsed', 'x', 'y', 'width', 'height'])

function serializeNode(n: C4Node): Record<string, unknown> {
  const out: Record<string, unknown> = { id: n.id, type: n.type, label: n.label, parentId: n.parentId ?? null }
  for (const [key, val] of Object.entries(n as unknown as Record<string, unknown>)) {
    if (key in out || LAYOUT_ONLY_NODE_KEYS.has(key)) continue
    if (val === undefined || val === '') continue
    out[key] = val
  }
  return out
}

function serializeRelation(r: C4Relation): Record<string, unknown> {
  const out: Record<string, unknown> = { id: r.id, sourceId: r.sourceId, targetId: r.targetId }
  for (const [key, val] of Object.entries(r as unknown as Record<string, unknown>)) {
    if (key in out) continue
    if (val === undefined || val === '') continue
    out[key] = val
  }
  return out
}

export function buildContextMessage(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  activeView?: { id: string; name: string; nodeIds: string[] } | null,
  views?: Record<string, DiagramView>,
): string {
  const ns = Object.values(nodes).map(serializeNode)
  const rs = Object.values(relations).map(serializeRelation)
  const vs = views
    ? Object.values(views).map((v) => ({
        id: v.id,
        name: v.name,
        kind: v.kind ?? 'static',
        nodeIds: v.nodeIds,
      }))
    : []
  const lines = [
    'Current diagram state (use these ids when referring to existing elements;',
    'any field beyond id/type/label/parentId is a custom or governance property):',
    '```json',
    JSON.stringify({ nodes: ns, relations: rs, views: vs }, null, 2),
    '```',
  ]
  if (activeView) {
    lines.push(
      `Active view: "${activeView.name}" (id=${activeView.id}). New nodes will`,
      'be auto-added to this view.',
    )
  } else {
    lines.push('Active view: (none) — new nodes will live in the model only.')
  }
  return lines.join('\n')
}

/** The system-role messages for one round — rebuilt fresh every round so the
 *  model always sees the latest state (including whatever its own previous
 *  tool calls this run just changed). */
export function buildSystemMessages(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  metamodel: Metamodel | undefined,
  activeView?: { id: string; name: string; nodeIds: string[] } | null,
  views?: Record<string, DiagramView>,
): ChatMessage[] {
  return [
    { role: 'system', content: AI_SYSTEM_PROMPT },
    { role: 'system', content: buildMetamodelMessage(metamodel) },
    { role: 'system', content: buildContextMessage(nodes, relations, activeView, views) },
  ]
}
