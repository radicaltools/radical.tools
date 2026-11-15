import React, { useState } from 'react'
import { baseName, baseSince, type ModelBase } from '@radical/common/formats/modelBase'

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

type ChangeCounts = { added: number; changed: number; removed: number; relations: number }
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

/** The number Changes on branch shows: elements and relations changed. */
export const changeTotal = (counts: ChangeCounts): number => counts.added + counts.changed + counts.removed + counts.relations

/** "3 elements and 1 relation changed"; a branch that only changes relations
 *  says so rather than "0 elements". */
export function changedText(counts: ChangeCounts): string {
  const elements = counts.added + counts.changed + counts.removed
  if (!counts.relations) return `${plural(elements, 'element')} changed`
  return `${elements ? `${plural(elements, 'element')} and ` : ''}${plural(counts.relations, 'relation')} changed`
}

/** "3 elements changed: 1 added, 1 changed, 1 removed; 1 relation changed". */
export function changeBreakdown(counts: ChangeCounts): string {
  const elements = counts.added + counts.changed + counts.removed
  return `${plural(elements, 'element')} changed: ${counts.added} added, ${counts.changed} changed, ${counts.removed} removed${counts.relations ? `; ${plural(counts.relations, 'relation')} changed` : ''}`
}

/** What the changes are counted since, for the Inspector: "main <code>534f32f</code>
 *  (merge base with origin/main, feat/x)", "HEAD <code>473d593</code> (main)",
 *  or the start of the Forge run. */
export function BaseSince({ base }: { base: ModelBase }): React.ReactElement {
  if (base.source === 'forge') return <>the start of the Forge run</>
  const name = baseName(base)
  // How it was chosen, unless its name says it already ("HEAD"), and the branch.
  const chosen = [...(base.described !== name ? [base.described] : []), ...(base.branch ? [base.branch] : [])]
  return <>{name ? `${name} ` : ''}<code>{base.commit.slice(0, 7)}</code>{chosen.length ? ` (${chosen.join(', ')})` : ''}</>
}

export function Command({ text }: { text: string }): React.ReactElement {
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
export function SaveBaseHelp({ old }: { old: boolean }): React.ReactElement {
  return (
    <>
      <p>Run this once in the repository; from then on git saves it after a checkout, a commit or a pull:</p>
      <Command text={INSTALL_HOOKS} />
      <p>{old ? 'Or save it again now:' : 'Or save it once:'}</p>
      <Command text={SAVE_BASE} />
      <p className="branch-muted">An agent's get_changes saves it too. Outside git, a Radical Forge run saves the model as it was before the run.</p>
    </>
  )
}
