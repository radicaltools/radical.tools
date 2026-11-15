// Q5: radical verify binds this repository's test to a scenario of another model of
// the federation (deps.json) and says it is "checked by 1 test"; the test then fails
// in the report and radical check passes (exit 0, nothing said), and
// radical check --trace on that scenario says there is no such element.
// Usage: node q5-federation-bound-test-unjudged.mjs [--scratch <dir>] [--keep]
import { cleanUp, git, join, mkdirSync, requirement, scratch, show, writeFileSync, writeModel } from './flib.mjs'

try {
  const base = scratch('fed')
  const env = { RADICAL_CACHE: join(base, 'cache') }
  const orders = join(base, 'orders'); mkdirSync(orders)
  git(orders, 'init', '-q', '-b', 'main')
  writeModel(join(orders, '.radical', 'model'), [
    { id: 'osys', type: 'system', label: 'Orders', path: 'orders/_index.md' },
    { id: 'oapi', type: 'container', label: 'Orders API', path: 'orders/api/_index.md' },
    requirement('oreq', 'Take orders', 'Orders API'),
    { id: 'oscen', type: 'scenario', label: 'Order taken', path: 'oscen.md' },
  ], [
    { id: 'o1', sourceId: 'oapi', targetId: 'oreq', relationType: 'satisfies' },
    { id: 'o2', sourceId: 'oscen', targetId: 'oreq', relationType: 'verifies' },
  ], 'orders')
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
  writeFileSync(join(shop, 'report.json'), JSON.stringify({ testResults: [{ name: join(shop, 'tests', 'orders.contract.test.ts'), assertionResults: [{ ancestorTitles: [], title: 'places an order', status: 'failed', failureMessages: ['expected 201, got 500'] }] }] }))
  git(shop, 'add', '-A'); git(shop, 'commit', '-qm', 'shop')
  show('shop', shop, ['federation', 'fetch'], env)
  show('shop', shop, ['verify', 'Order taken', '--test', 'tests/orders.contract.test.ts › places an order'], env)
  const checked = show('shop', shop, ['check', '--report', 'report.json'], env)
  const traced = show('shop', shop, ['check', '--trace', 'oscen'], env)
  console.log(`\nQuestion: should a failed test this repository binds to another model's scenario show in its check (and --trace), or should radical verify refuse the binding?`)
  console.log(`Actual: verify took it; check exit ${checked.code}, ${/failed|Order taken/.test(checked.out) ? 'names it' : 'says nothing of it'}; --trace exit ${traced.code}.`)
  console.log(`REPRODUCED: ${checked.code === 0 && !/Order taken/.test(checked.out) && traced.code === 2 ? 'yes' : 'no'}`)
} finally { cleanUp() }
