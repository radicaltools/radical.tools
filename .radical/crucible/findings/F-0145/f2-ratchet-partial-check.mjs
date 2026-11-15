// F2: radical check --ratchet lowers baselines from a check that left part of
// the rules' input out, so the next full check fails:
//  A. --alone (without the models deps.json names): inherited-adr-unapplied
//     finds 0 there, max 1 → 0; the check with the dependency then finds 1 > 0.
//  B. --trigger pull-request: a continual fitness function's unmeasured metric
//     is not reported on that trigger, metric-not-measured max 1 → 0; the
//     check without --trigger then finds 1 > 0.
// The help keeps the baselines of rules that do not run (the test rules
// without --report); these ran on part of their input only.
// Usage: node f2-ratchet-partial-check.mjs [--scratch <dir>] [--keep]
import { cleanUp, git, join, mkdirSync, readFileSync, scratch, show, writeFileSync, writeModel } from './flib.mjs'

const maxOf = (file, rule) => JSON.parse(readFileSync(file, 'utf8')).rules[rule].max

function alone() {
  const base = scratch('alone')
  const env = { RADICAL_CACHE: join(base, 'cache') }
  const orders = join(base, 'orders'); mkdirSync(orders)
  git(orders, 'init', '-q', '-b', 'main')
  writeModel(join(orders, '.radical', 'model'), [
    { id: 'osys', type: 'system', label: 'Orders', path: 'orders/_index.md' },
    { id: 'oapi', type: 'container', label: 'Orders API', path: 'orders/api/_index.md' },
    { id: 'oadr', type: 'adr', label: 'Every service logs as JSON', path: 'oadr.md', status: 'accepted', date: '2026-11-01', context: 'Logs are read by one tool.', decision: 'Every service logs as JSON.', consequences: 'One parser.' },
  ], [{ id: 'o1', sourceId: 'oadr', targetId: 'oapi', relationType: 'constrains' }], 'orders')
  git(orders, 'add', '-A'); git(orders, 'commit', '-qm', 'orders'); git(orders, 'tag', 'v1.0.0')
  const shop = join(base, 'shop'); mkdirSync(shop)
  git(shop, 'init', '-q', '-b', 'main')
  const model = join(shop, '.radical', 'model')
  writeModel(model, [
    { id: 'ssys', type: 'system', label: 'Shop', path: 'shop/_index.md' },
    { id: 'sweb', type: 'container', label: 'Web', path: 'shop/web/_index.md' },
  ], [{ id: 's1', sourceId: 'sweb', targetId: 'oapi', label: 'places orders' }], 'shop')
  const config = join(model, 'check.json')
  writeFileSync(config, JSON.stringify({ rules: { 'concern-unaddressed': 'off', 'inherited-adr-unapplied': { severity: 'error', max: 1 } } }, null, 2) + '\n')
  writeFileSync(join(model, 'deps.json'), JSON.stringify({ name: 'shop', dependencies: [{ name: 'orders', repo: '../../../orders', path: '.radical/model', ref: 'v1.0.0' }] }, null, 2) + '\n')
  git(shop, 'add', '-A'); git(shop, 'commit', '-qm', 'shop')
  show('A', shop, ['federation', 'fetch'], env)
  const before = show('A', shop, ['check'], env)
  show('A', shop, ['check', '--alone', '--ratchet'], env)
  const max = maxOf(config, 'inherited-adr-unapplied')
  const after = show('A', shop, ['check'], env)
  return { before: before.code, max, after: after.code }
}

function trigger() {
  const root = scratch('trigger')
  git(root, 'init', '-q', '-b', 'main')
  const model = join(root, '.radical', 'model')
  writeModel(model, [
    { id: 'sys', type: 'system', label: 'Shop', path: 'shop/_index.md' },
    { id: 'ff1', type: 'fitness-fn', label: 'Shop stays up', path: 'ff1.md', cadence: 'continual', metrics: 'uptime >= 99.9 %' },
    { id: 'ff2', type: 'fitness-fn', label: 'Bundle stays small', path: 'ff2.md', cadence: 'triggered', trigger: 'pull-request', metrics: 'bundle_kb < 500 kB' },
  ], [{ id: 'c1', sourceId: 'ff1', targetId: 'sys', relationType: 'constrains' }, { id: 'c2', sourceId: 'ff2', targetId: 'sys', relationType: 'constrains' }])
  const config = join(model, 'check.json')
  writeFileSync(config, JSON.stringify({ rules: { 'concern-unaddressed': 'off', 'fitness-fn-unclassified': 'off', 'metric-not-measured': { severity: 'error', max: 1 } } }, null, 2) + '\n')
  writeFileSync(join(root, 'bundle.json'), JSON.stringify({ format: 'radical-metrics', version: 1, source: 'bundle', at: new Date().toISOString(), measurements: [{ metric: 'bundle_kb', value: 300, unit: 'kB' }] }))
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'm')
  const before = show('B', root, ['check', '--metrics', 'bundle.json'])
  show('B', root, ['check', '--trigger', 'pull-request', '--ratchet'])
  const max = maxOf(config, 'metric-not-measured')
  const after = show('B', root, ['check'])
  return { before: before.code, max, after: after.code }
}

try {
  const a = alone()
  const b = trigger()
  console.log('\nExpected: a baseline stays where a rule ran on part of its input (--alone, --trigger), or --ratchet refuses with them; the full check still passes.')
  console.log(`Actual: A (--alone): check exit ${a.before}, inherited-adr-unapplied max 1 → ${a.max}, full check then exit ${a.after}. B (--trigger pull-request): check exit ${b.before}, metric-not-measured max 1 → ${b.max}, check then exit ${b.after}.`)
  const bug = (a.before === 0 && a.max < 1 && a.after === 1) || (b.before === 0 && b.max < 1 && b.after === 1)
  console.log(`REPRODUCED: ${bug ? 'yes' : 'no'}`)
  process.exitCode = bug ? 1 : 0
} finally { cleanUp() }
