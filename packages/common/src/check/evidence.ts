// ─── radical check: evidence ─────────────────────────────────────────────────
//
// What the test reports say about the model: each scenario and fitness
// function by the tests it names, and from them each requirement (by the
// scenarios that verify it) and each ADR (by the fitness functions that
// implement it). Studio and the MCP server can read it from a file beside
// the model; it never goes into the model's own files.

import type { C4Node } from '../c4'
import type { CheckModel } from './rules'
import { findTests, outcomeOf, parseTestIds, type TestId, type TestStatus } from './reports'

/** A test id's outcome; `not-found` when its file ran but no test has its
 *  title, `not-run` when no report has its file. */
export type TestOutcome = TestStatus | 'not-found' | 'not-run'

/** A scenario's or fitness function's status. */
export type CheckedStatus = 'passed' | 'failed' | 'not-run' | 'no-tests'
/** A requirement's or ADR's status, from what checks it. */
export type VerifiedStatus = 'verified' | 'broken' | 'unverified'

export interface EvidenceEntry {
  type: string
  label: string
  status: CheckedStatus | VerifiedStatus
  /** For a scenario or fitness function: each test id and its outcome. */
  tests?: Array<{ id: string; outcome: TestOutcome }>
  /** For a requirement or ADR: the scenarios or fitness functions behind its status. */
  by?: string[]
}

export interface Evidence {
  version: 1
  /** Test cases read from the reports. */
  testCases: number
  nodes: Record<string, EvidenceEntry>
}

/** Types whose `tests` property names tests. */
export const TESTED_TYPES = ['scenario', 'fitness-fn'] as const

export const testIdsOf = (node: C4Node): TestId[] => parseTestIds((node as unknown as Record<string, unknown>).tests)

/** Each test id of `node` with its outcome in the model's reports. */
export function testOutcomes(node: C4Node, model: CheckModel): Array<{ id: TestId; outcome: TestOutcome }> {
  const cases = model.tests ?? []
  return testIdsOf(node).map((id) => {
    const { fileSeen, matches } = findTests(id, cases)
    return { id, outcome: matches.length ? outcomeOf(matches) : fileSeen ? 'not-found' : 'not-run' }
  })
}

export function checkedStatus(outcomes: Array<{ outcome: TestOutcome }>): CheckedStatus {
  if (!outcomes.length) return 'no-tests'
  if (outcomes.some((o) => o.outcome === 'failed' || o.outcome === 'not-found')) return 'failed'
  if (outcomes.every((o) => o.outcome === 'passed')) return 'passed'
  return 'not-run'
}

/** The nodes of `type` that the relation `relationType` links to `id`, from
 *  their side (`from`: source of the relation). */
export function linkedNodes(model: CheckModel, id: string, relationType: string, end: 'source' | 'target', type?: string): C4Node[] {
  return Object.values(model.relations)
    .filter((r) => r.relationType === relationType && (end === 'source' ? r.targetId : r.sourceId) === id)
    .map((r) => model.nodes[end === 'source' ? r.sourceId : r.targetId])
    .filter((n): n is C4Node => !!n && (!type || n.type === type))
}

export function computeEvidence(model: CheckModel): Evidence {
  const nodes: Record<string, EvidenceEntry> = {}
  for (const node of Object.values(model.nodes)) {
    if (!(TESTED_TYPES as readonly string[]).includes(node.type)) continue
    const outcomes = testOutcomes(node, model)
    nodes[node.id] = {
      type: node.type,
      label: node.label,
      status: checkedStatus(outcomes),
      tests: outcomes.map((o) => ({ id: o.id.raw, outcome: o.outcome })),
    }
  }
  const verified = (node: C4Node, checkers: C4Node[]): void => {
    const statuses = checkers.map((c) => nodes[c.id]?.status)
    nodes[node.id] = {
      type: node.type,
      label: node.label,
      status: statuses.includes('failed') ? 'broken'
        : statuses.length && statuses.every((s) => s === 'passed') ? 'verified' : 'unverified',
      by: checkers.map((c) => c.id),
    }
  }
  for (const node of Object.values(model.nodes)) {
    if (node.type === 'requirement') verified(node, linkedNodes(model, node.id, 'verifies', 'source', 'scenario'))
    else if (node.type === 'adr') verified(node, linkedNodes(model, node.id, 'implements', 'source', 'fitness-fn'))
  }
  return { version: 1, testCases: model.tests?.length ?? 0, nodes }
}
