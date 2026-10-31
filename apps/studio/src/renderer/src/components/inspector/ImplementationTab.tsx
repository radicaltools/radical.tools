// ─── Inspector: Implementation ───────────────────────────────────────────────
//
// How faithfully the code follows the model, by what the last test reports
// say: requirements verified by scenarios and their functional tests,
// decisions verified by fitness functions, tests the model does not name,
// coverage by element of the architecture, and the checks that do not run.

import React, { useMemo, useState } from 'react'
import type { CheckMetricResult, CheckResult, EvidenceEntry } from '@radical/common/check'
import type { C4Node, C4Relation } from '@radical/common/c4'
import { Bar, Chip, FindingsByDimension, GoalPill, MetricBar, PASSING, metricOf, tally, type Ctx } from './shared'

function MetricTile({ m, label, notes }: { m: CheckMetricResult | undefined; label: string; notes: React.ReactNode }): React.ReactElement {
  return (
    <div className="insp-tile">
      <div className="insp-tile-head"><span className="insp-label">{label}</span>{m && <GoalPill metrics={[m]} />}</div>
      <span className="insp-big">{m ? `${m.percent}%` : '—'}{m && <small> · {m.count} / {m.total}</small>}</span>
      {m ? <MetricBar m={m} /> : <Bar parts={[[0, 'ok']]} />}
      <span className="insp-sub">{notes}</span>
    </div>
  )
}

/** From the whole population to what is verified, each step with what falls out. */
function Funnel({ steps }: { steps: Array<{ label: React.ReactNode; count: number; goal?: number }> }): React.ReactElement {
  const total = steps[0]?.count ?? 0
  return (
    <div className="insp-panel insp-funnel">
      {steps.map((s, i) => (
        <div key={i} className="insp-step">
          <div className="insp-step-bar"><span>{s.label}</span><Bar parts={[[s.count, 'ok'], [total - s.count, 'none']]} goal={s.goal} /></div>
          <span className="insp-num"><b>{s.count}</b>{i > 0 && steps[i - 1].count > s.count && <> · −{steps[i - 1].count - s.count}</>}</span>
        </div>
      ))}
    </div>
  )
}

const count = (entries: EvidenceEntry[], status: string): number => entries.filter((e) => e.status === status).length
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

/** Why a scenario or fitness function does not count as passing. */
function reason(e: EvidenceEntry): string {
  if (e.status === 'no-checks') return 'names no check'
  const off = (e.conditions ?? []).filter((c) => c.outcome !== 'passed')
  const kinds = [...new Set(off.map((c) => `${c.test ? 'test' : 'metric'}:${c.outcome}`))]
  const say: Record<string, string> = {
    'test:failed': 'a test failed', 'test:not-found': 'a test is gone', 'test:skipped': 'its test was skipped', 'test:not-run': 'no report has its test',
    'metric:failed': 'a value is off its threshold', 'metric:stale': 'a measurement is too old', 'metric:not-run': 'nothing measured a value', 'metric:invalid': 'a condition cannot be read',
  }
  return kinds.map((k) => say[k] ?? k.split(':')[1]).join(', ')
}

const PILL: Record<string, [string, string]> = { failed: ['bad', 'failed'], stale: ['warn', 'stale'], 'not-run': ['warn', 'not run'], 'no-checks': ['none', 'no check'] }

export function ImplementationTab({ check, ctx, relations, onSettings }: {
  check: CheckResult; ctx: Ctx; relations: Record<string, C4Relation>; onSettings: () => void
}): React.ReactElement {
  const ev = check.evidence?.nodes
  const m = (id: string): CheckMetricResult | undefined => metricOf(check, id)
  const [allElements, setAllElements] = useState(false)
  const [allAttention, setAllAttention] = useState(false)

  const view = useMemo(() => {
    const entries = Object.entries(ev ?? {})
    const ofType = (type: string): EvidenceEntry[] => entries.filter(([, e]) => e.type === type).map(([, e]) => e)
    const statusOf = (id: string): string | undefined => ev?.[id]?.status
    const satisfied = new Map<string, string[]>()
    for (const r of Object.values(relations)) {
      if (r.relationType === 'satisfies' && ctx.nodes[r.targetId]?.type === 'requirement' && ctx.nodes[r.sourceId]) satisfied.set(r.sourceId, [...(satisfied.get(r.sourceId) ?? []), r.targetId])
    }
    const elements = [...satisfied].map(([id, reqs]) => ({ id, t: tally(reqs.map(statusOf)), total: reqs.length }))
      .sort((a, b) => (b.total - b.t.ok) - (a.total - a.t.ok) || a.t.ok / a.total - b.t.ok / b.total)
    // What the checkers that do not pass leave unverified.
    const leaves = (id: string): string[] => Object.values(relations)
      .filter((r) => r.sourceId === id && (r.relationType === 'verifies' || r.relationType === 'implements'))
      .map((r) => r.targetId).filter((t) => ctx.nodes[t] && !PASSING.has(statusOf(t) ?? ''))
    const order = ['failed', 'stale', 'not-run', 'no-checks']
    const attention = entries.filter(([, e]) => (e.type === 'scenario' || e.type === 'fitness-fn') && e.status !== 'passed')
      .map(([id, e]) => ({ id, e, leaves: leaves(id) }))
      .sort((a, b) => order.indexOf(a.e.status) - order.indexOf(b.e.status) || b.leaves.length - a.leaves.length || Number(b.e.type === 'fitness-fn') - Number(a.e.type === 'fitness-fn'))
    const adrsWithout = Object.values(ctx.nodes).filter((n: C4Node) => n.type === 'adr' && (n as unknown as Record<string, unknown>).status === 'accepted'
      && !Object.values(relations).some((r) => r.relationType === 'implements' && r.targetId === n.id && ctx.nodes[r.sourceId]?.type === 'fitness-fn')).map((n) => n.id)
    const outcomes = entries.flatMap(([, e]) => e.tests ?? [])
    return {
      requirements: ofType('requirement'), adrs: ofType('adr'), scenarios: ofType('scenario'), ffs: ofType('fitness-fn'),
      elements, attention, adrsWithout,
      failedTests: outcomes.filter((t) => t.outcome === 'failed').length,
      goneTests: outcomes.filter((t) => t.outcome === 'not-found').length,
      skippedTests: outcomes.filter((t) => t.outcome === 'skipped').length,
    }
  }, [ev, relations, ctx.nodes])

  if (!ev) {
    return <p className="insp-notice">No test results or measurements beside this model yet. Run <code>radical check &lt;folder&gt; --report &lt;reports&gt;</code> to see which requirements and decisions the tests verify, and <code>radical sense &lt;adapter&gt;</code> to measure the values the fitness functions hold to; Studio picks them up by itself.</p>
  }

  const unbound = check.findings.filter((f) => f.rule === 'test-unbound')
  const bound = m('tests-bound')
  const attentionShown = allAttention ? view.attention : view.attention.slice(0, 8)

  return (
    <>
      <p className="insp-lede insp-tab-lede">How faithfully the code follows the model, by what the tests say. Behaviour: requirements are verified by scenarios, which name functional tests. Decisions: accepted ADRs are verified by the fitness functions that implement them. And the other way round: tests the model does not name.</p>

      <div className="insp-tiles">
        <MetricTile m={m('requirements-verified')} label="Requirements verified"
          notes={<><span><i className="insp-dot bad" />{count(view.requirements, 'broken')} broken</span><span><i className="insp-dot none" />{count(view.requirements, 'unverified')} unverified</span></>} />
        <MetricTile m={m('adrs-verified')} label="Decisions verified"
          notes={<><span><i className="insp-dot bad" />{count(view.adrs, 'broken')} broken</span><span><i className="insp-dot none" />{count(view.adrs, 'unverified')} without a passing check</span></>} />
        <MetricTile m={m('named-tests-passing')} label="Named tests passing"
          notes={<span>{view.failedTests} failed · {view.goneTests} gone · {view.skippedTests} skipped</span>} />
        {bound ? <MetricTile m={bound} label="Tests the model names" notes={<span>{unbound.length ? `${plural(bound.total - bound.count, 'test')} in ${plural(unbound.length, 'file')} no scenario names` : 'Every included test is named'}</span>} />
          : (
            <div className="insp-tile">
              <div className="insp-tile-head"><span className="insp-label">Tests the model names</span><span className="insp-pill none">not set up</span></div>
              <span className="insp-big">—</span>
              <span className="insp-sub">Say which test files the model should name all tests of in <button type="button" className="insp-inline-link" onClick={onSettings}>Settings</button> (test-unbound, Include).</span>
            </div>
          )}
      </div>

      <div className="insp-two">
        <section>
          <h2>Behaviour · functional tests</h2>
          <p className="insp-lede">From requirement to a passing test. Each step drops what falls out of it.</p>
          {m('requirements-verified') && <Funnel steps={[
            { label: 'Requirements', count: m('requirements-verified')!.total },
            ...(m('requirements-with-scenario') ? [{ label: '… with a scenario', count: m('requirements-with-scenario')!.count }] : []),
            { label: <><b>… verified</b>: their scenarios name tests, and all passed</>, count: m('requirements-verified')!.count, goal: m('requirements-verified')!.min },
          ]} />}
          <p className="insp-muted insp-foot">{plural(view.scenarios.length, 'scenario')}: {count(view.scenarios, 'passed')} passed · {count(view.scenarios, 'failed')} failed · {count(view.scenarios, 'stale')} stale · {count(view.scenarios, 'not-run')} not run · {count(view.scenarios, 'no-checks')} name no check</p>
        </section>
        <section>
          <h2>Decisions · fitness functions</h2>
          <p className="insp-lede">From accepted ADR to a passing automated check.</p>
          {m('adrs-verified') && <Funnel steps={[
            { label: 'Accepted ADRs', count: m('adrs-verified')!.total },
            ...(m('adrs-with-fitness-fn') ? [{ label: '… with a fitness function', count: m('adrs-with-fitness-fn')!.count }] : []),
            { label: <><b>… verified</b>: their checks name tests or values, and all passed</>, count: m('adrs-verified')!.count, goal: m('adrs-verified')!.min },
          ]} />}
          <p className="insp-muted insp-foot">{plural(view.ffs.length, 'fitness function')}: {count(view.ffs, 'passed')} passed · {count(view.ffs, 'failed')} failed · {count(view.ffs, 'stale')} stale · {count(view.ffs, 'not-run')} not run · {count(view.ffs, 'no-checks')} name no check</p>
        </section>
      </div>

      <div className="insp-two">
        {view.elements.length > 0 && (
          <section>
            <h2>By architecture element</h2>
            <p className="insp-lede">The requirements each element satisfies, by what the tests say. Most left unverified first.</p>
            <div className="insp-panel insp-rows">
              {(allElements ? view.elements : view.elements.slice(0, 8)).map((e) => (
                <div key={e.id} className={`insp-row${e.t.bad ? ' alert' : ''}`}>
                  <span className="insp-row-name"><Chip id={e.id} ctx={ctx} /></span>
                  <Bar parts={[[e.t.ok, 'ok'], [e.t.bad, 'bad'], [e.t.none, 'none']]} />
                  <span className="insp-num">{e.t.bad ? <b>{e.t.bad} broken</b> : <><b>{e.t.ok}</b> / {e.total}</>}</span>
                </div>
              ))}
              {!allElements && view.elements.length > 8 && <button type="button" className="insp-more" onClick={() => setAllElements(true)}>All {view.elements.length} elements</button>}
            </div>
          </section>
        )}
        <section>
          <h2>Needs attention</h2>
          <p className="insp-lede">Scenarios and fitness functions that do not pass, and what they leave unverified.</p>
          <div className="insp-panel insp-attn">
            {view.attention.length === 0 && view.adrsWithout.length === 0 && <p className="insp-muted insp-pad">Every scenario and fitness function passed.</p>}
            {attentionShown.map(({ id, e, leaves }) => (
              <div key={id} className="insp-attn-item">
                <div className="insp-chips"><span className={`insp-pill ${PILL[e.status]?.[0] ?? 'none'}`}>{PILL[e.status]?.[1] ?? e.status}</span><Chip id={id} ctx={ctx} /><span className="insp-muted">{reason(e)}</span></div>
                {leaves.length > 0 && <div className="insp-chips insp-muted">Leaves unverified {leaves.map((l) => <Chip key={l} id={l} ctx={ctx} />)}</div>}
              </div>
            ))}
            {!allAttention && view.attention.length > 8 && <button type="button" className="insp-more" onClick={() => setAllAttention(true)}>Show {view.attention.length - 8} more</button>}
            {view.adrsWithout.length > 0 && (
              <div className="insp-attn-item">
                <div className="insp-chips"><span className="insp-pill none">no check</span>{view.adrsWithout.map((id) => <Chip key={id} id={id} ctx={ctx} />)}</div>
                <div className="insp-muted">No fitness function implements {view.adrsWithout.length === 1 ? 'it' : 'them'}.</div>
              </div>
            )}
          </div>
        </section>
      </div>

      <section>
        <h2>Findings by dimension</h2>
        <p className="insp-lede">The rules about the tests, and the goals on what they verify.</p>
        <FindingsByDimension check={check} ctx={ctx} perspective="implementation" />
      </section>
    </>
  )
}
