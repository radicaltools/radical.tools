// ─── radical check: files beside the model ───────────────────────────────────
//
// check.json in the model folder holds the project's rule settings, so the
// CLI, Studio and CI check alike; it goes into git with the model.
// .state/test-results.json holds the test cases of the last run read with
// --report, or downloaded from CI with --from-ci, for Studio to work out what
// they say about the model as it is edited; .state/measurements.json holds
// what sensors measured, and .state/ci-fetch.json what the last fetch from
// CI found. Like the rest of .state/ they stay out of git: a commit cannot
// hold the results of its own tests.

import { STATE_DIR } from '../formats/canvasSelection'
import { stripBom } from '../formats/mdFolder'
import type { CheckConfig } from './index'
import type { TestCase, TestStatus } from './reports'

export const CHECK_CONFIG_FILE = 'check.json'
export const TEST_RESULTS_FILE = `${STATE_DIR}/test-results.json`
/** The latest measurement of each metric and labels, as `radical sense`
 *  and `radical check --metrics` keep them for Studio (metrics.ts). */
export const MEASUREMENTS_FILE = `${STATE_DIR}/measurements.json`
/** What the last `radical check --from-ci` found, written also when it found
 *  nothing: the git hooks run it with their output closed. */
export const CI_FETCH_FILE = `${STATE_DIR}/ci-fetch.json`

/** A CI run whose artifacts held test reports. */
export interface CiRun {
  id: number
  url: string
  /** The commit the run tested: a pull request's head for a squash merge. */
  sha: string
  /** When it ran (ISO time). */
  ranAt: string
  workflow: string
  pr?: number
  artifacts: string[]
}

/** Where results downloaded from CI come from. */
export interface CiSource {
  provider: 'github'
  /** The commit in HEAD's history the runs stand for. */
  commit: string
  /** How many commits HEAD was past it when they were downloaded. */
  behind: number
  runs: CiRun[]
  /** How many measurements (radical-metrics/1 files) the runs' artifacts
   *  held; absent in results downloaded before they were read. */
  measurements?: number
}

export interface TestResults {
  version: 1
  /** When the reports were read (ISO time). */
  readAt: string
  /** The report files, as given. */
  reports: string[]
  cases: TestCase[]
  /** HEAD when the reports were read, in git. */
  commit?: string
  /** Downloaded from CI (radical check --from-ci). */
  ci?: CiSource
  /** The cases among them that the reports read last do not have: kept from
   *  what was read before. */
  kept?: KeptCases
}

/** What a run of some test files left in the results as it was. */
export interface KeptCases {
  /** The earliest reading they may come from (ISO time). */
  since: string
  /** How many test cases, in how many files. */
  cases: number
  files: number
}

export function serializeTestResults(cases: TestCase[], reports: string[], readAt = new Date(), from: { commit?: string; ci?: CiSource; kept?: KeptCases } = {}): string {
  const results: TestResults = {
    version: 1, readAt: readAt.toISOString(), reports, cases, ...(from.commit ? { commit: from.commit } : {}), ...(from.ci ? { ci: from.ci } : {}),
    ...(from.kept ? { kept: from.kept } : {}),
  }
  return JSON.stringify(results)
}

/** Two names of one test file: reports name a file by its whole path or by
 *  the end of it, so paths that end one with the other are the same file. */
const sameTestFile = (a: string, b: string): boolean => a === b || a.endsWith('/' + b) || b.endsWith('/' + a)

/** The cases of a run with what `earlier` results say of the test files the
 *  run does not have: a run of some tests replaces the results of its
 *  files and leaves the others as they were, so the tests it did not run
 *  keep the outcome they had. `kept` counts what was left, and since when. */
export function withEarlierResults(cases: TestCase[], earlier: TestResults | null): { cases: TestCase[]; kept?: KeptCases } {
  if (!earlier?.cases.length) return { cases }
  const slash = (file: string): string => file.replace(/\\/g, '/')
  const ran = [...new Set(cases.map((c) => slash(c.file)))]
  const ranSet = new Set(ran)
  // Decided once for each file of the earlier results.
  const replaced = new Map<string, boolean>()
  const isReplaced = (file: string): boolean => {
    let r = replaced.get(file)
    if (r === undefined) { r = ranSet.has(file) || ran.some((f) => sameTestFile(f, file)); replaced.set(file, r) }
    return r
  }
  const left = earlier.cases.filter((c) => !isReplaced(slash(c.file)))
  if (!left.length) return { cases }
  return {
    cases: [...cases, ...left],
    kept: { since: earlier.kept?.since ?? testsRanAt(earlier), cases: left.length, files: new Set(left.map((c) => slash(c.file))).size },
  }
}

/** When the tests behind `results` ran: the latest CI run for results from
 *  CI, else when they were read. */
export function testsRanAt(results: TestResults): string {
  const runs = results.ci?.runs.map((r) => r.ranAt).filter((at) => !Number.isNaN(Date.parse(at))).sort() ?? []
  return runs.length ? runs[runs.length - 1] : results.readAt
}

function ciSourceOf(value: unknown): CiSource | undefined {
  const ci = value as Partial<CiSource> | undefined
  if (!ci || ci.provider !== 'github' || typeof ci.commit !== 'string' || typeof ci.behind !== 'number' || !Array.isArray(ci.runs)) return undefined
  const runs = ci.runs.filter((r): r is CiRun => !!r && typeof r.id === 'number' && typeof r.url === 'string' && typeof r.sha === 'string'
    && typeof r.ranAt === 'string' && typeof r.workflow === 'string' && Array.isArray(r.artifacts))
  return { provider: 'github', commit: ci.commit, behind: ci.behind, runs, ...(typeof ci.measurements === 'number' ? { measurements: ci.measurements } : {}) }
}

const STATUSES = new Set<TestStatus>(['passed', 'failed', 'skipped'])

/** The test results in `text`, or null when it is none. */
export function parseTestResults(text: string): TestResults | null {
  let data: unknown
  try { data = JSON.parse(text) } catch { return null }
  const r = data as Partial<TestResults>
  if (r?.version !== 1 || typeof r.readAt !== 'string' || !Array.isArray(r.cases)) return null
  const cases = r.cases.filter((c): c is TestCase =>
    !!c && typeof c.file === 'string' && Array.isArray(c.title) && c.title.every((t) => typeof t === 'string') && STATUSES.has(c.status))
  const ci = ciSourceOf(r.ci)
  const k = r.kept as Partial<KeptCases> | undefined
  const kept = k && typeof k.since === 'string' && typeof k.cases === 'number' && typeof k.files === 'number' ? { since: k.since, cases: k.cases, files: k.files } : undefined
  return {
    version: 1, readAt: r.readAt, reports: Array.isArray(r.reports) ? r.reports.filter((x) => typeof x === 'string') : [], cases,
    ...(typeof r.commit === 'string' ? { commit: r.commit } : {}), ...(ci ? { ci } : {}), ...(kept ? { kept } : {}),
  }
}

/** The rule settings in `text`; throws when it is not a config. A
 *  byte-order mark (Notepad, PowerShell 5) is no part of the JSON. */
export function parseCheckConfig(text: string): CheckConfig {
  const data = JSON.parse(stripBom(text)) as unknown
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('a config is a JSON object')
  const rules = (data as CheckConfig).rules
  if (rules !== undefined && (typeof rules !== 'object' || rules === null || Array.isArray(rules))) throw new Error('"rules" is an object of rule settings')
  const goals = (data as CheckConfig).goals
  if (goals !== undefined) {
    if (typeof goals !== 'object' || goals === null || Array.isArray(goals)) throw new Error('"goals" is an object of goals by metric')
    for (const [id, goal] of Object.entries(goals)) {
      const min = (goal as { min?: unknown } | null)?.min
      if (typeof min !== 'number' || !(min >= 0 && min <= 100)) throw new Error(`goal "${id}" needs a "min" from 0 to 100 (percent)`)
    }
  }
  const adopt = (data as CheckConfig).adopt
  if (adopt !== undefined && typeof adopt !== 'boolean') throw new Error('"adopt" is true while check.json waits for the baselines of its first run (radical check --adopt), else left out')
  const ci = (data as CheckConfig).ci
  if (ci !== undefined) {
    const artifacts = (ci as { artifacts?: unknown } | null)?.artifacts
    if (typeof ci !== 'object' || ci === null || Array.isArray(ci) || (artifacts !== undefined && !(Array.isArray(artifacts) && artifacts.every((a) => typeof a === 'string' && a))))
      throw new Error('"ci" is an object whose "artifacts" lists the names of the CI artifacts that hold test reports')
  }
  return data as CheckConfig
}

// ─── The last fetch from CI ─────────────────────────────────────────────────

/** What a fetch from CI found: the results of CI read, the same runs as
 *  the results kept, results kept that were read with --report at a later
 *  commit, or nothing (no gh, no run with artifacts, no report in them). */
export type CiFetchOutcome = 'read' | 'same' | 'kept' | 'failed'

export interface CiFetch {
  version: 1
  /** When it fetched (ISO time). */
  at: string
  /** HEAD when it fetched. */
  head?: string
  outcome: CiFetchOutcome
  /** What it said, as the command prints it. */
  message: string
  /** The commit the runs stand for, and the runs. */
  commit?: string
  runs?: Array<{ id: number; url: string }>
  /** How many test cases and measurements the artifacts held. */
  tests?: number
  measurements?: number
}

/** What CI has to do for --from-ci to find something: said where a fetch found nothing. */
export const CI_ARTIFACTS_HINT = 'CI has to keep its test reports (and its radical sense --out files) as artifacts of the run, named in .radical/radical.json\'s "ci": { "artifacts": [...] }'

export const serializeCiFetch = (fetch: Omit<CiFetch, 'version'>): string => JSON.stringify({ version: 1, ...fetch } satisfies CiFetch, null, 2) + '\n'

const OUTCOMES = new Set<CiFetchOutcome>(['read', 'same', 'kept', 'failed'])

/** The record in `text`, or null when it is none. */
export function parseCiFetch(text: string): CiFetch | null {
  let data: unknown
  try { data = JSON.parse(text) } catch { return null }
  const f = data as Partial<CiFetch>
  if (f?.version !== 1 || typeof f.at !== 'string' || Number.isNaN(Date.parse(f.at)) || !OUTCOMES.has(f.outcome as CiFetchOutcome) || typeof f.message !== 'string') return null
  const runs = Array.isArray(f.runs) ? f.runs.filter((r) => !!r && typeof r.id === 'number' && typeof r.url === 'string').map((r) => ({ id: r.id, url: r.url })) : undefined
  return {
    version: 1, at: f.at, outcome: f.outcome as CiFetchOutcome, message: f.message,
    ...(typeof f.head === 'string' ? { head: f.head } : {}), ...(typeof f.commit === 'string' ? { commit: f.commit } : {}),
    ...(runs?.length ? { runs } : {}), ...(typeof f.tests === 'number' ? { tests: f.tests } : {}), ...(typeof f.measurements === 'number' ? { measurements: f.measurements } : {}),
  }
}

/** Why the last fetch left the results of CI out, or null when it read
 *  them: it could not fetch, or the artifacts held no test report. */
export function ciFetchProblem(fetch: CiFetch | null): string | null {
  if (!fetch) return null
  if (fetch.outcome === 'failed') return fetch.message
  if (fetch.outcome === 'read' && fetch.tests === 0) return fetch.message
  return null
}
