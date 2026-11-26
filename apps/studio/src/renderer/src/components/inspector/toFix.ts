// ─── Inspector: what is to fix, and the debt ─────────────────────────────────
//
// Pure: the check's findings in the two places the Inspector shows them.
// To fix is what fails the check, counted as what has to be settled for it
// to pass: one finding over a baseline makes every finding of its rule an
// error, and one of them is to be settled. Debt is what the check finds
// that does not fail it: the rules within their baselines, the rules that
// warn, and what was read from test results older than the model.

import { GOAL_RULE, canonicalTestId, type CheckFinding, type CheckMetricResult, type CheckResult } from '@radical/common/check'
import { attentionGroups, ruleName, type AttentionGroup } from './attention'

type Checked = Pick<CheckResult, 'findings' | 'rules' | 'metrics'>

export interface FixItem {
  /** The rule, `rule/code`, or `goal-unmet/<metric>` for a goal. */
  key: string
  rule: string
  name: string
  /** How many findings are to be settled for the check to pass. */
  toSettle: number
  /** Every finding the rule has, the ones that warn among them. */
  count: number
  /** The baseline the rule is over. */
  max?: number
  /** Its errors, those about the branch's elements first. */
  findings: CheckFinding[]
  /** How many of them, at the head of the list, are about the branch's elements. */
  onBranch: number
  /** The goal missed, and how many more elements reach it. */
  goal?: { metric: CheckMetricResult; needed: number }
}

/** Whether a finding is about one of `ids`: its own element or one it names. */
export const isAbout = (f: CheckFinding, ids: ReadonlySet<string>): boolean =>
  (!!f.nodeId && ids.has(f.nodeId)) || !!f.relatedIds?.some((id) => ids.has(id))

/** What causes a finding, when others may have the same cause: a test
 *  (several scenarios may name it), or a metric condition with the
 *  measurement it was decided by (several elements may state it). */
function causeOf(f: CheckFinding): string | null {
  if (f.test) return `test:${canonicalTestId(f.test)}`
  if (f.condition) {
    const m = f.measured
    const labels = m ? Object.keys(m.labels ?? {}).sort().map((k) => `${k}=${m.labels[k]}`).join(',') : ''
    return `condition:${f.condition}|${m ? `${m.metric}{${labels}}@${m.at}` : ''}`
  }
  return null
}

/** Findings by what causes them, in their order: one failing test or one
 *  measurement off its limit is one thing to fix, however many elements of
 *  the model name it. Each other finding is a cause of its own. */
export function byCause(findings: CheckFinding[]): CheckFinding[][] {
  const groups: CheckFinding[][] = []
  const at = new Map<string, CheckFinding[]>()
  for (const f of findings) {
    const cause = causeOf(f)
    const group = cause ? at.get(`${f.key}|${cause}`) : undefined
    if (group) group.push(f)
    else {
      const made = [f]
      groups.push(made)
      if (cause) at.set(`${f.key}|${cause}`, made)
    }
  }
  return groups
}

/** How many more elements have to meet a metric for it to reach its goal. */
export function neededFor(m: Pick<CheckMetricResult, 'count' | 'total' | 'min'>): number {
  if (m.min === undefined) return 0
  return Math.max(0, Math.ceil((m.min * m.total) / 100) - m.count)
}

/** What fails the check, by rule in the order the check ran them, a goal
 *  not met as an item of its own. `branchIds`: the elements changed on the
 *  branch, whose findings come first. */
export function toFix(check: Checked, branchIds?: ReadonlySet<string> | null): FixItem[] {
  const items: FixItem[] = []
  for (const g of attentionGroups(check)) {
    if (g.severity !== 'error') continue
    if (g.rule === GOAL_RULE.id) {
      for (const f of g.findings) {
        const metric = check.metrics.find((m) => m.id === f.code)
        items.push({
          key: `${GOAL_RULE.id}/${f.code ?? ''}`, rule: g.rule, name: metric ? `Goal not met: ${metric.label}` : g.name,
          toSettle: 1, count: 1, findings: [f], onBranch: 0,
          ...(metric ? { goal: { metric, needed: Math.max(1, neededFor(metric)) } } : {}),
        })
      }
      continue
    }
    const mine = branchIds ? g.findings.filter((f) => isAbout(f, branchIds)) : []
    const others = branchIds ? g.findings.filter((f) => !isAbout(f, branchIds)) : g.findings
    const count = check.rules.find((r) => r.id === g.key)?.count ?? g.findings.length
    // Over a baseline, the number over it, never more than its errors;
    // without one, each cause of its errors.
    const toSettle = g.max !== undefined ? Math.max(1, Math.min(g.findings.length, count - g.max)) : byCause(g.findings).length
    items.push({
      key: g.key, rule: g.rule, name: g.name, toSettle, count, ...(g.max !== undefined ? { max: g.max } : {}),
      findings: [...mine, ...others], onBranch: mine.length,
    })
  }
  return items
}

/** How many findings are to be settled for the check to pass. */
export const settleCount = (items: FixItem[]): number => items.reduce((n, item) => n + item.toSettle, 0)

export interface Debt {
  /** Rules within their baselines. */
  baselines: AttentionGroup[]
  /** Rules that warn, and findings that warn of a rule that fails. */
  warnings: AttentionGroup[]
  /** Read from test results older than the model. */
  old: AttentionGroup[]
  /** Rules under their baselines, which Ratchet lowers. */
  slack: Array<{ id: string; name: string; count: number; max: number }>
  /** The findings in the three lists. */
  total: number
}

/** What the check finds that does not fail it; `only` keeps the findings
 *  about those elements. */
export function debt(check: Checked, only?: ReadonlySet<string>): Debt {
  const rule = new Map(check.rules.map((r) => [r.id, r]))
  const buckets: Record<'baselines' | 'warnings' | 'old', CheckFinding[]> = { baselines: [], warnings: [], old: [] }
  for (const f of check.findings) {
    if (f.severity !== 'warning') continue
    const r = rule.get(f.key)
    const within = r?.max !== undefined && r.count <= r.max
    buckets[f.asOf ? 'old' : within ? 'baselines' : 'warnings'].push(f)
  }
  const groups = (findings: CheckFinding[]): AttentionGroup[] => attentionGroups({ findings, rules: check.rules }, only)
  const lists = { baselines: groups(buckets.baselines), warnings: groups(buckets.warnings), old: groups(buckets.old) }
  return {
    ...lists,
    slack: check.rules
      .filter((r) => r.max !== undefined && r.severity !== 'off' && !r.notRun && r.count < r.max)
      .map((r) => ({ id: r.id, name: ruleName(r.id), count: r.count, max: r.max! })),
    total: [...lists.baselines, ...lists.warnings, ...lists.old].reduce((n, g) => n + g.findings.length, 0),
  }
}
