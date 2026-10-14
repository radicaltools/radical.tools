// ─── radical check: the rule catalogue ───────────────────────────────────────
//
// Each rule reads one model and says what in it is wrong or missing. Rules
// that need a type the model's metamodel lacks (a C4-only model has no
// requirements) find nothing. The metamodel rule wraps validateModel, the same
// list Studio's Validation panel and the MCP server's get_issues show; the
// other rules are about completeness, which no editor can enforce while
// someone types (a requirement comes before its scenario).

import type { C4Node, C4Relation } from '../c4'
import { composeEarsSentence, requirementStatePhrase, validateModel, type Metamodel } from '../metamodel'

export type CheckSeverity = 'error' | 'warning'

/** One thing a rule found. `nodeId` or `relationId` point at the element. */
export interface RuleFinding {
  message: string
  nodeId?: string
  relationId?: string
  /** File in the model folder, when the finding is about a file. */
  path?: string
  /** Sub-rule, e.g. the validator's issue kind under `metamodel`. */
  code?: string
  /** Overrides the rule's severity (the validator rates each issue). */
  severity?: CheckSeverity
}

export interface CheckModel {
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  metamodel: Metamodel
}

export interface CheckRule {
  id: string
  /** What the rule wants, in one sentence, for `--list-rules` and docs. */
  description: string
  severity: CheckSeverity
  run(model: CheckModel): RuleFinding[]
}

type Props = Record<string, unknown>
const prop = (node: C4Node, key: string): string => {
  const value = (node as unknown as Props)[key]
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value)
}

/** Relations of `type` ending (in) or starting (out) at each node. */
function linked(model: CheckModel, type: string, end: 'in' | 'out'): Map<string, C4Relation[]> {
  const map = new Map<string, C4Relation[]>()
  for (const r of Object.values(model.relations)) {
    if (r.relationType !== type) continue
    const id = end === 'in' ? r.targetId : r.sourceId
    map.set(id, [...(map.get(id) ?? []), r])
  }
  return map
}

const nodesOf = (model: CheckModel, type: string): C4Node[] =>
  model.metamodel.nodeTypes[type] ? Object.values(model.nodes).filter((n) => n.type === type) : []

const hasRelationType = (model: CheckModel, type: string): boolean =>
  !!model.metamodel.relationTypes[type]

/** Nodes of `type` with no `relation` at the given end, from or to a node of
 *  one of `otherTypes` (any type when omitted). */
function unlinked(model: CheckModel, type: string, relation: string, end: 'in' | 'out', otherTypes?: string[]): C4Node[] {
  if (!hasRelationType(model, relation)) return []
  const map = linked(model, relation, end)
  return nodesOf(model, type).filter((n) => !(map.get(n.id) ?? []).some((r) => {
    const other = model.nodes[end === 'in' ? r.sourceId : r.targetId]
    return other && (!otherTypes || otherTypes.includes(other.type))
  }))
}

const quote = (n: C4Node): string => `"${n.label}"`

export const CHECK_RULES: CheckRule[] = [
  {
    id: 'metamodel',
    description: 'The model follows its metamodel: types, parents, relation pairs, required properties, references and the state machine rules. The Validation list in Studio and get_issues over MCP, with their severities: an unknown type or a relation to no element is an error, a relation pair the metamodel does not allow a warning (`"metamodel": "error"` makes every issue one).',
    severity: 'error',
    run: (model) => validateModel(model.nodes, model.relations, model.metamodel).map((issue) => ({
      message: issue.message,
      code: issue.id.split(':')[0],
      severity: issue.severity,
      ...(issue.nodeId ? { nodeId: issue.nodeId } : {}),
      ...(issue.relationId ? { relationId: issue.relationId } : {}),
    })),
  },
  {
    id: 'requirement-incomplete',
    description: 'A requirement has an action and every field its EARS type reads (an event-driven one a trigger, a state-driven one a precondition, …).',
    severity: 'warning',
    run: (model) => nodesOf(model, 'requirement')
      .filter((n) => !composeEarsSentence(n as unknown as Props, undefined, requirementStatePhrase(n, model.nodes, model.relations)).complete)
      .map((n) => ({ nodeId: n.id, message: `Requirement ${quote(n)} (${prop(n, 'ears_type') || 'ubiquitous'}) misses the action or a field its EARS type needs.` })),
  },
  {
    id: 'requirement-without-scenario',
    description: 'Every requirement is verified by at least one scenario.',
    severity: 'warning',
    run: (model) => model.metamodel.nodeTypes.scenario
      ? unlinked(model, 'requirement', 'verifies', 'in', ['scenario'])
        .map((n) => ({ nodeId: n.id, message: `No scenario verifies requirement ${quote(n)}.` }))
      : [],
  },
  {
    id: 'requirement-unsatisfied',
    description: 'Every requirement is satisfied by an element of the architecture.',
    severity: 'warning',
    run: (model) => unlinked(model, 'requirement', 'satisfies', 'in')
      .map((n) => ({ nodeId: n.id, message: `Nothing satisfies requirement ${quote(n)}.` })),
  },
  {
    id: 'requirement-without-origin',
    description: 'Every requirement derives from a need or from another requirement.',
    severity: 'warning',
    run: (model) => unlinked(model, 'requirement', 'derives', 'out', ['need', 'requirement'])
      .map((n) => ({ nodeId: n.id, message: `Requirement ${quote(n)} derives from no need and no other requirement.` })),
  },
  {
    id: 'need-without-requirement',
    description: 'Every need has at least one requirement derived from it.',
    severity: 'warning',
    run: (model) => unlinked(model, 'need', 'derives', 'in', ['requirement'])
      .map((n) => ({ nodeId: n.id, message: `No requirement derives from need ${quote(n)}.` })),
  },
  {
    id: 'scenario-verifies-nothing',
    description: 'Every scenario verifies a requirement or a state machine.',
    severity: 'warning',
    run: (model) => unlinked(model, 'scenario', 'verifies', 'out')
      .map((n) => ({ nodeId: n.id, message: `Scenario ${quote(n)} verifies no requirement and no state machine.` })),
  },
  {
    id: 'adr-without-fitness-fn',
    description: 'Every accepted ADR is implemented by a fitness function that checks it.',
    severity: 'warning',
    run: (model) => model.metamodel.nodeTypes['fitness-fn']
      ? unlinked(model, 'adr', 'implements', 'in', ['fitness-fn'])
        .filter((n) => prop(n, 'status') === 'accepted')
        .map((n) => ({ nodeId: n.id, message: `No fitness function implements accepted ADR ${quote(n)}.` }))
      : [],
  },
  {
    id: 'adr-incomplete',
    description: 'An accepted ADR records its date, context, decision and consequences.',
    severity: 'warning',
    run: (model) => nodesOf(model, 'adr')
      .filter((n) => prop(n, 'status') === 'accepted')
      .flatMap((n) => {
        const missing = ['date', 'context', 'decision', 'consequences'].filter((key) => !prop(n, key))
        return missing.length ? [{ nodeId: n.id, message: `Accepted ADR ${quote(n)} has no ${missing.join(', ')}.` }] : []
      }),
  },
  {
    id: 'adr-superseded-unlinked',
    description: 'An ADR is superseded exactly when a newer ADR supersedes it.',
    severity: 'warning',
    run: (model) => {
      if (!hasRelationType(model, 'supersedes')) return []
      const by = linked(model, 'supersedes', 'in')
      return nodesOf(model, 'adr').flatMap((n) => {
        const superseded = prop(n, 'status') === 'superseded'
        const hasSuccessor = (by.get(n.id) ?? []).length > 0
        if (superseded && !hasSuccessor) return [{ nodeId: n.id, message: `ADR ${quote(n)} is superseded, but no ADR supersedes it.` }]
        if (!superseded && hasSuccessor) return [{ nodeId: n.id, message: `ADR ${quote(n)} is superseded by another ADR, but its status is ${prop(n, 'status') || 'not set'}.` }]
        return []
      })
    },
  },
  {
    id: 'fitness-fn-unlinked',
    description: 'Every fitness function implements an ADR or constrains an element.',
    severity: 'warning',
    run: (model) => {
      const out = [...linked(model, 'implements', 'out').keys(), ...linked(model, 'constrains', 'out').keys()]
      const linkedIds = new Set(out)
      return nodesOf(model, 'fitness-fn').filter((n) => !linkedIds.has(n.id))
        .map((n) => ({ nodeId: n.id, message: `Fitness function ${quote(n)} implements no ADR and constrains no element.` }))
    },
  },
  {
    id: 'fitness-fn-without-threshold',
    description: 'Every fitness function states its threshold or success criteria.',
    severity: 'warning',
    run: (model) => nodesOf(model, 'fitness-fn').filter((n) => !prop(n, 'threshold'))
      .map((n) => ({ nodeId: n.id, message: `Fitness function ${quote(n)} states no threshold.` })),
  },
]
