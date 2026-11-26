// ─── Inspector: pieces every tab uses ────────────────────────────────────────
//
// Element chips that show their element, a finding's message with the
// elements it quotes as chips, bars with a goal tick, and a finding as every
// tab draws it: its element, what is wrong, Open and the fix of one step,
// alone or in the group of its rule.

import React, { useEffect, useRef, useState } from 'react'
import {
  ADOPT_RULE, CHECK_DIMENSIONS, CHECK_METRICS, CHECK_RULES, FOLDER_RULES, GOAL_RULE, formatAge, testFindingNote, testIdentity,
  type CheckDimension, type CheckFinding, type CheckMetricResult, type CheckPerspective, type CheckResult, type EvidenceEntry,
} from '@radical/common/check'
import type { C4Node } from '@radical/common/c4'
import type { Metamodel } from '@radical/common/metamodel'
import { QuotedText, RuleText } from '@radical/ui/components/FindingText'
import { openConcern } from '../../persistence/inspector'
import type { AttentionGroup } from './attention'
import { ONE_STEP_FIXES, startFix, useFixOffer } from './fixes'
import { useRuleFocus } from './ruleFocus'
import { byCause, isAbout, toFix, type FixItem } from './toFix'

export const RULE_INFO = new Map<string, string>([...FOLDER_RULES, ...CHECK_RULES, GOAL_RULE, ADOPT_RULE].map((r) => [r.id, r.description]))
const RULE_DIMENSION = new Map<string, CheckDimension>([...FOLDER_RULES, ...CHECK_RULES, ADOPT_RULE].map((r) => [r.id, r.dimension]))
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

/** The metric with the smallest share met. */
export const weakest = (metrics: CheckMetricResult[]): CheckMetricResult | undefined =>
  metrics.reduce<CheckMetricResult | undefined>((w, m) => !w || m.count * w.total < w.count * m.total ? m : w, undefined)

/** How many findings are to be settled in each dimension for the check to pass. */
export function settleByDimension(items: FixItem[]): Map<CheckDimension, number> {
  const by = new Map<CheckDimension, number>()
  for (const item of items) {
    const d = dimensionOfKey(item.key)
    if (d) by.set(d, (by.get(d) ?? 0) + item.toSettle)
  }
  return by
}

/** Each dimension of the model with its metrics, how many findings are to be
 *  settled in it, its weakest metric (a dimension is as strong as that) and
 *  whether its rules gate. */
export function modelScores(check: CheckResult): Array<{ d: (typeof CHECK_DIMENSIONS)[number]; metrics: CheckMetricResult[]; errors: number; weak: CheckMetricResult | undefined; gated: boolean }> {
  const settle = settleByDimension(toFix(check))
  return dimensionsOf('model').map((d) => {
    const metrics = check.metrics.filter((x) => x.dimension === d.id)
    return { d, metrics, errors: settle.get(d.id) ?? 0, weak: weakest(metrics), gated: gatedDimension(check, d.id) }
  })
}

export const SHORT_TYPE: Record<string, string> = { requirement: 'Req', 'fitness-fn': 'FF', scenario: 'Scenario', adr: 'ADR', need: 'Need', database: 'DB', webapp: 'Web app', component: 'Comp', container: 'Cont', system: 'System' }
export const MARK: Record<string, string> = { verified: '✓', passed: '✓', broken: '✗', failed: '✗', unverified: '○', 'not-run': '○', 'no-checks': '○', 'not-found': '?', skipped: '–', stale: '◷', invalid: '!' }
export const FAILING = new Set(['broken', 'failed', 'not-found', 'invalid'])
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

/** The message with each element it quotes as a link, and the other words
 *  and values it quotes in bold. What a failure takes
 *  down shows as links of its own, so it leaves the sentence. With `own`,
 *  the finding's element stays text: its link stands before the message. */
export function Message({ f, ctx, own }: { f: CheckFinding; ctx: Ctx; own?: boolean }): React.ReactElement {
  const text = f.relatedIds?.length ? f.message.replace(/ Not verified now: .*$/, '') : f.message
  const ids = [...new Set([own ? undefined : f.nodeId, ...(f.relatedIds ?? [])].filter((id): id is string => !!id && !!ctx.nodes[id]))]
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
    parts.push(<QuotedText key={`t-${guard}`} text={rest.slice(0, first.at)} />, <Chip key={`${first.id}-${guard}`} id={first.id} ctx={ctx} />)
    rest = rest.slice(first.at + first.len)
  }
  parts.push(<QuotedText key="rest" text={rest} />)
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

/** Where a dimension stands against check.json: findings to settle, a goal
 *  it misses or meets, or rules that would fail the check (`gated`) and do not. */
export function GoalPill({ metrics, errors = 0, gated = false }: { metrics: CheckMetricResult[]; errors?: number; gated?: boolean }): React.ReactElement {
  const goals = metrics.filter((m) => m.min !== undefined)
  if (errors) return <span className="insp-pill bad">✗ {errors} to fix</span>
  if (goals.some((m) => !m.met)) return <span className="insp-pill bad">✗ below goal</span>
  if (goals.length) return <span className="insp-pill ok">✓ goal met</span>
  if (gated) return <span className="insp-pill ok" title="Its rules fail the check on an error, and find none">✓ passes</span>
  return <span className="insp-pill none">no goal</span>
}

/** A tab's badge: how many of its goals are met. */
export function TabBadge({ metrics }: { metrics: CheckMetricResult[] }): React.ReactElement | null {
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

const FINDINGS_SHOWN = 8

/** What a scenario expects, as its test is to show it: its given, when and
 *  then, those it has. */
export function expectationOf(scenario: C4Node): Array<[string, string]> {
  const props = scenario as unknown as Record<string, unknown>
  return ([['Given', props.given], ['When', props.when], ['Then', props.then]] as Array<[string, unknown]>)
    .flatMap(([word, text]) => typeof text === 'string' && text.trim() ? [[word, text.trim()] as [string, string]] : [])
}

/** A finding about a metric condition: the condition as written and, apart
 *  from it, what was measured, by which sensor and how long ago, or that
 *  nothing measured it. */
function Condition({ f }: { f: CheckFinding }): React.ReactElement {
  const m = f.measured
  return (
    <span className="insp-cond">
      <code>{f.condition}</code>
      {m ? (
        <span className="insp-measured"><span className="insp-expects-label">Measured</span> <b>{m.value}{m.unit ? ` ${m.unit}` : ''}</b> · {m.source} · {formatAge(Math.max(0, Date.now() - Date.parse(m.at)))} ago</span>
      ) : <span className="insp-measured insp-muted">{f.why ?? 'nothing measured it'}</span>}
      {m && f.why && <span className="insp-muted">{f.why}</span>}
    </span>
  )
}

/** One finding: its element, what is wrong, Open and the fix of one step.
 *  What is wrong is its group's name (its rule); a finding about a test
 *  shows the test by its title, with its file and describes apart, what
 *  the scenario it checks expects and why it failed, and one about a
 *  metric condition the condition and what was measured apart, not the
 *  sentence a log gets, which ends in the verdict.
 *  `branch`: it is about an element changed on this branch. */
export function FindingRow({ f, same = [], ctx, branch }: {
  f: CheckFinding
  /** The other findings of the same cause (byCause): their elements and
   *  what they leave unverified show on this row. */
  same?: CheckFinding[]
  ctx: Ctx
  branch?: boolean
}): React.ReactElement {
  const node = f.nodeId && ctx.nodes[f.nodeId] ? f.nodeId : null
  const others = [...new Set(same.map((s) => s.nodeId).filter((id): id is string => !!id && id !== f.nodeId && !!ctx.nodes[id]))]
  const fix = node ? ONE_STEP_FIXES[f.rule] : undefined
  const offer = useFixOffer()
  const concern = f.rule === 'concern-unaddressed'
  const also = [...new Set([f, ...same].flatMap((s) => s.relatedIds ?? []))].filter((id) => ctx.nodes[id])
  const test = f.test ? testIdentity(f.test) : null
  const note = test ? testFindingNote(f) : undefined
  // What its test is to show: the scenario's given, when and then.
  const expects = test && node && ctx.nodes[node].type === 'scenario' ? expectationOf(ctx.nodes[node]) : []
  return (
    <div className="insp-finding" data-rule={f.rule} data-branch={branch ? '' : undefined} data-testid={concern ? 'concern-finding' : undefined}>
      <div className="insp-finding-what">
        {node && <Chip id={node} ctx={ctx} />}
        {others.map((id) => <Chip key={id} id={id} ctx={ctx} />)}
        {branch && <span className="insp-pill new" title="About an element changed on this branch">this branch</span>}
        {f.path && !node && <code className="insp-path">{f.path}</code>}
        {test ? (
          <span className="insp-test"><b>{test.title}</b>{test.where && <code className="insp-path">{test.where}</code>}</span>
        ) : f.condition ? <Condition f={f} /> : <Message f={f} ctx={ctx} own />}
        {expects.length > 0 && (
          <span className="insp-expects"><span className="insp-expects-label">Expects</span>
            {expects.map(([word, text]) => <span key={word} className="insp-expects-part"><b>{word}</b> {text}</span>)}
          </span>
        )}
        {note && <span className="insp-muted insp-note">{note}</span>}
        {f.reason && (
          <details className="insp-details">
            <summary>Why it failed</summary>
            <pre className="insp-reason">{f.reason}</pre>
          </details>
        )}
        {also.length > 0 && (
          <span className="insp-chain">{concern ? 'Also' : 'Leaves unverified'}: {also.map((id) => <Chip key={id} id={id} ctx={ctx} status={concern ? undefined : 'broken'} />)}</span>
        )}
        {f.details && f.details.length > 0 && (
          <details className="insp-details">
            <summary>{concern ? (f.details.length === 1 ? '1 question' : `${f.details.length} questions`) : f.details.length === 1 ? '1 test' : `${f.details.length} tests`}</summary>
            <ul className={concern ? 'insp-questions' : undefined}>{f.details.map((d) => <li key={d}>{concern ? d : <code>{d}</code>}</li>)}</ul>
          </details>
        )}
      </div>
      <div className="insp-finding-acts">
        {fix && (
          <button type="button" className="insp-btn primary" disabled={!!offer.refused} title={offer.refused ?? offer.title}
            onClick={() => startFix(f.rule, node!, ctx.peek)}>{fix.label}{offer.suffix}</button>
        )}
        {concern && f.code && (
          <button type="button" className="insp-btn primary" title={f.details?.join('\n')} onClick={() => openConcern(f.code!, f.nodeId)}>Answer the questions…</button>
        )}
        {node && <button type="button" className="insp-btn" aria-label={`Open ${ctx.nodes[node].label}`} onClick={() => ctx.peek(node)}>Open</button>}
      </div>
    </div>
  )
}

/** Findings, the first few and then on request, those of one cause on one
 *  row; those about the branch's elements are marked. */
export function FindingList({ findings, ctx, branchIds }: { findings: CheckFinding[]; ctx: Ctx; branchIds?: ReadonlySet<string> | null }): React.ReactElement {
  const [shown, setShown] = useState(FINDINGS_SHOWN)
  // One row for one cause: a test or a measurement several elements name.
  const rows = byCause(findings)
  return (
    <>
      {rows.slice(0, shown).map(([f, ...same], i) => (
        <FindingRow key={`${f.nodeId ?? f.path ?? ''}-${i}`} f={f} same={same} ctx={ctx} branch={!!branchIds && [f, ...same].some((s) => isAbout(s, branchIds))} />
      ))}
      {rows.length > shown && <button type="button" className="insp-more" onClick={() => setShown(rows.length)}>Show {rows.length - shown} more</button>}
    </>
  )
}

/** Whether the rule of a group is the one asked for (a link of the chain,
 *  a goal not met): the group opens and comes into view. */
export function useRuleAsked(rule: string, open: () => void): { asked: boolean; ref: React.RefObject<HTMLDetailsElement> } {
  const focus = useRuleFocus()
  const asked = focus.rule === rule
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (!asked) return
    open()
    // Once it is open: its place in the list is its place on screen.
    requestAnimationFrame(() => ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked, focus.n])
  return { asked, ref }
}

/** One rule's findings as a group: what the rule means, its count and
 *  baseline, opening to its findings. */
export function FindingGroup({ g, ctx, branchIds }: { g: AttentionGroup; ctx: Ctx; branchIds?: ReadonlySet<string> | null }): React.ReactElement {
  const [open, setOpen] = useState(false)
  const { asked, ref } = useRuleAsked(g.rule, () => setOpen(true))
  const error = g.severity === 'error'
  return (
    <details ref={ref} className={`insp-group ${g.severity}${asked ? ' asked' : ''}`} open={open} onToggle={(e) => setOpen(e.currentTarget.open)} data-rule={g.key}>
      <summary>
        <span className={`insp-sev ${g.severity}`} aria-label={error ? 'Error' : 'Warning'}>{error ? '✖' : '⚠'}</span>
        <span><b className="insp-group-name">{g.name}</b><RuleText className="insp-rdesc" text={RULE_INFO.get(g.rule) ?? ''} /></span>
        {/* Against a baseline the check's own count; else what there is to look at. */}
        <span className="insp-rcount">{g.max !== undefined ? g.findings.length : byCause(g.findings).length}{g.max !== undefined && <small> · max {g.max}</small>}</span>
      </summary>
      {open && <div className="insp-group-items"><FindingList findings={g.findings} ctx={ctx} branchIds={branchIds} /></div>}
    </details>
  )
}
