// ─── Inspector: how old the evidence is ──────────────────────────────────────
//
// A chip in the header for each kind of evidence the check reads: the test
// results, the measurements `radical sense` took and the reviews of the
// manual fitness functions. A chip is marked when the model changed after
// what it reads (or, when Studio cannot tell, when that is older than a
// day), and opens to when it was read, from what, and the command that
// reads it again.

import React, { useEffect, useRef, useState } from 'react'
import { formatAge, type Measurement, type TestResults } from '@radical/common/check'
import { Command } from '../BranchChanges'
import { isOutdated, latestOf, measureCommands, measuredWhen, reviewCommand, runsWithPullRequest, testsAge, testsCommand } from './attention'

const when = (at: number): string => new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

interface ChipProps {
  name: string
  /** What the chip says after the name; none: "No <name>". */
  text?: string
  marked: boolean
  /** Nothing of this kind beside the model. */
  none?: boolean
  why: string
  children: React.ReactNode
}

function Chip({ name, text, marked, none, why, children }: ChipProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key) }
  }, [open])
  return (
    <span className="insp-age-wrap" ref={box}>
      <button type="button" className={`insp-age${marked ? ' marked' : ''}${none ? ' none' : ''}`} aria-haspopup="dialog" aria-expanded={open}
        title={marked ? why : undefined} onClick={() => setOpen((o) => !o)}>
        {marked && <span aria-hidden="true">◷ </span>}{none ? `No ${name.toLowerCase()}` : <>{name} <b>{text}</b></>}
      </button>
      {open && <div className="insp-age-pop" role="dialog" aria-label={name}>{children}</div>}
    </span>
  )
}

export function FreshnessChips({ results, measurements, folder, changedAt, waiting }: {
  results: TestResults | null; measurements: Measurement[] | null; folder: string
  /** The fitness functions whose metric conditions wait for a measurement. */
  waiting: Array<{ id: string; label: string; trigger: string }>
  /** When the model last changed, when Studio knows (modelChangedAt). */
  changedAt: number | null
}): React.ReactElement {
  const now = Date.now()
  const why = changedAt != null ? 'The model changed after these were read: they may not hold for it now.' : 'Older than a day: the model or the code may have changed since.'
  const readAt = results ? Date.parse(results.readAt) : null
  const sensed = latestOf(measurements, false)
  const reviewed = latestOf(measurements, true)
  return (
    <span className="insp-ages" aria-label="Evidence">
      {readAt !== null ? (
        <Chip name="Tests" text={testsAge(readAt, now)} marked={isOutdated(readAt, now, changedAt)} why={why}>
          <p><b>Test results read {when(readAt)}</b>, {plural(results!.cases.length, 'test case')}.</p>
          {isOutdated(readAt, now, changedAt) && <p className="insp-age-why">{why}</p>}
          <p className="insp-muted">From {results!.reports.length ? results!.reports.map((r, i) => <React.Fragment key={r}>{i ? ', ' : ''}<code>{r}</code></React.Fragment>) : 'no report named'}.</p>
          <p>Read them again in the repository:</p>
          <Command text={testsCommand(folder)} />
        </Chip>
      ) : (
        <Chip name="Tests" marked={false} none why={why}>
          <p><b>No test results beside this model.</b></p>
          <p>Run the tests and read their reports in the repository:</p>
          <Command text={testsCommand(folder)} />
        </Chip>
      )}
      {sensed ? (
        <Chip name="Measurements" text={formatAge(now - sensed.at)} marked={isOutdated(sensed.at, now, changedAt)} why={why}>
          <p><b>Last measured {when(sensed.at)}</b>, {plural(sensed.count, 'measurement')}.</p>
          {isOutdated(sensed.at, now, changedAt) && <p className="insp-age-why">{why}</p>}
          <p className="insp-muted">By {sensed.sources.map((s, i) => <React.Fragment key={s}>{i ? ', ' : ''}<code>{s}</code></React.Fragment>)}.</p>
          <p>Measure again, and read what was measured:</p>
          {measureCommands(folder).map((c) => <Command key={c} text={c} />)}
        </Chip>
      ) : (
        <Chip name="Measurements" marked={false} none why={why}>
          <p><b>Nothing measured beside this model.</b></p>
          {waiting.length > 0 ? <>
            <p>{plural(waiting.length, 'fitness function')} wait{waiting.length === 1 ? 's' : ''} for a measurement:</p>
            <ul className="insp-age-list">
              {waiting.map((w) => (
                <li key={w.id}><span>{w.label}</span> <span className={`insp-pill ${runsWithPullRequest(w.trigger) ? 'warn' : 'none'}`}>{w.trigger}</span></li>
              ))}
            </ul>
            {waiting.some((w) => runsWithPullRequest(w.trigger)) && <>
              <p>Measure those that run with a pull request here, and read what was measured:</p>
              {measureCommands(folder, 'pull-request').map((c) => <Command key={c} text={c} />)}
            </>}
            {waiting.some((w) => !runsWithPullRequest(w.trigger)) && (
              <p className="insp-muted">Those measured {[...new Set(waiting.filter((w) => !runsWithPullRequest(w.trigger)).map((w) => measuredWhen(w.trigger)))].join(', ')} are not measured here: the nightly workflow measures the nightly ones.</p>
            )}
          </> : <>
            <p>Measure what the fitness functions hold to, and read it:</p>
            {measureCommands(folder).map((c) => <Command key={c} text={c} />)}
          </>}
        </Chip>
      )}
      {reviewed && (
        <Chip name="Reviews" text={formatAge(now - reviewed.at)} marked={isOutdated(reviewed.at, now, changedAt)} why={why}>
          <p><b>Last review {when(reviewed.at)}</b>, {plural(reviewed.count, 'review')} in <code>reviews.json</code>.</p>
          {isOutdated(reviewed.at, now, changedAt) && <p className="insp-age-why">{why}</p>}
          <p>Record a review again:</p>
          <Command text={reviewCommand(folder)} />
        </Chip>
      )}
    </span>
  )
}
