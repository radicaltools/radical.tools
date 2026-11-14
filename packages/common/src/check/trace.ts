// ─── radical check: verification path ───────────────────────────────────────
//
// Every path through one element of the model from its root to what the
// tests and measurements say: need → requirement (→ derived requirement) →
// scenario → its tests, or ADR → fitness function → its tests and metric
// conditions (for each element it is measured for). Above the element the
// path keeps only the elements that lead to it; below it, everything. The
// Inspector draws it, `radical check --trace` and the MCP tool get_trace
// print it (formatTrace), all from this one function.

import type { C4Node, C4Relation } from '../c4'
import type { ConditionOutcome, ConditionResult, Evidence, EvidenceEntry } from './evidence'
import type { Measurement } from './metrics'
import { findTests, parseTestIds, type TestCase } from './reports'

/** The node types a verification path is made of. */
export const TRACE_TYPES = ['need', 'requirement', 'scenario', 'adr', 'fitness-fn'] as const

/** The relations a path goes up along: from the lower element (source) to
 *  the higher one (target), each between these types. */
const UP: ReadonlyArray<{ relationType: string; from: string; to: readonly string[] }> = [
  { relationType: 'derives', from: 'requirement', to: ['need', 'requirement'] },
  { relationType: 'verifies', from: 'scenario', to: ['requirement'] },
  { relationType: 'implements', from: 'fitness-fn', to: ['adr'] },
]

/** A test or metric condition at the end of a path. */
export interface TraceResult {
  /** The condition as written (`test(<id>) passed`, `p95_ms < 300`). */
  condition: string
  /** For a test: its id (`<file> › <title>`). */
  test?: string
  outcome: ConditionOutcome
  measurement?: Measurement
  detail?: string
  /** For a test: the cases of the reports it names, with why they failed. */
  cases?: TestCase[]
}

/** One element of the model on a path. */
export interface TraceNode {
  id: string
  type: string
  label: string
  /** What the check says of it: a scenario's or fitness function's
   *  CheckedStatus, a requirement's or ADR's VerifiedStatus, a need's from
   *  its requirements; undefined when there are no results. */
  status?: string
  /** The element the path was asked for. */
  target?: boolean
  /** The elements under it, failing ones first. */
  children: TraceNode[]
  /** For a scenario or fitness function: its conditions. */
  results: TraceResult[]
  /** For a fitness function measured for each element its ADR constrains:
   *  each such element with its metric conditions, failing ones first. */
  elements?: Array<{ id: string; label: string; status: string; results: TraceResult[] }>
  /** Already drawn higher on the same path (a cycle of derives); not
   *  followed again. */
  repeated?: boolean
}

export interface Trace {
  /** The element asked for. */
  id: string
  /** The roots of its paths: needs and ADRs, or the highest element when
   *  nothing links it higher. Empty when the element has no path (it is
   *  of no type a path is made of). */
  roots: TraceNode[]
}

export interface TraceInput {
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  /** What the reports and measurements say (CheckResult.evidence). */
  evidence?: Evidence | null
  /** The test cases of the reports, for why a test failed. */
  cases?: TestCase[] | null
}

/** Worst first: what a path shows on top. */
const RANK: Record<string, number> = {
  failed: 0, broken: 0, 'not-found': 0, invalid: 0,
  stale: 1, 'not-run': 2, skipped: 2, unverified: 2, 'no-checks': 3,
  passed: 4, verified: 4,
}
export const rankOf = (status: string | undefined): number => (status ? RANK[status] ?? 3 : 3)

/** A need's status from its requirements': broken when one is, verified
 *  when all are, otherwise unverified. */
function rollUp(children: TraceNode[]): string | undefined {
  const statuses = children.map((c) => c.status).filter((s): s is string => !!s)
  if (!statuses.length) return children.length ? undefined : 'unverified'
  if (statuses.includes('broken') || statuses.includes('failed')) return 'broken'
  return statuses.length === children.length && statuses.every((s) => s === 'verified' || s === 'passed') ? 'verified' : 'unverified'
}

function resultsOf(conditions: ConditionResult[] | undefined, cases: TestCase[] | null | undefined): TraceResult[] {
  return (conditions ?? [])
    .map((c): TraceResult => {
      const id = c.test ? parseTestIds(c.test)[0] : undefined
      const found = id && cases ? findTests(id, cases).matches : []
      return {
        condition: c.condition, outcome: c.outcome,
        ...(c.test ? { test: c.test } : {}),
        ...(c.measurement ? { measurement: c.measurement } : {}),
        ...(c.detail ? { detail: c.detail } : {}),
        ...(found.length ? { cases: [...found].sort((a, b) => rankOf(a.status) - rankOf(b.status)) } : {}),
      }
    })
    .sort((a, b) => rankOf(a.outcome) - rankOf(b.outcome))
}

/** Every path through `id`, from its roots to the results. */
export function traceOf(input: TraceInput, id: string): Trace {
  const { nodes, relations } = input
  const target = nodes[id]
  if (!target || !(TRACE_TYPES as readonly string[]).includes(target.type)) return { id, roots: [] }
  const up = new Map<string, string[]>()
  const down = new Map<string, string[]>()
  for (const r of Object.values(relations)) {
    const s = nodes[r.sourceId]
    const t = nodes[r.targetId]
    if (!s || !t || s.id === t.id) continue
    if (!UP.some((u) => u.relationType === r.relationType && u.from === s.type && u.to.includes(t.type))) continue
    up.set(s.id, [...up.get(s.id) ?? [], t.id])
    down.set(t.id, [...down.get(t.id) ?? [], s.id])
  }
  // Above the target: only what leads to it.
  const above = new Set<string>()
  const roots: string[] = []
  const climb = (n: string, seen: Set<string>): void => {
    const parents = (up.get(n) ?? []).filter((p) => !seen.has(p))
    if (!parents.length) { if (!roots.includes(n)) roots.push(n); return }
    for (const p of parents) { above.add(p); climb(p, new Set([...seen, p])) }
  }
  climb(id, new Set([id]))

  const ev = input.evidence?.nodes
  const build = (n: string, path: Set<string>, under: boolean): TraceNode => {
    const node = nodes[n]
    const e: EvidenceEntry | undefined = ev?.[n]
    const isTarget = n === id
    const below = under || isTarget
    const base: TraceNode = { id: n, type: node.type, label: node.label, ...(isTarget ? { target: true } : {}), children: [], results: [] }
    if (path.has(n)) return { ...base, status: e?.status, repeated: true }
    const next = new Set([...path, n])
    // Under the target every child; above it only those on the way to it.
    const kids = (down.get(n) ?? []).filter((k, i, all) => all.indexOf(k) === i && (below || k === id || above.has(k)))
    // Failing first; at the same status what checks it before what derives from it.
    const children = kids.map((k) => build(k, next, below))
      .sort((a, b) => rankOf(a.status) - rankOf(b.status) || Number(a.type === b.type ? 0 : a.type === 'requirement') - Number(a.type === b.type ? 0 : b.type === 'requirement') || a.label.localeCompare(b.label))
    const elements = e?.elements?.map((el) => ({ id: el.id, label: el.label, status: el.status, results: resultsOf(el.conditions, input.cases) }))
      .sort((a, b) => rankOf(a.status) - rankOf(b.status))
    return {
      ...base,
      status: e?.status ?? (node.type === 'need' && ev ? rollUp(children) : undefined),
      children,
      results: resultsOf(e?.conditions, input.cases),
      ...(elements?.length ? { elements } : {}),
    }
  }
  return {
    id,
    roots: roots.map((r) => build(r, new Set(), false)).sort((a, b) => rankOf(a.status) - rankOf(b.status) || a.label.localeCompare(b.label)),
  }
}

const TYPE_LABEL: Record<string, string> = { need: 'Need', requirement: 'Requirement', scenario: 'Scenario', adr: 'ADR', 'fitness-fn': 'Fitness function' }
export const traceTypeLabel = (type: string): string => TYPE_LABEL[type] ?? type

/** What is missing under an element with nothing under it. */
export function traceGap(node: TraceNode): string | null {
  if (node.repeated || node.children.length || node.results.length || node.elements?.length) return null
  switch (node.type) {
    case 'need': return 'no requirement derives from it'
    case 'requirement': return 'no scenario verifies it'
    case 'adr': return 'no fitness function implements it'
    case 'scenario': case 'fitness-fn': return 'names no check'
    default: return null
  }
}

function resultLine(r: TraceResult, now: number): string {
  const what = r.test ?? r.condition
  const m = r.measurement
  const measured = m ? ` · ${m.value}${m.unit ? ` ${m.unit}` : ''} by ${m.source}, ${Math.max(0, Math.round((now - Date.parse(m.at)) / 3_600_000))} h ago` : ''
  return `${what} — ${r.outcome}${measured}${r.detail && !m ? ` (${r.detail})` : ''}`
}

/** The paths as indented text, for the CLI and the MCP server. */
export function formatTrace(trace: Trace, nodes: Record<string, C4Node>, now = Date.now()): string {
  const asked = nodes[trace.id]
  if (!asked) return `No element ${trace.id} in the model.`
  const out: string[] = []
  if (!trace.roots.length) return `${asked.label} (${asked.type}) is on no verification path: paths are made of ${TRACE_TYPES.join(', ')}.`
  out.push(`Verification path of ${asked.label} [${asked.id}]`)
  const walk = (n: TraceNode, depth: number): void => {
    const pad = '  '.repeat(depth)
    out.push(`${pad}${n.target ? '▶ ' : '- '}${traceTypeLabel(n.type)}: ${n.label} [${n.id}] — ${n.status ?? 'no results'}${n.repeated ? ' (again, see above)' : ''}`)
    const gap = traceGap(n)
    if (gap) out.push(`${pad}    (${gap})`)
    for (const r of n.results) {
      out.push(`${pad}    · ${resultLine(r, now)}`)
      for (const c of r.cases ?? []) {
        if (c.status !== 'failed' || !c.message) continue
        for (const line of c.message.split('\n').slice(0, 4)) out.push(`${pad}        ${line}`)
      }
    }
    for (const el of n.elements ?? []) {
      out.push(`${pad}    for ${el.label} [${el.id}] — ${el.status}`)
      for (const r of el.results) out.push(`${pad}      · ${resultLine(r, now)}`)
    }
    for (const c of n.children) walk(c, depth + 1)
  }
  for (const r of trace.roots) walk(r, 0)
  return out.join('\n')
}
