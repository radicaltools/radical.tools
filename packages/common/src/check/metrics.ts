// ─── radical check: conditions and measurements ──────────────────────────────
//
// A scenario or a fitness function states what checks it in its `metrics`
// property, one condition per line: a test that has to pass
// (`test(<file> › <title>) passed`) or a value a sensor measured
// (`api.latency.p95{env=staging} <= 300 ms`). Sensors (`radical sense`)
// only measure: they write radical-metrics/1 files of values, never
// verdicts. The engine here compares those values with the conditions in
// the model, so the threshold is part of the model and a tool can be
// swapped without touching it.

import { parseTestIds, type TestId } from './reports'

// ── Measurements ─────────────────────────────────────────────────────────────

export const METRICS_FORMAT = 'radical-metrics'

/** One value a sensor measured. `labels` are what a condition matches;
 *  `context` only says where it was taken (a commit, a CI run). */
export interface Measurement {
  metric: string
  value: number
  unit?: string
  labels: Record<string, string>
  /** The sensor (adapter) that measured it. */
  source: string
  /** When (ISO time). */
  at: string
  context?: Record<string, string>
}

/** A radical-metrics/1 file, as a sensor writes it. */
export interface MetricsFile {
  format: typeof METRICS_FORMAT
  version: 1
  source: string
  at: string
  context?: Record<string, string>
  measurements: Array<{ metric: string; value: number; unit?: string; labels?: Record<string, string> }>
}

const METRIC_NAME = /^[A-Za-z_][\w.:/-]*$/

const isStringMap = (v: unknown): v is Record<string, string> =>
  !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((x) => typeof x === 'string')

/** What is wrong with `data` as a radical-metrics/1 file; empty when nothing. */
export function metricsFileProblems(data: unknown): string[] {
  const f = data as Partial<MetricsFile> | null
  if (!f || typeof f !== 'object' || Array.isArray(f)) return ['it is no JSON object']
  const problems: string[] = []
  if (f.format !== METRICS_FORMAT || f.version !== 1) problems.push(`format is not "${METRICS_FORMAT}" version 1`)
  if (typeof f.source !== 'string' || !f.source.trim()) problems.push('source is missing')
  if (typeof f.at !== 'string' || Number.isNaN(Date.parse(f.at))) problems.push('at is no ISO time')
  if (f.context !== undefined && !isStringMap(f.context)) problems.push('context is no object of strings')
  if (!Array.isArray(f.measurements)) return [...problems, 'measurements is no list']
  f.measurements.forEach((m, i) => {
    if (typeof m?.metric !== 'string' || !METRIC_NAME.test(m.metric)) problems.push(`measurement ${i + 1}: metric is no name (letters, digits, . _ : / -)`)
    if (typeof m?.value !== 'number' || !Number.isFinite(m.value)) problems.push(`measurement ${i + 1}: value is no finite number`)
    if (m?.unit !== undefined && (typeof m.unit !== 'string' || /\s/.test(m.unit))) problems.push(`measurement ${i + 1}: unit is no word`)
    if (m?.labels !== undefined && !isStringMap(m.labels)) problems.push(`measurement ${i + 1}: labels is no object of strings`)
  })
  return problems
}

/** The measurements in a radical-metrics/1 file; throws, naming `name`,
 *  when it is none. */
export function parseMetricsFile(text: string, name: string): Measurement[] {
  let data: unknown
  try { data = JSON.parse(text) } catch { throw new Error(`${name} is no JSON`) }
  const problems = metricsFileProblems(data)
  if (problems.length) throw new Error(`${name} is no ${METRICS_FORMAT}/1 file: ${problems.join('; ')}`)
  const f = data as MetricsFile
  return f.measurements.map((m) => ({
    metric: m.metric, value: m.value, ...(m.unit ? { unit: m.unit } : {}), labels: { ...(m.labels ?? {}) },
    source: f.source, at: new Date(f.at).toISOString(), ...(f.context && Object.keys(f.context).length ? { context: f.context } : {}),
  }))
}

export function serializeMetricsFile(file: Omit<MetricsFile, 'format' | 'version'>): string {
  return JSON.stringify({ format: METRICS_FORMAT, version: 1, ...file }, null, 2) + '\n'
}

/** The measurements kept beside a model (.radical/measurements.json). */
export interface MeasurementStore {
  version: 1
  measurements: Measurement[]
}

const keyOf = (m: Measurement): string =>
  `${m.metric}{${Object.keys(m.labels).sort().map((k) => `${k}=${m.labels[k]}`).join(',')}}`

/** `existing` with `incoming` added, keeping only the latest measurement of
 *  each metric and labels: a condition reads no other, and the store stays
 *  as small as the set of things measured. */
export function mergeMeasurements(existing: Measurement[], incoming: Measurement[]): Measurement[] {
  const latest = new Map<string, Measurement>()
  for (const m of [...existing, ...incoming]) {
    const key = keyOf(m)
    const was = latest.get(key)
    if (!was || Date.parse(m.at) >= Date.parse(was.at)) latest.set(key, m)
  }
  return [...latest.values()].sort((a, b) => keyOf(a).localeCompare(keyOf(b)))
}

export const serializeMeasurementStore = (measurements: Measurement[]): string =>
  JSON.stringify({ version: 1, measurements } satisfies MeasurementStore) + '\n'

/** The measurements in a store file; the ones that are no measurement are
 *  left out, and a file that is no store gives none. */
export function parseMeasurementStore(text: string): Measurement[] {
  let data: Partial<MeasurementStore>
  try { data = JSON.parse(text) as Partial<MeasurementStore> } catch { return [] }
  if (data?.version !== 1 || !Array.isArray(data.measurements)) return []
  return data.measurements.filter((m): m is Measurement =>
    !!m && typeof m.metric === 'string' && typeof m.value === 'number' && Number.isFinite(m.value)
    && isStringMap(m.labels) && typeof m.source === 'string' && typeof m.at === 'string' && !Number.isNaN(Date.parse(m.at)))
}

// ── Conditions ───────────────────────────────────────────────────────────────

export type Comparison = '<' | '<=' | '>' | '>=' | '==' | '!='

/** A condition stated against a baseline: its median, plus or minus a
 *  margin, in percent or in a unit. */
export interface BaselineMargin {
  sign: 1 | -1
  by: number
  percent: boolean
  unit?: string
}

export type Condition =
  | { kind: 'test'; raw: string; id: TestId }
  /** `value` (and `unit`) is the limit; with `baseline`, the limit is the
   *  baseline's median with that margin, and `value` is NaN. */
  | { kind: 'metric'; raw: string; metric: string; labels: Record<string, string>; op: Comparison; value: number; unit?: string; baseline?: BaselineMargin }
  | { kind: 'invalid'; raw: string; problem: string }

const TEST_LINE = /^test\((.+)\)(?:\s+passed)?$/
// A manual fitness function's review: the latest one `radical sense review`
// recorded under the name has to have passed.
const REVIEW_LINE = /^review\((.+)\)\s+passed$/i

/** The metric a recorded review is read as (reviews.ts): 1 passed, 0 failed,
 *  labelled with the review's name. */
export const REVIEW_METRIC = 'review'
const METRIC_LINE = /^([A-Za-z_][\w.:/-]*)\s*(?:\{([^}]*)\})?\s*(<=|>=|==|!=|=|<|>)\s*(-?\d+(?:\.\d+)?(?:e-?\d+)?)\s*(\S+)?$/i
const BASELINE_LINE = /^([A-Za-z_][\w.:/-]*)\s*(?:\{([^}]*)\})?\s*(<=|>=|==|!=|=|<|>)\s*baseline(?:\s*([+-])\s*(\d+(?:\.\d+)?(?:e-?\d+)?)\s*(%|[^\s%]+)?)?$/i

function parseLabels(text: string): Record<string, string> | string {
  const labels: Record<string, string> = {}
  for (const part of text.split(',').map((p) => p.trim()).filter(Boolean)) {
    const m = /^([\w.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^"',]*))$/.exec(part)
    if (!m) return `"${part}" is no label (name=value)`
    labels[m[1]] = (m[2] ?? m[3] ?? m[4]).trim()
  }
  return labels
}

/** One condition from one line of `metrics`. */
export function parseCondition(line: string): Condition {
  const raw = line.trim()
  const test = TEST_LINE.exec(raw)
  if (test) {
    const [id] = parseTestIds(test[1])
    return id ? { kind: 'test', raw, id } : { kind: 'invalid', raw, problem: 'test() names no test' }
  }
  const review = REVIEW_LINE.exec(raw)
  if (review) return { kind: 'metric', raw, metric: REVIEW_METRIC, labels: { name: review[1].trim() }, op: '==', value: 1 }
  const b = BASELINE_LINE.exec(raw)
  if (b) {
    const labels = b[2] === undefined ? {} : parseLabels(b[2])
    if (typeof labels === 'string') return { kind: 'invalid', raw, problem: labels }
    if (b[4] && !b[6]) return { kind: 'invalid', raw, problem: 'a margin on the baseline needs % or a unit (`baseline + 20%`, `baseline + 500 ms`)' }
    const baseline: BaselineMargin = b[4]
      ? { sign: b[4] === '-' ? -1 : 1, by: Number(b[5]), percent: b[6] === '%', ...(b[6] !== '%' ? { unit: b[6] } : {}) }
      : { sign: 1, by: 0, percent: true }
    return { kind: 'metric', raw, metric: b[1], labels, op: (b[3] === '=' ? '==' : b[3]) as Comparison, value: Number.NaN, baseline }
  }
  const m = METRIC_LINE.exec(raw)
  if (!m) return { kind: 'invalid', raw, problem: 'it is neither `test(<file> › <title>) passed`, `review(<name>) passed`, `<metric>{<labels>} <op> <number> [unit]` nor `<metric>{<labels>} <op> baseline [+|- <number> %|unit]`' }
  const labels = m[2] === undefined ? {} : parseLabels(m[2])
  if (typeof labels === 'string') return { kind: 'invalid', raw, problem: labels }
  return { kind: 'metric', raw, metric: m[1], labels, op: (m[3] === '=' ? '==' : m[3]) as Comparison, value: Number(m[4]), ...(m[5] ? { unit: m[5] } : {}) }
}

/** The conditions in a `metrics` property, one per line; blank lines and
 *  lines starting with # are left out. */
export function parseConditions(text: unknown): Condition[] {
  if (typeof text !== 'string') return []
  return text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map(parseCondition)
}

/** Whether a fitness function's result is static (its metric conditions
 *  are fixed limits) or dynamic (one compares with a baseline), as
 *  Building Evolutionary Architectures classifies it; undefined when it
 *  states no metric condition (tests or reviews alone). */
export function fitnessResult(metrics: unknown): 'static' | 'dynamic' | undefined {
  const values = parseConditions(metrics).filter((c): c is Extract<Condition, { kind: 'metric' }> => c.kind === 'metric' && c.metric !== REVIEW_METRIC)
  if (!values.length) return undefined
  return values.some((c) => c.baseline) ? 'dynamic' : 'static'
}

/** How the outcomes of an element's conditions make its status. */
export type Combine = { kind: 'all' } | { kind: 'any' } | { kind: 'at-least'; n: number }

/** `combine`: all (also when empty), any, or "at least N"; null when it is
 *  none of them. */
export function parseCombine(text: unknown): Combine | null {
  const t = typeof text === 'string' ? text.trim().toLowerCase() : ''
  if (!t || t === 'all') return { kind: 'all' }
  if (t === 'any') return { kind: 'any' }
  const m = /^at\s+least\s+(\d+)$/.exec(t)
  return m && Number(m[1]) > 0 ? { kind: 'at-least', n: Number(m[1]) } : null
}

const AGE_UNITS: Record<string, number> = { s: 1e3, m: 60e3, min: 60e3, h: 3600e3, d: 86400e3, w: 7 * 86400e3 }

/** `max_age` in milliseconds ("7d", "12 h", "30min", "2w"): undefined when
 *  empty, null when it is no age. */
export function parseMaxAge(text: unknown): number | undefined | null {
  const t = typeof text === 'string' ? text.trim().toLowerCase() : ''
  if (!t) return undefined
  const m = /^(\d+(?:\.\d+)?)\s*(s|min|m|h|d|w)$/.exec(t)
  return m ? Number(m[1]) * AGE_UNITS[m[2]] : null
}

// Units that convert into each other, by their size in the family's base.
const UNIT_FAMILIES: Array<Record<string, number>> = [
  { ns: 1e-9, us: 1e-6, 'µs': 1e-6, ms: 1e-3, s: 1, min: 60, h: 3600, d: 86400 },
  { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4 },
]

/** `value` in `from` expressed in `to`; null when the units do not convert. */
export function convertUnit(value: number, from: string, to: string): number | null {
  if (from === to) return value
  const f = from.toLowerCase()
  const t = to.toLowerCase()
  if (f === t) return value
  const family = UNIT_FAMILIES.find((u) => u[f] !== undefined && u[t] !== undefined)
  return family ? (value * family[f]) / family[t] : null
}

const COMPARE: Record<Comparison, (a: number, b: number) => boolean> = {
  '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b,
  '==': (a, b) => a === b, '!=': (a, b) => a !== b,
}

export type MetricOutcome = 'passed' | 'failed' | 'stale' | 'not-run' | 'invalid'

export interface MetricEvaluation {
  outcome: MetricOutcome
  /** The measurement it was decided by, when one matched. */
  measurement?: Measurement
  /** Why: a unit that does not convert, the age of a stale measurement. */
  detail?: string
}

/** The latest measurement of the condition's metric whose labels include
 *  every label of the condition. */
export function latestMeasurement(condition: Extract<Condition, { kind: 'metric' }>, measurements: Measurement[]): Measurement | undefined {
  let latest: Measurement | undefined
  for (const m of measurements) {
    if (m.metric !== condition.metric) continue
    if (Object.entries(condition.labels).some(([k, v]) => m.labels[k] !== v)) continue
    if (!latest || Date.parse(m.at) > Date.parse(latest.at)) latest = m
  }
  return latest
}

const DAY = 86400e3
/** An age for people: "3 d", "5 h", "12 min". */
export const formatAge = (ms: number): string =>
  ms >= DAY ? `${Math.floor(ms / DAY)} d` : ms >= 3600e3 ? `${Math.floor(ms / 3600e3)} h` : `${Math.max(0, Math.floor(ms / 60e3))} min`

/** How many of the latest baseline measurements a baseline's median is
 *  taken over: a week of nights (the user's choice, 2026-10-30). */
export const BASELINE_RUNS = 7

/** The median of the latest BASELINE_RUNS measurements in `baseline` of
 *  the condition's metric and labels, in `unit` (those that do not convert
 *  left out); undefined when there are none. */
export function baselineOf(condition: Extract<Condition, { kind: 'metric' }>, baseline: Measurement[], unit: string | undefined): { median: number; runs: number } | undefined {
  const values = baseline
    .filter((m) => m.metric === condition.metric && Object.entries(condition.labels).every(([k, v]) => m.labels[k] === v))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, BASELINE_RUNS)
    .map((m) => (unit && m.unit ? convertUnit(m.value, m.unit, unit) : m.value))
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .sort((a, b) => a - b)
  if (!values.length) return undefined
  const mid = Math.floor(values.length / 2)
  return { median: values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2, runs: values.length }
}

const round = (n: number): number => Math.round(n * 100) / 100

/** A metric condition against the measurements: not run when none matches,
 *  stale when the latest is older than `maxAge` (whatever it says),
 *  invalid when the units do not convert, else passed or failed. A
 *  condition against a baseline compares with the median of `baseline`
 *  (baselineOf), with its margin; not run, saying so, when the baseline
 *  has nothing to compare with. */
export function evaluateMetric(condition: Extract<Condition, { kind: 'metric' }>, measurements: Measurement[], maxAge: number | undefined, now: number, baseline: Measurement[] = []): MetricEvaluation {
  const measurement = latestMeasurement(condition, measurements)
  if (!measurement) return { outcome: 'not-run' }
  const age = now - Date.parse(measurement.at)
  if (condition.baseline) {
    if (maxAge !== undefined && age > maxAge) return { outcome: 'stale', measurement, detail: `measured ${formatAge(age)} ago` }
    const unit = measurement.unit
    const base = baselineOf(condition, baseline, unit)
    if (!base) return { outcome: 'not-run', measurement, detail: 'no baseline to compare with' }
    const { sign, by, percent } = condition.baseline
    let margin = percent ? (base.median * by) / 100 : by
    if (!percent && condition.baseline.unit && unit) {
      const converted = convertUnit(by, condition.baseline.unit, unit)
      if (converted === null) return { outcome: 'invalid', measurement, detail: `the measurement is in ${unit}, which ${condition.baseline.unit} does not convert to` }
      margin = converted
    }
    const limit = base.median + sign * margin
    const outcome = COMPARE[condition.op](measurement.value, limit) ? 'passed' : 'failed'
    return { outcome, measurement, detail: `baseline ${round(base.median)}${unit ? ` ${unit}` : ''}, the median of ${base.runs}; limit ${round(limit)}${unit ? ` ${unit}` : ''}` }
  }
  let value = measurement.value
  if (condition.unit && measurement.unit) {
    const converted = convertUnit(measurement.value, measurement.unit, condition.unit)
    if (converted === null) return { outcome: 'invalid', measurement, detail: `the measurement is in ${measurement.unit}, which does not convert to ${condition.unit}` }
    value = converted
  }
  if (maxAge !== undefined && age > maxAge) return { outcome: 'stale', measurement, detail: `measured ${formatAge(age)} ago` }
  return { outcome: COMPARE[condition.op](value, condition.value) ? 'passed' : 'failed', measurement }
}
