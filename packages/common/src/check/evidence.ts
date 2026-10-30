// ─── radical check: evidence ─────────────────────────────────────────────────
//
// What the test reports and the measurements say about the model: each
// scenario and fitness function by the conditions in its `metrics`, and
// from them each requirement (by the scenarios that verify it) and each ADR
// (by the fitness functions that implement it). Studio and the MCP server
// can read it from a file beside the model; it never goes into the model's
// own files.

import type { C4Node } from '../c4'
import type { CheckModel } from './rules'
import { findTests, outcomeOf, type TestId, type TestStatus } from './reports'
import { evaluateMetric, parseCombine, parseConditions, parseMaxAge, type Combine, type Condition, type Measurement } from './metrics'

/** A test id's outcome; `not-found` when its file ran but no test has its
 *  title, `not-run` when no report has its file. */
export type TestOutcome = TestStatus | 'not-found' | 'not-run'

/** A condition's outcome: a test's, or a metric condition's (`stale` when
 *  the latest measurement is older than the element's max_age, `not-run`
 *  when nothing measured it, `invalid` when it cannot be evaluated). */
export type ConditionOutcome = TestOutcome | 'stale' | 'invalid'

/** A scenario's or fitness function's status. */
export type CheckedStatus = 'passed' | 'failed' | 'stale' | 'not-run' | 'no-checks'
/** A requirement's or ADR's status, from what checks it. */
export type VerifiedStatus = 'verified' | 'broken' | 'unverified'

export interface ConditionResult {
  /** The line as written. */
  condition: string
  /** For a test() condition: the test id it names. */
  test?: string
  outcome: ConditionOutcome
  /** For a metric condition: the measurement it was decided by. */
  measurement?: Measurement
  /** Why, when there is more to say: a unit that does not convert, an age. */
  detail?: string
}

export interface EvidenceEntry {
  type: string
  label: string
  status: CheckedStatus | VerifiedStatus
  /** For a scenario or fitness function: each test id and its outcome. */
  tests?: Array<{ id: string; outcome: TestOutcome }>
  /** For a scenario or fitness function: each condition and its outcome. */
  conditions?: ConditionResult[]
  /** For a requirement or ADR: the scenarios or fitness functions behind its status. */
  by?: string[]
}

export interface Evidence {
  version: 1
  /** Test cases read from the reports. */
  testCases: number
  /** Measurements read. */
  measurements?: number
  nodes: Record<string, EvidenceEntry>
}

/** Types whose `metrics` property states what checks them. */
export const TESTED_TYPES = ['scenario', 'fitness-fn'] as const

type Props = Record<string, unknown>
export const conditionsOf = (node: C4Node): Condition[] => parseConditions((node as unknown as Props).metrics)

/** The tests a node's test() conditions name. */
export const testIdsOf = (node: C4Node): TestId[] =>
  conditionsOf(node).flatMap((c) => c.kind === 'test' ? [c.id] : [])

const testOutcome = (id: TestId, model: CheckModel): TestOutcome => {
  const { fileSeen, matches } = findTests(id, model.tests ?? [])
  return matches.length ? outcomeOf(matches) : fileSeen ? 'not-found' : 'not-run'
}

/** Each test id of `node` with its outcome in the model's reports. */
export function testOutcomes(node: C4Node, model: CheckModel): Array<{ id: TestId; outcome: TestOutcome }> {
  return testIdsOf(node).map((id) => ({ id, outcome: testOutcome(id, model) }))
}

/** Each condition of `node` with its outcome, from the test reports and the
 *  measurements. A metric condition of an element whose max_age cannot be
 *  read is evaluated without one (metric-invalid reports the max_age). */
export function conditionResults(node: C4Node, model: CheckModel): ConditionResult[] {
  const maxAge = parseMaxAge((node as unknown as Props).max_age) ?? undefined
  const now = model.now ?? Date.now()
  return conditionsOf(node).map((c): ConditionResult => {
    if (c.kind === 'invalid') return { condition: c.raw, outcome: 'invalid', detail: c.problem }
    if (c.kind === 'test') return { condition: c.raw, test: c.id.raw, outcome: testOutcome(c.id, model) }
    const e = evaluateMetric(c, model.measurements ?? [], maxAge, now, model.baseline ?? [])
    return { condition: c.raw, outcome: e.outcome, ...(e.measurement ? { measurement: e.measurement } : {}), ...(e.detail ? { detail: e.detail } : {}) }
  })
}

const PASSED = (o: ConditionOutcome): boolean => o === 'passed'
const FAILING = (o: ConditionOutcome): boolean => o === 'failed' || o === 'not-found' || o === 'invalid'

/** An element's status from its conditions' outcomes, combined as its
 *  `combine` says (all when it cannot be read: metric-invalid reports it).
 *  With all, one failing condition fails it, a stale one keeps it from
 *  passing; with any, one passed condition passes it; with at least N, it
 *  fails once too few can still pass. A skipped or unmeasured condition is
 *  not run. */
export function checkedStatus(outcomes: Array<{ outcome: ConditionOutcome }>, combine: Combine = { kind: 'all' }): CheckedStatus {
  if (!outcomes.length) return 'no-checks'
  const list = outcomes.map((o) => o.outcome)
  const passed = list.filter(PASSED).length
  const failing = list.filter(FAILING).length
  const pending = (): CheckedStatus => list.includes('stale') ? 'stale' : 'not-run'
  if (combine.kind === 'any') return passed ? 'passed' : failing === list.length ? 'failed' : pending()
  const need = combine.kind === 'all' ? list.length : Math.min(combine.n, list.length)
  if (passed >= need) return 'passed'
  if (list.length - failing < need) return 'failed'
  return pending()
}

export const combineOf = (node: C4Node): Combine => parseCombine((node as unknown as Props).combine) ?? { kind: 'all' }

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
    const conditions = conditionResults(node, model)
    nodes[node.id] = {
      type: node.type,
      label: node.label,
      status: checkedStatus(conditions, combineOf(node)),
      tests: testOutcomes(node, model).map((o) => ({ id: o.id.raw, outcome: o.outcome })),
      conditions,
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
  return { version: 1, testCases: model.tests?.length ?? 0, ...(model.measurements ? { measurements: model.measurements.length } : {}), nodes }
}
