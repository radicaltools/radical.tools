// ─── radical check: what a change of check.json does ────────────────────────
//
// check.json is the CI gate of a model. The Inspector's Settings may change
// it either way, but say which changes let more through (a lower severity,
// a higher baseline, a lower goal, fewer test files looked at), so that
// loosening the gate is never an accident.

import type { CheckConfig, RuleSetting } from './index'
import type { CheckSeverity } from './rules'

export interface CheckConfigChange {
  kind: 'rule' | 'goal'
  /** The rule id (or `rule/code`) or the metric id. */
  key: string
  /** What changed, as `severity warning → error`, `max 61 → 70`, `min 80% → 75%`. */
  changes: string[]
  /** It lets through what the config before did not. */
  loosens: boolean
}

const RANK: Record<string, number> = { off: 0, warning: 1, error: 2 }

interface Effective { severity: CheckSeverity | 'off'; max?: number; include: string[]; exclude: string[] }

function effective(setting: RuleSetting | undefined, fallback: CheckSeverity): Effective {
  if (setting === undefined) return { severity: fallback, include: [], exclude: [] }
  if (typeof setting === 'string') return { severity: setting, include: [], exclude: [] }
  return { severity: setting.severity ?? fallback, ...(setting.max !== undefined ? { max: setting.max } : {}), include: setting.include ?? [], exclude: setting.exclude ?? [] }
}

const shown = (max: number | undefined): string => max === undefined ? 'none' : String(max)

/** Each rule and goal `after` sets otherwise than `before`. `defaults`
 *  gives a rule's severity when the config does not set it. */
export function compareCheckConfig(before: CheckConfig, after: CheckConfig, defaults: (rule: string) => CheckSeverity): CheckConfigChange[] {
  const out: CheckConfigChange[] = []
  const ruleKeys = [...new Set([...Object.keys(before.rules ?? {}), ...Object.keys(after.rules ?? {})])]
  for (const key of ruleKeys) {
    const fallback = defaults(key.split('/')[0])
    const a = effective(before.rules?.[key], fallback)
    const b = effective(after.rules?.[key], fallback)
    const changes: string[] = []
    let loosens = false
    if (a.severity !== b.severity) {
      changes.push(`severity ${a.severity} → ${b.severity}`)
      if (RANK[b.severity] < RANK[a.severity]) loosens = true
    }
    if (a.max !== b.max) {
      changes.push(`max ${shown(a.max)} → ${shown(b.max)}`)
      // No baseline lets none through; a higher one lets more.
      if (b.max !== undefined && (a.max === undefined || b.max > a.max)) loosens = true
    }
    const lost = a.include.filter((g) => !b.include.includes(g))
    const gained = b.include.filter((g) => !a.include.includes(g))
    const excluded = b.exclude.filter((g) => !a.exclude.includes(g))
    const unexcluded = a.exclude.filter((g) => !b.exclude.includes(g))
    if (gained.length) changes.push(`include + ${gained.join(', ')}`)
    if (lost.length) { changes.push(`include − ${lost.join(', ')}`); loosens = true }
    if (excluded.length) { changes.push(`exclude + ${excluded.join(', ')}`); loosens = true }
    if (unexcluded.length) changes.push(`exclude − ${unexcluded.join(', ')}`)
    if (changes.length) out.push({ kind: 'rule', key, changes, loosens })
  }
  const goalKeys = [...new Set([...Object.keys(before.goals ?? {}), ...Object.keys(after.goals ?? {})])]
  for (const key of goalKeys) {
    const a = before.goals?.[key]?.min
    const b = after.goals?.[key]?.min
    if (a === b) continue
    const pct = (v: number | undefined): string => v === undefined ? 'none' : `${v}%`
    out.push({ kind: 'goal', key, changes: [`min ${pct(a)} → ${pct(b)}`], loosens: a !== undefined && (b === undefined || b < a) })
  }
  return out
}
