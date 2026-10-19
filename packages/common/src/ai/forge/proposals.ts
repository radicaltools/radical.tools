// ─── A Radical Forge stage asks before it refines an earlier stage ──────────
// A stage that finds what an earlier stage left out or got wrong does not
// write it: it proposes it, and the user decides there and then (ADR Forge
// asks before each refinement). A proposal is what the stage found and the
// exact changes, as calls of the catalogue's own tools, so what the user is
// shown (describeProposal) is what is written (applyProposal), whole or not
// at all. Studio's AI gets the propose_refinement tool and pauses the stage on
// it; over MCP the agent calls forge_propose_refinement, asks the user in its
// chat and brings the answer with forge_answer_refinement.
//
// refinementGuard makes the rule hold whatever the AI does: while a stage
// runs, a direct write to an earlier stage is refused with a pointer to the
// proposal tool. The stage's own elements, and links from them to earlier
// ones, are written as usual.

import type { C4Node, C4Relation } from '../../c4'
import { runTool, type ToolDef, type ToolRunContext } from '../tools'
import { PRIMARY_TYPE_IDS_FOR_STAGE, type ForgeStageId } from './prompts'
import { rejectRefinements, snapshotOf, stageRefinements, type ForgeRefinement, type ModelSnapshot } from './refinements'

/** The tools a proposal may call: additions and corrections, no deletions. */
export const PROPOSAL_TOOLS = ['add_node', 'add_relation', 'update_node', 'update_relation', 'move_node'] as const
export type ProposalTool = (typeof PROPOSAL_TOOLS)[number]

export interface ProposedChange {
  tool: ProposalTool
  /** What that tool takes. */
  input: Record<string, unknown>
}

export interface ForgeProposal {
  /** What the stage found, in a sentence or two. */
  reason: string
  changes: ProposedChange[]
}

/** The name of Studio's proposal tool; over MCP it is forge_propose_refinement. */
export const PROPOSE_REFINEMENT = 'propose_refinement'

const PROPOSAL_PROPERTIES = {
  reason: { type: 'string', description: 'What this stage found that an earlier stage lacks or got wrong, and why the change follows from the description, in 1-2 sentences. The user reads it.' },
  changes: {
    type: 'array',
    description: 'Every change the finding needs, in order, as calls of the model tools: the element with its fields and links (a requirement with its derives link and the scenario that verifies it), or the update of the element that is wrong. An add_node needs a tempId, which later changes and later calls can use.',
    items: {
      type: 'object',
      properties: {
        tool: { type: 'string', enum: [...PROPOSAL_TOOLS] },
        input: { type: 'object', description: 'Exactly what that tool takes.', additionalProperties: true },
      },
      required: ['tool', 'input'],
      additionalProperties: false,
    },
  },
}

/** Studio's proposal tool, offered to the AI running a stage. */
export const PROPOSE_REFINEMENT_TOOL: ToolDef = {
  name: PROPOSE_REFINEMENT,
  description: 'Propose adding to or correcting what an earlier Forge stage made: the stage pauses, the user sees exactly these changes and adds them or not, and may reply. Applied whole, only if the user adds it. One finding per proposal. Never for this stage\'s own elements.',
  inputSchema: { type: 'object', properties: PROPOSAL_PROPERTIES, required: ['reason', 'changes'], additionalProperties: false },
}

/** The proposal's input schema properties, for the MCP tool. */
export const PROPOSAL_INPUT_PROPERTIES = PROPOSAL_PROPERTIES

/** The proposal in a tool call's input, or what is wrong with it. */
export function parseProposal(raw: unknown): ForgeProposal | string {
  const input = (raw ?? {}) as { reason?: unknown; changes?: unknown }
  if (typeof input.reason !== 'string' || !input.reason.trim()) return 'reason is required: say what you found'
  if (!Array.isArray(input.changes) || !input.changes.length) return 'changes must list at least one change'
  const changes: ProposedChange[] = []
  for (const [i, item] of input.changes.entries()) {
    const { tool, input: args } = (item ?? {}) as { tool?: unknown; input?: unknown }
    if (typeof tool !== 'string' || !(PROPOSAL_TOOLS as readonly string[]).includes(tool)) {
      return `change ${i + 1}: tool must be one of ${PROPOSAL_TOOLS.join(', ')} (a Forge stage never deletes)`
    }
    if (!args || typeof args !== 'object' || Array.isArray(args)) return `change ${i + 1}: input must be an object`
    changes.push({ tool: tool as ProposalTool, input: args as Record<string, unknown> })
  }
  return { reason: input.reason.trim(), changes }
}

// ─── What the user is shown ─────────────────────────────────────────────────

/** One change as the user reads it: a line, and its fields below it. */
export interface ProposalLine {
  change: 'add' | 'link' | 'change' | 'move'
  text: string
  details: string[]
}

const show = (value: unknown): string => {
  if (value === undefined || value === null || value === '') return '(empty)'
  if (typeof value === 'string') return `"${value}"`
  return JSON.stringify(value)
}

/** Field values a tool call sets: its top-level fields and its properties. */
function fieldsOf(input: Record<string, unknown>, skip: string[]): [string, unknown][] {
  const top = Object.entries(input).filter(([k, v]) => !skip.includes(k) && k !== 'properties' && v !== undefined)
  const props = input.properties && typeof input.properties === 'object' ? Object.entries(input.properties as Record<string, unknown>) : []
  return [...top, ...props]
}

/** The changes of `proposal`, each with every field it writes; an update
 *  with the old value beside the new one. Ids are given as labels: a tempId
 *  of the proposal or of the run, or a node in the model. */
export function describeProposal(
  proposal: ForgeProposal,
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  resolveId: (id: string) => string = (id) => id,
): ProposalLine[] {
  const proposed = new Map<string, { type: string; label: string }>()
  for (const { tool, input } of proposal.changes) {
    if (tool === 'add_node' && typeof input.tempId === 'string') proposed.set(input.tempId, { type: String(input.type ?? 'node'), label: String(input.label ?? '') })
  }
  const nodeOf = (id: unknown): { type: string; label: string } | undefined => {
    if (typeof id !== 'string') return undefined
    return proposed.get(id) ?? nodes[resolveId(id)]
  }
  const name = (id: unknown): string => {
    const n = nodeOf(id)
    return n ? `${n.type} "${n.label}"` : `unknown node ${show(id)}`
  }
  return proposal.changes.map(({ tool, input }): ProposalLine => {
    switch (tool) {
      case 'add_node': {
        const parent = input.parentId ? ` in ${name(input.parentId)}` : ''
        return {
          change: 'add',
          text: `Add ${String(input.type ?? 'node')} "${String(input.label ?? '')}"${parent}`,
          details: fieldsOf(input, ['tempId', 'type', 'label', 'parentId']).map(([k, v]) => `${k}: ${show(v)}`),
        }
      }
      case 'add_relation':
        return {
          change: 'link',
          text: `Link ${name(input.sourceId)} → ${name(input.targetId)} (${String(input.relationType ?? 'relation')})`,
          details: fieldsOf(input, ['sourceId', 'targetId', 'relationType']).map(([k, v]) => `${k}: ${show(v)}`),
        }
      case 'update_node': {
        const old = nodes[resolveId(String(input.id ?? ''))] as unknown as Record<string, unknown> | undefined
        return {
          change: 'change',
          text: `Change ${name(input.id)}`,
          details: fieldsOf(input, ['id']).map(([k, v]) => `${k}: ${show(old?.[k])} → ${show(v)}`),
        }
      }
      case 'update_relation': {
        const old = relations[resolveId(String(input.id ?? ''))] as unknown as Record<string, unknown> | undefined
        const what = old ? `${name(old.sourceId)} → ${name(old.targetId)} (${String(old.relationType ?? 'relation')})` : `unknown relation ${show(input.id)}`
        return {
          change: 'change',
          text: `Change the link ${what}`,
          details: fieldsOf(input, ['id']).map(([k, v]) => `${k}: ${show(old?.[k])} → ${show(v)}`),
        }
      }
      case 'move_node':
        return {
          change: 'move',
          text: `Move ${name(input.id)} ${input.parentId ? `into ${name(input.parentId)}` : 'to the root'}`,
          details: [],
        }
    }
  })
}

/** The proposal as text, for the MCP server's answers and the AI's tool results. */
export function formatProposal(proposal: ForgeProposal, lines: ProposalLine[]): string {
  return [
    `Found: ${proposal.reason}`,
    ...lines.flatMap((l, i) => [`${i + 1}. ${l.text}`, ...l.details.map((d) => `   ${d}`)]),
  ].join('\n')
}

// ─── Applying it ────────────────────────────────────────────────────────────

export type ProposalOutcome =
  | { ok: true; text: string; refinements: ForgeRefinement[]; added: string[] }
  | { ok: false; text: string }

/** Writes every change of `proposal` in order with the catalogue's tools, or
 *  none: when one fails the model is put back as it was. The refinements are
 *  what it wrote, as stageRefinements lists them; `added` the ids of every
 *  node and relation it added, for the guard. */
export async function applyProposal(proposal: ForgeProposal, ctx: ToolRunContext): Promise<ProposalOutcome> {
  const before = snapshotOf(ctx.diagram)
  const results: string[] = []
  for (const [i, { tool, input }] of proposal.changes.entries()) {
    const result = await runTool(tool, input, ctx)
    if (!result.ok) {
      // Everything counts as a refinement for the Review stage, which makes no types of its own.
      rejectRefinements(ctx.diagram, stageRefinements('review', before, snapshotOf(ctx.diagram)))
      return { ok: false, text: `Change ${i + 1} (${tool}) failed, so nothing was written: ${result.resultText}` }
    }
    results.push(result.resultText)
  }
  const after = snapshotOf(ctx.diagram)
  const added = [
    ...Object.keys(after.nodes).filter((id) => !before.nodes[id]),
    ...Object.keys(after.relations).filter((id) => !before.relations[id]),
  ]
  return { ok: true, text: results.join(' '), refinements: stageRefinements('review', before, after), added }
}

// ─── The guard ──────────────────────────────────────────────────────────────

/** What a running stage may not write without asking: the model as it was
 *  when the stage began, and what its accepted proposals added since. */
export interface RefinementGuardState {
  stage: ForgeStageId
  before: ModelSnapshot
  /** Ids of the nodes and relations accepted proposals added. */
  proposed: Set<string>
}

/** Why the stage may not make this tool call itself, or null when it may.
 *  `proposeTool` is the tool the message points to. */
export function refinementGuard(
  state: RefinementGuardState,
  name: string,
  rawInput: unknown,
  resolveId: (id: string) => string,
  proposeTool: string = PROPOSE_REFINEMENT,
): string | null {
  const input = (rawInput ?? {}) as Record<string, unknown>
  // An element a proposal added is named by its id: the guard keeps no copy of it.
  const earlierNode = (id: unknown): { label: string } | undefined => {
    if (typeof id !== 'string') return undefined
    const real = resolveId(id)
    return state.before.nodes[real] ?? (state.proposed.has(real) ? { label: real } : undefined)
  }
  const earlierRelation = (id: unknown): boolean => typeof id === 'string' && (!!state.before.relations[resolveId(id)] || state.proposed.has(resolveId(id)))
  const ask = `Propose it with ${proposeTool} instead: the user decides.`
  switch (name) {
    case 'reset_diagram':
      return 'reset_diagram: a Forge stage never clears the model.'
    case 'add_node': {
      const own = PRIMARY_TYPE_IDS_FOR_STAGE[state.stage]
      if (typeof input.type === 'string' && !own.includes(input.type)) {
        return `add_node: a ${input.type} belongs to an earlier stage, not to this one (${own.join(', ') || 'none of its own'}). ${ask}`
      }
      return null
    }
    case 'update_node':
    case 'move_node': {
      const node = earlierNode(input.id)
      return node ? `${name}: "${node.label}" belongs to an earlier stage. ${ask}` : null
    }
    case 'delete_node': {
      const node = earlierNode(input.id)
      return node ? `delete_node: "${node.label}" belongs to an earlier stage, and a Forge stage never deletes one.` : null
    }
    case 'add_relation':
      return earlierNode(input.sourceId) && earlierNode(input.targetId)
        ? `add_relation: both ends belong to earlier stages. ${ask}`
        : null
    case 'update_relation':
      return earlierRelation(input.id) ? `update_relation: the link belongs to an earlier stage. ${ask}` : null
    case 'delete_relation':
      return earlierRelation(input.id) ? 'delete_relation: the link belongs to an earlier stage, and a Forge stage never deletes one.' : null
    default:
      return null
  }
}
