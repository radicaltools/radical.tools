// ─── Inspector: measurements and their readers ───────────────────────────────
//
// What the Measurements tab works out from the measurements beside the
// model and the check's evidence, apart from how it is drawn: the readers
// of each measurement (the scenarios and fitness functions whose condition
// was decided by it), the conditions nothing measured, the groups by
// metric and the tab's badge.

import { REVIEW_METRIC, parseCondition, type ConditionOutcome, type EvidenceEntry, type Measurement } from '@radical/common/check'

/** A scenario or fitness function whose condition read a measurement. */
export interface Reader {
  /** The scenario or fitness function. */
  id: string
  /** For a fitness function measured for each element: the element the
   *  condition was read for. */
  element?: string
  condition: string
  outcome: ConditionOutcome
  detail?: string
}

/** A metric condition no measurement matched. */
export interface Unmeasured {
  id: string
  element?: string
  condition: string
  metric: string
}

export const keyOf = (metric: string, labels: Record<string, string>): string =>
  `${metric}{${Object.keys(labels).sort().map((k) => `${k}=${labels[k]}`).join(',')}}`

/** The readers of each measurement (by its metric and labels) and the
 *  conditions nothing measured, from the check's evidence. */
export function readersOf(evidence: Record<string, EvidenceEntry> | undefined): { readers: Map<string, Reader[]>; unmeasured: Unmeasured[] } {
  const readers = new Map<string, Reader[]>()
  const unmeasured: Unmeasured[] = []
  const add = (id: string, element: string | undefined, c: { condition: string; test?: string; outcome: ConditionOutcome; measurement?: Measurement; detail?: string }): void => {
    if (c.test) return
    if (c.measurement) {
      const key = keyOf(c.measurement.metric, c.measurement.labels)
      readers.set(key, [...(readers.get(key) ?? []), { id, ...(element ? { element } : {}), condition: c.condition, outcome: c.outcome, ...(c.detail ? { detail: c.detail } : {}) }])
    } else if (c.outcome === 'not-run') {
      const parsed = parseCondition(c.condition)
      if (parsed.kind === 'metric') unmeasured.push({ id, ...(element ? { element } : {}), condition: c.condition, metric: parsed.metric })
    }
  }
  for (const [id, e] of Object.entries(evidence ?? {})) {
    for (const c of e.conditions ?? []) add(id, undefined, c)
    for (const el of e.elements ?? []) for (const c of el.conditions) add(id, el.id, c)
  }
  return { readers, unmeasured }
}

/** What the tab's card in the left panel says: how many measurements, and
 *  how many of their readers fail or find them too old. */
export function measurementsBadge(measurements: Measurement[] | null, evidence: Record<string, EvidenceEntry> | undefined): { count: number; failed: number; stale: number } | null {
  if (!measurements) return null
  const all = [...readersOf(evidence).readers.values()].flat()
  return { count: measurements.length, failed: all.filter((r) => r.outcome === 'failed' || r.outcome === 'invalid').length, stale: all.filter((r) => r.outcome === 'stale').length }
}

export const PILL: Record<string, [string, string]> = { passed: ['ok', 'passed'], failed: ['bad', 'failed'], stale: ['warn', 'stale'], invalid: ['bad', 'invalid'], 'not-run': ['none', 'not run'] }

/** A value for people: integers as they are, others to six figures. */
export const formatValue = (m: Measurement): string =>
  m.metric === REVIEW_METRIC ? (m.value === 1 ? 'passed' : m.value === 0 ? 'failed' : String(m.value))
    : Number.isInteger(m.value) ? String(m.value) : String(Number(m.value.toPrecision(6)))

export const when = (at: string): string => new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export interface MetricGroup {
  metric: string
  unit: string | undefined
  rows: Array<{ m: Measurement; readers: Reader[] }>
  sources: string[]
  latest: number
  failed: number
  stale: number
}

/** The measurements by metric, newest first within one; those with a
 *  failing reader first, then those with a stale one, then by name. */
export function groupByMetric(measurements: Measurement[], readers: Map<string, Reader[]>): MetricGroup[] {
  const groups = new Map<string, MetricGroup>()
  for (const m of measurements) {
    let g = groups.get(m.metric)
    if (!g) { g = { metric: m.metric, unit: undefined, rows: [], sources: [], latest: 0, failed: 0, stale: 0 }; groups.set(m.metric, g) }
    const own = readers.get(keyOf(m.metric, m.labels)) ?? []
    g.rows.push({ m, readers: own })
    g.unit = g.unit ?? m.unit
    if (!g.sources.includes(m.source)) g.sources.push(m.source)
    g.latest = Math.max(g.latest, Date.parse(m.at))
    g.failed += own.filter((r) => r.outcome === 'failed' || r.outcome === 'invalid').length
    g.stale += own.filter((r) => r.outcome === 'stale').length
  }
  for (const g of groups.values()) g.rows.sort((a, b) => Date.parse(b.m.at) - Date.parse(a.m.at))
  return [...groups.values()].sort((a, b) => Number(b.failed > 0) - Number(a.failed > 0) || Number(b.stale > 0) - Number(a.stale > 0) || a.metric.localeCompare(b.metric))
}
