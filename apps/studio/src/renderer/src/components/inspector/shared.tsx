// ─── Inspector: pieces every tab uses ────────────────────────────────────────
//
// Element chips that open the side panel, a finding's message with the
// elements it quotes as chips, bars with a goal tick, the side panel itself,
// and the list of a rule's findings.

import React, { useState } from 'react'
import {
  CHECK_DIMENSIONS, CHECK_METRICS, CHECK_RULES, FOLDER_RULES, GOAL_RULE,
  type CheckDimension, type CheckFinding, type CheckMetricResult, type CheckPerspective, type CheckResult, type CheckRuleResult, type EvidenceEntry,
} from '@radical/common/check'
import type { C4Node } from '@radical/common/c4'
import type { Metamodel } from '@radical/common/metamodel'
import { openWikiPage, revealOnCanvas, wikiViewFor } from '../../navigation'

export const RULE_INFO = new Map<string, string>([...FOLDER_RULES, ...CHECK_RULES, GOAL_RULE].map((r) => [r.id, r.description]))
const RULE_DIMENSION = new Map<string, CheckDimension>([...FOLDER_RULES, ...CHECK_RULES].map((r) => [r.id, r.dimension]))
const METRIC_DIMENSION = new Map<string, CheckDimension>(CHECK_METRICS.map((m) => [m.id, m.dimension]))
export const DIMENSIONS = new Map(CHECK_DIMENSIONS.map((d) => [d.id, d]))
export const dimensionsOf = (perspective: CheckPerspective): typeof CHECK_DIMENSIONS => CHECK_DIMENSIONS.filter((d) => d.perspective === perspective)

/** The dimension a rule (or `rule/code` key) is about; a goal's is its metric's. */
export function dimensionOfKey(key: string): CheckDimension | undefined {
  const [rule, code] = key.split('/')
  return rule === GOAL_RULE.id ? (code ? METRIC_DIMENSION.get(code) : undefined) : RULE_DIMENSION.get(rule)
}
export const dimensionOfFinding = (f: CheckFinding): CheckDimension | undefined =>
  f.rule === GOAL_RULE.id ? (f.code ? METRIC_DIMENSION.get(f.code) : undefined) : RULE_DIMENSION.get(f.rule)

export const metricOf = (check: CheckResult, id: string): CheckMetricResult | undefined => check.metrics.find((m) => m.id === id)

export const SHORT_TYPE: Record<string, string> = { requirement: 'Req', 'fitness-fn': 'FF', scenario: 'Scenario', adr: 'ADR', need: 'Need', database: 'DB', webapp: 'Web app', component: 'Comp', container: 'Cont', system: 'System' }
export const MARK: Record<string, string> = { verified: '✓', passed: '✓', broken: '✗', failed: '✗', unverified: '○', 'not-run': '○', 'no-tests': '○', 'not-found': '?', skipped: '–' }
export const FAILING = new Set(['broken', 'failed', 'not-found'])
export const PASSING = new Set(['verified', 'passed'])
export const tone = (status: string | undefined): string => !status ? '' : FAILING.has(status) ? 'bad' : PASSING.has(status) ? 'ok' : 'none'

export interface Ctx {
  nodes: Record<string, C4Node>
  metamodel: Metamodel
  evidence: Record<string, EvidenceEntry> | undefined
  peek: (id: string) => void
}

export function Chip({ id, ctx, status }: { id: string; ctx: Ctx; status?: string }): React.ReactElement | null {
  const node = ctx.nodes[id]
  if (!node) return null
  const def = ctx.metamodel.nodeTypes[node.type]
  const type = SHORT_TYPE[node.type] ?? def?.label ?? node.type
  return (
    <button type="button" className="insp-chip" onClick={() => ctx.peek(id)} title={`${def?.label ?? node.type}: ${node.label}`}>
      <span className="insp-chip-type" style={{ background: def?.color ?? '#64748b', color: def?.fg ?? '#fff' }}>{type}</span>
      <span className="insp-chip-label">{node.label}</span>
      {status && <span className={`insp-mark ${tone(status)}`}>{MARK[status] ?? ''}</span>}
    </button>
  )
}

/** The message with each element it quotes as a link. What a failure takes
 *  down shows as links of its own, so it leaves the sentence. */
export function Message({ f, ctx }: { f: CheckFinding; ctx: Ctx }): React.ReactElement {
  const text = f.relatedIds?.length ? f.message.replace(/ Not verified now: .*$/, '') : f.message
  const ids = [...new Set([f.nodeId, ...(f.relatedIds ?? [])].filter((id): id is string => !!id && !!ctx.nodes[id]))]
  const parts: React.ReactNode[] = []
  let rest = text
  for (let guard = 0; guard < 20; guard++) {
    let first: { at: number; id: string; len: number } | null = null
    for (const id of ids) {
      const quoted = `"${ctx.nodes[id].label}"`
      const at = rest.indexOf(quoted)
      if (at >= 0 && (!first || at < first.at)) first = { at, id, len: quoted.length }
    }
    if (!first) break
    parts.push(rest.slice(0, first.at), <Chip key={`${first.id}-${guard}`} id={first.id} ctx={ctx} />)
    rest = rest.slice(first.at + first.len)
  }
  parts.push(rest)
  return <span className="insp-msg">{parts}</span>
}

/** A stacked bar; `goal` draws a tick at that percent. */
export function Bar({ parts, goal }: { parts: Array<[number, string]>; goal?: number }): React.ReactElement {
  const total = parts.reduce((s, [v]) => s + v, 0)
  return (
    <div className="insp-barwrap">
      <div className="insp-bar" role="img" aria-label={parts.map(([v, c]) => `${v} ${c}`).join(', ') + (goal !== undefined ? `, goal ${goal}%` : '')}>
        {parts.map(([v, c]) => v ? <i key={c} className={c} style={{ width: `${(100 * v) / total}%` }} /> : null)}
      </div>
      {goal !== undefined && <span className="insp-tick" style={{ left: `${goal}%` }} aria-hidden="true" />}
    </div>
  )
}

/** The bar of a metric: what meets it, what does not, its goal. */
export const MetricBar = ({ m }: { m: CheckMetricResult }): React.ReactElement =>
  <Bar parts={[[m.count, 'ok'], [m.total - m.count, 'none']]} goal={m.min} />

/** Where a dimension stands against check.json: errors, a goal it misses
 *  or meets, or rules that would fail the check (`gated`) and do not. */
export function GoalPill({ metrics, errors = 0, gated = false }: { metrics: CheckMetricResult[]; errors?: number; gated?: boolean }): React.ReactElement {
  const goals = metrics.filter((m) => m.min !== undefined)
  if (errors) return <span className="insp-pill bad">✗ {errors} {errors === 1 ? 'error' : 'errors'}</span>
  if (goals.some((m) => !m.met)) return <span className="insp-pill bad">✗ below goal</span>
  if (goals.length) return <span className="insp-pill ok">✓ goal met</span>
  if (gated) return <span className="insp-pill ok" title="Its rules fail the check on an error, and find none">✓ passes</span>
  return <span className="insp-pill none">no goal</span>
}

/** A tab's badge: its errors, or how many of its goals are met. */
export function TabBadge({ metrics, errors }: { metrics: CheckMetricResult[]; errors: number }): React.ReactElement | null {
  if (errors) return <span className="insp-pill bad">✗ {errors}</span>
  const goals = metrics.filter((m) => m.min !== undefined)
  if (!goals.length) return null
  const met = goals.filter((m) => m.met).length
  return <span className={`insp-pill ${met === goals.length ? 'ok' : 'bad'}`}>{met} / {goals.length} goals</span>
}

/** Rules of `dimension` that fail the check on a finding above their baseline. */
export const gatedDimension = (check: CheckResult, dimension: CheckDimension): boolean =>
  check.rules.some((r) => r.severity === 'error' && dimensionOfKey(r.id) === dimension)

export interface Tally { ok: number; bad: number; none: number }
export const tally = (statuses: Array<string | undefined>): Tally => ({
  ok: statuses.filter((s) => s && PASSING.has(s)).length,
  bad: statuses.filter((s) => s && FAILING.has(s)).length,
  none: statuses.filter((s) => !s || (!PASSING.has(s) && !FAILING.has(s))).length,
})

export function Peek({ id, ctx, check, onClose }: { id: string; ctx: Ctx; check: CheckResult; onClose: () => void }): React.ReactElement | null {
  const node = ctx.nodes[id]
  if (!node) return null
  const path: string[] = []
  for (let p = node.parentId ? ctx.nodes[node.parentId] : undefined; p; p = p.parentId ? ctx.nodes[p.parentId] : undefined) path.unshift(p.label)
  const own = check.findings.filter((f) => f.nodeId === id || f.relatedIds?.includes(id))
  const ev = ctx.evidence?.[id]
  const hasWiki = !!wikiViewFor(id)
  return (
    <aside className="insp-peek" aria-label="Element">
      <button type="button" className="insp-peek-close" onClick={onClose}>Close</button>
      <Chip id={id} ctx={ctx} />
      <h3>{node.label}</h3>
      <dl className="insp-kv">
        <dt>Type</dt><dd>{ctx.metamodel.nodeTypes[node.type]?.label ?? node.type}</dd>
        {path.length > 0 && <><dt>In</dt><dd>{path.join(' › ')}</dd></>}
        {ev && <><dt>Tests</dt><dd><span className={`insp-mark ${tone(ev.status)}`}>{MARK[ev.status]}</span> {ev.status}</dd></>}
      </dl>
      <div className="insp-peek-acts">
        <button type="button" className="primary" onClick={() => revealOnCanvas(id)}>Show on canvas</button>
        <button type="button" onClick={() => openWikiPage(id)} disabled={!hasWiki} title={hasWiki ? undefined : 'No wiki view shows this element'}>Open wiki page</button>
      </div>
      {ev?.tests && ev.tests.length > 0 && (
        <div className="insp-peek-sec">
          <span className="insp-label">Tests ({ev.tests.length})</span>
          {ev.tests.map((t) => (
            <div key={t.id} className="insp-test"><span className={`insp-mark ${tone(t.outcome)}`}>{MARK[t.outcome]}</span><code>{t.id}</code>{t.outcome !== 'passed' && <em>{t.outcome}</em>}</div>
          ))}
        </div>
      )}
      {ev?.by && (
        <div className="insp-peek-sec">
          <span className="insp-label">Checked by ({ev.by.length})</span>
          <div className="insp-chips">{ev.by.length ? ev.by.map((b) => <Chip key={b} id={b} ctx={ctx} status={ctx.evidence?.[b]?.status} />) : <span className="insp-muted">Nothing checks it.</span>}</div>
        </div>
      )}
      <div className="insp-peek-sec">
        <span className="insp-label">Findings ({own.length})</span>
        {own.length ? own.map((f, i) => <div key={i} className={`insp-peek-finding ${f.severity}`}><Message f={f} ctx={ctx} /></div>) : <span className="insp-muted">Nothing the check reports.</span>}
      </div>
    </aside>
  )
}

/** What fails the check, each error with what it takes down. */
export function Errors({ errors, ctx }: { errors: CheckFinding[]; ctx: Ctx }): React.ReactElement | null {
  if (!errors.length) return null
  return (
    <section>
      <h2>Errors</h2>
      <p className="insp-lede">What fails the check in CI. Each one names the element it is about and what it takes down with it.</p>
      <div className="insp-errors">
        {errors.map((f, i) => (
          <div key={i} className="insp-error">
            <Message f={f} ctx={ctx} />
            {f.relatedIds && f.relatedIds.length > 0 && (
              <div className="insp-chain">Not verified now: {f.relatedIds.map((id) => <Chip key={id} id={id} ctx={ctx} status="broken" />)}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

const FINDINGS_SHOWN = 6

/** One rule's findings, the first few and then on request. */
function RuleFindings({ list, ctx }: { list: CheckFinding[]; ctx: Ctx }): React.ReactElement {
  const [shown, setShown] = useState(FINDINGS_SHOWN)
  return (
    <div className="insp-items">
      {list.slice(0, shown).map((f, i) => (
        <div key={i} className="insp-item">
          {f.path && !f.nodeId && <code className="insp-path">{f.path}</code>}
          <Message f={f} ctx={ctx} />
          {f.details && f.details.length > 0 && (
            <details className="insp-details">
              <summary>{f.details.length === 1 ? '1 test' : `${f.details.length} tests`}</summary>
              <ul>{f.details.map((d) => <li key={d}><code>{d}</code></li>)}</ul>
            </details>
          )}
        </div>
      ))}
      {list.length > shown && <button type="button" className="insp-more" onClick={() => setShown(list.length)}>Show {list.length - shown} more</button>}
    </div>
  )
}

/** The rules of each dimension of a perspective, with their findings: one
 *  block per dimension, opened when it fails or when `focus` names one of
 *  its rules (a click on the traceability chain). */
export function FindingsByDimension({ check, ctx, perspective, focus }: { check: CheckResult; ctx: Ctx; perspective: CheckPerspective; focus?: string | null }): React.ReactElement {
  const blocks = dimensionsOf(perspective).map((d) => {
    const rules = check.rules.filter((r) => r.severity !== 'off' && dimensionOfKey(r.id) === d.id && (r.count > 0 || r.max !== undefined))
    // goal-unmet without a code of its own in the config: its findings by metric.
    const goalFindings = check.findings.filter((f) => f.key === GOAL_RULE.id && dimensionOfFinding(f) === d.id)
    const all = dimensionsRules(check).filter((id) => dimensionOfKey(id) === d.id)
    return { d, rules, goalFindings, all }
  })
  return (
    <div className="insp-panel insp-dims">
      {blocks.map(({ d, rules, goalFindings, all }) => {
        const count = rules.reduce((s, r) => s + r.count, 0) + goalFindings.length
        const maxSum = rules.every((r) => r.max !== undefined) && rules.length ? rules.reduce((s, r) => s + (r.max ?? 0), 0) : undefined
        const failed = rules.some((r) => r.failed) || goalFindings.some((f) => f.severity === 'error')
        const focused = !!focus && rules.some((r) => r.id === focus)
        return (
          <details key={d.id} className="insp-dim" open={failed || focused || undefined} data-dimension={d.id}>
            <summary>
              <span className={`insp-sev ${failed ? 'error' : count ? 'warning' : 'ok'}`}>{failed ? '✖' : count ? '⚠' : '✓'}</span>
              <span><b>{d.label}</b><span className="insp-rdesc">{all.join(' · ')}</span></span>
              <span className="insp-rcount">{count}{maxSum !== undefined && <small> / max {maxSum}</small>}</span>
            </summary>
            {count === 0 && <p className="insp-muted insp-dim-empty">Nothing found.</p>}
            {rules.map((r) => <RuleBlock key={r.id} r={r} check={check} ctx={ctx} focused={focus === r.id} />)}
            {goalFindings.length > 0 && <RuleBlock r={{ id: GOAL_RULE.id, count: goalFindings.length, severity: 'error', failed: goalFindings.some((f) => f.severity === 'error') }} list={goalFindings} check={check} ctx={ctx} />}
          </details>
        )
      })}
    </div>
  )
}

/** The rule ids the check ran, for the line under a dimension. */
const dimensionsRules = (check: CheckResult): string[] => [...new Set([...check.rules.map((r) => r.id), ...CHECK_RULES.map((r) => r.id)])]

function RuleBlock({ r, check, ctx, list, focused }: { r: CheckRuleResult; check: CheckResult; ctx: Ctx; list?: CheckFinding[]; focused?: boolean }): React.ReactElement | null {
  const findings = list ?? check.findings.filter((f) => f.key === r.id)
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { if (focused) ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }, [focused])
  if (!findings.length && r.max === undefined) return null
  return (
    <div ref={ref} className={`insp-rule-block${focused ? ' focused' : ''}`} data-rule={r.id}>
      <div className="insp-rule-head">
        <span className={`insp-sev ${r.failed ? 'error' : 'warning'}`}>{r.failed ? '✖' : findings.length ? '⚠' : '✓'}</span>
        <span><span className="insp-rid">{r.id}</span><span className="insp-rdesc">{RULE_INFO.get(r.id.split('/')[0]) ?? ''}</span></span>
        <span className="insp-rcount">{r.count}{r.max !== undefined && <small> / max {r.max}</small>}</span>
      </div>
      {findings.length > 0 && <RuleFindings list={findings} ctx={ctx} />}
    </div>
  )
}
