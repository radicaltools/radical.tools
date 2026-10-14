// ─── radical check: test reports ─────────────────────────────────────────────
//
// Reads the reports test runners write (Vitest/Jest JSON, Playwright JSON,
// JUnit XML) into one list of test cases, and finds the case a model's test
// id names. A test id is `<file> › <title>`: the file as a path suffix, the
// title as the end of the case's describe blocks plus its own title.

export type TestStatus = 'passed' | 'failed' | 'skipped'

export interface TestCase {
  /** The file, as the report names it (absolute or relative). */
  file: string
  /** Describe blocks, then the test's own title. */
  title: string[]
  status: TestStatus
}

/** Between a test id's file and titles, as Playwright and Vitest print them. */
const SEPARATOR = /\s+›\s+/
/** Between the describe blocks in a JUnit test name: Vitest writes >. */
const JUNIT_SEPARATOR = /\s+[›>]\s+/

const normalize = (path: string): string => path.replace(/\\/g, '/').replace(/^\.\//, '')

/** Parses one report; `name` (the file name) only goes into errors. */
export function parseTestReport(content: string, name: string): TestCase[] {
  const text = content.trim()
  if (text.startsWith('<')) return parseJUnit(text)
  let json: unknown
  try { json = JSON.parse(text) } catch { throw new Error(`${name} is neither JSON nor JUnit XML`) }
  const report = json as Record<string, unknown>
  if (Array.isArray(report.testResults)) return parseJestJson(report)
  if (Array.isArray(report.suites)) return parsePlaywrightJson(report)
  throw new Error(`${name} is no Vitest, Jest or Playwright JSON report`)
}

function parseJestJson(report: Record<string, unknown>): TestCase[] {
  const cases: TestCase[] = []
  for (const file of report.testResults as Array<{ name: string; assertionResults?: Array<{ ancestorTitles?: string[]; title: string; status: string }> }>) {
    for (const a of file.assertionResults ?? []) {
      cases.push({
        file: normalize(file.name),
        title: [...(a.ancestorTitles ?? []), a.title],
        status: a.status === 'passed' ? 'passed' : a.status === 'failed' ? 'failed' : 'skipped',
      })
    }
  }
  return cases
}

interface PwSuite { title: string; file?: string; specs?: PwSpec[]; suites?: PwSuite[] }
interface PwSpec { title: string; file?: string; tests?: Array<{ status?: string }> }

function parsePlaywrightJson(report: Record<string, unknown>): TestCase[] {
  const config = report.config as { rootDir?: string } | undefined
  const root = config?.rootDir ? normalize(config.rootDir).replace(/\/$/, '') : ''
  const cases: TestCase[] = []
  const walk = (suite: PwSuite, titles: string[], file: string): void => {
    for (const spec of suite.specs ?? []) {
      const statuses = (spec.tests ?? []).map((t) => t.status)
      cases.push({
        file: root ? `${root}/${normalize(spec.file ?? file)}` : normalize(spec.file ?? file),
        title: [...titles, spec.title],
        // One test per project (browser); a spec fails when any of them did.
        status: statuses.includes('unexpected') ? 'failed'
          : statuses.length && statuses.every((s) => s === 'skipped') ? 'skipped' : 'passed',
      })
    }
    for (const child of suite.suites ?? []) walk(child, [...titles, child.title], file)
  }
  // The top suites are the files; their titles are the file names.
  for (const top of report.suites as PwSuite[]) walk(top, [], top.file ?? top.title)
  return cases
}

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const unescapeXml = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : XML_ENTITIES[e] ?? m)

const attributes = (tag: string): Record<string, string> =>
  Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)].map((m) => [m[1], unescapeXml(m[3] ?? m[4])]))

function parseJUnit(xml: string): TestCase[] {
  const cases: TestCase[] = []
  // A testcase is self-closing or holds failure/error/skipped elements.
  for (const m of xml.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const attrs = attributes(m[1])
    const body = m[3] ?? ''
    const file = attrs.file ?? attrs.classname ?? ''
    const title = (attrs.name ?? '').split(JUNIT_SEPARATOR)
    cases.push({
      file: normalize(file),
      title,
      status: /<(failure|error)\b/.test(body) ? 'failed' : /<skipped\b/.test(body) ? 'skipped' : 'passed',
    })
  }
  return cases
}

/** One test id from a model: `<file> › <title>…`. */
export interface TestId {
  raw: string
  file: string
  title: string[]
}

/** The test ids in a `tests` property, one per line (a title may hold
 *  "; "). Blank lines and lines starting with # are left out. */
export function parseTestIds(text: unknown): TestId[] {
  if (typeof text !== 'string') return []
  return text.split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((raw) => {
      const [file, ...title] = raw.split(SEPARATOR)
      return { raw, file: normalize(file), title }
    })
}

/** The same file when one path ends with the other: reports name files
 *  absolutely (Vitest JSON, Playwright) or relative to their workspace
 *  (Vitest JUnit), ids relative to the repository. */
const fileMatches = (reportFile: string, idFile: string): boolean =>
  reportFile === idFile || reportFile.endsWith('/' + idFile) || idFile.endsWith('/' + reportFile)

/** The cases a test id names, and whether its file is in the reports at
 *  all. A title names the test it ends (`file › test`, `file › describe ›
 *  test`) or, failing that, every test in the describe block it starts
 *  (`file › describe`); no title names every test in the file, or under
 *  the directory. */
export function findTests(id: TestId, cases: TestCase[]): { fileSeen: boolean; matches: TestCase[] } {
  const n = id.title.length
  if (!n) {
    // A file, or a directory: every test under it.
    const under = cases.filter((c) => fileMatches(c.file, id.file) || c.file.includes(`/${id.file.replace(/\/$/, '')}/`) || c.file.startsWith(`${id.file.replace(/\/$/, '')}/`))
    return { fileSeen: under.length > 0, matches: under }
  }
  const inFile = cases.filter((c) => fileMatches(c.file, id.file))
  const key = id.title.join(' › ')
  const tail = inFile.filter((c) => c.title.length >= n && c.title.slice(-n).join(' › ') === key)
  const matches = tail.length ? tail : inFile.filter((c) => c.title.length > n && c.title.slice(0, n).join(' › ') === key)
  return { fileSeen: inFile.length > 0, matches }
}

/** The outcome of the cases a test id names: failed when one failed,
 *  passed when one passed, otherwise skipped. */
export const outcomeOf = (matches: TestCase[]): TestStatus =>
  matches.some((c) => c.status === 'failed') ? 'failed' : matches.some((c) => c.status === 'passed') ? 'passed' : 'skipped'
