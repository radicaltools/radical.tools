import { describe, expect, it } from 'vitest'
import { checkModel, formatCheckGithub, formatCheckText, parseCheckConfig, parseTestIds, parseTestReport, parseTestResults, runCheck, serializeTestResults, type TestCase } from '../src/check'
import { findTests, globMatch } from '../src/check/reports'
import { serializeToMdFolderWithPaths } from '../src/formats/mdFolder'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import type { C4Node, C4Relation, DiagramData } from '../src/c4'

const VITEST_JSON = JSON.stringify({
  numTotalTests: 3,
  testResults: [{
    name: '/repo/apps/cli/src/cli.test.ts',
    status: 'failed',
    assertionResults: [
      { ancestorTitles: ['radical check'], title: 'exits 0 with warnings only', status: 'passed' },
      { ancestorTitles: ['radical check', 'config'], title: 'ratchets', status: 'failed' },
      { ancestorTitles: [], title: 'later', status: 'todo' },
    ],
  }],
})

const PLAYWRIGHT_JSON = JSON.stringify({
  config: { rootDir: '/repo/apps/e2e/tests' },
  suites: [{
    title: 'studio/boot.spec.ts',
    file: 'studio/boot.spec.ts',
    specs: [{ title: 'boots', file: 'studio/boot.spec.ts', tests: [{ projectName: 'studio', status: 'expected' }] }],
    suites: [{
      title: 'Forge',
      file: 'studio/boot.spec.ts',
      specs: [
        { title: 'files stages', file: 'studio/boot.spec.ts', tests: [{ status: 'expected' }, { status: 'unexpected' }] },
        { title: 'is skipped', file: 'studio/boot.spec.ts', tests: [{ status: 'skipped' }] },
        { title: 'is flaky', file: 'studio/boot.spec.ts', tests: [{ status: 'flaky' }] },
      ],
    }],
  }],
})

const JUNIT_XML = `<?xml version="1.0" encoding="UTF-8" ?>
<testsuites name="vitest tests" tests="3">
  <testsuite name="src/cli.test.ts" tests="3">
    <testcase classname="src/cli.test.ts" name="radical check &gt; exits 0 &amp; more" time="0.01">
    </testcase>
    <testcase classname="src/cli.test.ts" name="radical check &gt; fails" time="0.01">
      <failure message="expected 1 to be 0">AssertionError</failure>
    </testcase>
    <testcase classname="src/cli.test.ts" name="skipped one" time="0"><skipped/></testcase>
    <testcase classname="Other" file="tests/x.test.ts" name="self closing"/>
  </testsuite>
</testsuites>`

describe('test reports', () => {
  it('reads a Vitest or Jest JSON report', () => {
    expect(parseTestReport(VITEST_JSON, 'v.json')).toEqual([
      { file: '/repo/apps/cli/src/cli.test.ts', title: ['radical check', 'exits 0 with warnings only'], status: 'passed' },
      { file: '/repo/apps/cli/src/cli.test.ts', title: ['radical check', 'config', 'ratchets'], status: 'failed' },
      { file: '/repo/apps/cli/src/cli.test.ts', title: ['later'], status: 'skipped' },
    ])
  })

  it('reads a Playwright JSON report: a spec fails when one of its projects did', () => {
    expect(parseTestReport(PLAYWRIGHT_JSON, 'pw.json')).toEqual([
      { file: '/repo/apps/e2e/tests/studio/boot.spec.ts', title: ['boots'], status: 'passed' },
      { file: '/repo/apps/e2e/tests/studio/boot.spec.ts', title: ['Forge', 'files stages'], status: 'failed' },
      { file: '/repo/apps/e2e/tests/studio/boot.spec.ts', title: ['Forge', 'is skipped'], status: 'skipped' },
      { file: '/repo/apps/e2e/tests/studio/boot.spec.ts', title: ['Forge', 'is flaky'], status: 'passed' },
    ])
  })

  it('reads a JUnit XML report', () => {
    expect(parseTestReport(JUNIT_XML, 'j.xml')).toEqual([
      { file: 'src/cli.test.ts', title: ['radical check', 'exits 0 & more'], status: 'passed' },
      { file: 'src/cli.test.ts', title: ['radical check', 'fails'], status: 'failed' },
      { file: 'src/cli.test.ts', title: ['skipped one'], status: 'skipped' },
      { file: 'tests/x.test.ts', title: ['self closing'], status: 'passed' },
    ])
  })

  it('refuses what is no report', () => {
    expect(() => parseTestReport('{"stats":{}}', 'r.json')).toThrow('r.json is no Vitest, Jest or Playwright JSON report')
    expect(() => parseTestReport('nope', 'r.txt')).toThrow('r.txt is neither JSON nor JUnit XML')
  })

  it('reads test ids one per line, leaving out comments; a title may hold "; "', () => {
    expect(parseTestIds('# Covered by:\napps/cli/src/cli.test.ts › radical check › prints JSON\n\napps/e2e/tests/studio/wizard.spec.ts › opens its wizard; finishing creates it\n')
      .map((id) => [id.file, id.title])).toEqual([
      ['apps/cli/src/cli.test.ts', ['radical check', 'prints JSON']],
      ['apps/e2e/tests/studio/wizard.spec.ts', ['opens its wizard; finishing creates it']],
    ])
    expect(parseTestIds(undefined)).toEqual([])
  })

  it('finds a test by a path suffix either way and the end of its title', () => {
    const cases: TestCase[] = [
      { file: '/repo/apps/cli/src/cli.test.ts', title: ['radical check', 'prints JSON'], status: 'passed' },
      { file: 'src/cli.test.ts', title: ['radical check', 'prints JSON'], status: 'failed' },
      { file: '/repo/apps/mcp/src/cli.test.ts', title: ['radical check', 'prints JSON'], status: 'passed' },
    ]
    const [full] = parseTestIds('apps/cli/src/cli.test.ts › radical check › prints JSON')
    expect(findTests(full, cases).matches).toEqual([cases[0], cases[1]])
    const [short] = parseTestIds('apps/cli/src/cli.test.ts › prints JSON')
    expect(findTests(short, cases).matches).toHaveLength(2)
    const [other] = parseTestIds('apps/cli/src/cli.test.ts › prints XML')
    expect(findTests(other, cases)).toEqual({ fileSeen: true, matches: [] })
    const [block] = parseTestIds('apps/cli/src/cli.test.ts › radical check')
    expect(findTests(block, cases).matches).toEqual([cases[0], cases[1]])
    const [file] = parseTestIds('apps/cli/src/cli.test.ts')
    expect(findTests(file, cases).matches).toEqual([cases[0], cases[1]])
    const [dir] = parseTestIds('apps/cli')
    expect(findTests(dir, cases).matches).toEqual([cases[0]])
    const [elsewhere] = parseTestIds('apps/web/a.test.ts › prints JSON')
    expect(findTests(elsewhere, cases)).toEqual({ fileSeen: false, matches: [] })
  })
})

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
const rel = (id: string, relationType: string, sourceId: string, targetId: string): C4Relation =>
  ({ id, relationType, sourceId, targetId })

/** Four scenarios, one per outcome, each verifying its own requirement; a
 *  fitness function for an ADR; a scenario that names no test. */
function model(): DiagramData {
  const scenario = (id: string, tests: string) => node(id, 'scenario', id.toUpperCase(), { given: 'g', when: 'w', then: 't', tests })
  return {
    metamodel: builtInGovernanceMetamodel(),
    nodes: [
      node('pass', 'requirement', 'Passing', { action: 'a' }),
      node('fail', 'requirement', 'Failing', { action: 'a' }),
      node('gone', 'requirement', 'Renamed', { action: 'a' }),
      node('later', 'requirement', 'Not run', { action: 'a' }),
      node('none', 'requirement', 'No test', { action: 'a' }),
      scenario('s-pass', 'apps/cli/src/cli.test.ts › radical check › exits 0 with warnings only'),
      scenario('s-fail', 'apps/cli/src/cli.test.ts › config › ratchets'),
      scenario('s-gone', 'apps/cli/src/cli.test.ts › radical check › old title'),
      scenario('s-later', 'apps/web/site.spec.ts › loads'),
      node('s-none', 'scenario', 'S-NONE', { given: 'g', when: 'w', then: 't' }),
      node('adr', 'adr', 'Decision', { status: 'accepted', date: 'd', context: 'c', decision: 'd', consequences: 'c' }),
      node('ff', 'fitness-fn', 'Guard', { threshold: 'passes', tests: 'apps/e2e/tests/studio/boot.spec.ts › Forge › is skipped' }),
    ],
    relations: [
      rel('v1', 'verifies', 's-pass', 'pass'),
      rel('v2', 'verifies', 's-fail', 'fail'),
      rel('v3', 'verifies', 's-gone', 'gone'),
      rel('v4', 'verifies', 's-later', 'later'),
      rel('v5', 'verifies', 's-none', 'none'),
      rel('i1', 'implements', 'ff', 'adr'),
    ],
  }
}

const tests = [...parseTestReport(VITEST_JSON, 'v.json'), ...parseTestReport(PLAYWRIGHT_JSON, 'pw.json')]
const checkWith = (data: DiagramData, withTests = true) =>
  runCheck(serializeToMdFolderWithPaths(data, 'T').files, {}, withTests ? { tests } : {})
const messages = (result: ReturnType<typeof checkWith>, rule: string) =>
  result.findings.filter((f) => f.rule === rule).map((f) => f.message)

describe('radical check with test reports', () => {
  it('finds each test outcome and names what it takes down', () => {
    const result = checkWith(model())
    expect(messages(result, 'test-failed')).toEqual(['Scenario "S-FAIL": test apps/cli/src/cli.test.ts › config › ratchets failed. Not verified now: requirement "Failing".'])
    expect(messages(result, 'test-not-found')).toEqual(['Scenario "S-GONE": no test apps/cli/src/cli.test.ts › radical check › old title in the reports, though its file ran; renamed or deleted? Not verified now: requirement "Renamed".'])
    expect(messages(result, 'test-not-run')).toEqual(['Scenario "S-LATER": no report has the file of test apps/web/site.spec.ts › loads.'])
    expect(messages(result, 'test-skipped')).toEqual(['Fitness function "Guard": test apps/e2e/tests/studio/boot.spec.ts › Forge › is skipped was skipped.'])
    expect(messages(result, 'scenario-without-tests')).toEqual(['Scenario "S-NONE" names no test.'])
    expect(result.errors).toBe(2)
    expect(result.ok).toBe(false)
  })

  it('reads no outcomes without reports', () => {
    const result = checkWith(model(), false)
    expect(result.findings.filter((f) => f.rule.startsWith('test-'))).toEqual([])
    expect(result.evidence).toBeUndefined()
  })

  it('works out the evidence of scenarios, requirements, fitness functions and ADRs', () => {
    const { evidence } = checkWith(model())
    const status = (id: string) => evidence!.nodes[id].status
    expect([status('s-pass'), status('s-fail'), status('s-gone'), status('s-later'), status('s-none')]).toEqual(['passed', 'failed', 'failed', 'not-run', 'no-tests'])
    expect([status('pass'), status('fail'), status('gone'), status('later'), status('none')]).toEqual(['verified', 'broken', 'broken', 'unverified', 'unverified'])
    expect([status('ff'), status('adr')]).toEqual(['not-run', 'unverified'])
    expect(evidence!.nodes['s-gone'].tests).toEqual([{ id: 'apps/cli/src/cli.test.ts › radical check › old title', outcome: 'not-found' }])
    expect(evidence!.nodes.fail.by).toEqual(['s-fail'])
    expect(evidence!.testCases).toBe(7)
  })

  it('sums the evidence up in the text output', () => {
    const text = formatCheckText(checkWith(model()), { folder: 'm' })
    expect(text).toContain([
      'Test reports: 7 test cases',
      '  Requirements: 1 verified, 2 broken, 2 unverified',
      '  Scenarios: 1 passed, 2 failed, 1 not-run, 1 no-tests',
      '  ADRs: 1 unverified',
      '  Fitness functions: 1 not-run',
    ].join('\n'))
  })
})

describe('radical check on a model in memory, and the files beside it', () => {
  it('gives what runCheck gives, but for the folder rules, and links what a failure takes down', () => {
    const data = model()
    const inMemory = checkModel(data, {}, { tests })
    const fromFolder = checkWith(data)
    expect(inMemory.findings.map((f) => f.message).sort()).toEqual(fromFolder.findings.map((f) => f.message).sort())
    expect(inMemory.evidence).toEqual(fromFolder.evidence)
    expect(inMemory.findings.find((f) => f.rule === 'test-failed')).toMatchObject({ nodeId: 's-fail', relatedIds: ['fail'] })
    expect(inMemory.findings.find((f) => f.rule === 'test-skipped')!.relatedIds).toBeUndefined()
  })

  it('writes and reads the test results, dropping what is not a test case', () => {
    const text = serializeTestResults(tests, ['v.json', 'pw.json'], new Date('2026-10-14T12:54:00Z'))
    expect(parseTestResults(text)).toEqual({ version: 1, readAt: '2026-10-14T12:54:00.000Z', reports: ['v.json', 'pw.json'], cases: tests })
    const bad = JSON.stringify({ version: 1, readAt: 'x', cases: [{ file: 'a', title: ['t'], status: 'odd' }, tests[0]] })
    expect(parseTestResults(bad)!.cases).toEqual([tests[0]])
    expect(parseTestResults('{"version":2}')).toBeNull()
    expect(parseTestResults('nope')).toBeNull()
  })

  it('reads a config and refuses what is none', () => {
    expect(parseCheckConfig('{"rules":{"metamodel":"error"}}')).toEqual({ rules: { metamodel: 'error' } })
    expect(() => parseCheckConfig('[]')).toThrow('a config is a JSON object')
    expect(() => parseCheckConfig('{"rules":[]}')).toThrow('"rules" is an object of rule settings')
  })
})

describe('test-unbound', () => {
  const unbound = (data: DiagramData, setting?: unknown) => {
    const config = setting === undefined ? {} : { rules: { 'test-unbound': setting as never } }
    return runCheck(serializeToMdFolderWithPaths(data, 'T').files, config, { tests }).findings.filter((f) => f.rule === 'test-unbound')
  }

  it('finds nothing unless the project includes test files', () => {
    expect(unbound(model())).toEqual([])
    expect(unbound(model(), 'warning')).toEqual([])
  })

  it('counts per file the tests no element names by title or describe block; a whole file or directory covers none', () => {
    const data = model()
    // An umbrella over the whole e2e suite, as "E2E regression" has.
    data.nodes.push(node('ff-all', 'fitness-fn', 'All e2e', { threshold: 't', tests: 'apps/e2e/tests' }))
    const [finding] = unbound(data, { include: ['apps/e2e/**'] })
    // The fitness function "Guard" names one test of the four precisely.
    expect(finding).toMatchObject({
      severity: 'warning',
      testFile: 'apps/e2e/tests/studio/boot.spec.ts',
      message: 'apps/e2e/tests/studio/boot.spec.ts: 3 of 4 tests named by no scenario or fitness function.',
      details: ['boots', 'Forge › files stages', 'Forge › is flaky'],
    })
    expect(finding.nodeId).toBeUndefined()
  })

  it('takes a describe block as naming the tests in it, and leaves excluded files out', () => {
    const data = model()
    data.nodes.push(node('sc-forge', 'scenario', 'Forge', { given: 'g', when: 'w', then: 't', tests: 'apps/e2e/tests/studio/boot.spec.ts › Forge' }))
    expect(unbound(data, { include: ['apps/e2e/'] }).map((f) => f.details)).toEqual([['boots']])
    expect(unbound(data, { include: ['apps/e2e/**'], exclude: ['**/boot.spec.ts'] })).toEqual([])
    // The unit tests are no part of it unless included.
    expect(unbound(data, { include: ['apps/cli/**'] }).map((f) => f.testFile)).toEqual(['apps/cli/src/cli.test.ts'])
  })

  it('is listed with the test file in the text and as a GitHub annotation on it', () => {
    const data = model()
    const result = runCheck(serializeToMdFolderWithPaths(data, 'T').files, { rules: { 'test-unbound': { include: ['apps/e2e/**'] } } }, { tests })
    expect(formatCheckText(result, { folder: 'm', verbose: true })).toContain(
      '    warning  apps/e2e/tests/studio/boot.spec.ts: 3 of 4 tests named by no scenario or fitness function.\n               boots\n')
    // As an error, so the cap on warning annotations does not drop it.
    const strict = runCheck(serializeToMdFolderWithPaths(data, 'T').files, { rules: { 'test-unbound': { severity: 'error', include: ['apps/e2e/**'] } } }, { tests })
    expect(formatCheckGithub(strict, { folder: 'm' })).toContain('::error file=apps/e2e/tests/studio/boot.spec.ts,title=radical check%3A test-unbound::')
  })

  it('matches globs over repository paths against the paths reports give', () => {
    expect(globMatch('apps/e2e/**', '/repo/apps/e2e/tests/a.spec.ts')).toBe('apps/e2e/tests/a.spec.ts')
    expect(globMatch('apps/e2e/', '/__w/r/r/apps/e2e/b.spec.ts')).toBe('apps/e2e/b.spec.ts')
    expect(globMatch('apps/*/tests/*.ts', '/repo/apps/e2e/tests/d.ts')).toBe('apps/e2e/tests/d.ts')
    expect(globMatch('apps/*/tests/*.ts', '/repo/apps/e2e/tests/sub/d.ts')).toBeNull()
    expect(globMatch('apps/e2e/**', '/repo/apps/e2e2/x.ts')).toBeNull()
    expect(globMatch('**/*.spec.ts', '/repo/x/c.spec.ts')).toBe('/repo/x/c.spec.ts')
    expect(globMatch('tests/a.b.ts', 'tests/aXb.ts')).toBeNull()
  })
})

