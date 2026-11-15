// F1: radical verify takes a test id copied as Playwright prints it
// ("tests/pay.spec.ts:2:3 › pay › takes a card", or with its project,
// "[chromium] › tests/pay.spec.ts:2:3 › pay › takes a card"), and radical check
// never finds it: "no report has the file of test …", the scenario not-run,
// though the Playwright report has the test passed. The same test bound as
// "tests/pay.spec.ts › pay › takes a card" passes. The help says a test is
// given "as Vitest and Playwright print it".
// Usage: node f1-playwright-printed-id.mjs [--scratch <dir>] [--keep]
import { cleanUp, git, join, mkdirSync, requirement, scratch, show, writeFileSync, writeModel } from './flib.mjs'

function repository(tag) {
  const root = scratch(tag)
  git(root, 'init', '-q', '-b', 'main')
  writeModel(join(root, '.radical', 'model'), [
    { id: 'sys', type: 'system', label: 'Shop', path: 'shop/_index.md' },
    { id: 'api', type: 'container', label: 'API', path: 'shop/api/_index.md' },
    { id: 'need', type: 'need', label: 'Pay', path: 'need.md', description: 'People pay by card.' },
    requirement('req', 'Take card payments', 'API'),
    { id: 'pay', type: 'scenario', label: 'Pays by card', path: 'pays-by-card.md' },
  ], [
    { id: 'r1', sourceId: 'req', targetId: 'need', relationType: 'derives' },
    { id: 'r2', sourceId: 'api', targetId: 'req', relationType: 'satisfies' },
    { id: 'r3', sourceId: 'pay', targetId: 'req', relationType: 'verifies' },
  ])
  writeFileSync(join(root, '.radical', 'model', 'check.json'), JSON.stringify({ rules: { 'concern-unaddressed': 'off' } }) + '\n')
  mkdirSync(join(root, 'tests'))
  writeFileSync(join(root, 'tests', 'pay.spec.ts'), "test.describe('pay', () => {\n  test('takes a card', async () => {})\n})\n")
  // Playwright's JSON report (rootDir is the repository): the test passed.
  writeFileSync(join(root, 'playwright.json'), JSON.stringify({
    config: { rootDir: root },
    suites: [{ title: 'tests/pay.spec.ts', file: 'tests/pay.spec.ts', specs: [], suites: [{ title: 'pay', file: 'tests/pay.spec.ts', specs: [{ title: 'takes a card', file: 'tests/pay.spec.ts', line: 2, column: 3, tests: [{ projectName: 'chromium', status: 'expected', results: [{ duration: 12, status: 'passed' }] }] }] }] }],
  }))
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'shop')
  return root
}

try {
  const forms = {
    // What Playwright's list and line reporters print for the test (formatTestTitle).
    printed: 'tests/pay.spec.ts:2:3 › pay › takes a card',
    withProject: '[chromium] › tests/pay.spec.ts:2:3 › pay › takes a card',
    // The form the README's examples use.
    bare: 'tests/pay.spec.ts › pay › takes a card',
  }
  const passed = {}
  for (const [tag, id] of Object.entries(forms)) {
    console.log(`\n=== bound as "${id}"`)
    const root = repository(tag)
    const v = show(tag, root, ['verify', 'Pays by card', '--test', id])
    show(tag, root, ['check', '--report', 'playwright.json'])
    const traced = show(tag, root, ['check', '--trace', 'pay'])
    passed[tag] = { accepted: v.code === 0, passed: /Scenario: Pays by card \[pay\] — passed/.test(traced.out) }
  }
  console.log('\nExpected: a test given as Playwright prints it is the test the report has passed (Scenarios: 1 passed), or radical verify says how to write it.')
  console.log(`Actual: printed form accepted=${passed.printed.accepted} passed=${passed.printed.passed}; with project accepted=${passed.withProject.accepted} passed=${passed.withProject.passed}; bare form passed=${passed.bare.passed}.`)
  const bug = passed.bare.passed && ((passed.printed.accepted && !passed.printed.passed) || (passed.withProject.accepted && !passed.withProject.passed))
  console.log(`REPRODUCED: ${bug ? 'yes' : 'no'}`)
  process.exitCode = bug ? 1 : 0
} finally { cleanUp() }
