// ─── Inspector Settings: editing check.json ──────────────────────────────────
//
// Settings edit a draft of the config and save it whole. These keep the
// draft as close to the file as it was: a rule set only by severity stays a
// string, a setting with nothing left in it goes, and nothing is rewritten
// that the user did not touch.

import type { CheckConfig, RuleSetting } from '@radical/common/check'

export interface RulePatch {
  severity?: 'error' | 'warning' | 'off'
  max?: number | null
  include?: string[]
  exclude?: string[]
}

/** The config with `patch` applied to the rule `key`; `max: null` and an
 *  empty list remove that field. */
export function patchRule(config: CheckConfig, key: string, patch: RulePatch): CheckConfig {
  const current = config.rules?.[key]
  const object: Exclude<RuleSetting, string> = current === undefined ? {} : typeof current === 'string' ? { severity: current } : { ...current }
  if (patch.severity !== undefined) object.severity = patch.severity
  if (patch.max === null) delete object.max
  else if (patch.max !== undefined) object.max = patch.max
  for (const list of ['include', 'exclude'] as const) {
    if (patch[list] === undefined) continue
    if (patch[list]!.length) object[list] = patch[list]
    else delete object[list]
  }
  const rules = { ...(config.rules ?? {}) }
  const keys = Object.keys(object)
  if (!keys.length) delete rules[key]
  else rules[key] = keys.length === 1 && object.severity ? object.severity : object
  return withPart(config, 'rules', rules)
}

/** The config with the goal of `metric` at `min` percent, or without one. */
export function setGoal(config: CheckConfig, metric: string, min: number | null): CheckConfig {
  const goals = { ...(config.goals ?? {}) }
  if (min === null) delete goals[metric]
  else goals[metric] = { min: Math.max(0, Math.min(100, Math.round(min))) }
  return withPart(config, 'goals', goals)
}

function withPart<K extends 'rules' | 'goals'>(config: CheckConfig, part: K, value: NonNullable<CheckConfig[K]>): CheckConfig {
  const next = { ...config }
  if (Object.keys(value).length) next[part] = value
  else delete next[part]
  return next
}

export interface DiffLine { kind: ' ' | '-' | '+'; text: string }

/** A line diff of two texts (longest common subsequence), with up to
 *  `context` unchanged lines around each change; `…` stands for the rest. */
export function lineDiff(before: string, after: string, context = 2): DiffLine[] {
  const a = before.split('\n')
  const b = after.split('\n')
  const n = a.length
  const m = b.length
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  const all: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { all.push({ kind: ' ', text: a[i] }); i++; j++ }
    // On a tie the removed line comes first, as git shows it.
    else if (i < n && (j === m || lcs[i + 1][j] >= lcs[i][j + 1])) { all.push({ kind: '-', text: a[i] }); i++ }
    else { all.push({ kind: '+', text: b[j] }); j++ }
  }
  const near = all.map((_, k) => all.slice(Math.max(0, k - context), k + context + 1).some((l) => l.kind !== ' '))
  const out: DiffLine[] = []
  all.forEach((line, k) => {
    if (near[k]) out.push(line)
    else if (out[out.length - 1]?.text !== '…') out.push({ kind: ' ', text: '…' })
  })
  return out
}
