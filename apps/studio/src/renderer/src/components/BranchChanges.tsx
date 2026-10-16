import React, { useEffect, useRef, useState } from 'react'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import type { BranchChanges } from '@radical/common/branchChanges'
import type { ElementChange } from '@radical/common/modelChanges'
import { branchBaseIsOld, setBranchChangesShown, useBranchStore } from '../persistence/branchChanges'
import { revealOnCanvas } from '../navigation'

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

const FIELD_NAMES: Record<string, string> = { label: 'name', parentId: 'place', description: 'description', technology: 'technology', external: 'external', type: 'type' }

/** Every change since the base, by kind; an element still in the model is a
 *  link to it on a canvas. */
function BranchChangeList({ changes, onGo }: { changes: BranchChanges; onGo: () => void }): React.ReactElement {
  const metamodel = useDiagramStore((s) => s.metamodel)
  const [relationsOpen, setRelationsOpen] = useState(false)
  const { elements, relations } = changes.report
  const typeOf = (type: string) => {
    const def = metamodel?.nodeTypes[type]
    return <span className="branch-type" style={{ background: def?.color ?? '#64748b', color: def?.fg ?? '#fff' }}>{def?.label ?? type}</span>
  }
  const fieldsOf = (c: ElementChange) => {
    const props = metamodel?.nodeTypes[c.type]?.properties ?? []
    return (c.changes ?? []).map((f) => props.find((p) => p.key === f.field)?.label?.toLowerCase() ?? FIELD_NAMES[f.field] ?? f.field).join(', ')
  }
  const item = (c: ElementChange, kind: 'added' | 'changed' | 'removed') => {
    const body = <>{typeOf(c.type)}<span className="branch-item-label">{c.label}</span>{kind === 'changed' && <span className="branch-muted">{fieldsOf(c)}</span>}</>
    return kind === 'removed'
      ? <li key={c.id}><span className="branch-item gone" title={c.path.join(' › ')}>{body}</span></li>
      : <li key={c.id}><button type="button" className="branch-item" title={[...c.path, c.label].join(' › ')} onClick={() => { onGo(); revealOnCanvas(c.id) }}>{body}</button></li>
  }
  const group = (title: string, kind: 'added' | 'changed' | 'removed', list: ElementChange[]) => list.length > 0 && (
    <section className={`branch-group ${kind}`} aria-label={title}>
      <h4>{title} <span className="branch-muted">{list.length}</span></h4>
      <ul>{list.map((c) => item(c, kind))}</ul>
    </section>
  )
  const rels = [
    ...relations.added.map((r) => ['added', r] as const),
    ...relations.changed.map((r) => ['changed', r] as const),
    ...relations.removed.map((r) => ['removed', r] as const),
  ]
  return (
    <div className="branch-pop branch-list" role="dialog" aria-label="Changes since main">
      {group('Added', 'added', elements.added)}
      {group('Changed', 'changed', elements.changed)}
      {group('Removed', 'removed', elements.removed)}
      {!elements.added.length && !elements.changed.length && !elements.removed.length && <p className="branch-muted">No element changed since the base.</p>}
      {rels.length > 0 && (
        <section className="branch-group" aria-label="Relations">
          <button type="button" className="branch-rel-toggle" aria-expanded={relationsOpen} onClick={() => setRelationsOpen((o) => !o)}>
            Relations <span className="branch-muted">{rels.length}</span> {relationsOpen ? '▾' : '▸'}
          </button>
          {relationsOpen && (
            <ul>
              {rels.map(([kind, r]) => (
                <li key={r.id} className={`branch-rel ${kind}`}>
                  <span className="branch-rel-kind">{kind === 'added' ? '+' : kind === 'removed' ? '−' : '~'}</span>
                  <span>{r.source.label} → {r.target.label}</span>
                  <span className="branch-muted">{r.relationType ?? 'relation'}{r.label ? ` "${r.label}"` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
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
  const [list, setList] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!list && !help) return
    const close = (e: MouseEvent): void => { if (!box.current?.contains(e.target as Node)) { setList(false); setHelp(false) } }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [list, help])
  if (!on || !base || !changes || milestone) return null
  const old = branchBaseIsOld(base)
  const { added, changed, removed } = changes.counts
  const none = added + changed + removed === 0
  const relations = changes.report.relations.added.length + changes.report.relations.changed.length + changes.report.relations.removed.length
  return (
    <div className={`branch-chip${old ? ' old' : ''}`} role="status" aria-label="Changes on branch" ref={box}>
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
      {old && <button type="button" className="branch-chip-old" onClick={() => { setHelp((h) => !h); setList(false) }} aria-expanded={help}>Old base</button>}
      {(!none || relations > 0) && (
        <button type="button" className="branch-chip-list" aria-expanded={list} onClick={() => { setList((l) => !l); setHelp(false) }}>
          List {list ? '▴' : '▾'}
        </button>
      )}
      {list && <BranchChangeList changes={changes} onGo={() => setList(false)} />}
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
