// F1: after delete_node, the element's entry in .radical/radical.json stays,
// get_implementation / get_verification flag it as "no element of the model",
// radical check warns about it, and set_implementation / set_verification
// with remove: true refuse to take it out ("no element ... in the model").
//   node f1-orphan-entry.mjs
import { join } from 'node:path'
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { DIR, REPO, mcp, freshRepo, commitAll } from './lib.mjs'
const dir = join(DIR, 'work/f1')
const folder = freshRepo(dir, null)
mkdirSync(join(dir, 'apps/api'), { recursive: true })
const m = await mcp(folder)
const must = async (name, args) => { const r = await m.call(name, args); if (!r.ok) throw new Error(`${name}: ${r.text}`); return r }
await must('add_node', { type: 'system', label: 'Shop', tempId: 'sys' })
await must('add_node', { type: 'container', label: 'API', parentId: 'sys', tempId: 'api' })
await must('add_node', { type: 'scenario', label: 'Pays', tempId: 'sc' })
await must('set_implementation', { id: 'api', paths: ['apps/api'] })
await must('set_verification', { id: 'sc', tests: ['apps/api/pay.test.ts › pays'] })
const file = join(dir, '.radical/radical.json')
const ids = JSON.parse(readFileSync(file, 'utf8'))
const apiId = ids.implements[0].element, scId = ids.verifies[0].element
await must('delete_node', { id: apiId })
await must('delete_node', { id: scId })
const impl = JSON.parse((await must('get_implementation', {})).text)
const ver = JSON.parse((await must('get_verification', {})).text)
console.log('get_implementation flags:', JSON.stringify(impl.implements.map((e) => e.unknown)))
console.log('get_verification flags:', JSON.stringify(ver.verifies.map((e) => e.unknown)))
const rmImpl = await m.call('set_implementation', { id: apiId, remove: true })
const rmVer = await m.call('set_verification', { id: scId, remove: true })
console.log('set_implementation remove:', rmImpl.ok ? 'ok' : 'REFUSED', '-', rmImpl.text)
console.log('set_verification remove:', rmVer.ok ? 'ok' : 'REFUSED', '-', rmVer.text)
await m.close()
let check
try { check = execFileSync(process.execPath, [join(REPO, 'apps/cli/dist/index.js'), 'check', folder], { cwd: dir, encoding: 'utf8' }) } catch (e) { check = `${e.stdout}${e.stderr}` }
const lines = check.split('\n').filter((l) => /radical\.json/.test(l))
console.log(`radical check, lines about radical.json (${lines.length}):\n${lines.join('\n')}`)
const after = JSON.parse(readFileSync(file, 'utf8'))
console.log(`radical.json still holds ${after.implements.length} implements and ${after.verifies.length} verifies entries of deleted elements`)
const bug = !rmImpl.ok && !rmVer.ok && after.implements.length === 1 && after.verifies.length === 1
console.log(bug ? 'BUG REPRODUCED' : 'not reproduced')
process.exitCode = bug ? 1 : 0
