// ─── radical check: files beside the model ───────────────────────────────────
//
// check.json in the model folder holds the project's rule settings, so the
// CLI, Studio and CI check alike; it goes into git with the model.
// .radical/test-results.json holds the test cases of the last run read with
// --report, for Studio to work out what they say about the model as it is
// edited; like the rest of .radical/ it stays out of git.

import { SELECTION_DIR } from '../formats/canvasSelection'
import type { CheckConfig } from './index'
import type { TestCase, TestStatus } from './reports'

export const CHECK_CONFIG_FILE = 'check.json'
export const TEST_RESULTS_FILE = `${SELECTION_DIR}/test-results.json`

export interface TestResults {
  version: 1
  /** When the reports were read (ISO time). */
  readAt: string
  /** The report files, as given. */
  reports: string[]
  cases: TestCase[]
}

export function serializeTestResults(cases: TestCase[], reports: string[], readAt = new Date()): string {
  const results: TestResults = { version: 1, readAt: readAt.toISOString(), reports, cases }
  return JSON.stringify(results)
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
  return { version: 1, readAt: r.readAt, reports: Array.isArray(r.reports) ? r.reports.filter((x) => typeof x === 'string') : [], cases }
}

/** The rule settings in `text`; throws when it is not a config. */
export function parseCheckConfig(text: string): CheckConfig {
  const data = JSON.parse(text) as unknown
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('a config is a JSON object')
  const rules = (data as CheckConfig).rules
  if (rules !== undefined && (typeof rules !== 'object' || rules === null || Array.isArray(rules))) throw new Error('"rules" is an object of rule settings')
  return data as CheckConfig
}
