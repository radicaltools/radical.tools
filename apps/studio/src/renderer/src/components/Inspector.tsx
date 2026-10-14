// ─── Inspector perspective ───────────────────────────────────────────────────
//
// What `radical check` says about the open model, as one page: the summary,
// what fails, the requirements and the elements that satisfy them by what
// the tests say, the decisions and their checks, and every finding by rule.
// Each element the report names is a link: it opens a panel with the
// element's findings, from which Studio shows it on a canvas or its wiki
// page. The check runs on the model as it is (persistence/inspector.ts).

import React, { useMemo, useState } from 'react'
import { CHECK_RULES, FOLDER_RULES, type CheckFinding, type CheckResult, type EvidenceEntry } from '@radical/common/check'
import type { C4Node, C4Relation } from '@radical/common/c4'
import type { Metamodel } from '@radical/common/metamodel'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { useInspectorStore } from '../persistence/inspector'
import { useDocumentsStore } from '../store/documentStore'
import { openWikiPage, revealOnCanvas, wikiViewFor } from '../navigation'

const RULE_INFO = new Map([...FOLDER_RULES, ...CHECK_RULES].map((r) => [r.id, r.description]))
const SHORT_TYPE: Record<string, string> = { requirement: 'Req', 'fitness-fn': 'FF', scenario: 'Scenario', adr: 'ADR', need: 'Need', database: 'DB', webapp: 'Web app' }
const MARK: Record<string, string> = { verified: '✓', passed: '✓', broken: '✗', failed: '✗', unverified: '○', 'not-run': '○', 'no-tests': '○', 'not-found': '?', skipped: '–' }
const FAILING = new Set(['broken', 'failed', 'not-found'])
const PASSING = new Set(['verified', 'passed'])
const tone = (status: string | undefined): string => !status ? '' : FAILING.has(status) ? 'bad' : PASSING.has(status) ? 'ok' : 'none'

interface Ctx {
  nodes: Record<string, C4Node>
  metamodel: Metamodel
  evidence: Record<string, EvidenceEntry> | undefined
  peek: (id: string) => void
}

function Chip({ id, ctx, status }: { id: string; ctx: Ctx; status?: string }): React.ReactElement | null {
  const node = ctx.nodes[id]
  if (!node) return null
  const def = ctx.metamodel.nodeTypes[node.type]
  const type = SHORT_TYPE[node.type] ?? def?.label ?? node.type
  return (
    <button type="button" className="insp-chip" onClick={() => ctx.peek(id)} title={`${def?.label ?? node.type}: ${node.label}`}>
      <span className="insp-chip-type" style={{ background: def?.color ?? '#64748b', color: def?.fg ?? '#fff' }}>{type}</span>
      <span className="insp-chip-label">{node.label}</span>
      {status && <span className={`insp-mark ${tone(status)}`}>{MARK[status] ?? ''}</span>}
    </button>
  )
}

/** The message with each element it quotes as a link. What a failure takes
 *  down shows as links of its own, so it leaves the sentence. */
function Message({ f, ctx }: { f: CheckFinding; ctx: Ctx }): React.ReactElement {
  const text = f.relatedIds?.length ? f.message.replace(/ Not verified now: .*$/, '') : f.message
  const ids = [...new Set([f.nodeId, ...(f.relatedIds ?? [])].filter((id): id is string => !!id && !!ctx.nodes[id]))]
  const parts: React.ReactNode[] = []
  let rest = text
  for (let guard = 0; guard < 20; guard++) {
    let first: { at: number; id: string; len: number } | null = null
    for (const id of ids) {
      const quoted = `"${ctx.nodes[id].label}"`
      const at = rest.indexOf(quoted)
      if (at >= 0 && (!first || at < first.at)) first = { at, id, len: quoted.length }
    }
    if (!first) break
    parts.push(rest.slice(0, first.at), <Chip key={`${first.id}-${guard}`} id={first.id} ctx={ctx} />)
    rest = rest.slice(first.at + first.len)
  }
  parts.push(rest)
  return <span className="insp-msg">{parts}</span>
}

function Bar({ parts }: { parts: Array<[number, string]> }): React.ReactElement {
  const total = parts.reduce((s, [v]) => s + v, 0)
  return (
    <div className="insp-bar" role="img" aria-label={parts.map(([v, c]) => `${v} ${c}`).join(', ')}>
      {parts.map(([v, c]) => v ? <i key={c} className={c} style={{ width: `${(100 * v) / total}%` }} /> : null)}
    </div>
  )
}

interface Tally { ok: number; bad: number; none: number }
const tally = (statuses: Array<string | undefined>): Tally => ({
  ok: statuses.filter((s) => s && PASSING.has(s)).length,
  bad: statuses.filter((s) => s && FAILING.has(s)).length,
  none: statuses.filter((s) => !s || (!PASSING.has(s) && !FAILING.has(s))).length,
})

function Tile({ label, value, of, unit, tallied, notes }: { label: string; value: number; of?: number; unit?: string; tallied: Tally; notes: React.ReactNode }): React.ReactElement {
  return (
    <div className="insp-tile">
      <span className="insp-label">{label}</span>
      <span className={`insp-big${tallied.bad && of === undefined ? ' bad' : ''}`}>{value}{of !== undefined && <small> / {of}{unit ? ` ${unit}` : ''}</small>}</span>
      <Bar parts={[[tallied.ok, 'ok'], [tallied.bad, 'bad'], [tallied.none, 'none']]} />
      <span className="insp-sub">{notes}</span>
    </div>
  )
}

function Peek({ id, ctx, check, onClose }: { id: string; ctx: Ctx; check: CheckResult; onClose: () => void }): React.ReactElement | null {
  const node = ctx.nodes[id]
  if (!node) return null
  const path: string[] = []
  for (let p = node.parentId ? ctx.nodes[node.parentId] : undefined; p; p = p.parentId ? ctx.nodes[p.parentId] : undefined) path.unshift(p.label)
  const own = check.findings.filter((f) => f.nodeId === id || f.relatedIds?.includes(id))
  const ev = ctx.evidence?.[id]
  const hasWiki = !!wikiViewFor(id)
  return (
    <aside className="insp-peek" aria-label="Element">
      <button type="button" className="insp-peek-close" onClick={onClose}>Close</button>
      <Chip id={id} ctx={ctx} />
      <h3>{node.label}</h3>
      <dl className="insp-kv">
        <dt>Type</dt><dd>{ctx.metamodel.nodeTypes[node.type]?.label ?? node.type}</dd>
        {path.length > 0 && <><dt>In</dt><dd>{path.join(' › ')}</dd></>}
        {ev && <><dt>Tests</dt><dd><span className={`insp-mark ${tone(ev.status)}`}>{MARK[ev.status]}</span> {ev.status}</dd></>}
      </dl>
      <div className="insp-peek-acts">
        <button type="button" className="primary" onClick={() => revealOnCanvas(id)}>Show on canvas</button>
        <button type="button" onClick={() => openWikiPage(id)} disabled={!hasWiki} title={hasWiki ? undefined : 'No wiki view shows this element'}>Open wiki page</button>
      </div>
      {ev?.tests && ev.tests.length > 0 && (
        <div className="insp-peek-sec">
          <span className="insp-label">Tests ({ev.tests.length})</span>
          {ev.tests.map((t) => (
            <div key={t.id} className="insp-test"><span className={`insp-mark ${tone(t.outcome)}`}>{MARK[t.outcome]}</span><code>{t.id}</code>{t.outcome !== 'passed' && <em>{t.outcome}</em>}</div>
          ))}
        </div>
      )}
      {ev?.by && (
        <div className="insp-peek-sec">
          <span className="insp-label">Checked by ({ev.by.length})</span>
          <div className="insp-chips">{ev.by.length ? ev.by.map((b) => <Chip key={b} id={b} ctx={ctx} status={ctx.evidence?.[b]?.status} />) : <span className="insp-muted">Nothing checks it.</span>}</div>
        </div>
      )}
      <div className="insp-peek-sec">
        <span className="insp-label">Findings ({own.length})</span>
        {own.length ? own.map((f, i) => <div key={i} className={`insp-peek-finding ${f.severity}`}><Message f={f} ctx={ctx} /></div>) : <span className="insp-muted">Nothing the check reports.</span>}
      </div>
    </aside>
  )
}

const WARNINGS_SHOWN = 6

export function Inspector(): React.ReactElement {
  const check = useInspectorStore((s) => s.check)
  const results = useInspectorStore((s) => s.results)
  const configError = useInspectorStore((s) => s.configError)
  const nodes = useDiagramStore((s) => s.c4Nodes) as Record<string, C4Node>
  const relations = useDiagramStore((s) => s.c4Relations) as Record<string, C4Relation>
  const metamodel = useDiagramStore((s) => s.metamodel)
  const activeDoc = useDocumentsStore((s) => s.docs.find((d) => d.id === s.activeId) ?? null)
  const [peekId, setPeekId] = useState<string | null>(null)
  const [opened, setOpened] = useState<Record<string, number>>({})
  const [allAdrs, setAllAdrs] = useState(false)

  const ctx: Ctx = { nodes, metamodel, evidence: check?.evidence?.nodes, peek: setPeekId }
  const ev = check?.evidence?.nodes

  const view = useMemo(() => {
    const ofType = (type: string): C4Node[] => Object.values(nodes).filter((n) => n.type === type)
    const statusOf = (id: string): string | undefined => ev?.[id]?.status
    const requirements = ofType('requirement')
    const byParent = new Map<string, string[]>()
    for (const r of requirements) {
      const parent = r.parentId ? nodes[r.parentId]?.label ?? '' : ''
      byParent.set(parent, [...(byParent.get(parent) ?? []), r.id])
    }
    const areas = [...byParent].map(([name, ids]) => ({ name: name || 'Top level', t: tally(ids.map(statusOf)), total: ids.length }))
      .sort((a, b) => b.t.bad - a.t.bad || b.total - a.total)
    const satisfied = new Map<string, string[]>()
    for (const r of Object.values(relations)) {
      if (r.relationType === 'satisfies' && nodes[r.targetId]?.type === 'requirement') satisfied.set(r.sourceId, [...(satisfied.get(r.sourceId) ?? []), r.targetId])
    }
    const elements = [...satisfied].filter(([id]) => nodes[id]).map(([id, reqs]) => ({ id, t: tally(reqs.map(statusOf)), total: reqs.length }))
      .sort((a, b) => b.t.bad - a.t.bad || b.total - a.total).slice(0, 8)
    const adrs = ofType('adr').map((a) => ({
      id: a.id,
      status: statusOf(a.id),
      ffs: Object.values(relations).filter((r) => r.relationType === 'implements' && r.targetId === a.id && nodes[r.sourceId]?.type === 'fitness-fn').map((r) => r.sourceId),
    })).sort((a, b) => Number(FAILING.has(b.status ?? '')) - Number(FAILING.has(a.status ?? '')) || Number(PASSING.has(b.status ?? '')) - Number(PASSING.has(a.status ?? '')))
    const scenarios = ofType('scenario')
    return {
      requirements: tally(requirements.map((r) => statusOf(r.id))), requirementCount: requirements.length,
      adrTally: tally(adrs.map((a) => a.status)), adrCount: adrs.length,
      scenarios: tally(scenarios.map((s) => statusOf(s.id))), scenarioCount: scenarios.length,
      noTests: scenarios.filter((s) => statusOf(s.id) === 'no-tests').length,
      areas, elements, adrs,
    }
  }, [nodes, relations, ev])

  if (!check) return <div className="insp"><div className="insp-main"><p className="insp-muted">Checking the model…</p></div></div>

  const errors = check.findings.filter((f) => f.severity === 'error')
  const rules = check.rules.filter((r) => r.count > 0 || r.max !== undefined)
  const isFolder = activeDoc?.source === 'md'
  const readAt = results ? new Date(results.readAt) : null
  const withoutScenario = check.rules.find((r) => r.id === 'requirement-without-scenario')?.count ?? 0

  return (
    <div className="insp">
      <div className="insp-main">
        <header className="insp-head">
          <div>
            <h1>Inspector</h1>
            <p className="insp-meta">
              {activeDoc?.name ?? 'Model'} · {check.nodeCount} elements · {check.relationCount} relations · checked as you edit
              {readAt ? <> · tests read {readAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} ({results!.cases.length} test cases)</> : null}
            </p>
          </div>
          <span className={`insp-verdict ${check.errors ? 'bad' : 'ok'}`}>{check.errors ? `✖ ${check.errors} errors` : '✓ No errors'} · {check.warnings} warnings</span>
        </header>

        {configError && <p className="insp-notice warn">{configError}. The default rule settings apply.</p>}
        {!results && (
          <p className="insp-notice">
            {isFolder
              ? <>No test results beside this model yet. Run <code>radical check &lt;folder&gt; --report &lt;reports&gt;</code> to see which requirements and decisions the tests verify; Studio picks them up by itself.</>
              : <>Test results come with models kept in a folder. The rules about the model are checked here as you edit.</>}
          </p>
        )}

        <div className="insp-tiles">
          {ev ? <>
            <Tile label="Requirements verified" value={view.requirements.ok} of={view.requirementCount} tallied={view.requirements}
              notes={<><span><i className="insp-dot bad" />{view.requirements.bad} broken</span><span><i className="insp-dot none" />{view.requirements.none} unverified</span></>} />
            <Tile label="Decisions verified" value={view.adrTally.ok} of={view.adrCount} unit="ADRs" tallied={view.adrTally}
              notes={<><span><i className="insp-dot bad" />{view.adrTally.bad} broken</span><span><i className="insp-dot none" />{view.adrTally.none} without a passing check</span></>} />
            <Tile label="Scenarios passing" value={view.scenarios.ok} of={view.scenarioCount} tallied={view.scenarios}
              notes={<><span><i className="insp-dot bad" />{view.scenarios.bad} failed</span><span><i className="insp-dot none" />{view.noTests} name no test</span></>} />
          </> : <>
            <Tile label="Requirements with a scenario" value={view.requirementCount - withoutScenario} of={view.requirementCount}
              tallied={{ ok: view.requirementCount - withoutScenario, bad: 0, none: withoutScenario }} notes={<span><i className="insp-dot none" />{withoutScenario} without one</span>} />
          </>}
          <Tile label="Problems" value={check.errors} tallied={{ ok: 0, bad: check.errors, none: 0 }} unit="errors"
            notes={<span><i className="insp-dot warn" />{check.warnings} warnings in {rules.filter((r) => r.count && !r.failed).length} rules</span>} />
        </div>

        {errors.length > 0 && (
          <section>
            <h2>Errors</h2>
            <p className="insp-lede">What fails the check in CI. Each one names the element it is about and what it takes down with it.</p>
            <div className="insp-errors">
              {errors.map((f, i) => (
                <div key={i} className="insp-error">
                  <Message f={f} ctx={ctx} />
                  {f.relatedIds && f.relatedIds.length > 0 && (
                    <div className="insp-chain">Not verified now: {f.relatedIds.map((id) => <Chip key={id} id={id} ctx={ctx} status="broken" />)}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {ev && (
          <div className="insp-two">
            <section>
              <h2>Requirements by group</h2>
              <p className="insp-lede">Verified when every scenario that verifies them passed.</p>
              <div className="insp-panel insp-rows">
                {view.areas.map((a) => (
                  <div key={a.name} className={`insp-row${a.t.bad ? ' alert' : ''}`}>
                    <span className="insp-row-name" title={a.name}>{a.name}</span>
                    <Bar parts={[[a.t.ok, 'ok'], [a.t.bad, 'bad'], [a.t.none, 'none']]} />
                    <span className="insp-num">{a.t.bad ? <b>{a.t.bad} broken</b> : <><b>{a.t.ok}</b> / {a.total}</>}</span>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h2>Architecture</h2>
              <p className="insp-lede">The requirements each element satisfies, by what the tests say.</p>
              <div className="insp-panel insp-rows">
                {view.elements.map((e) => (
                  <div key={e.id} className={`insp-row${e.t.bad ? ' alert' : ''}`}>
                    <span className="insp-row-name"><Chip id={e.id} ctx={ctx} /></span>
                    <Bar parts={[[e.t.ok, 'ok'], [e.t.bad, 'bad'], [e.t.none, 'none']]} />
                    <span className="insp-num">{e.t.bad ? <b>{e.t.bad} broken</b> : <><b>{e.t.ok}</b> / {e.total}</>}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {view.adrs.length > 0 && (
          <section>
            <h2>Decisions and their checks</h2>
            <p className="insp-lede">An ADR is verified when the fitness functions that implement it passed.</p>
            <div className="insp-panel insp-adrs">
              {(allAdrs ? view.adrs : view.adrs.slice(0, 8)).map((a) => (
                <div key={a.id} className="insp-adr">
                  <span className={`insp-mark ${tone(a.status)}`} title={a.status}>{a.status ? MARK[a.status] : '·'}</span>
                  <div>
                    <Chip id={a.id} ctx={ctx} />
                    <div className="insp-chips">
                      {a.ffs.length ? a.ffs.map((f) => <Chip key={f} id={f} ctx={ctx} status={ctx.evidence?.[f]?.status} />) : <span className="insp-muted">No fitness function implements it.</span>}
                    </div>
                  </div>
                </div>
              ))}
              {!allAdrs && view.adrs.length > 8 && <button type="button" className="insp-more" onClick={() => setAllAdrs(true)}>Show all {view.adrs.length} ADRs</button>}
            </div>
          </section>
        )}

        <section>
          <h2>Findings by rule</h2>
          <p className="insp-lede">Every rule <code>radical check</code> runs, as the model's <code>check.json</code> sets them. Open one to see its findings.</p>
          <div className="insp-panel insp-rules">
            {rules.length === 0 && <p className="insp-muted insp-pad">The check finds nothing.</p>}
            {rules.map((r) => {
              const list = check.findings.filter((f) => f.key === r.id)
              const shown = opened[r.id] ?? WARNINGS_SHOWN
              const severity = r.failed ? 'error' : 'warning'
              return (
                <details key={r.id} className="insp-rule" open={r.failed || undefined}>
                  <summary>
                    <span className={`insp-sev ${severity}`}>{severity === 'error' ? '✖' : '⚠'}</span>
                    <span><span className="insp-rid">{r.id}</span><span className="insp-rdesc">{RULE_INFO.get(r.id.split('/')[0]) ?? ''}</span></span>
                    <span className="insp-rcount">{r.count}{r.max !== undefined && <small> / max {r.max}</small>}</span>
                  </summary>
                  <div className="insp-items">
                    {list.slice(0, shown).map((f, i) => (
                      <div key={i} className="insp-item">
                        {f.path && !f.nodeId && <code className="insp-path">{f.path}</code>}
                        <Message f={f} ctx={ctx} />
                        {f.details && f.details.length > 0 && (
                          <details className="insp-details">
                            <summary>{f.details.length === 1 ? '1 test' : `${f.details.length} tests`}</summary>
                            <ul>{f.details.map((d) => <li key={d}><code>{d}</code></li>)}</ul>
                          </details>
                        )}
                      </div>
                    ))}
                    {list.length > shown && <button type="button" className="insp-more" onClick={() => setOpened({ ...opened, [r.id]: list.length })}>Show {list.length - shown} more</button>}
                  </div>
                </details>
              )
            })}
          </div>
        </section>
      </div>
      {peekId && <Peek id={peekId} ctx={ctx} check={check} onClose={() => setPeekId(null)} />}
    </div>
  )
}
