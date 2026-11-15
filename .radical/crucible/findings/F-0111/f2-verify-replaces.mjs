// F2: set_verification's description says "Call it for each test you write
// for a scenario", and the manual says the agent "does the same over MCP" as
// `radical verify --test`, which adds a test. But each set_verification call
// replaces the scenario's tests: the second test written drops the first.
//   node f2-verify-replaces.mjs
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { DIR, REPO, mcp, freshRepo } from './lib.mjs'
const dir = join(DIR, 'work/f2')
const folder = freshRepo(dir, null)
const m = await mcp(folder)
const must = async (name, args) => { const r = await m.call(name, args); if (!r.ok) throw new Error(`${name}: ${r.text}`); return r }
const desc = (await m.tools()).find((t) => t.name === 'set_verification').description
console.log('description says "Call it for each test you write for a scenario":', desc.includes('Call it for each test you write for a scenario'))
await must('add_node', { type: 'scenario', label: 'Pays', tempId: 'mcp' })
await must('add_node', { type: 'scenario', label: 'Refunds', tempId: 'cli' })
// The agent writes two tests for "Pays" and binds each, as the tool says.
await must('set_verification', { id: 'mcp', tests: ['tests/pay.test.ts › pays by card'] })
const second = await must('set_verification', { id: 'mcp', tests: ['tests/pay.test.ts › declines an expired card'] })
console.log('MCP after 2 calls:', second.text)
// The same with the CLI the manual calls the same.
const cli = (args) => execFileSync(process.execPath, [join(REPO, 'apps/cli/dist/index.js'), 'verify', ...args, '--folder', folder], { cwd: dir, encoding: 'utf8' })
cli(['Refunds', '--test', 'tests/refund.test.ts › refunds'])
console.log('CLI after 2 calls:', cli(['Refunds', '--test', 'tests/refund.test.ts › refunds twice']).split('\n')[0])
await m.close()
const file = JSON.parse(readFileSync(join(dir, '.radical/radical.json'), 'utf8'))
const tests = (label) => file.verifies.find((v) => v.name === label)?.tests ?? []
console.log('Pays (MCP):', JSON.stringify(tests('Pays')))
console.log('Refunds (CLI):', JSON.stringify(tests('Refunds')))
const bug = tests('Pays').length === 1 && tests('Refunds').length === 2
console.log(bug ? 'BUG REPRODUCED: MCP kept 1 of 2 tests, the CLI 2 of 2' : 'not reproduced')
process.exitCode = bug ? 1 : 0
