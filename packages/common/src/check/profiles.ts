// ─── radical check: the gate a new model starts with ─────────────────────────
//
// The built-in defaults are lenient on purpose: a model without check.json
// must not start failing CI when Radical is upgraded. A model made with
// Radical gets its gate written into check.json when it is made instead
// (ADR Strict gate for new models): the strict profile for a model that
// starts with its code, and for existing code every rule an error whose
// baselines the first run sets once (radical check --adopt); --ratchet only
// lowers them from then on.

import type { CheckConfig, CheckResult, RuleSetting } from './index'
import type { CheckSeverity } from './rules'

/** The rule that reports a check.json still waiting for its first baselines. */
export const ADOPT_RULE = {
  id: 'baselines-pending',
  description: 'check.json does not wait for the baselines of its first run ("adopt": true); radical check --adopt takes them once.',
  severity: 'error' as CheckSeverity,
  dimension: 'consistency' as const,
}

/** The message of ADOPT_RULE's finding. */
export const ADOPT_MESSAGE = 'check.json waits for the baselines of its first run ("adopt": true): run radical check --adopt and commit check.json.'

/** Every rule an error, and every goal at 100%: a model that starts with
 *  its code keeps every promise from its first commit. */
export function strictCheckConfig(ruleIds: readonly string[], metricIds: readonly string[]): CheckConfig {
  return {
    rules: Object.fromEntries(ruleIds.filter((id) => id !== ADOPT_RULE.id).map((id) => [id, 'error' as const])),
    goals: Object.fromEntries(metricIds.map((id) => [id, { min: 100 }])),
  }
}

/** Every rule an error, waiting for the baselines of the first run: a model
 *  of code that was there before it. */
export function existingCodeCheckConfig(ruleIds: readonly string[]): CheckConfig {
  return {
    adopt: true,
    rules: Object.fromEntries(ruleIds.filter((id) => id !== ADOPT_RULE.id).map((id) => [id, 'error' as const])),
  }
}

export interface AdoptedBaselines {
  config: CheckConfig
  /** Rules whose baseline (max) was set at their count. */
  baselines: Array<{ id: string; max: number }>
  /** Goals set at the share found. */
  goals: Array<{ id: string; min: number }>
  /** Rules and goals that did not run (no test report, no measurements):
   *  no baseline was taken for them. */
  notRun: string[]
}

const severityOf = (setting: RuleSetting | undefined): RuleSetting | undefined =>
  typeof setting === 'object' ? setting.severity : setting

/** `config` with the baselines of `result`, its first run: each rule that
 *  found something gets its count as max, each metric its share as the
 *  goal, and "adopt" goes. Throws when the config does not wait for them:
 *  baselines are taken once, and only --ratchet changes them after. */
export function adoptBaselines(config: CheckConfig, result: CheckResult): AdoptedBaselines {
  if (!config.adopt) throw new Error('check.json does not wait for baselines (no "adopt": true): they were taken already, and only radical check --ratchet lowers them')
  const rules: Record<string, RuleSetting> = { ...(config.rules ?? {}) }
  const baselines: AdoptedBaselines['baselines'] = []
  const notRun: string[] = []
  for (const r of result.rules) {
    if (r.id === ADOPT_RULE.id || r.id.startsWith('goal-unmet')) continue
    if (r.notRun) { notRun.push(r.id); continue }
    if (r.severity === 'off' || r.count === 0) continue
    const severity = severityOf(rules[r.id]) ?? r.severity
    rules[r.id] = { ...(typeof rules[r.id] === 'object' ? rules[r.id] as object : {}), severity: severity as CheckSeverity, max: r.count }
    baselines.push({ id: r.id, max: r.count })
  }
  const goals: AdoptedBaselines['goals'] = []
  for (const m of result.metrics) {
    if (m.total === 0) continue
    goals.push({ id: m.id, min: m.percent })
  }
  for (const g of result.goalsNotRun) notRun.push(g.id)
  const { adopt: _adopt, ...rest } = config
  return {
    config: { ...rest, rules, goals: { ...(config.goals ?? {}), ...Object.fromEntries(goals.map((g) => [g.id, { min: g.min }])) } },
    baselines,
    goals,
    notRun,
  }
}
