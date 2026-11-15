// F1: a test bound with radical verify as Vitest prints it ("file > describe > title")
// is taken without a word, and radical check then never finds it: "no report has the
// file of test …", though the report holds that very test, passed.
// The same test bound with › is found and passes.
// Usage: node f1-verify-vitest-separator.mjs [--scratch <dir>] [--keep]
import { cleanUp, git, join, mkdirSync, show, scratch, writeFileSync, writeModel, requirement } from './flib.mjs'

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
  mkdirSync(join(root, 'src'))
  writeFileSync(join(root, 'src', 'pay.test.ts'), "describe('pay', () => { it('takes a card', () => {}) })\n")
  // Vitest's JSON report of that file: the test passed.
  writeFileSync(join(root, 'vitest.json'), JSON.stringify({ testResults: [{ name: join(root, 'src', 'pay.test.ts'), assertionResults: [{ ancestorTitles: ['pay'], title: 'takes a card', status: 'passed' }] }] }))
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'shop')
  return root
}

try {
  const results = {}
  for (const [tag, id] of [['gt', 'src/pay.test.ts > pay > takes a card'], ['arrow', 'src/pay.test.ts › pay › takes a card']]) {
    console.log(`\n=== bound as "${id}"`)
    const root = repository(tag)
    show(tag, root, ['verify', 'Pays by card', '--test', id])
    const checked = show(tag, root, ['check', '--report', 'vitest.json'])
    const traced = show(tag, root, ['check', '--trace', 'pay'])
    results[tag] = { notRun: /no report has the file/.test(checked.out), passed: /Scenario: Pays by card \[pay\] — passed/.test(traced.out) }
  }
  console.log('\nExpected: both bindings name the same passed test: Scenarios: 1 passed, the trace says passed.')
  console.log(`Actual: with ">" not-run = ${results.gt.notRun}, passed = ${results.gt.passed}; with "›" not-run = ${results.arrow.notRun}, passed = ${results.arrow.passed}.`)
  console.log(`REPRODUCED: ${results.gt.notRun && !results.gt.passed && results.arrow.passed ? 'yes' : 'no'}`)
} finally { cleanUp() }
