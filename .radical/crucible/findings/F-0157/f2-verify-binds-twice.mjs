// F2: a test bound as Vitest prints it ("file > describe > title", the same
// test as "file › describe › title" since F-0113) is bound a second time by
// set_verification given the › form: the scenario "is checked by 2 test(s)"
// with one test. radical verify --test, given the same, keeps one.
//   node f2-verify-binds-twice.mjs
import { join } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { DIR, REPO, mcp, freshRepo } from './lib.mjs'
const dir = join(DIR, 'work/f2')
const folder = freshRepo(dir, null)
const m = await mcp(folder)
const must = async (name, args) => { const r = await m.call(name, args); if (!r.ok) throw new Error(`${name}: ${r.text}`); return r }
const created = async (label, tempId) => (await must('add_node', { type: 'scenario', label, tempId })).text.match(/Created node (\S+)\./)[1]
const ids = { pays: await created('Pays', 'pays'), refunds: await created('Refunds', 'refunds') }
// The repository's file as a person wrote it, with the test as Vitest prints it.
const file = join(dir, '.radical/radical.json')
writeFileSync(file, JSON.stringify({ implements: [], verifies: [
  { element: ids.pays, name: 'Pays', tests: ['tests/pay.test.ts > checkout > pays by card'] },
  { element: ids.refunds, name: 'Refunds', tests: ['tests/pay.test.ts > checkout > pays by card'] },
] }, null, 2))
const said = await must('set_verification', { id: 'pays', tests: ['tests/pay.test.ts › checkout › pays by card'] })
console.log(`set_verification: ${said.text}`)
const out = execFileSync(process.execPath, [join(REPO, 'apps/cli/dist/index.js'), 'verify', 'Refunds', '--test', 'tests/pay.test.ts › checkout › pays by card'], { cwd: dir, encoding: 'utf8' })
console.log(`radical verify: ${out.trim()}`)
await m.close()
const after = JSON.parse(readFileSync(file, 'utf8'))
const bound = (id) => after.verifies.find((v) => v.element === id).tests
console.log(`Pays (set_verification) binds ${bound(ids.pays).length}: ${JSON.stringify(bound(ids.pays))}`)
console.log(`Refunds (radical verify) binds ${bound(ids.refunds).length}: ${JSON.stringify(bound(ids.refunds))}`)
const bug = bound(ids.pays).length === 2 && bound(ids.refunds).length === 1
console.log(`REPRODUCED: ${bug ? 'yes' : 'no'}`)
process.exitCode = bug ? 1 : 0
