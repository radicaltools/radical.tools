// A concern pack imported unbound over MCP (as forge_import_hub_concept allows
// "before the elements exist"): radical check (and the Inspector, which runs
// the same check) reports its ADR as concern-unbound and says where to bind
// it; get_issues says nothing of it and tells the agent to import the pack
// again, which brings a second ADR, need, requirements and view.
// Usage: node f2-unbound-get-issues.mjs
import { connect, CLI } from './mcp.mjs'
import { rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
const folder = join(process.cwd(), 'tmp-f2-model')
rmSync(folder, { recursive: true, force: true }); mkdirSync(folder, { recursive: true })
const c = await connect(folder)
const check = () => { let o; try { o = execFileSync('node', [CLI, 'check', folder, '--format', 'json'], { encoding: 'utf8' }) } catch (e) { o = e.stdout } return JSON.parse(o).findings.filter((f) => f.rule.startsWith('concern') && /authenticat/i.test(f.code + f.message)) }
const id = (t) => /Created node (\S+)\./.exec(t)[1]
const cu = id(await c.call('add_node', { tempId: 'a', type: 'person', label: 'Customer' }))
const sh = id(await c.call('add_node', { tempId: 'b', type: 'system', label: 'Shop' }))
const web = id(await c.call('add_node', { tempId: 'c', type: 'webapp', label: 'Web', parentId: sh }))
await c.call('add_relation', { sourceId: cu, targetId: web, relationType: 'interacts', label: 'uses' })
console.log('1. forge_import_hub_concept concern-authentication, no bindTo:')
console.log('   ' + (await c.call('forge_import_hub_concept', { conceptId: 'concern-authentication', answers: {} })).split('\n').slice(0, 2).join('\n   '))
const fromCheck = check()
console.log('2. radical check:'); for (const f of fromCheck) console.log(`   ${f.rule}: ${f.message}`)
const issues = await c.call('get_issues')
const block = issues.split('\n- ').find((b) => b.startsWith('Authentication')) ?? ''
console.log('3. get_issues on Authentication:\n   - ' + block.split('\n').slice(0, 3).join('\n   '))
const mentionsAdr = /Users sign in through an identity provider|unbound|constrains no element/i.test(issues)
console.log(`   names the imported ADR or concern-unbound: ${mentionsAdr}`)
const adrs = JSON.parse(await c.call('search_model', { query: 'LIST NODES WHERE type = "adr"' })).rows
console.log(`4. ADRs marked authentication in the model: ${adrs.length} (${adrs.map((a) => a.label).join(', ')})`)
await c.close()
rmSync(folder, { recursive: true, force: true })
const bug = fromCheck.some((f) => f.rule === 'concern-unbound') && !mentionsAdr && /forge_import_hub_concept/.test(issues)
console.log(bug ? 'BUG: get_issues hides the unbound decision radical check reports, and asks for the pack again' : 'OK')
process.exit(bug ? 1 : 0)
