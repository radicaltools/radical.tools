// ─── Inspector: Measurements ─────────────────────────────────────────────────
//
// What the sensors measured, by metric: each measurement with its labels,
// value, unit, source and age, and under it the scenarios and fitness
// functions whose conditions read it (the readers), each with the condition
// as written, its outcome and Path to its verification path, the whole
// evaluation flow from the need or ADR down to this value. After them the
// metric conditions nothing measured. A filter narrows all of it. The
// readers come from the check's evidence: a condition's result names the
// measurement it was decided by, so the tab and the card agree.

import React, { useMemo, useState } from 'react'
import { ELEMENT_LABEL, REVIEW_METRIC, formatAge, type Measurement } from '@radical/common/check'
import { Command } from '../BranchChanges'
import { measureCommands } from './attention'
import { PILL, formatValue, groupByMetric, keyOf, readersOf, when, type Reader, type Unmeasured } from './measurements'
import { Chip, MARK, tone, type Ctx } from './shared'

export { measurementsBadge } from './measurements'

function Labels({ labels, ctx }: { labels: Record<string, string>; ctx: Ctx }): React.ReactElement {
  const entries = Object.entries(labels)
  if (!entries.length) return <span className="insp-muted">no labels</span>
  return (
    <span className="insp-meas-labels">
      {entries.map(([k, v]) => k === ELEMENT_LABEL && ctx.nodes[v]
        ? <Chip key={k} id={v} ctx={ctx} />
        : <code key={k}>{k}={v}</code>)}
    </span>
  )
}

function ReaderRow({ r, ctx, onTrace }: { r: Reader; ctx: Ctx; onTrace: (id: string) => void }): React.ReactElement {
  const [cls, text] = PILL[r.outcome] ?? ['none', r.outcome]
  return (
    <li className="insp-meas-reader" data-outcome={r.outcome}>
      <span className={`insp-mark ${tone(r.outcome)}`}>{MARK[r.outcome] ?? '○'}</span>
      <Chip id={r.id} ctx={ctx} />
      {r.element && ctx.nodes[r.element] && <span className="insp-muted">for</span>}
      {r.element && ctx.nodes[r.element] && <Chip id={r.element} ctx={ctx} />}
      <code>{r.condition}</code>
      <span className={`insp-pill ${cls}`}>{text}</span>
      {r.detail && <span className="insp-muted">{r.detail}</span>}
      <button type="button" className="insp-btn insp-meas-path" onClick={() => onTrace(r.id)}
        title="The verification path: from its need or ADR to the tests and this measurement">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="3" cy="8" r="1.6" /><circle cx="13" cy="4" r="1.6" /><circle cx="13" cy="12" r="1.6" /><path d="M4.6 7.4 11.4 4.6M4.6 8.6l6.8 2.8" /></svg>
        Path
      </button>
    </li>
  )
}

/** Whether a measurement, with its readers, has `text` in its metric,
 *  labels, source, the element it is labelled with or its readers' names. */
function rowMatches(row: { m: Measurement; readers: Reader[] }, text: string, ctx: Ctx): boolean {
  const { m } = row
  const words = [m.metric, m.source, m.unit ?? '', ...Object.entries(m.labels).map(([k, v]) => `${k}=${v}`),
    ...Object.values(m.labels).map((v) => ctx.nodes[v]?.label ?? ''),
    ...row.readers.flatMap((r) => [ctx.nodes[r.id]?.label ?? '', r.element ? ctx.nodes[r.element]?.label ?? '' : '', r.condition])]
  return words.some((w) => w.toLowerCase().includes(text))
}

export function MeasurementsTab({ measurements, ctx, folder, onTrace }: {
  measurements: Measurement[] | null
  ctx: Ctx
  /** The folder's name, for the commands that measure. */
  folder: string
  /** Shows an element's verification path in place of the tab. */
  onTrace: (id: string) => void
}): React.ReactElement {
  const [filter, setFilter] = useState('')
  const text = filter.trim().toLowerCase()
  const { readers, unmeasured } = useMemo(() => readersOf(ctx.evidence), [ctx.evidence])
  const groups = useMemo(() => groupByMetric(measurements ?? [], readers), [measurements, readers])
  const now = Date.now()

  if (!measurements?.length) {
    return (
      <>
        <p className="insp-notice">Nothing measured beside this model yet. Measure what the fitness functions hold to with <code>radical sense</code>, which keeps the values in <code>.state/measurements.json</code>; Studio picks them up by itself.</p>
        {measureCommands(folder).map((c) => <Command key={c} text={c} />)}
        {unmeasured.length > 0 && <Waiting items={unmeasured} ctx={ctx} onTrace={onTrace} />}
      </>
    )
  }

  const shown = groups.map((g) => ({ ...g, rows: text ? g.rows.filter((r) => rowMatches(r, text, ctx)) : g.rows })).filter((g) => g.rows.length)
  const waiting = text ? unmeasured.filter((u) => [u.condition, ctx.nodes[u.id]?.label ?? '', u.element ? ctx.nodes[u.element]?.label ?? '' : ''].some((w) => w.toLowerCase().includes(text))) : unmeasured
  const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

  return (
    <>
      <p className="insp-lede insp-tab-lede">What the sensors measured, by metric: each value with its labels, its source and its age, and under it the scenarios and fitness functions whose conditions read it. <em>Path</em> shows the whole evaluation flow, from the need or ADR down to this value.</p>
      <div className="insp-meas-bar">
        <input type="search" className="insp-meas-filter" placeholder="Filter by metric, label, source or element…" aria-label="Filter measurements"
          value={filter} onChange={(e) => setFilter(e.target.value)} />
        <span className="insp-muted">{plural(measurements.length, 'measurement')} of {plural(groups.length, 'metric')}{text ? `, ${shown.reduce((n, g) => n + g.rows.length, 0)} shown` : ''}</span>
      </div>
      {shown.length === 0 && <p className="insp-muted insp-pad">No measurement matches.</p>}
      {shown.map((g) => (
        <section key={g.metric} className="insp-panel insp-metric" aria-label={g.metric} data-testid="insp-metric">
          <div className="insp-metric-head">
            <code className="insp-metric-name">{g.metric}</code>
            {g.unit && <span className="insp-muted">{g.unit}</span>}
            <span className="insp-muted">{plural(g.rows.length, 'measurement')} · by {g.sources.join(', ')} · {formatAge(Math.max(0, now - g.latest))} ago</span>
            {g.failed > 0 && <span className="insp-pill bad">✗ {g.failed} failed</span>}
            {g.stale > 0 && <span className="insp-pill warn">◷ {g.stale} stale</span>}
          </div>
          {g.rows.map(({ m, readers: own }) => (
            <div key={keyOf(m.metric, m.labels)} className={`insp-meas-row${own.some((r) => r.outcome === 'failed' || r.outcome === 'invalid') ? ' alert' : ''}`} data-testid="insp-measurement">
              <div className="insp-meas-main">
                <Labels labels={m.labels} ctx={ctx} />
                <span className="insp-meas-value"><b>{formatValue(m)}</b>{m.unit && m.metric !== REVIEW_METRIC ? ` ${m.unit}` : ''}</span>
                <span className="insp-muted" title={`${when(m.at)}${m.context ? ` · ${Object.entries(m.context).map(([k, v]) => `${k}=${v}`).join(', ')}` : ''}`}>
                  {m.source} · {formatAge(Math.max(0, now - Date.parse(m.at)))} ago
                </span>
              </div>
              <ul className="insp-meas-readers" aria-label="Read by">
                {own.map((r, i) => <ReaderRow key={i} r={r} ctx={ctx} onTrace={onTrace} />)}
                {!own.length && <li className="insp-muted">Read by no condition.</li>}
              </ul>
            </div>
          ))}
        </section>
      ))}
      {waiting.length > 0 && <Waiting items={waiting} ctx={ctx} onTrace={onTrace} />}
    </>
  )
}

/** The metric conditions no measurement matches, each with its element. */
function Waiting({ items, ctx, onTrace }: { items: Unmeasured[]; ctx: Ctx; onTrace: (id: string) => void }): React.ReactElement {
  return (
    <section className="insp-metric-waiting" aria-label="Not measured">
      <h2>Not measured</h2>
      <p className="insp-lede">Conditions whose metric and labels no measurement matches: they wait for a sensor.</p>
      <div className="insp-panel">
        <ul className="insp-meas-readers insp-meas-waiting" data-testid="insp-unmeasured">
          {items.map((u, i) => <ReaderRow key={i} r={{ id: u.id, ...(u.element ? { element: u.element } : {}), condition: u.condition, outcome: 'not-run' }} ctx={ctx} onTrace={onTrace} />)}
        </ul>
      </div>
    </section>
  )
}
