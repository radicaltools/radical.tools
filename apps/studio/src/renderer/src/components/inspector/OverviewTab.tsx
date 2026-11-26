// ─── Inspector: Overview ─────────────────────────────────────────────────────
//
// Where the Inspector opens: a score for each dimension of the model and
// for what the tests verify, each leading to its tab, and under them what
// is to fix (ToFix: only what fails the check, as what has to be settled
// for it to pass). What the check finds that does not fail it is the Debt
// tab's. The verdict in the bar brings To fix into view.

import React, { useMemo } from 'react'
import type { CheckMetricResult, CheckResult } from '@radical/common/check'
import { unverifiedBreakdown } from './attention'
import { Bar, GoalPill, MetricBar, metricOf, modelScores, type Ctx } from './shared'
import { ToFix } from './ToFixSection'
import { toFix } from './toFix'

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

export function OverviewTab({ check, ctx, branchIds, debt, onTab, onDebt, focus }: {
  check: CheckResult; ctx: Ctx
  /** The elements changed on the branch; null without a base. */
  branchIds: ReadonlySet<string> | null
  /** How many findings do not fail the check (the Debt tab's). */
  debt: number
  onTab: (tab: 'model' | 'implementation') => void
  onDebt: () => void
  /** Changes each time To fix is to be brought into view. */
  focus: number
}): React.ReactElement {
  const items = useMemo(() => toFix(check, branchIds), [check, branchIds])
  const why = useMemo(() => ({
    'requirements-verified': unverifiedBreakdown('requirement', check.evidence?.nodes, ctx.nodes),
    'adrs-verified': unverifiedBreakdown('adr', check.evidence?.nodes, ctx.nodes),
  } as Record<string, ReturnType<typeof unverifiedBreakdown>>), [check, ctx.nodes])

  const ev = !!check.evidence
  const impl: Array<[string, string, string]> = [
    ['requirements-verified', 'Requirements verified', 'by scenarios whose tests passed'],
    ['adrs-verified', 'Decisions verified', 'by fitness functions whose checks passed'],
    ['named-tests-passing', 'Named tests passing', 'of the tests the model names'],
  ]

  return (
    <>
      <section aria-label="Scores">
        <h2>Scores</h2>
        <p className="insp-lede">Where the model stands, and how much of it the tests verify. A score leads to its tab.</p>
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
      </section>

      <ToFix items={items} check={check} ctx={ctx} branchIds={branchIds} debt={debt} onTab={onTab} onDebt={onDebt} focus={focus} />
    </>
  )
}
