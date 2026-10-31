// ─── radical check: goals ────────────────────────────────────────────────────
//
// What share of the model meets what the rules ask (requirements with a
// scenario, accepted ADRs a fitness function implements, …) and, with test
// reports, what share the tests verify. Each share is a metric; check.json
// can set a goal for it in percent (`"goals": { "requirements-verified":
// { "min": 80 } }`). A metric below its goal is a finding of the rule
// `goal-unmet`, an error unless the config says otherwise. The Inspector
// groups the metrics and the rules by dimension: four about the model
// itself, three about how the implementation follows it.

import type { C4Node } from '../c4'
import type { Evidence } from './evidence'
import { nodesOf, prop, testBinding, type CheckModel, type CheckSeverity, type RuleFinding } from './rules'

export type CheckDimension = 'consistency' | 'completeness' | 'traceability' | 'decisions' | 'behaviour' | 'fitness' | 'tests'
/** The model on its own, or the implementation against it (by the tests). */
export type CheckPerspective = 'model' | 'implementation'

export const CHECK_DIMENSIONS: ReadonlyArray<{ id: CheckDimension; label: string; perspective: CheckPerspective; description: string }> = [
  { id: 'consistency', label: 'Consistency', perspective: 'model', description: 'The model follows its metamodel, and its views, sequences and slides point only at what it has.' },
  { id: 'completeness', label: 'Completeness', perspective: 'model', description: 'Each record says all it has to: a requirement its whole EARS sentence, an accepted ADR its context, decision and consequences, a fitness function its threshold.' },
  { id: 'traceability', label: 'Traceability', perspective: 'model', description: 'Each need leads to requirements, each requirement to what satisfies it and the scenarios that verify it, each scenario to its tests.' },
  { id: 'decisions', label: 'Decisions', perspective: 'model', description: 'Each accepted ADR has a fitness function that checks it, and each fitness function names its checks.' },
  { id: 'behaviour', label: 'Behaviour', perspective: 'implementation', description: 'Requirements verified by scenarios whose functional tests passed.' },
  { id: 'fitness', label: 'Decisions', perspective: 'implementation', description: 'ADRs verified by fitness functions whose checks passed.' },
  { id: 'tests', label: 'Tests', perspective: 'implementation', description: 'The tests the model names passed, and the tests a project includes are named by the model.' },
]

/** The rule a goal below its minimum is a finding of. */
export const GOAL_RULE = {
  id: 'goal-unmet',
  description: 'Every metric check.json sets a goal for ("goals": { "<metric>": { "min": <percent> } }) reaches it. One finding per goal, with the metric as its code.',
  severity: 'error' as CheckSeverity,
}

export interface GoalSetting {
  /** The least share, in percent (0–100). */
  min: number
}

interface MeasureContext {
  model: CheckModel
  found: Array<RuleFinding & { rule: string }>
  evidence?: Evidence
}

export interface CheckMetric {
  id: string
  label: string
  description: string
  dimension: CheckDimension
  /** The rule whose findings mark the elements that miss it, when one does. */
  rule?: string
  /** Measured only with test reports or measurements. */
  tests?: boolean
  /** How many of how many meet it; null when the model has nothing to count. */
  measure(ctx: MeasureContext): { count: number; total: number } | null
}

export interface CheckMetricResult {
  id: string
  label: string
  dimension: CheckDimension
  rule?: string
  count: number
  total: number
  /** count / total in whole percent, rounded down: 84.9% shows as 84. */
  percent: number
  /** The goal check.json sets, in percent. */
  min?: number
  /** False only when a goal is set and the share is below it. */
  met: boolean
}

/** The nodes in `population` that no finding of `rule` points at. */
const without = (rule: string) => (population: C4Node[]) => (ctx: MeasureContext): { count: number; total: number } | null => {
  if (!population.length) return null
  const missing = new Set(ctx.found.filter((f) => f.rule === rule && f.nodeId).map((f) => f.nodeId))
  return { count: population.filter((n) => !missing.has(n.id)).length, total: population.length }
}

/** The nodes in `population` whose evidence has one of `statuses`. */
const withStatus = (population: C4Node[], statuses: string[], ctx: MeasureContext): { count: number; total: number } | null => {
  if (!ctx.evidence || !population.length) return null
  return { count: population.filter((n) => statuses.includes(ctx.evidence!.nodes[n.id]?.status ?? '')).length, total: population.length }
}

const acceptedAdrs = (model: CheckModel): C4Node[] => nodesOf(model, 'adr').filter((n) => prop(n, 'status') === 'accepted')
const hasType = (model: CheckModel, type: string): boolean => !!model.metamodel.nodeTypes[type]

/** A metric over the nodes of `type` that a rule's findings say miss it. */
const byRule = (id: string, label: string, description: string, dimension: CheckDimension, rule: string, population: (model: CheckModel) => C4Node[] | null): CheckMetric => ({
  id, label, description, dimension, rule,
  measure: (ctx) => {
    const nodes = population(ctx.model)
    return nodes ? without(rule)(nodes)(ctx) : null
  },
})

export const CHECK_METRICS: CheckMetric[] = [
  byRule('elements-valid', 'Elements the metamodel allows', 'Elements no metamodel issue points at.', 'consistency', 'metamodel', (m) => Object.values(m.nodes)),
  byRule('requirements-complete', 'Complete requirements', 'Requirements with an action and every field their EARS type reads.', 'completeness', 'requirement-incomplete', (m) => nodesOf(m, 'requirement')),
  byRule('adrs-complete', 'Complete accepted ADRs', 'Accepted ADRs with a date, context, decision and consequences.', 'completeness', 'adr-incomplete', acceptedAdrs),
  byRule('needs-with-requirement', 'Needs with a requirement', 'Needs at least one requirement derives from.', 'traceability', 'need-without-requirement', (m) => nodesOf(m, 'need')),
  byRule('requirements-with-origin', 'Requirements with an origin', 'Requirements that derive from a need or another requirement.', 'traceability', 'requirement-without-origin', (m) => nodesOf(m, 'requirement')),
  byRule('requirements-satisfied', 'Requirements satisfied', 'Requirements an element of the architecture satisfies.', 'traceability', 'requirement-unsatisfied', (m) => nodesOf(m, 'requirement')),
  byRule('requirements-with-scenario', 'Requirements with a scenario', 'Requirements at least one scenario verifies.', 'traceability', 'requirement-without-scenario', (m) => hasType(m, 'scenario') ? nodesOf(m, 'requirement') : null),
  byRule('scenarios-verifying', 'Scenarios that verify something', 'Scenarios that verify a requirement or a state machine.', 'traceability', 'scenario-verifies-nothing', (m) => nodesOf(m, 'scenario')),
  byRule('scenarios-with-metrics', 'Scenarios that name a check', 'Scenarios whose Metrics property states the tests or measured values that check them.', 'traceability', 'scenario-without-metrics', (m) => nodesOf(m, 'scenario')),
  byRule('adrs-with-fitness-fn', 'Accepted ADRs with a fitness function', 'Accepted ADRs a fitness function implements.', 'decisions', 'adr-without-fitness-fn', (m) => hasType(m, 'fitness-fn') ? acceptedAdrs(m) : null),
  byRule('fitness-fns-linked', 'Fitness functions linked', 'Fitness functions that implement an ADR or constrain an element.', 'decisions', 'fitness-fn-unlinked', (m) => nodesOf(m, 'fitness-fn')),
  byRule('fitness-fns-with-metrics', 'Fitness functions that name a check', 'Fitness functions whose Metrics property states the tests or measured values that check them.', 'decisions', 'fitness-fn-without-metrics', (m) => nodesOf(m, 'fitness-fn')),
  {
    id: 'requirements-verified', label: 'Requirements verified', dimension: 'behaviour', tests: true,
    description: 'Requirements whose scenarios all passed their checks.',
    measure: (ctx) => withStatus(nodesOf(ctx.model, 'requirement'), ['verified'], ctx),
  },
  {
    id: 'scenarios-passing', label: 'Scenarios passing', dimension: 'behaviour', tests: true,
    description: 'Scenarios whose checks passed.',
    measure: (ctx) => withStatus(nodesOf(ctx.model, 'scenario'), ['passed'], ctx),
  },
  {
    id: 'adrs-verified', label: 'Accepted ADRs verified', dimension: 'fitness', tests: true,
    description: 'Accepted ADRs whose fitness functions all passed their checks.',
    measure: (ctx) => withStatus(acceptedAdrs(ctx.model), ['verified'], ctx),
  },
  {
    id: 'fitness-fns-passing', label: 'Fitness functions passing', dimension: 'fitness', tests: true,
    description: 'Fitness functions whose checks passed.',
    measure: (ctx) => withStatus(nodesOf(ctx.model, 'fitness-fn'), ['passed'], ctx),
  },
  {
    id: 'named-tests-passing', label: 'Named tests passing', dimension: 'tests', tests: true,
    description: 'The tests scenarios and fitness functions name that passed.',
    measure: (ctx) => {
      if (!ctx.evidence) return null
      const outcomes = Object.values(ctx.evidence.nodes).flatMap((e) => e.tests ?? [])
      return outcomes.length ? { count: outcomes.filter((t) => t.outcome === 'passed').length, total: outcomes.length } : null
    },
  },
  {
    id: 'tests-bound', label: 'Tests the model names', dimension: 'tests', tests: true, rule: 'test-unbound',
    description: 'The tests in the files test-unbound includes that a scenario or fitness function names.',
    measure: (ctx) => {
      const files = [...testBinding(ctx.model)?.values() ?? []]
      const total = files.reduce((sum, f) => sum + f.total, 0)
      return total ? { count: total - files.reduce((sum, f) => sum + f.unbound.length, 0), total } : null
    },
  },
]

const METRIC_IDS = new Set(CHECK_METRICS.map((m) => m.id))
export const isMetricId = (id: string): boolean => METRIC_IDS.has(id)

/** Each metric the model has something to count for, with its goal, and a
 *  goal-unmet finding for each goal it misses. `notRun`: the metrics with a
 *  goal that only test reports measure, when there are none. */
export function measureGoals(ctx: MeasureContext, goals: Record<string, GoalSetting>): { metrics: CheckMetricResult[]; findings: RuleFinding[]; notRun: string[] } {
  const metrics: CheckMetricResult[] = []
  const findings: RuleFinding[] = []
  const notRun: string[] = []
  for (const metric of CHECK_METRICS) {
    if (metric.tests && !ctx.evidence) {
      if (goals[metric.id] !== undefined) notRun.push(metric.id)
      continue
    }
    const value = metric.measure(ctx)
    if (!value) continue
    const min = goals[metric.id]?.min
    const met = min === undefined || value.count * 100 >= min * value.total
    metrics.push({
      id: metric.id, label: metric.label, dimension: metric.dimension, ...(metric.rule ? { rule: metric.rule } : {}),
      ...value, percent: Math.floor((value.count * 100) / value.total), ...(min !== undefined ? { min } : {}), met,
    })
    if (!met) {
      // Read from test results kept from an earlier run, it says how the
      // tests stood then.
      const asOf = metric.tests ? ctx.model.testsReadAt : undefined
      findings.push({
        code: metric.id,
        message: `${metric.label}: ${Math.floor((value.count * 100) / value.total)}% (${value.count} of ${value.total}), below the goal of ${min}%${asOf ? ` by the test results read ${asOf.slice(0, 10)}` : ''}.`,
        ...(asOf ? { asOf } : {}),
      })
    }
  }
  return { metrics, findings, notRun }
}
