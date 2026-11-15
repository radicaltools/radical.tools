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
  /** Why it failed, as the runner wrote it: colour codes removed, cut to
   *  the first lines. */
  message?: string
  /** How long it ran, in milliseconds. */
  durationMs?: number
  /** Its line in the file. */
  line?: number
}

/** The lines of a failure message kept with a test case. */
export const MESSAGE_LINES = 12
const MESSAGE_CHARS = 2000

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g

/** A failure message as a test case keeps it: without colour codes or
 *  blank edges, at most MESSAGE_LINES lines; undefined when empty. */
export function failureMessage(text: unknown): string | undefined {
  if (typeof text !== 'string') return undefined
  const lines = text.replace(ANSI, '').replace(/\r\n?/g, '\n').split('\n')
  while (lines.length && !lines[0].trim()) lines.shift()
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  if (!lines.length) return undefined
  let kept = lines.slice(0, MESSAGE_LINES).join('\n')
  if (kept.length > MESSAGE_CHARS) kept = kept.slice(0, MESSAGE_CHARS)
  return kept.length < lines.join('\n').length ? `${kept}\n…` : kept
}

/** The details a report gives of one case, leaving out what it does not. */
const details = (message: unknown, durationMs: unknown, line: unknown): Pick<TestCase, 'message' | 'durationMs' | 'line'> => {
  const m = failureMessage(message)
  return {
    ...(m ? { message: m } : {}),
    ...(typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs >= 0 ? { durationMs: Math.round(durationMs) } : {}),
    ...(typeof line === 'number' && Number.isInteger(line) && line > 0 ? { line } : {}),
  }
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
  type Assertion = { ancestorTitles?: string[]; title: string; status: string; failureMessages?: unknown[]; duration?: number; location?: { line?: number } }
  for (const file of report.testResults as Array<{ name: string; assertionResults?: Assertion[] }>) {
    for (const a of file.assertionResults ?? []) {
      const status: TestStatus = a.status === 'passed' ? 'passed' : a.status === 'failed' ? 'failed' : 'skipped'
      const messages = Array.isArray(a.failureMessages) ? a.failureMessages.filter((m): m is string => typeof m === 'string') : []
      cases.push({
        file: normalize(file.name),
        title: [...(a.ancestorTitles ?? []), a.title],
        status,
        // Vitest writes the location only with includeTaskLocation.
        ...details(status === 'failed' ? messages.join('\n') : undefined, a.duration, a.location?.line),
      })
    }
  }
  return cases
}

interface PwSuite { title: string; file?: string; specs?: PwSpec[]; suites?: PwSuite[] }
interface PwResult { duration?: number; error?: { message?: string }; errors?: Array<{ message?: string }> }
interface PwSpec { title: string; file?: string; line?: number; tests?: Array<{ status?: string; results?: PwResult[] }> }

function parsePlaywrightJson(report: Record<string, unknown>): TestCase[] {
  const config = report.config as { rootDir?: string } | undefined
  const root = config?.rootDir ? normalize(config.rootDir).replace(/\/$/, '') : ''
  const cases: TestCase[] = []
  const walk = (suite: PwSuite, titles: string[], file: string): void => {
    for (const spec of suite.specs ?? []) {
      const statuses = (spec.tests ?? []).map((t) => t.status)
      // One test per project (browser); a spec fails when any of them did.
      const status: TestStatus = statuses.includes('unexpected') ? 'failed'
        : statuses.length && statuses.every((s) => s === 'skipped') ? 'skipped' : 'passed'
      // The last try of each project's test is the one that counts.
      const last = (spec.tests ?? []).map((t) => t.results?.[t.results.length - 1]).filter((r): r is PwResult => !!r)
      const failedTry = (spec.tests ?? []).filter((t) => t.status === 'unexpected').map((t) => t.results?.[t.results.length - 1]).find((r) => r)
      const message = failedTry ? failedTry.error?.message ?? failedTry.errors?.find((e) => e.message)?.message : undefined
      const durations = last.map((r) => r.duration).filter((d): d is number => typeof d === 'number')
      cases.push({
        file: root ? `${root}/${normalize(spec.file ?? file)}` : normalize(spec.file ?? file),
        title: [...titles, spec.title],
        status,
        ...details(status === 'failed' ? message : undefined, durations.length ? Math.max(...durations) : undefined, spec.line),
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
    const failure = /<(failure|error)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/.exec(body)
    // The element's text (escaped, or in CDATA), else its message attribute.
    const raw = failure?.[4] ?? ''
    const text = /<!\[CDATA\[/.test(raw) ? raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') : unescapeXml(raw)
    const message = failure ? (text.trim() ? text : attributes(failure[2]).message) : undefined
    const seconds = attrs.time !== undefined ? Number(attrs.time) : undefined
    const line = attrs.line !== undefined ? Number(attrs.line) : undefined
    cases.push({
      file: normalize(file),
      title,
      status: failure ? 'failed' : /<skipped\b/.test(body) ? 'skipped' : 'passed',
      ...details(message, seconds !== undefined ? seconds * 1000 : undefined, line),
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

/** The test ids in a list, one per line (a title may hold
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
  // Asked for each test a scenario or fitness function names, by each rule
  // and for each element it is measured on: kept for the cases' list, as a
  // model of 20,000 elements asked it hundreds of thousands of times.
  let found = FOUND.get(cases)
  if (!found) { found = new Map(); FOUND.set(cases, found) }
  const key = `${id.file}\u0000${id.title.join('\u0000')}`
  let result = found.get(key)
  if (!result) { result = findTestsIn(id, cases); found.set(key, result) }
  return result
}

const FOUND = new WeakMap<TestCase[], Map<string, { fileSeen: boolean; matches: TestCase[] }>>()
const BY_NAME = new WeakMap<TestCase[], Map<string, TestCase[]>>()
const baseName = (file: string): string => file.slice(file.lastIndexOf('/') + 1)

function findTestsIn(id: TestId, cases: TestCase[]): { fileSeen: boolean; matches: TestCase[] } {
  const n = id.title.length
  if (!n) {
    // A file, or a directory: every test under it.
    const under = cases.filter((c) => fileMatches(c.file, id.file) || c.file.includes(`/${id.file.replace(/\/$/, '')}/`) || c.file.startsWith(`${id.file.replace(/\/$/, '')}/`))
    return { fileSeen: under.length > 0, matches: under }
  }
  // Paths that end one with the other end with the same name.
  let byName = BY_NAME.get(cases)
  if (!byName) {
    byName = new Map()
    for (const c of cases) {
      const name = baseName(c.file)
      const list = byName.get(name)
      if (list) list.push(c); else byName.set(name, [c])
    }
    BY_NAME.set(cases, byName)
  }
  const inFile = (byName.get(baseName(id.file)) ?? []).filter((c) => fileMatches(c.file, id.file))
  const key = id.title.join(' › ')
  const tail = inFile.filter((c) => c.title.length >= n && c.title.slice(-n).join(' › ') === key)
  const matches = tail.length ? tail : inFile.filter((c) => c.title.length > n && c.title.slice(0, n).join(' › ') === key)
  return { fileSeen: inFile.length > 0, matches }
}

/** The outcome of the cases a test id names: failed when one failed,
 *  passed when one passed, otherwise skipped. */
export const outcomeOf = (matches: TestCase[]): TestStatus =>
  matches.some((c) => c.status === 'failed') ? 'failed' : matches.some((c) => c.status === 'passed') ? 'passed' : 'skipped'

const globCache = new Map<string, RegExp>()

/** Where a glob over repository paths (`apps/e2e/**`, `**\/*.spec.ts`)
 *  matches `file`, which a report may name absolutely: the file cut to the
 *  matched part (`apps/e2e/tests/a.spec.ts`), or null. */
export function globMatch(glob: string, file: string): string | null {
  let re = globCache.get(glob)
  if (!re) {
    // A directory (`apps/e2e/`) holds every file under it.
    const pattern = normalize(glob).replace(/\/+$/, (slash) => slash ? '/**' : '')
    const body = pattern.split(/(\*\*\/?|\*|\?)/).map((part) =>
      part === '**/' ? '(?:[^/]+/)*' : part === '**' ? '.*' : part === '*' ? '[^/]*' : part === '?' ? '[^/]' : part.replace(/[.+^${}()|[\]\\]/g, '\\$&')).join('')
    re = new RegExp(`(?:^|/)(${body})$`)
    globCache.set(glob, re)
  }
  const m = re.exec(normalize(file))
  if (!m) return null
  // A glob that starts anywhere (`**/…`) has no root to cut the path to.
  return glob.startsWith('**') ? normalize(file) : m[1]
}

