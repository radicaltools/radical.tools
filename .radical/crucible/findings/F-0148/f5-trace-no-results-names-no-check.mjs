// F5: before any radical check --report has kept test results, check --trace
// (and the MCP server's get_trace) says a scenario with a test bound by
// radical verify "names no check": the gap of a scenario with nothing bound.
// The bound test is not listed at all. After check --report the same trace
// lists the test.
// Usage: node f5-trace-no-results-names-no-check.mjs [--scratch <dir>] [--keep]
import { cleanUp, git, join, requirement, scratch, show, writeFileSync, writeModel } from './flib.mjs'
import { mcp } from './mcp.mjs'

try {
  const root = scratch('trace')
  git(root, 'init', '-q', '-b', 'main')
  const model = join(root, '.radical', 'model')
  writeModel(model, [
    { id: 'sys', type: 'system', label: 'Orders', path: 'orders/_index.md' },
    { id: 'api', type: 'container', label: 'Orders API', path: 'orders/api/_index.md' },
    { id: 'need', type: 'need', label: 'Order', path: 'need.md', description: 'People order goods.' },
    requirement('req', 'Take orders', 'Orders API'),
    { id: 'scen', type: 'scenario', label: 'Order taken', path: 'scen.md' },
  ], [
    { id: 'r0', sourceId: 'req', targetId: 'need', relationType: 'derives' },
    { id: 'r1', sourceId: 'api', targetId: 'req', relationType: 'satisfies' },
    { id: 'r2', sourceId: 'scen', targetId: 'req', relationType: 'verifies' },
  ], 'orders')
  writeFileSync(join(root, 'report.json'), JSON.stringify({ testResults: [{ name: join(root, 'tests', 'orders.test.ts'), assertionResults: [{ ancestorTitles: [], title: 'places an order', status: 'passed' }] }] }))
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'orders')
  show('', root, ['verify', 'Order taken', '--test', 'tests/orders.test.ts › places an order'])
  const before = show('', root, ['check', '--trace', 'scen'])
  const m = await mcp(model, root)
  const viaMcp = await m.call('get_trace', { id: 'scen' })
  await m.close()
  console.log(`MCP get_trace scen:\n${viaMcp.text.split('\n').map((l) => `    ${l}`).join('\n')}`)
  show('', root, ['check', '--report', 'report.json'])
  const after = show('', root, ['check', '--trace', 'scen'])
  const gap = (t) => /names no check/.test(t)
  console.log('\nExpected: with no results kept, the trace lists the bound test with no outcome yet (as the trace after a report lists it), never "names no check".')
  console.log(`Actual: before a report: CLI says "names no check" = ${gap(before.out)}, lists the test = ${/places an order/.test(before.out)}; MCP get_trace "names no check" = ${gap(viaMcp.text)}; after check --report: "names no check" = ${gap(after.out)}, lists the test = ${/places an order/.test(after.out)}.`)
  const bug = (gap(before.out) || gap(viaMcp.text)) && !gap(after.out)
  console.log(`REPRODUCED: ${bug ? 'yes' : 'no'}`)
  process.exitCode = bug ? 1 : 0
} finally { cleanUp() }
