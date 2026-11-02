import React, { useEffect, useRef, useState } from 'react'
import { revealViewFolder } from '@radical/ui/components/RightPanel'
import { useOtherModelsStore, type OtherModelsSummary } from '../persistence/otherModels'
import { ago, Command } from './BranchChanges'

const FETCH = 'radical federation fetch'

/** The other models a model depends on (its deps.json), in the toolbar
 *  beside Changes on branch: how many, or how many problems; opened, each
 *  with the version pinned and the one fetched, what is wrong and the
 *  command that fetches them. A model with no deps.json has none. */
export function OtherModelsButton(): React.ReactElement | null {
  const summary = useOtherModelsStore((s) => s.summary)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const escape = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  if (!summary) return null

  const models = summary.rows.filter((r) => !r.via).length
  const problems = summary.problems.length
  const label = `${models} other model${models === 1 ? '' : 's'}`
  return (
    <div className="branch-btn-wrap" ref={box}>
      <button
        type="button"
        className={`toolbar-btn branch-btn${open ? ' open' : ''}`}
        aria-expanded={open}
        aria-describedby={open ? undefined : 'other-models-tip'}
        onClick={() => setOpen((o) => !o)}
      >
        <IconModels /><span className="branch-btn-label">{label}</span>
        <span className={`branch-count${problems ? ' old' : ''}`}>{problems ? `⚠ ${problems}` : models}</span>
      </button>
      {!open && (
        <div id="other-models-tip" className="branch-tip" role="tooltip">
          <strong>Other models</strong>
          <span>{problems ? `${label}: ${problems === 1 ? 'a problem' : `${problems} problems`} with what is fetched` : `This model depends on ${label}, fetched`}</span>
        </div>
      )}
      {open && <OtherModelsPopover summary={summary} models={models} onPicked={() => setOpen(false)} />}
    </div>
  )
}

function OtherModelsPopover({ summary, models, onPicked }: { summary: OtherModelsSummary; models: number; onPicked: () => void }): React.ReactElement {
  const nothing = summary.rows.length > 0 && summary.rows.every((r) => r.status === 'not-fetched')
  // Their views are in a folder named after each model (withOtherModels).
  const show = (name: string): void => {
    revealViewFolder(name)
    onPicked()
  }
  return (
    <div className="branch-pop other-models-pop" role="dialog" aria-label="Other models">
      <strong>This model depends on {models} other model{models === 1 ? '' : 's'}</strong>
      <p className="branch-muted">
        Their elements and views are shown beside its own, read-only. Fetched by the command line into .radical/federation.json{summary.fetchedAt ? `, ${ago(summary.fetchedAt)}` : ''}.
      </p>
      {summary.rows.length > 0 && (
        <table className="other-models-table">
          <thead>
            <tr><th>Model</th><th>Pinned</th><th>Fetched</th><th><span className="branch-btn-label">Status</span></th></tr>
          </thead>
          <tbody>
            {summary.rows.map((row) => (
              <tr key={`${row.via ?? ''}/${row.name}`} className={row.status === 'ok' ? undefined : 'warn'}>
                <td>
                  <button type="button" className={`other-models-name${row.via ? ' via' : ''}`} onClick={() => show(row.name)} title={`Show the views of ${row.name}`}>
                    {row.via && <span aria-hidden="true">↳ </span>}{row.name}
                  </button>
                  {row.via && <span className="branch-muted"> via {row.via}</span>}
                </td>
                <td><code>{row.pinned}</code></td>
                <td>{row.fetched ? <code>{row.fetched}</code> : <span className="branch-muted">—</span>}</td>
                <td aria-label={row.status === 'ok' ? 'fetched' : row.status === 'not-fetched' ? 'not fetched' : 'fetched at another version'}>{row.status === 'ok' ? '✓' : '⚠'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {summary.problems.length > 0 && (
        <>
          {summary.problems.map((problem) => <p key={problem} className="other-models-problem">⚠ {problem}</p>)}
          <p>{nothing ? 'Fetch them in the repository:' : 'Fetch again in the repository:'}</p>
          <Command text={FETCH} />
          <p className="branch-muted">in the model folder</p>
        </>
      )}
      <p className="branch-muted">Clicking a model shows its views in the list on the left.</p>
    </div>
  )
}

/** Three models, joined; the bottom one dashed: another's. */
function IconModels(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="2.5" width="7" height="7" rx="1.5" /><rect x="14.5" y="2.5" width="7" height="7" rx="1.5" />
      <rect x="8.5" y="14.5" width="7" height="7" rx="1.5" strokeDasharray="2.5 2" />
      <path d="M6 9.5v2.5h12V9.5M12 12v2.5" />
    </svg>
  )
}
