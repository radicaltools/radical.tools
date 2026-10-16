import React, { useEffect, useRef, useState } from 'react'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { branchBaseIsOld, setBranchChangesShown, useBranchStore } from '../persistence/branchChanges'

const SAVE_BASE = 'radical diff <model folder> --save-base'
const INSTALL_HOOKS = 'radical hooks install <model folder>'

/** "5 min ago", "2 h ago", "3 days ago". */
export function ago(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function Command({ text }: { text: string }): React.ReactElement {
  const [copied, setCopied] = useState(false)
  const copy = (): void => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }, () => {})
  }
  return (
    <div className="branch-cmd">
      <code>{text}</code>
      <button type="button" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
    </div>
  )
}

/** What saves a base, for a model that has none or an old one. */
function SaveBaseHelp({ old }: { old: boolean }): React.ReactElement {
  return (
    <>
      <p>Run this once in the repository; from then on git saves it after a checkout, a commit or a pull:</p>
      <Command text={INSTALL_HOOKS} />
      <p>{old ? 'Or save it again now:' : 'Or save it once:'}</p>
      <Command text={SAVE_BASE} />
      <p className="branch-muted">An agent's get_changes saves it too.</p>
    </>
  )
}

/** Changes on branch, in the toolbar: shows the changes since the base on
 *  the canvas; without a base it says how to save one. */
export function BranchChangesButton(): React.ReactElement | null {
  const base = useBranchStore((s) => s.base)
  const on = useBranchStore((s) => s.on)
  const counts = useBranchStore((s) => s.changes?.counts)
  const milestone = useDiagramStore((s) => s.activeSnapshotId)
  const [help, setHelp] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!help) return
    const close = (e: MouseEvent): void => { if (!box.current?.contains(e.target as Node)) setHelp(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [help])

  const total = counts ? counts.added + counts.changed + counts.removed : 0
  const old = !!base && branchBaseIsOld(base)
  const title = !base
    ? 'Changes on branch: no base beside this model yet. Click to see how to save one.'
    : milestone
      ? 'Changes on branch: a milestone is shown, and its diff is on the canvas.'
      : `Changes on branch: what changed in the model since ${base.described} (${base.commit.slice(0, 7)})${old ? '; the base is old' : ''}`
  return (
    <div className="branch-btn-wrap" ref={box}>
      <button
        type="button"
        className={`toolbar-btn branch-btn${on ? ' active' : ''}${base ? '' : ' unavailable'}`}
        aria-pressed={base ? on : undefined}
        aria-disabled={base && milestone ? true : undefined}
        aria-expanded={base ? undefined : help}
        title={title}
        onClick={() => {
          if (!base) { setHelp((h) => !h); return }
          if (milestone) return
          setBranchChangesShown(!on)
        }}
      >
        <IconBranch /><span className="branch-btn-label">Changes on branch</span>
        {base && <span className={`branch-count${old ? ' old' : ''}`}>{old ? '⚠ ' : ''}{total}</span>}
      </button>
      {help && !base && (
        <div className="branch-pop" role="dialog" aria-label="Changes on branch">
          <strong>Nothing to compare with yet</strong>
          <p className="branch-muted">Studio compares the model with its version where the branch left main, which the command line saves beside the model in .radical/base.json.</p>
          <SaveBaseHelp old={false} />
        </div>
      )}
    </div>
  )
}

/** Over the canvas while Changes on branch is on: the base and the counts. */
export function BranchChip(): React.ReactElement | null {
  const base = useBranchStore((s) => s.base)
  const on = useBranchStore((s) => s.on)
  const changes = useBranchStore((s) => s.changes)
  const milestone = useDiagramStore((s) => s.activeSnapshotId)
  const [help, setHelp] = useState(false)
  if (!on || !base || !changes || milestone) return null
  const old = branchBaseIsOld(base)
  const { added, changed, removed } = changes.counts
  const none = added + changed + removed === 0
  const relations = changes.report.relations.added.length + changes.report.relations.changed.length + changes.report.relations.removed.length
  return (
    <div className={`branch-chip${old ? ' old' : ''}`} role="status" aria-label="Changes on branch">
      <strong>{none && !relations ? 'No model changes since main' : 'Changes since main'}</strong>
      <code title={`${base.described}, ${base.commit}`}>{base.commit.slice(0, 7)} · saved {ago(base.savedAt)}{old && base.branch ? ` on ${base.branch}` : ''}</code>
      {!none && (
        <span className="branch-stats">
          <span className="added"><b>{added}</b> added</span>
          <span className="changed"><b>{changed}</b> changed</span>
          <span className="removed"><b>{removed}</b> removed</span>
        </span>
      )}
      {relations > 0 && <span className="branch-muted">{relations} relation{relations === 1 ? '' : 's'}</span>}
      {old && <button type="button" className="branch-chip-old" onClick={() => setHelp((h) => !h)} aria-expanded={help}>Old base</button>}
      {old && help && (
        <div className="branch-pop" role="dialog" aria-label="Old base">
          <strong>Saved {ago(base.savedAt)}{base.branch ? `, on ${base.branch}` : ''}</strong>
          <p className="branch-muted">If you have switched branches or pulled since, the changes shown may not be this branch's.</p>
          <SaveBaseHelp old />
        </div>
      )}
    </div>
  )
}

function IconBranch(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="9" r="2.5" />
      <path d="M6 8.5v7M18 11.5c0 4-6 3-11 5" />
    </svg>
  )
}
