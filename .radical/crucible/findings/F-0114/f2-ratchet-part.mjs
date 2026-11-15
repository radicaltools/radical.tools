// F2: in a code repository of one system model (.radical/radical.json names the
// model's repository; the model checked out at .radical/model), radical check
// --ratchet lowers the model's baselines to the count of the repository's part:
// requirement-without-scenario max 3 → 1 in the model's check.json, though the
// whole model still has 3. Carried to the model's repository, its own check fails.
// Usage: node f2-ratchet-part.mjs [--scratch <dir>] [--keep]
import { cleanUp, git, join, mkdirSync, readFileSync, requirement, scratch, show, writeFileSync, writeModel } from './flib.mjs'

try {
  const base = scratch('ratchet')
  // The model's own repository: Web and Payments, three requirements, no scenario yet.
  const central = join(base, 'central'); mkdirSync(central)
  git(central, 'init', '-q', '-b', 'main')
  writeModel(central, [
    { id: 'sys', type: 'system', label: 'Shop', path: 'shop/_index.md' },
    { id: 'web', type: 'container', label: 'Web', path: 'shop/web/_index.md' },
    { id: 'pay', type: 'container', label: 'Payments', path: 'shop/pay/_index.md' },
    { id: 'need', type: 'need', label: 'Pay', path: 'need.md', description: 'People pay by card.' },
    requirement('req1', 'Show the basket', 'Web'), requirement('req2', 'Take card payments', 'Payments'), requirement('req3', 'Refund payments', 'Payments'),
  ], [
    { id: 'r1', sourceId: 'web', targetId: 'req1', relationType: 'satisfies' },
    { id: 'r2', sourceId: 'pay', targetId: 'req2', relationType: 'satisfies' },
    { id: 'r3', sourceId: 'pay', targetId: 'req3', relationType: 'satisfies' },
    { id: 'r5', sourceId: 'req1', targetId: 'need', relationType: 'derives' },
    { id: 'r6', sourceId: 'req2', targetId: 'need', relationType: 'derives' },
    { id: 'r7', sourceId: 'req3', targetId: 'need', relationType: 'derives' },
  ], 'shop')
  writeFileSync(join(central, 'check.json'), JSON.stringify({ rules: { 'requirement-without-scenario': { severity: 'error', max: 3 }, 'concern-unaddressed': 'off' } }, null, 2) + '\n')
  git(central, 'add', '-A'); git(central, 'commit', '-qm', 'the model')
  // The Web repository: builds Web; the model checked out at .radical/model.
  const web = join(base, 'web'); mkdirSync(join(web, 'src'), { recursive: true })
  git(web, 'init', '-q', '-b', 'main')
  mkdirSync(join(web, '.radical'))
  writeFileSync(join(web, '.gitignore'), '.radical/model/\n')
  writeFileSync(join(web, '.radical', 'radical.json'), JSON.stringify({ model: { repo: '../central' }, implements: [{ element: 'web', name: 'Web', paths: ['src'] }] }, null, 2) + '\n')
  git(web, 'add', '-A'); git(web, 'commit', '-qm', 'web')
  git(join(web, '.radical'), 'clone', '-q', central, 'model')

  show('model repository', central, ['check'])
  show('web repository', web, ['check', '--ratchet'])
  const lowered = JSON.parse(readFileSync(join(web, '.radical', 'model', 'check.json'), 'utf8')).rules['requirement-without-scenario'].max
  console.log(`check.json of the model checkout: requirement-without-scenario max = ${lowered}; git status there: ${git(join(web, '.radical', 'model'), 'status', '--short')}`)
  // The model's repository with that check.json (committed and pushed from the checkout, say).
  writeFileSync(join(central, 'check.json'), readFileSync(join(web, '.radical', 'model', 'check.json'), 'utf8'))
  const after = show('model repository, with the ratcheted check.json', central, ['check'])
  console.log('\nExpected: the baseline is the whole model\'s; --ratchet in a repository\'s part leaves it at 3 (the model still has 3), and the model\'s own check stays at exit 0.')
  console.log(`Actual: max 3 → ${lowered}; the model's own check exits ${after.code} with ${(/(\d+) errors?/.exec(after.out) ?? [])[1]} errors.`)
  console.log(`REPRODUCED: ${lowered < 3 && after.code === 1 ? 'yes' : 'no'}`)
} finally { cleanUp() }
