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
import { TRACE_TYPES, formatAge, type CheckFinding, type ConditionResult } from '@radical/common/check'
import { useDiagramStore } from '../store/diagramStore'
import { useCardVerification } from '../store/verification'
import { useVerificationPath } from '../store/showInView'

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
    parts.push(rest.slice(0, first.at), <ElementLink key={`${first.id}-${guard}`} id={first.id} />)
    rest = rest.slice(first.at + first.len)
  }
  parts.push(rest)
  const down = (f.relatedIds ?? []).filter((id) => id !== self && nodes[id] && !text.includes(`"${nodes[id].label}"`))
  return (
    <>
      <span className="pp-ver-msg">{parts}</span>
      {down.length > 0 && <span className="pp-ver-down">Not verified now: {down.map((id) => <ElementLink key={id} id={id} status="broken" />)}</span>}
    </>
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
  const pathMode = useDiagramStore((s) => !s.presentationActive && (s.appMode === 'designer' || s.appMode === 'viewer' || s.appMode === 'inspector'))
  if (!node) return null
  const onPath = (TRACE_TYPES as readonly string[]).includes(node.type)
  const offerPath = onPath && !!path.open && pathMode
  if (!entry && !findings?.length && !offerPath) return null
  // The tests are in the card's Tests, with their outcomes.
  const conditions = (entry?.conditions ?? []).filter((c) => !c.test)
  return (
    <section className="pp-section pp-verification" aria-label="Verification">
      <div className="pp-section-title pp-ver-head">
        <span>Verification</span>
        {entry && <span className={`pp-ver-status ${tone(entry.status)}`}>{MARK[entry.status] ?? '○'} {say(entry.status)}</span>}
        {offerPath && (
          <button type="button" className="pp-head-btn pp-ver-path" disabled={!!path.unavailable} onClick={() => path.open?.(nodeId)}
            title={path.unavailable ?? 'Verification path: from its need or ADR to the tests and measurements that check it, in the Inspector'}>Path</button>
        )}
      </div>
      {conditions.length > 0 && (
        <ul className="pp-ver-conds" aria-label="Checks">{conditions.map((c, i) => <ConditionRow key={i} c={c} />)}</ul>
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
      {findings && findings.length > 0 && (
        <div className="pp-ver-group" role="group" aria-label="Findings">
          <div className="pp-ver-sub">Findings · {findings.length}</div>
          {findings.map((f, i) => <div key={i} className={`pp-ver-finding ${f.severity}`}><FindingMessage f={f} self={nodeId} /></div>)}
        </div>
      )}
    </section>
  )
}
