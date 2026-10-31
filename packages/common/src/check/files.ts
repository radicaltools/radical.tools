// ─── radical check: files beside the model ───────────────────────────────────
//
// check.json in the model folder holds the project's rule settings, so the
// CLI, Studio and CI check alike; it goes into git with the model.
// .radical/test-results.json holds the test cases of the last run read with
// --report, or downloaded from CI with --from-ci, for Studio to work out what
// they say about the model as it is edited; .radical/measurements.json holds
// what sensors measured. Like the rest of .radical/ they stay out of git: a
// commit cannot hold the results of its own tests.

import { SELECTION_DIR } from '../formats/canvasSelection'
import { stripBom } from '../formats/mdFolder'
import type { CheckConfig } from './index'
import type { TestCase, TestStatus } from './reports'

export const CHECK_CONFIG_FILE = 'check.json'
export const TEST_RESULTS_FILE = `${SELECTION_DIR}/test-results.json`
/** The latest measurement of each metric and labels, as `radical sense`
 *  and `radical check --metrics` keep them for Studio (metrics.ts). */
export const MEASUREMENTS_FILE = `${SELECTION_DIR}/measurements.json`

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
}

export function serializeTestResults(cases: TestCase[], reports: string[], readAt = new Date(), from: { commit?: string; ci?: CiSource } = {}): string {
  const results: TestResults = { version: 1, readAt: readAt.toISOString(), reports, cases, ...(from.commit ? { commit: from.commit } : {}), ...(from.ci ? { ci: from.ci } : {}) }
  return JSON.stringify(results)
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
  return { provider: 'github', commit: ci.commit, behind: ci.behind, runs }
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
  return {
    version: 1, readAt: r.readAt, reports: Array.isArray(r.reports) ? r.reports.filter((x) => typeof x === 'string') : [], cases,
    ...(typeof r.commit === 'string' ? { commit: r.commit } : {}), ...(ci ? { ci } : {}),
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
  const ci = (data as CheckConfig).ci
  if (ci !== undefined) {
    const artifacts = (ci as { artifacts?: unknown } | null)?.artifacts
    if (typeof ci !== 'object' || ci === null || Array.isArray(ci) || (artifacts !== undefined && !(Array.isArray(artifacts) && artifacts.every((a) => typeof a === 'string' && a))))
      throw new Error('"ci" is an object whose "artifacts" lists the names of the CI artifacts that hold test reports')
  }
  return data as CheckConfig
}
