// ─── Inspector: what needs attention, and how old the evidence is ────────────
//
// Pure: the Overview's list of findings by severity and rule, a rule's name
// as a person reads it, the header's freshness of the test results,
// measurements and reviews with the commands that read them again, what the
// checks did not run, why a requirement or decision is not verified, and the
// fields of a changed element as a person reads them.

import type { CheckFinding, CheckResult, CheckSeverity, EvidenceEntry, Measurement } from '@radical/common/check'
import type { C4Node, C4Relation } from '@radical/common/c4'
import { formatAge } from '@radical/common/check'

/** Words a rule id spells short. */
const WORDS: Record<string, string> = { adr: 'ADR', adrs: 'ADRs', fn: 'function', json: 'JSON', sm: 'state machine' }
/** Rules whose id reads badly as words. */
const NAMES: Record<string, string> = {
  metamodel: 'Breaks the metamodel',
  'goal-unmet': 'Goal not met',
  'test-unbound': 'Test the model does not name',
  'folder-not-a-node': 'Node file without id or type',
  'folder-json': 'JSON file that does not parse',
  'folder-manifest': 'Folder without its manifest',
  'folder-conflict': 'Git conflict markers',
  'folder-duplicate-id': 'Two files with one id',
}

/** "requirement-without-scenario" → "Requirement without scenario";
 *  `rule/code` keys name their code after the rule. */
export function ruleName(key: string): string {
  const [rule, code] = key.split('/')
  const named = NAMES[rule] ?? rule.split('-').map((w) => WORDS[w] ?? w).join(' ')
  const name = named.charAt(0).toUpperCase() + named.slice(1)
  return code ? `${name}: ${code}` : name
}

export interface AttentionGroup {
  severity: CheckSeverity
  /** The key the findings count under: the rule, or `rule/code`. */
  key: string
  rule: string
  name: string
  findings: CheckFinding[]
  /** The baseline check.json sets for the key. */
  max?: number
}

/** The findings, errors first and then warnings, each severity by rule in
 *  the order the check ran them; `only` keeps the findings about those
 *  elements (their own element or one they name). */
export function attentionGroups(check: Pick<CheckResult, 'findings' | 'rules'>, only?: ReadonlySet<string>): AttentionGroup[] {
  const order = check.rules.map((r) => r.id)
  const groups = new Map<string, AttentionGroup>()
  for (const f of check.findings) {
    if (only && !(f.nodeId && only.has(f.nodeId)) && !f.relatedIds?.some((id) => only.has(id))) continue
    const id = `${f.severity}:${f.key}`
    let group = groups.get(id)
    if (!group) {
      const max = check.rules.find((r) => r.id === f.key)?.max
      group = { severity: f.severity, key: f.key, rule: f.rule, name: ruleName(f.key), findings: [], ...(max !== undefined ? { max } : {}) }
      groups.set(id, group)
    }
    group.findings.push(f)
  }
  const rank = (key: string): number => { const at = order.indexOf(key); return at < 0 ? order.length : at }
  return [...groups.values()].sort((a, b) =>
    Number(a.severity !== 'error') - Number(b.severity !== 'error') || rank(a.key) - rank(b.key) || a.key.localeCompare(b.key))
}

export const DAY = 24 * 60 * 60 * 1000

/** "8 d old", "today", "5 h old": how old the test results are. */
export function testsAge(readAt: number, now = Date.now()): string {
  const age = now - readAt
  if (age >= DAY) return `${Math.floor(age / DAY)} d old`
  return new Date(readAt).toDateString() === new Date(now).toDateString() ? 'today' : `${formatAge(age)} old`
}

/** Whether evidence from `at` is to be read with care: the model changed
 *  after it (`changedAt`, when that is known), else it is older than a day. */
export function isOutdated(at: number, now = Date.now(), changedAt?: number | null): boolean {
  return changedAt != null ? changedAt > at : now - at > DAY
}

/** The time the model last changed, as far as Studio knows: an edit made
 *  in it since it was opened, or the base the branch's changes are counted
 *  from, when there are any; null when it knows of none. */
export function modelChangedAt(editedAt: number | null, base: { savedAt: string } | null, changed: number): number | null {
  const fromBase = base && changed > 0 ? Date.parse(base.savedAt) : NaN
  const times = [editedAt ?? NaN, fromBase].filter((t) => Number.isFinite(t))
  return times.length ? Math.max(...times) : null
}

/** The latest of the measurements a sensor took (`reviews` false) or of the
 *  reviews (true), with their sources and count; null when there is none. */
export function latestOf(measurements: Measurement[] | null, reviews: boolean): { at: number; count: number; sources: string[] } | null {
  const list = (measurements ?? []).filter((m) => (m.source === 'review') === reviews)
  if (!list.length) return null
  return {
    at: Math.max(...list.map((m) => Date.parse(m.at)).filter((t) => Number.isFinite(t))),
    count: list.length,
    sources: [...new Set(list.map((m) => m.source))].sort(),
  }
}

/** What reads the test results again, run in the repository. */
export const testsCommand = (folder: string): string => `npm run test:reports && radical check ${folder} --report reports`

/** What measures again what runs on `trigger`, and what reads the
 *  measurements into the check. */
export const measureCommands = (folder: string, trigger = '<event>'): string[] => [
  `radical sense run --trigger ${trigger} --folder ${folder} --out reports/metrics`,
  `radical check ${folder} --metrics reports/metrics`,
]

/** What records a review of a manual fitness function. */
export const reviewCommand = (folder: string): string => `radical sense review <name> --passed --by <who> --folder ${folder}`

/** The fields every element has, by the name Studio gives them. */
const FIELD_LABELS: Record<string, string> = { label: 'Name', parentId: 'Place', description: 'Description', technology: 'Technology', external: 'External', type: 'Type' }

/** A changed field by its label in the metamodel ("The system shall
 *  (action)"), else by the name Studio gives it, else by its key. */
export function fieldLabel(field: string, properties: ReadonlyArray<{ key: string; label?: string }> | undefined): string {
  return properties?.find((p) => p.key === field)?.label ?? FIELD_LABELS[field] ?? field
}

/** A field's value as text: a place by the label of the element, yes or no,
 *  lists joined; null for no value. */
export function valueText(field: string, value: unknown, labelOf: (id: string) => string | undefined): string | null {
  if (value === null || value === undefined || value === '') return field === 'parentId' ? 'Top level' : null
  if (field === 'parentId' && typeof value === 'string') return labelOf(value) ?? value
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (Array.isArray(value)) return value.every((v) => typeof v !== 'object') ? value.join(', ') : JSON.stringify(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// ─── What the checks did not run, and why a decision is not verified ─────────

type Props = Record<string, unknown>
const propOf = (node: C4Node, key: string): string => {
  const value = (node as unknown as Props)[key]
  return typeof value === 'string' ? value.trim() : ''
}

/** When a scenario or fitness function runs: a scenario's tests with the
 *  pull request; a fitness function by its cadence: the event it is
 *  triggered on, "continual", or "every 90d". Without a cadence, with the
 *  pull request. */
export function triggerOf(node: C4Node): string {
  if (node.type !== 'fitness-fn') return 'pull-request'
  const cadence = propOf(node, 'cadence')
  if (cadence === 'continual') return 'continual'
  if (cadence === 'temporal') return propOf(node, 'every') ? `every ${propOf(node, 'every')}` : 'temporal'
  return propOf(node, 'trigger') || 'pull-request'
}

/** "nightly", "continually", "on release", "every 90d": when what runs on
 *  `trigger` is measured, for a trigger that is not the pull request. */
export function measuredWhen(trigger: string): string {
  if (trigger === 'continual') return 'continually'
  if (trigger === 'temporal') return 'from time to time'
  if (trigger === 'release' || trigger === 'deploy') return `on ${trigger}`
  return trigger
}

/** Whether what runs on `trigger` runs with a pull request, as the test
 *  results and measurements beside a model come from. */
export const runsWithPullRequest = (trigger: string): boolean => trigger === 'pull-request'

export interface NotRunItem {
  id: string
  label: string
  type: string
  trigger: string
  /** It runs on another event: not running here is expected, no gap. */
  expected: boolean
  /** Each condition nothing ran, as a person reads it. */
  why: string[]
  /** What it verifies or implements: the requirements and ADRs it leaves open. */
  checks: string[]
}

/** The scenarios and fitness functions whose checks nothing ran in the test
 *  results and measurements beside the model, each condition no rule
 *  reports already (test-not-run reads only test results, metric-not-measured
 *  only measurements): gaps first, then what runs on another event. */
export function notRunItems(
  evidence: Record<string, EvidenceEntry> | undefined,
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  findings: CheckFinding[],
): NotRunItem[] {
  if (!evidence) return []
  const items: NotRunItem[] = []
  for (const [id, e] of Object.entries(evidence)) {
    const node = nodes[id]
    if (!node || (e.type !== 'scenario' && e.type !== 'fitness-fn') || e.status !== 'not-run') continue
    const reported = findings.filter((f) => f.nodeId === id && (f.rule === 'test-not-run' || f.rule === 'metric-not-measured'))
    const why = (e.conditions ?? [])
      .filter((c) => c.outcome === 'not-run')
      .filter((c) => !reported.some((f) => f.message.includes(c.test ?? c.condition)))
      .map((c) => c.test ? `test ${c.test} not in the test results` : c.detail ? `${c.condition}: ${c.detail}` : `nothing measured ${c.condition}`)
    if (!why.length) continue
    const trigger = triggerOf(node)
    const relationType = e.type === 'scenario' ? 'verifies' : 'implements'
    const checks = Object.values(relations).filter((r) => r.sourceId === id && r.relationType === relationType && nodes[r.targetId]).map((r) => r.targetId)
    items.push({ id, label: node.label, type: e.type, trigger, expected: !runsWithPullRequest(trigger), why, checks })
  }
  return items.sort((a, b) => Number(a.expected) - Number(b.expected) || a.label.localeCompare(b.label))
}

/** The fitness functions whose metric conditions wait for a measurement,
 *  with when they run. */
export function waitingForMeasurement(evidence: Record<string, EvidenceEntry> | undefined, nodes: Record<string, C4Node>): Array<{ id: string; label: string; trigger: string }> {
  return Object.entries(evidence ?? {})
    .filter(([id, e]) => e.type === 'fitness-fn' && nodes[id] && (e.conditions ?? []).some((c) => !c.test && c.outcome === 'not-run'))
    .map(([id]) => ({ id, label: nodes[id].label, trigger: triggerOf(nodes[id]) }))
    .sort((a, b) => Number(!runsWithPullRequest(a.trigger)) - Number(!runsWithPullRequest(b.trigger)) || a.label.localeCompare(b.label))
}

export interface WhyPart {
  key: 'failing' | 'no-checker' | 'no-check' | 'not-run' | 'stale'
  count: number
  /** "1 no fitness function", "2 not run (1 measured nightly)". */
  text: string
}

/** Why the requirements (`requirement`) or the accepted ADRs (`adr`) that
 *  are not verified are not: failing, nothing verifies them, what does names
 *  no check, its checks did not run (counting apart those that run on
 *  another event than the pull request), or were measured too long ago.
 *  Each counts once, so the parts add up to all not verified. */
export function unverifiedBreakdown(kind: 'requirement' | 'adr', evidence: Record<string, EvidenceEntry> | undefined, nodes: Record<string, C4Node>): WhyPart[] {
  if (!evidence) return []
  const counts = { failing: 0, 'no-checker': 0, 'no-check': 0, 'not-run': 0, stale: 0 }
  const elsewhere = new Map<string, number>()
  for (const node of Object.values(nodes)) {
    if (node.type !== kind || (kind === 'adr' && propOf(node, 'status') !== 'accepted')) continue
    const e = evidence[node.id]
    if (!e || e.status === 'verified') continue
    const by = (e.by ?? []).filter((id) => evidence[id])
    const statusOf = (id: string): string => evidence[id].status
    if (e.status === 'broken') counts.failing++
    else if (!by.length) counts['no-checker']++
    else if (by.some((id) => statusOf(id) === 'no-checks')) counts['no-check']++
    else if (by.some((id) => statusOf(id) === 'not-run')) {
      counts['not-run']++
      const triggers = [...new Set(by.filter((id) => statusOf(id) === 'not-run').map((id) => nodes[id] ? triggerOf(nodes[id]) : 'pull-request'))]
      if (triggers.every((t) => !runsWithPullRequest(t))) {
        const when = triggers.length === 1 ? measuredWhen(triggers[0]) : 'outside pull requests'
        elsewhere.set(when, (elsewhere.get(when) ?? 0) + 1)
      }
    } else counts.stale++
  }
  const names: Record<WhyPart['key'], string> = kind === 'adr'
    ? { failing: 'failing', 'no-checker': 'no fitness function', 'no-check': 'no check', 'not-run': 'not run', stale: 'stale' }
    : { failing: 'failing', 'no-checker': 'no scenario', 'no-check': 'no check', 'not-run': 'test not run', stale: 'stale' }
  const order: Array<WhyPart['key']> = ['no-checker', 'no-check', 'not-run', 'stale', 'failing']
  return order.filter((key) => counts[key] > 0).map((key) => {
    const apart = key === 'not-run' && elsewhere.size ? ` (${[...elsewhere].map(([when, n]) => `${n} measured ${when}`).join(', ')})` : ''
    return { key, count: counts[key], text: `${counts[key]} ${names[key]}${apart}` }
  })
}
