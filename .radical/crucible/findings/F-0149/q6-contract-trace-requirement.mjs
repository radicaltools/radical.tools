// Q6: a consumer contract test (this repository's test bound to a scenario of
// another federation model) fails. radical check says "Not verified now:
// requirement 'Take orders'"; check --trace (and MCP get_trace) draw that
// requirement above the failed scenario as "no results". The same model kept
// as the repository's own draws it "broken".
// Usage: node q6-contract-trace-requirement.mjs [--scratch <dir>] [--keep]
import { cleanUp, git, join, mkdirSync, requirement, scratch, show, writeFileSync, writeModel } from './flib.mjs'

const ORDERS = [
  { id: 'osys', type: 'system', label: 'Orders', path: 'orders/_index.md' },
  { id: 'oapi', type: 'container', label: 'Orders API', path: 'orders/api/_index.md' },
  requirement('oreq', 'Take orders', 'Orders API'),
  { id: 'oscen', type: 'scenario', label: 'Order taken', path: 'oscen.md' },
]
const ORDER_RELATIONS = [
  { id: 'o1', sourceId: 'oapi', targetId: 'oreq', relationType: 'satisfies' },
  { id: 'o2', sourceId: 'oscen', targetId: 'oreq', relationType: 'verifies' },
]
const report = (root) => writeFileSync(join(root, 'report.json'), JSON.stringify({ testResults: [{ name: join(root, 'tests', 'orders.contract.test.ts'), assertionResults: [{ ancestorTitles: [], title: 'places an order', status: 'failed', failureMessages: ['expected 201, got 500'] }] }] }))
const TEST = 'tests/orders.contract.test.ts › places an order'

try {
  // Federated: shop depends on orders and binds a test to its scenario.
  const base = scratch('fed')
  const env = { RADICAL_CACHE: join(base, 'cache') }
  const orders = join(base, 'orders'); mkdirSync(orders)
  git(orders, 'init', '-q', '-b', 'main')
  writeModel(join(orders, '.radical', 'model'), ORDERS, ORDER_RELATIONS, 'orders')
  git(orders, 'add', '-A'); git(orders, 'commit', '-qm', 'orders'); git(orders, 'tag', 'v1.0.0')
  const shop = join(base, 'shop'); mkdirSync(shop)
  git(shop, 'init', '-q', '-b', 'main')
  const model = join(shop, '.radical', 'model')
  writeModel(model, [
    { id: 'ssys', type: 'system', label: 'Shop', path: 'shop/_index.md' },
    { id: 'sweb', type: 'container', label: 'Web', path: 'shop/web/_index.md' },
  ], [{ id: 's1', sourceId: 'sweb', targetId: 'oapi', label: 'places orders' }], 'shop')
  writeFileSync(join(model, 'check.json'), JSON.stringify({ rules: { 'concern-unaddressed': 'off' } }) + '\n')
  writeFileSync(join(model, 'deps.json'), JSON.stringify({ name: 'shop', dependencies: [{ name: 'orders', repo: '../../../orders', path: '.radical/model', ref: 'v1.0.0' }] }, null, 2) + '\n')
  report(shop)
  git(shop, 'add', '-A'); git(shop, 'commit', '-qm', 'shop')
  show('federated', shop, ['federation', 'fetch'], env)
  show('federated', shop, ['verify', 'Order taken', '--test', TEST], env)
  const checked = show('federated', shop, ['check', '--report', 'report.json'], env)
  const traced = show('federated', shop, ['check', '--trace', 'oscen'], env)

  // The same model as the repository's own.
  const own = scratch('own')
  git(own, 'init', '-q', '-b', 'main')
  writeModel(join(own, '.radical', 'model'), ORDERS, ORDER_RELATIONS, 'orders')
  report(own)
  git(own, 'add', '-A'); git(own, 'commit', '-qm', 'own')
  show('own', own, ['verify', 'Order taken', '--test', TEST])
  show('own', own, ['check', '--report', 'report.json'])
  const ownTrace = show('own', own, ['check', '--trace', 'oscen'])

  const statusOf = (out) => /Requirement: Take orders \[oreq\] — ([\w -]+)/.exec(out)?.[1]
  const says = /Not verified now: requirement "Take orders"/.test(checked.out)
  console.log('\nQuestion: above a failed consumer contract test, should the trace call the other model\'s requirement broken, as the check\'s message and the same model kept here do?')
  console.log(`Actual: check says "Not verified now: requirement Take orders" = ${says}; trace in the federation: ${statusOf(traced.out)}; trace of the same model kept here: ${statusOf(ownTrace.out)}.`)
  const bug = says && statusOf(traced.out) === 'no results' && statusOf(ownTrace.out) === 'broken'
  console.log(`REPRODUCED: ${bug ? 'yes' : 'no'}`)
  process.exitCode = bug ? 1 : 0
} finally { cleanUp() }
