// ─── Inspector: verification path ───────────────────────────────────────────
//
// Every path through one element, drawn in columns from its root to what
// the tests and measurements say: need → requirement → scenario → test, or
// ADR → fitness function → (element it is measured for) → metric or test.
// The paths come from traceOf in @radical/common/check, the function
// `radical check --trace` and the MCP tool get_trace print. A click on an
// element makes the path that element's (Back returns); Details opens the
// element's panel beside it. A test links to its file in VS Code when
// Studio knows the repository's folder.

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { parseTestIds, traceGap, traceOf, traceTypeLabel, formatAge, type Evidence, type TestCase, type TraceNode, type TraceResult } from '@radical/common/check'
import type { C4Node, C4Relation } from '@radical/common/c4'
import { MARK, PASSING, SHORT_TYPE, ShowOnCanvas, tone } from './shared'

type Item =
  | { kind: 'node'; key: string; col: number; row: number; parent?: string; node: TraceNode; folded: boolean; hidden: number }
  | { kind: 'element'; key: string; col: number; row: number; parent: string; el: NonNullable<TraceNode['elements']>[number] }
  | { kind: 'result'; key: string; col: number; row: number; parent: string; r: TraceResult }
  | { kind: 'gap'; key: string; col: number; row: number; parent: string; text: string }

/** The repository's folder of a model folder on disk: the one holding its
 *  .radical/, else the folder above the model (as the CLI finds it without git). */
export function repositoryRootOf(folderPath: string | undefined): string | null {
  if (!folderPath || !/^([A-Za-z]:)?[\\/]/.test(folderPath)) return null
  const parts = folderPath.replace(/[\\/]+$/, '').split(/[\\/]/)
  const up = parts[parts.length - 2] === '.radical' ? 2 : 1
  return parts.slice(0, parts.length - up).join('/') || '/'
}

/** A case's file from the repository's root, by the test id that names it. */
export function repositoryPath(caseFile: string, idFile: string): string | null {
  const file = caseFile.replace(/\\/g, '/')
  const id = idFile.replace(/\\/g, '/').replace(/\/$/, '')
  if (file === id || file.endsWith(`/${id}`)) return id
  const at = file.indexOf(`/${id}/`)
  if (at >= 0) return file.slice(at + 1)
  if (file.startsWith(`${id}/`)) return file
  return /^([A-Za-z]:)?\//.test(file) ? null : file
}

/** A link that opens the file at the line in VS Code. */
export const vscodeLink = (root: string, path: string, line?: number): string =>
  `vscode://file${root.startsWith('/') ? '' : '/'}${encodeURI(`${root.replace(/\/$/, '')}/${path}`)}${line ? `:${line}` : ''}`

const failing = (status: string | undefined): boolean => !!status && !PASSING.has(status)

/** The path with only what does not pass, the element asked for and what
 *  leads to it kept. */
function onlyFailing(n: TraceNode): TraceNode | null {
  const children = n.children.map(onlyFailing).filter((c): c is TraceNode => !!c)
  const results = n.results.filter((r) => r.outcome !== 'passed')
  const elements = n.elements?.filter((e) => failing(e.status)).map((e) => ({ ...e, results: e.results.filter((r) => r.outcome !== 'passed') }))
  const keep = failing(n.status) || n.target || children.length > 0
  return keep ? { ...n, children, results, ...(elements ? { elements } : {}) } : null
}

/** Each element, result and gap at its column and row: a child in the
 *  column after its parent, the first on its parent's row. */
function layout(roots: TraceNode[], folded: Set<string>): { items: Item[]; cols: number; rows: number } {
  const items: Item[] = []
  let row = 0
  const visit = (n: TraceNode, col: number, parent: string | undefined, key: string): void => {
    const hidden = n.children.length + n.results.length + (n.elements?.length ?? 0)
    const isFolded = folded.has(key) && hidden > 0
    items.push({ kind: 'node', key, col, row, parent, node: n, folded: isFolded, hidden })
    if (isFolded) return
    let first = true
    const next = (): void => { if (!first) row++; first = false }
    n.results.forEach((r, i) => { next(); items.push({ kind: 'result', key: `${key}#r${i}`, col: col + 1, row, parent: key, r }) })
    for (const el of n.elements ?? []) {
      next()
      const ek = `${key}@${el.id}`
      items.push({ kind: 'element', key: ek, col: col + 1, row, parent: key, el })
      el.results.forEach((r, j) => { if (j) row++; items.push({ kind: 'result', key: `${ek}#r${j}`, col: col + 2, row, parent: ek, r }) })
    }
    for (const c of n.children) { next(); visit(c, col + 1, key, `${key}/${c.id}`) }
    const gap = traceGap(n)
    if (gap) { next(); items.push({ kind: 'gap', key: `${key}#gap`, col: col + 1, row, parent: key, text: gap }) }
  }
  roots.forEach((r, i) => { if (i) row++; visit(r, 0, undefined, r.id) })
  return { items, cols: Math.max(0, ...items.map((i) => i.col)) + 1, rows: row + 1 }
}

/** What a column holds, from its items. */
function columnTitle(items: Item[]): string {
  const names = new Set<string>()
  for (const i of items) {
    if (i.kind === 'node') names.add(traceTypeLabel(i.node.type))
    else if (i.kind === 'element') names.add('Measured for')
    else if (i.kind === 'result') names.add(i.r.test ? 'Test' : 'Metric')
  }
  return [...names].join(' · ') || ''
}

function Mark({ status }: { status: string | undefined }): React.ReactElement {
  return <span className={`insp-mark ${tone(status)}`}>{status ? MARK[status] ?? '○' : '·'}</span>
}

function CaseLines({ c, idFile, root }: { c: TestCase; idFile: string; root: string | null }): React.ReactElement {
  const path = repositoryPath(c.file, idFile)
  return (
    <div className="trace-case">
      <div className="trace-case-meta">
        {c.durationMs !== undefined && <span>{c.durationMs < 1 ? '<1 ms' : c.durationMs < 1000 ? `${c.durationMs} ms` : `${(c.durationMs / 1000).toFixed(1)} s`}</span>}
        {root && path && <a className="trace-open" href={vscodeLink(root, path, c.line)} title={`Open ${path}${c.line ? `:${c.line}` : ''} in VS Code`}>Open in VS Code{c.line ? ` · line ${c.line}` : ''}</a>}
      </div>
      {c.status === 'failed' && c.message && <pre className="trace-message">{c.message}</pre>}
    </div>
  )
}

function ResultCard({ r, root }: { r: TraceResult; root: string | null }): React.ReactElement {
  const id = r.test ? parseTestIds(r.test)[0] : undefined
  const cases = r.cases ?? []
  const failed = cases.filter((c) => c.status === 'failed')
  const m = r.measurement
  return (
    <div className={`trace-card trace-result ${tone(r.outcome)}`} data-testid="trace-result">
      <div className="trace-card-head"><Mark status={r.outcome} /><span className="trace-kind">{r.test ? 'Test' : 'Metric'}</span><span className="trace-status">{r.outcome}</span></div>
      {id ? (
        <div className="trace-test-id"><span className="trace-file">{id.file}</span>{id.title.length > 0 && <b>{id.title.join(' › ')}</b>}</div>
      ) : <code className="trace-condition">{r.condition}</code>}
      {m && <div className="trace-measured"><b>{m.value}{m.unit ? ` ${m.unit}` : ''}</b> · {m.source} · {formatAge(Math.max(0, Date.now() - Date.parse(m.at)))} ago</div>}
      {r.detail && !m && <div className="trace-detail">{r.detail}</div>}
      {id && cases.length === 1 && <CaseLines c={cases[0]} idFile={id.file} root={root} />}
      {id && cases.length > 1 && (
        <>
          <div className="trace-detail">{cases.length} tests{failed.length ? `, ${failed.length} failed` : ''}</div>
          {failed.slice(0, 3).map((c, i) => <div key={i} className="trace-sub-case"><b>{c.title.join(' › ')}</b><CaseLines c={c} idFile={id.file} root={root} /></div>)}
        </>
      )}
      {id && !cases.length && r.outcome === 'not-run' && <div className="trace-detail">No report has its file.</div>}
      {id && !cases.length && r.outcome === 'not-found' && <div className="trace-detail">Its file ran, but no test has this title: renamed or deleted?</div>}
    </div>
  )
}

export function TracePanel({ stack, nodes, relations, evidence, cases, ranAt, folderPath, onTrace, onBack, onClose, onDetails }: {
  stack: string[]
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  evidence: Evidence | undefined
  cases: TestCase[] | undefined
  /** When the test results ran (ISO), for their age. */
  ranAt: string | undefined
  folderPath: string | undefined
  onTrace: (id: string) => void
  onBack: () => void
  onClose: () => void
  onDetails: (id: string) => void
}): React.ReactElement {
  const id = stack[stack.length - 1]
  const [onlyFails, setOnlyFails] = useState(false)
  const [folded, setFolded] = useState<Set<string>>(new Set())
  const trace = useMemo(() => traceOf({ nodes, relations, evidence, cases }, id), [nodes, relations, evidence, cases, id])
  const roots = useMemo(() => onlyFails ? trace.roots.map(onlyFailing).filter((r): r is TraceNode => !!r) : trace.roots, [trace, onlyFails])
  const { items, cols } = useMemo(() => layout(roots, folded), [roots, folded])
  const root = repositoryRootOf(folderPath)
  const node = nodes[id]

  // The lines from each parent to its children, measured once the grid is drawn.
  const gridRef = useRef<HTMLDivElement>(null)
  const cards = useRef(new Map<string, HTMLElement>())
  const [lines, setLines] = useState<Array<{ key: string; d: string; tone: string }>>([])
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const measure = (): void => {
      const next: Array<{ key: string; d: string; tone: string }> = []
      for (const item of items) {
        if (!item.parent) continue
        const from = cards.current.get(item.parent)
        const to = cards.current.get(item.key)
        if (!from || !to) continue
        const x1 = from.offsetLeft + from.offsetWidth
        const y1 = from.offsetTop + 18
        const x2 = to.offsetLeft
        const y2 = to.offsetTop + 18
        const mid = x1 + Math.max(10, (x2 - x1) / 2)
        const status = item.kind === 'node' ? item.node.status : item.kind === 'result' ? item.r.outcome : item.kind === 'element' ? item.el.status : undefined
        next.push({ key: item.key, d: y1 === y2 ? `M${x1},${y1} H${x2}` : `M${x1},${y1} H${mid - 8} Q${mid},${y1} ${mid},${y1 + Math.sign(y2 - y1) * 8} V${y2 - Math.sign(y2 - y1) * 8} Q${mid},${y2} ${mid + 8},${y2} H${x2}`, tone: item.kind === 'gap' ? 'gap' : tone(status) })
      }
      setLines(next)
      setSize({ w: grid.scrollWidth, h: grid.scrollHeight })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(grid)
    return () => observer.disconnect()
  }, [items])

  const toggle = (key: string): void => setFolded((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n })
  const ref = (key: string) => (el: HTMLElement | null): void => { if (el) cards.current.set(key, el); else cards.current.delete(key) }
  const byCol = Array.from({ length: cols }, (_, c) => items.filter((i) => i.col === c))

  return (
    <section className="trace" aria-label="Verification path" data-testid="trace-panel">
      <header className="trace-head">
        <div className="trace-title">
          <button type="button" className="insp-btn" onClick={onBack} disabled={stack.length < 2} title={stack.length > 1 ? `Back to ${nodes[stack[stack.length - 2]]?.label ?? 'the path before'}` : undefined}>← Back</button>
          <div>
            <h1>Verification path</h1>
            <p className="insp-meta">
              {node ? <>{SHORT_TYPE[node.type] ?? node.type} <b>{node.label}</b></> : id}
              {' · '}{evidence ? (ranAt ? `test results ${formatAge(Math.max(0, Date.now() - Date.parse(ranAt)))} old` : 'measurements only') : 'no test results beside the model'}
            </p>
          </div>
        </div>
        <div className="trace-tools">
          <label className="trace-toggle"><input type="checkbox" checked={onlyFails} onChange={(e) => setOnlyFails(e.target.checked)} /> Only what does not pass</label>
          <button type="button" className="insp-btn" onClick={onClose}>Close</button>
        </div>
      </header>
      {!evidence && <p className="insp-notice">No test results or measurements beside this model, so the path shows no outcomes. Run <code>radical check &lt;folder&gt; --report &lt;reports&gt;</code> (or <code>--from-ci</code>); Studio picks them up by itself.</p>}
      {!roots.length ? (
        <p className="insp-muted">{trace.roots.length ? 'Everything on this path passes.' : 'This element is on no verification path.'}</p>
      ) : (
        <div className="trace-scroll">
          <div className="trace-grid" ref={gridRef} style={{ gridTemplateColumns: `repeat(${cols}, minmax(200px, 270px))` }}>
            <svg className="trace-lines" width={size.w} height={size.h} aria-hidden="true">
              {lines.map((l) => <path key={l.key} d={l.d} className={`trace-line ${l.tone}`} />)}
            </svg>
            {byCol.map((col, c) => <div key={`h${c}`} className="trace-col-head" style={{ gridColumn: c + 1, gridRow: 1 }}>{columnTitle(col)}</div>)}
            {items.map((item) => {
              const style = { gridColumn: item.col + 1, gridRow: item.row + 2 }
              if (item.kind === 'gap') return <div key={item.key} ref={ref(item.key)} style={style} className="trace-card trace-gap">{item.text}</div>
              if (item.kind === 'result') return <div key={item.key} ref={ref(item.key)} style={style}><ResultCard r={item.r} root={root} /></div>
              if (item.kind === 'element') {
                return (
                  <div key={item.key} ref={ref(item.key)} style={style} className={`trace-card trace-element ${tone(item.el.status)}`}>
                    <div className="trace-card-head"><Mark status={item.el.status} /><span className="trace-kind">{nodes[item.el.id] ? SHORT_TYPE[nodes[item.el.id].type] ?? nodes[item.el.id].type : 'Element'}</span><span className="trace-status">{item.el.status}</span></div>
                    <button type="button" className="trace-label" onClick={() => onDetails(item.el.id)}>{item.el.label}</button>
                  </div>
                )
              }
              const n = item.node
              return (
                <div key={item.key} ref={ref(item.key)} style={style} data-testid="trace-node" data-id={n.id}
                  className={`trace-card trace-node ${tone(n.status)}${n.target ? ' target' : ''}`}>
                  <div className="trace-card-head">
                    <Mark status={n.status} />
                    <span className="trace-kind">{traceTypeLabel(n.type)}</span>
                    <span className="trace-status">{n.status ?? 'no results'}</span>
                    {item.hidden > 0 && (
                      <button type="button" className="trace-fold" onClick={() => toggle(item.key)} aria-expanded={!item.folded}
                        title={item.folded ? 'Show what is under it' : 'Fold what is under it'}>{item.folded ? `▸ ${item.hidden}` : '▾'}</button>
                    )}
                  </div>
                  <button type="button" className="trace-label" onClick={() => n.target ? onDetails(n.id) : onTrace(n.id)}
                    title={n.target ? 'Open its panel' : 'Make the path this element\'s'}>{n.label}</button>
                  {n.repeated && <div className="trace-detail">Again: drawn higher on this path.</div>}
                  <div className="trace-acts">
                    <button type="button" onClick={() => onDetails(n.id)}>Details</button>
                    <ShowOnCanvas id={n.id} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

