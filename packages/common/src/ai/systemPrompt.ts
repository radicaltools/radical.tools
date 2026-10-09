// ─── AI system prompt & diagram context ─────────────────────────────────────
// The model gets its capabilities from real tool schemas (./tools), not from
// prose describing a JSON shape — this file only supplies domain/policy
// guidance plus the live diagram-state context message. Studio's chat and
// Radical Forge send AI_SYSTEM_PROMPT as their system prompt; the MCP server's
// Forge stage briefs carry AI_MODELLING_RULES and the context message.

import type { C4Node, C4Relation, DiagramView } from '../c4'

/** How every AI that edits a model through the tool catalogue should model,
 *  whichever host it runs in. */
export const AI_MODELLING_RULES: readonly string[] = [
  'Keep labels short (1–4 words). Put detail in `description`.',
  'STRICTLY follow the metamodel rules in the context block below: a node/relation that violates allowedParents/allowedAtRoot/cardinality/allowedPairs will be rejected. Call search_model or re-read the metamodel context if unsure.',
  'Views are FILTERS over the model graph: a view only stores which nodes are visible. Relations whose both endpoints are visible are shown automatically.',
  'When decomposing a requirement into sub-requirements, create each child with add_node (type "requirement") and a `properties` bag setting `ears_type` plus the fields it implies (trigger/precondition/unwanted_condition/feature/action/rationale — see the metamodel context for the exact set), then link child → parent with add_relation using relationType "derives".',
  'A `need` node holds raw free-text input (a brief, user story, notes, raw requirements) in its `description`. Never rewrite it into EARS in place: when asked to turn a need into requirements, create new `requirement` nodes and link each requirement → need with relationType "derives".',
  'A `state-machine` models the lifecycle of one entity, with SCXML semantics. Put `state` nodes inside it (parentId); a state with child states is compound, kind "parallel" makes its child states regions that are active at once, kind "final" ends the machine or its parent state. Give the machine and every compound state that is not parallel one `pseudostate` of kind "initial" with a single transition to its default child. Add the `event` nodes first, then connect states with relationType "transition", whose `properties` hold `event` (the trigger: the event node\'s id or tempId), an optional `guard`, `actions`, and `raises` (an array of the event ids it publishes). A state that publishes an event links to it with "emits" (property `on`: entry, exit or do). A machine is the lifecycle of one domain `entity` (Reservation, Order): link machine → entity with "lifecycle-of" (one machine per entity). The C4 elements that run it link to the machine with "implements", and the one that owns the entity\'s data links to the entity with "realises". A state-driven requirement ("While …") whose precondition is a state of a machine points at it with `precondition_state` (the state\'s id).',
]

/** Rules for Studio's embedded assistant only: its tools include the canvas,
 *  the metamodel and reset_diagram. */
const STUDIO_RULES: readonly string[] = [
  'Pick a view\'s `kind` deliberately: "table" for governance record types (ADR/Fitness Function/Requirement), "treemap" for hierarchy overviews, "wiki" for docs, "matrix" for relation grids, "dynamic" to play a sequence (create_sequence first: an ordered list of existing relations), "static" otherwise.',
  'Use smart_layout only when asked to arrange or tidy the diagram, or after adding many nodes. Change the metamodel (upsert_/delete_ node and relation types) only when the user asks for new or different element types, fields or relation types; it is not offered in every context. Cannot change themes — if asked, say so in your final answer and make no tool calls.',
  'reset_diagram erases EVERYTHING. Use ONLY when explicitly asked to start from scratch or replace the whole model, and call it before any other tool in the same task.',
]

const AI_INTRO = `You are a C4 architecture diagram editor embedded in the Radical Diagram tool.

Use the provided tools to inspect and change the diagram. Call search_model when you need exact data from the live model before answering or acting — it is free to interleave with mutating tool calls in the same turn. When you have enough information, reply with a short final answer and make NO further tool calls — that ends the turn.`

export const AI_SYSTEM_PROMPT = `${AI_INTRO}

Rules:
${[...AI_MODELLING_RULES, ...STUDIO_RULES].map((rule) => `- ${rule}`).join('\n')}`.trim()

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
    JSON.stringify({ nodes: ns, relations: rs, views: vs }),
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

