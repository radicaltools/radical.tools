// ─── The properties card's Verification section ──────────────────────────────
//
// What `radical check` says about the element, in every perspective: for a
// need, requirement, scenario, ADR or fitness function its status, the
// conditions that are no test (the card's Tests list those) with their
// outcomes and measurements, what checks it with each one's status, and
// Path; for any element the findings about it, each element they name a
// link. The host fills useCardVerification and useVerificationPath; with
// neither, the section shows nothing.

import React, { useContext } from 'react'
import { TRACE_TYPES, formatAge, ruleName, testFindingNote, testIdentity, type CheckFinding, type ConditionResult } from '@radical/common/check'
import { useDiagramStore } from '../store/diagramStore'
import { useCardVerification } from '../store/verification'
import { useVerificationPath } from '../store/showInView'
import { FoldSection } from './FoldSection'
import { QuotedText } from './FindingText'

/** Where a link in the card leads: the host's (the Inspector moves its card
 *  to the element), else the selection, which an open card follows. */
export const CardNavigation = React.createContext<((id: string) => void) | null>(null)

export function useCardNavigate(): (id: string) => void {
  const host = useContext(CardNavigation)
  const selectNode = useDiagramStore((s) => s.selectNode)
  return host ?? ((id: string) => selectNode(id))
}

const MARK: Record<string, string> = { verified: '✓', passed: '✓', broken: '✗', failed: '✗', unverified: '○', 'not-run': '○', 'no-checks': '○', 'not-found': '?', skipped: '–', stale: '◷', invalid: '!' }
const FAILING = new Set(['broken', 'failed', 'not-found', 'invalid'])
const PASSING = new Set(['verified', 'passed'])
const tone = (status: string | undefined): string => !status ? 'none' : FAILING.has(status) ? 'bad' : PASSING.has(status) ? 'ok' : 'none'
const STATUS_LABEL: Record<string, string> = { 'not-run': 'not run', 'no-checks': 'no check', 'not-found': 'gone' }
const say = (status: string): string => STATUS_LABEL[status] ?? status

function ElementLink({ id, status }: { id: string; status?: string }): React.ReactElement | null {
  const node = useDiagramStore((s) => s.c4Nodes[id])
  const def = useDiagramStore((s) => s.metamodel?.nodeTypes[node?.type ?? ''])
  const go = useCardNavigate()
  if (!node) return null
  return (
    <button type="button" className="pp-ver-link" onClick={() => go(id)} title={`${def?.label ?? node.type}: ${node.label}`}>
      <span className="pp-ver-type" style={{ background: def?.color ?? '#64748b', color: def?.fg ?? '#fff' }}>{def?.label ?? node.type}</span>
      <span className="pp-ver-label">{node.label}</span>
      {status && <span className={`pp-ver-mark ${tone(status)}`}>{MARK[status] ?? ''}</span>}
    </button>
  )
}

/** A finding's message, each element it quotes in quotes a link; what a
 *  failure takes down after it. */
function FindingMessage({ f, self }: { f: CheckFinding; self: string }): React.ReactElement {
  const nodes = useDiagramStore((s) => s.c4Nodes)
  const text = f.relatedIds?.length ? f.message.replace(/ Not verified now: .*$/, '') : f.message
  // Only those the message names: a finding may relate hundreds.
  const ids = [...new Set([f.nodeId, ...(f.relatedIds ?? [])].filter((id): id is string => !!id && id !== self && !!nodes[id] && text.includes(`"${nodes[id].label}"`)))]
  const parts: React.ReactNode[] = []
  let rest = text
  for (let guard = 0; guard < 20; guard++) {
    let first: { at: number; id: string; len: number } | null = null
    for (const id of ids) {
      const quoted = `"${nodes[id].label}"`
      const at = rest.indexOf(quoted)
      if (at >= 0 && (!first || at < first.at)) first = { at, id, len: quoted.length }
    }
    if (!first) break
    parts.push(<QuotedText key={`t-${guard}`} text={rest.slice(0, first.at)} />, <ElementLink key={`${first.id}-${guard}`} id={first.id} />)
    rest = rest.slice(first.at + first.len)
  }
  parts.push(<QuotedText key="rest" text={rest} />)
  const down = (f.relatedIds ?? []).filter((id) => id !== self && nodes[id] && !text.includes(`"${nodes[id].label}"`))
  return (
    <>
      <span className="pp-ver-msg">{parts}</span>
      {down.length > 0 && <span className="pp-ver-down">Leaves unverified: {down.map((id) => <ElementLink key={id} id={id} status="broken" />)}</span>}
    </>
  )
}

/** The first lines of why a test failed, as the runner wrote it. */
const REASON_LINES = 4
const firstLines = (text: string): string => text.split('\n').slice(0, REASON_LINES).join('\n')

/** One finding: what is wrong first, as its rule's name, then what it is
 *  about. A test shows by its title, with its file and describes apart and
 *  why it failed under it, not as one sentence that ends in the verdict. */
function Finding({ f, self }: { f: CheckFinding; self: string }): React.ReactElement {
  const nodes = useDiagramStore((s) => s.c4Nodes)
  const error = f.severity === 'error'
  const test = f.test ? testIdentity(f.test) : null
  const note = test ? testFindingNote(f) : undefined
  const down = (f.relatedIds ?? []).filter((id) => id !== self && nodes[id])
  return (
    <div className={`pp-ver-finding ${f.severity}`} data-rule={f.rule}>
      <span className="pp-ver-verdict"><span role="img" aria-label={error ? 'Error' : 'Warning'}>{error ? '✖' : '⚠'}</span> {ruleName(f.key)}</span>
      {test ? (
        <>
          <span className="pp-ver-test"><b>{test.title}</b>{test.where && <code>{test.where}</code>}</span>
          {f.reason && <pre className="pp-ver-reason">{firstLines(f.reason)}</pre>}
          {note && <span className="pp-ver-note">{note}</span>}
          {f.nodeId && f.nodeId !== self && nodes[f.nodeId] && <span className="pp-ver-down">Named by: <ElementLink id={f.nodeId} /></span>}
          {down.length > 0 && <span className="pp-ver-down">Leaves unverified: {down.map((id) => <ElementLink key={id} id={id} status="broken" />)}</span>}
        </>
      ) : f.condition ? (
        <>
          <span className="pp-ver-test"><code className="pp-ver-condition">{f.condition}</code></span>
          <span className="pp-ver-note">{f.measured
            ? <>Measured <b>{f.measured.value}{f.measured.unit ? ` ${f.measured.unit}` : ''}</b> · {f.measured.source} · {formatAge(Math.max(0, Date.now() - Date.parse(f.measured.at)))} ago{f.why ? ` · ${f.why}` : ''}</>
            : f.why ?? 'Nothing measured it.'}</span>
          {f.nodeId && f.nodeId !== self && nodes[f.nodeId] && <span className="pp-ver-down">Stated by: <ElementLink id={f.nodeId} /></span>}
          {down.length > 0 && <span className="pp-ver-down">Leaves unverified: {down.map((id) => <ElementLink key={id} id={id} status="broken" />)}</span>}
        </>
      ) : <FindingMessage f={f} self={self} />}
    </div>
  )
}

function ConditionRow({ c }: { c: ConditionResult }): React.ReactElement {
  const m = c.measurement
  return (
    <li className="pp-ver-cond">
      <span className={`pp-ver-mark ${tone(c.outcome)}`}>{MARK[c.outcome] ?? '○'}</span>
      <code>{c.condition}</code>
      <span className={`pp-test-outcome ${c.outcome}`}>{c.outcome === 'not-run' ? 'not measured' : say(c.outcome)}</span>
      {m && <span className="pp-ver-measured">{m.value}{m.unit ? ` ${m.unit}` : ''} · {m.source} · {formatAge(Math.max(0, Date.now() - Date.parse(m.at)))} ago</span>}
      {c.detail && !m && <span className="pp-ver-measured">{c.detail}</span>}
    </li>
  )
}

export function ElementVerification({ nodeId }: { nodeId: string }): React.ReactElement | null {
  const node = useDiagramStore((s) => s.c4Nodes[nodeId])
  const evidence = useCardVerification((s) => s.evidence)
  const entry = evidence?.[nodeId]
  const findings = useCardVerification((s) => s.findings[nodeId])
  const path = useVerificationPath()
  const pathMode = useDiagramStore((s) => !s.presentationActive && (s.appMode === 'designer' || s.appMode === 'viewer'))
  // The path is the live model's, as the Inspector is: an element only the
  // milestone shown has is on none (Path opened the Inspector panel with no path).
  const onlyInMilestone = useDiagramStore((s) => !!s.activeSnapshotId && !!s.liveBackup && !s.liveBackup.nodes[nodeId])
  if (!node) return null
  const onPath = (TRACE_TYPES as readonly string[]).includes(node.type)
  const offerPath = onPath && !!path.open && pathMode
  if (!entry && !findings?.length && !offerPath) return null
  // The tests are in the card's Tests, with their outcomes.
  const conditions = (entry?.conditions ?? []).filter((c) => !c.test)
  // Each thing once: a condition a finding of this element is about shows
  // with the finding (what was measured, what it leaves unverified), not
  // again among the checks.
  const inFindings = new Set((findings ?? []).filter((f) => f.condition && f.nodeId === nodeId).map((f) => f.condition))
  const checks = conditions.filter((c) => !inFindings.has(c.condition))
  const failing = checks.filter((c) => c.outcome !== 'passed').length
  const errors = (findings ?? []).filter((f) => f.severity === 'error').length
  const warnings = (findings?.length ?? 0) - errors
  return (
    <FoldSection id="verification" label="Verification" className="pp-verification"
      summary={<>
        {entry && <span className={`pp-ver-status ${tone(entry.status)}`}>{MARK[entry.status] ?? '○'} {say(entry.status)}</span>}
        {errors > 0 && <span className="pp-fold-count error" title={`${errors} finding${errors === 1 ? '' : 's'} that fail${errors === 1 ? 's' : ''} the check`}>✖ {errors}</span>}
        {warnings > 0 && <span className="pp-fold-count warning" title={`${warnings} finding${warnings === 1 ? '' : 's'} that warn${warnings === 1 ? 's' : ''}`}>⚠ {warnings}</span>}
      </>}
      actions={<>
        {offerPath && (
          <button type="button" className="pp-head-btn pp-ver-path" disabled={!!path.unavailable || onlyInMilestone} onClick={() => path.open?.(nodeId)}
            title={path.unavailable ?? (onlyInMilestone ? 'Only the milestone shown has this element; the verification path is the live model\'s' : 'Verification path: from its need or ADR to the tests and measurements that check it, in the Inspector')}>Path</button>
        )}
      </>}>
      {/* What is wrong first; then every check with its outcome, and what checks the element. */}
      {findings && findings.length > 0 && (
        <div className="pp-ver-group" role="group" aria-label="Findings">
          <div className="pp-ver-sub">Findings · {findings.length}</div>
          {/* What fails the check before what warns. */}
          {[...findings].sort((a, b) => Number(a.severity !== 'error') - Number(b.severity !== 'error')).map((f, i) => <Finding key={i} f={f} self={nodeId} />)}
        </div>
      )}
      {checks.length > 0 && (
        <div className="pp-ver-group" role="group" aria-label="Checks">
          <div className="pp-ver-sub">{inFindings.size > 0 ? 'Other checks' : 'Checks'} · {checks.length}{failing > 0 && <span className="pp-ver-sub-note bad">{failing} not passing</span>}</div>
          <ul className="pp-ver-conds" aria-label="Checks">{checks.map((c, i) => <ConditionRow key={i} c={c} />)}</ul>
        </div>
      )}
      {entry?.elements && entry.elements.length > 0 && (
        <div className="pp-ver-group" role="group" aria-label="For each element">
          <div className="pp-ver-sub">For each element · {entry.elements.length}</div>
          {entry.elements.map((el) => (
            <div key={el.id} className="pp-ver-element">
              <ElementLink id={el.id} status={el.status} />
              {el.status !== 'passed' && <ul className="pp-ver-conds">{el.conditions.filter((c) => c.outcome !== 'passed').map((c, i) => <ConditionRow key={i} c={c} />)}</ul>}
            </div>
          ))}
        </div>
      )}
      {entry?.by && (
        <div className="pp-ver-group" role="group" aria-label="Checked by">
          <div className="pp-ver-sub">Checked by · {entry.by.length}</div>
          {entry.by.length
            ? <div className="pp-ver-links">{entry.by.map((id) => <ElementLink key={id} id={id} status={evidence?.[id]?.status} />)}</div>
            : <span className="pp-ver-none">Nothing checks it.</span>}
        </div>
      )}
    </FoldSection>
  )
}
