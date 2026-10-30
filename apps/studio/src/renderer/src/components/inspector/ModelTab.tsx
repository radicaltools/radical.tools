// ─── Inspector: Model quality ────────────────────────────────────────────────
//
// How good the model is on its own, before any test runs: a tile per
// dimension (as strong as its weakest metric), the chain from needs to
// tests, where the weakest metric falls short by group, the goals the
// model's check.json sets, and the findings by dimension.

import React, { useMemo, useState } from 'react'
import type { CheckMetricResult, CheckResult } from '@radical/common/check'
import type { C4Node, C4Relation } from '@radical/common/c4'
import { Bar, FindingsByDimension, GoalPill, MetricBar, dimensionOfKey, dimensionsOf, gatedDimension, metricOf, type Ctx } from './shared'

const weakest = (metrics: CheckMetricResult[]): CheckMetricResult | undefined =>
  metrics.reduce<CheckMetricResult | undefined>((w, m) => !w || m.count * w.total < w.count * m.total ? m : w, undefined)

/** A link of the traceability chain: the share of what is on its left that
 *  has what is on its right. A click opens the findings that break it. */
function Link({ m, text, onOpen }: { m: CheckMetricResult | undefined; text: string; onOpen: (rule: string) => void }): React.ReactElement | null {
  if (!m) return null
  const short = m.count < m.total
  return (
    <button type="button" className={`insp-link${short ? ' short' : ''}${m.met ? '' : ' bad'}`} onClick={() => m.rule && onOpen(m.rule)} disabled={!short}
      title={short ? `${m.total - m.count} of ${m.total} miss it: show them` : undefined}>
      <span className="insp-link-text">{m.percent}% {text}</span>
      <MetricBar m={m} />
    </button>
  )
}

const Stop = ({ label, value }: { label: string; value: number | string }): React.ReactElement =>
  <div className="insp-stop"><span className="insp-label">{label}</span><span className="insp-stop-n">{value}</span></div>

export function ModelTab({ check, ctx, relations, onSettings }: { check: CheckResult; ctx: Ctx; relations: Record<string, C4Relation>; onSettings: () => void }): React.ReactElement {
  const [focus, setFocus] = useState<string | null>(null)
  const open = (rule: string): void => { setFocus(null); requestAnimationFrame(() => setFocus(rule)) }
  const m = (id: string): CheckMetricResult | undefined => metricOf(check, id)

  const dims = dimensionsOf('model').map((d) => {
    const metrics = check.metrics.filter((x) => x.dimension === d.id)
    const errors = check.findings.filter((f) => f.severity === 'error' && dimensionOfKey(f.key) === d.id).length
    return { d, metrics, errors, weak: weakest(metrics), gated: gatedDimension(check, d.id) }
  })

  const elements = useMemo(() => new Set(Object.values(relations)
    .filter((r) => r.relationType === 'satisfies' && ctx.nodes[r.targetId]?.type === 'requirement' && ctx.nodes[r.sourceId])
    .map((r) => r.sourceId)).size, [relations, ctx.nodes])

  // Where the weakest metric with a rule falls short, by the group its
  // elements are in.
  const gaps = useMemo(() => {
    const metric = weakest(check.metrics.filter((x) => x.rule && x.count < x.total && dimensionsOf('model').some((d) => d.id === x.dimension)))
    if (!metric) return null
    const missing = check.findings.filter((f) => f.rule === metric.rule && f.nodeId && ctx.nodes[f.nodeId]).map((f) => ctx.nodes[f.nodeId!])
    const type = missing[0]?.type
    const groupOf = (n: C4Node): string => (n.parentId && ctx.nodes[n.parentId]?.label) || 'Top level'
    const rows = new Map<string, { missing: number; total: number }>()
    for (const n of Object.values(ctx.nodes)) {
      if (n.type !== type) continue
      const row = rows.get(groupOf(n)) ?? { missing: 0, total: 0 }
      row.total++
      rows.set(groupOf(n), row)
    }
    for (const n of new Set(missing)) rows.get(groupOf(n))!.missing++
    const list = [...rows].filter(([, r]) => r.missing).map(([name, r]) => ({ name, ...r })).sort((a, b) => b.missing - a.missing || b.total - a.total)
    return { metric, list }
  }, [check, ctx.nodes])
  const [allGaps, setAllGaps] = useState(false)

  const goals = check.metrics.filter((x) => x.min !== undefined && dimensionsOf('model').some((d) => d.id === x.dimension))
  const baselines = check.rules.filter((r) => r.max !== undefined && r.severity !== 'off' && dimensionsOf('model').some((d) => d.id === dimensionOfKey(r.id)))

  return (
    <>
      <p className="insp-lede insp-tab-lede">How good the model is on its own, before any test runs: does it follow its metamodel, is each record complete, and can each need be traced to what satisfies and verifies it. A dimension is as strong as its weakest metric.</p>

      <div className="insp-tiles">
        {dims.map(({ d, metrics, errors, weak, gated }) => (
          <div key={d.id} className="insp-tile" data-dimension={d.id}>
            <div className="insp-tile-head"><span className="insp-label">{d.label}</span><GoalPill metrics={metrics} errors={errors} gated={gated} /></div>
            <span className="insp-big">{weak ? `${weak.percent}%` : '—'}{weak?.min !== undefined && <small> · goal ≥ {weak.min}%</small>}</span>
            {weak ? <MetricBar m={weak} /> : <Bar parts={[[0, 'ok']]} />}
            <span className="insp-sub">{!weak ? 'Nothing to count in this model.' : weak.count === weak.total ? d.description : <>Weakest: {weak.label.toLowerCase()}, {weak.count} of {weak.total}.</>}</span>
          </div>
        ))}
      </div>

      {(m('requirements-satisfied') || m('requirements-with-scenario')) && (
        <section>
          <h2>Traceability chain</h2>
          <p className="insp-lede">Each link is the share of the elements on its left that have one on its right. Click a link that falls short for the elements that break it.</p>
          <div className="insp-panel insp-chainrow">
            {m('needs-with-requirement') && <><Stop label="Needs" value={m('needs-with-requirement')!.total} /><Link m={m('needs-with-requirement')} text="derive a requirement" onOpen={open} /></>}
            {m('requirements-satisfied') && <><Stop label="Requirements" value={m('requirements-satisfied')!.total} /><Link m={m('requirements-satisfied')} text="satisfied by an element" onOpen={open} /><Stop label="Elements" value={elements} /></>}
            {m('requirements-with-scenario') && <>
              <span className="insp-chain-sep" aria-hidden="true" />
              <Stop label="Requirements" value={m('requirements-with-scenario')!.total} />
              <Link m={m('requirements-with-scenario')} text="verified by a scenario" onOpen={open} />
            </>}
            {m('scenarios-with-metrics') && <><Stop label="Scenarios" value={m('scenarios-with-metrics')!.total} /><Link m={m('scenarios-with-metrics')} text="name a check" onOpen={open} /><Stop label="Tests" value="→" /></>}
          </div>
        </section>
      )}

      <div className="insp-two">
        {gaps && (
          <section>
            <h2>Gaps by group</h2>
            <p className="insp-lede">Where the weakest link is thinnest: {gaps.metric.label.toLowerCase()}, by the group they are in.</p>
            <div className="insp-panel insp-rows">
              {(allGaps ? gaps.list : gaps.list.slice(0, 7)).map((g) => (
                <div key={g.name} className="insp-row">
                  <span className="insp-row-name" title={g.name}>{g.name}</span>
                  <Bar parts={[[g.total - g.missing, 'ok'], [g.missing, 'none']]} />
                  <span className="insp-num"><b>{g.missing}</b> of {g.total} miss it</span>
                </div>
              ))}
              {!allGaps && gaps.list.length > 7 && <button type="button" className="insp-more" onClick={() => setAllGaps(true)}>Show all {gaps.list.length} groups</button>}
            </div>
          </section>
        )}
        <section>
          <h2>Goals</h2>
          <p className="insp-lede">What <code>check.json</code> asks of the model. <button type="button" className="insp-inline-link" onClick={onSettings}>Change goals</button></p>
          <div className="insp-panel insp-goals">
            {goals.length + baselines.length === 0 && <p className="insp-muted insp-pad">No goals and no baselines yet: the rules alone decide.</p>}
            {goals.length + baselines.length > 0 && <div className="insp-goal head"><span className="insp-label">Goal</span><span className="insp-label">Now</span><span className="insp-label">Target</span><span /></div>}
            {goals.map((g) => (
              <div key={g.id} className="insp-goal">
                <span>{g.label}</span><b>{g.percent}%</b><span>≥ {g.min}%</span>
                <span className={`insp-pill ${g.met ? 'ok' : 'bad'}`}>{g.met ? '✓' : '✗'}</span>
              </div>
            ))}
            {baselines.map((r) => (
              <div key={r.id} className="insp-goal">
                <code>{r.id}</code><b>{r.count}</b><span>≤ {r.max}</span>
                {r.count > r.max! ? <span className="insp-pill bad">✗</span>
                  : r.count < r.max! ? <span className="insp-pill warn" title={`${r.max! - r.count} under its baseline: Ratchet in Settings lowers it`}>↓ {r.max! - r.count}</span>
                    : <span className="insp-pill ok">✓</span>}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section>
        <h2>Findings by dimension</h2>
        <p className="insp-lede">Every rule about the model, grouped as above. Each finding links to its element.</p>
        <FindingsByDimension check={check} ctx={ctx} perspective="model" focus={focus} />
      </section>
    </>
  )
}
