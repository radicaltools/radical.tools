// ─── Inspector: Overview ─────────────────────────────────────────────────────
//
// Where the Inspector opens: a score for each dimension of the model and for
// what the tests verify, each leading to its tab, and what needs attention:
// the findings, errors first, by rule, each with its element, Open and, where
// the fix is one step, the action that starts it. The list can be narrowed
// to the elements the branch changed.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { CheckFinding, CheckMetricResult, CheckResult } from '@radical/common/check'
import type { C4Relation } from '@radical/common/c4'
import { openConcern } from '../../persistence/inspector'
import { attentionGroups, measuredWhen, notRunItems, unverifiedBreakdown, type AttentionGroup, type NotRunItem } from './attention'
import { ONE_STEP_FIXES, startFix } from './fixes'
import { Bar, Chip, GoalPill, Message, MetricBar, RULE_INFO, metricOf, modelScores, type Ctx } from './shared'

const FINDINGS_SHOWN = 8

function ScoreCard({ label, m, pill, sub, onOpen, data }: {
  label: string; m: CheckMetricResult | undefined; pill: React.ReactNode; sub: React.ReactNode; onOpen: () => void
  data: Record<string, string>
}): React.ReactElement {
  return (
    <button type="button" className="insp-tile insp-score" onClick={onOpen} {...data}>
      <span className="insp-tile-head"><span className="insp-label">{label}</span>{pill}</span>
      <span className="insp-big">{m ? `${m.percent}%` : '—'}{m?.min !== undefined && <small> · goal ≥ {m.min}%</small>}</span>
      {m ? <MetricBar m={m} /> : <Bar parts={[[0, 'ok']]} />}
      <span className="insp-sub">{sub}</span>
    </button>
  )
}

/** One finding: its element, what is wrong, Open and the fix of one step. */
function Finding({ f, ctx, onCreated }: { f: CheckFinding; ctx: Ctx; onCreated: (id: string) => void }): React.ReactElement {
  const node = f.nodeId && ctx.nodes[f.nodeId] ? f.nodeId : null
  const fix = node ? ONE_STEP_FIXES[f.rule] : undefined
  return (
    <div className="insp-finding" data-rule={f.rule}>
      <div className="insp-finding-what">
        {node && <Chip id={node} ctx={ctx} />}
        {f.path && !node && <code className="insp-path">{f.path}</code>}
        <Message f={f} ctx={ctx} own />
        {f.relatedIds && f.relatedIds.length > 0 && f.rule !== 'concern-unaddressed' && (
          <span className="insp-chain">Not verified now: {f.relatedIds.map((id) => <Chip key={id} id={id} ctx={ctx} status="broken" />)}</span>
        )}
      </div>
      <div className="insp-finding-acts">
        {fix && <button type="button" className="insp-btn primary" onClick={() => startFix(f.rule, node!, onCreated)}>{fix.label}</button>}
        {f.rule === 'concern-unaddressed' && f.code && (
          <button type="button" className="insp-btn primary" title={f.details?.join('\n')} onClick={() => openConcern(f.code!, f.nodeId)}>Answer the questions…</button>
        )}
        {node && <button type="button" className="insp-btn" aria-label={`Open ${ctx.nodes[node].label}`} onClick={() => ctx.peek(node)}>Open</button>}
      </div>
    </div>
  )
}

function Group({ g, ctx, onCreated }: { g: AttentionGroup; ctx: Ctx; onCreated: (id: string) => void }): React.ReactElement {
  const [shown, setShown] = useState(FINDINGS_SHOWN)
  const error = g.severity === 'error'
  return (
    <details className={`insp-group ${g.severity}`} open={error || undefined} data-rule={g.key}>
      <summary>
        <span className={`insp-sev ${g.severity}`} aria-label={error ? 'Error' : 'Warning'}>{error ? '✖' : '⚠'}</span>
        <span><b className="insp-group-name">{g.name}</b><span className="insp-rdesc">{RULE_INFO.get(g.rule) ?? ''}</span></span>
        <span className="insp-rcount">{g.findings.length}{g.max !== undefined && <small> · max {g.max}</small>}</span>
      </summary>
      <div className="insp-group-items">
        {g.findings.slice(0, shown).map((f, i) => <Finding key={`${f.nodeId ?? f.path ?? ''}-${i}`} f={f} ctx={ctx} onCreated={onCreated} />)}
        {g.findings.length > shown && <button type="button" className="insp-more" onClick={() => setShown(g.findings.length)}>Show {g.findings.length - shown} more</button>}
      </div>
    </details>
  )
}

/** What the checks did not run here: the gaps, and in a muted style what
 *  runs on another event and is expected not to have run. */
function NotRun({ items, ctx }: { items: NotRunItem[]; ctx: Ctx }): React.ReactElement {
  const [shown, setShown] = useState(FINDINGS_SHOWN)
  return (
    <details className="insp-group warning insp-notrun" data-rule="not-run">
      <summary>
        <span className="insp-sev warning" aria-label="Warning">◷</span>
        <span><b className="insp-group-name">Not run</b><span className="insp-rdesc">Scenarios and fitness functions whose checks nothing ran in the results and measurements here.</span></span>
        <span className="insp-rcount">{items.length}</span>
      </summary>
      <div className="insp-group-items">
        {items.slice(0, shown).map((item) => (
          <div key={item.id} className={`insp-finding${item.expected ? ' expected' : ''}`} data-trigger={item.trigger}>
            <div className="insp-finding-what">
              <Chip id={item.id} ctx={ctx} />
              <span className={`insp-pill ${item.expected ? 'none' : 'warn'}`} title="When it runs">{item.trigger}</span>
              <span className="insp-msg">{item.why.join('; ')}.</span>
              {item.expected && <span className="insp-muted insp-expected">measured {measuredWhen(item.trigger)} — expected here</span>}
            </div>
            <div className="insp-finding-acts">
              <button type="button" className="insp-btn" aria-label={`Open ${item.label}`} onClick={() => ctx.peek(item.id)}>Open</button>
            </div>
          </div>
        ))}
        {items.length > shown && <button type="button" className="insp-more" onClick={() => setShown(items.length)}>Show {items.length - shown} more</button>}
      </div>
    </details>
  )
}

export function OverviewTab({ check, ctx, relations, branchIds, noBranch, onTab, focus, onCreated }: {
  check: CheckResult; ctx: Ctx; relations: Record<string, C4Relation>
  /** The elements changed on the branch; null without a base. */
  branchIds: ReadonlySet<string> | null
  /** Why This branch cannot narrow the list, when it cannot. */
  noBranch: string
  onTab: (tab: 'model' | 'implementation') => void
  /** Changes each time Needs attention is to be brought into view. */
  focus: number
  onCreated: (id: string) => void
}): React.ReactElement {
  const [onBranch, setOnBranch] = useState(false)
  const only = onBranch && branchIds ? branchIds : undefined
  const groups = useMemo(() => attentionGroups(check, only), [check, only])
  const notRun = useMemo(() => notRunItems(check.evidence?.nodes, ctx.nodes, relations, check.findings)
    .filter((item) => !only || only.has(item.id) || item.checks.some((id) => only.has(id))), [check, ctx.nodes, relations, only])
  const why = useMemo(() => ({
    'requirements-verified': unverifiedBreakdown('requirement', check.evidence?.nodes, ctx.nodes),
    'adrs-verified': unverifiedBreakdown('adr', check.evidence?.nodes, ctx.nodes),
  } as Record<string, ReturnType<typeof unverifiedBreakdown>>), [check, ctx.nodes])
  const section = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!focus) return
    section.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    section.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
  }, [focus])

  const ev = !!check.evidence
  const impl: Array<[string, string, string]> = [
    ['requirements-verified', 'Requirements verified', 'by scenarios whose tests passed'],
    ['adrs-verified', 'Decisions verified', 'by fitness functions whose checks passed'],
    ['named-tests-passing', 'Named tests passing', 'of the tests the model names'],
  ]
  const errors = groups.filter((g) => g.severity === 'error').reduce((n, g) => n + g.findings.length, 0)
  const warnings = groups.reduce((n, g) => n + g.findings.length, 0) - errors

  return (
    <>
      <p className="insp-lede insp-tab-lede">Where the model stands, and what to do next. A score leads to its tab; each finding below leads to its element, and where the fix is one step, starts it.</p>

      <div className="insp-scores">
        <section className="insp-score-group" aria-label="Model scores">
          <span className="insp-label">Model</span>
          <div className="insp-score-row">
            {modelScores(check).map(({ d, metrics, errors: n, weak, gated }) => (
              <ScoreCard key={d.id} label={d.label} m={weak} data={{ 'data-dimension': d.id }} onOpen={() => onTab('model')}
                pill={<GoalPill metrics={metrics} errors={n} gated={gated} />}
                sub={!weak ? 'Nothing to count in this model.' : weak.count === weak.total ? 'Every metric met in full.' : <>Weakest: {weak.label.toLowerCase()}, {weak.count} of {weak.total}.</>} />
            ))}
          </div>
        </section>
        <section className="insp-score-group" aria-label="Implementation scores">
          <span className="insp-label">Implementation</span>
          <div className="insp-score-row">
            {impl.map(([id, label, what]) => {
              const m = ev ? metricOf(check, id) : undefined
              return (
                <ScoreCard key={id} label={label} m={m} data={{ 'data-metric': id }} onOpen={() => onTab('implementation')}
                  pill={!ev ? <span className="insp-pill none">needs test results</span> : m ? <GoalPill metrics={[m]} /> : <span className="insp-pill none">nothing to count</span>}
                  sub={!ev ? 'Read test results or measurements to see it.' : !m ? 'Nothing to count in this model.'
                    : why[id]?.length ? <span className="insp-why">{m.count} of {m.total} · {why[id].map((p) => <span key={p.key} data-why={p.key}>{p.text}</span>)}</span>
                      : <>{m.count} of {m.total} {what}.</>} />
              )
            })}
          </div>
        </section>
      </div>

      <section ref={section} className="insp-attention" aria-label="Needs attention">
        <div className="insp-sec-head">
          <div>
            <h2 tabIndex={-1}>Needs attention</h2>
            <p className="insp-lede">What the check finds, errors first and then warnings, by rule. Errors fail the check in CI; a warning within its baseline does not.</p>
          </div>
          <span className="insp-seg" role="group" aria-label="Findings about">
            <button type="button" aria-pressed={onBranch} disabled={!branchIds} title={branchIds ? 'Only the findings about elements changed on this branch' : noBranch}
              onClick={() => setOnBranch(true)}>This branch</button>
            <button type="button" aria-pressed={!onBranch} onClick={() => setOnBranch(false)}>All</button>
          </span>
        </div>
        <div className="insp-panel insp-groups">
          {groups.length === 0 && notRun.length === 0
            ? <p className="insp-muted insp-pad">{only ? 'Nothing the check finds is about the elements changed on this branch.' : 'The check finds nothing.'}</p>
            : <>
              <p className="insp-muted insp-groups-sum">{errors} error{errors === 1 ? '' : 's'} · {warnings} warning{warnings === 1 ? '' : 's'}{only ? ' about the elements changed on this branch' : ''}</p>
              {groups.map((g) => <Group key={`${g.severity}:${g.key}`} g={g} ctx={ctx} onCreated={onCreated} />)}
              {notRun.length > 0 && <NotRun items={notRun} ctx={ctx} />}
            </>}
        </div>
      </section>
    </>
  )
}
