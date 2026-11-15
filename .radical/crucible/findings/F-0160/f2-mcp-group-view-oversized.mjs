import { rmSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { DIR } from './lib.mjs'
import { mcp, writeFolder } from './mcp.mjs'
const n = Number(process.argv[2] ?? 1100)
const out = join(DIR, `g${n}.json`)
if (!existsSync(out)) { const r = spawnSync(process.execPath, ['--import', 'tsx', join(DIR, 'gen3.mts'), String(n), out], { cwd: DIR, encoding: 'utf8' }); if (r.status) throw new Error(r.stderr) }
const folder = join(DIR, 'work/f2'); rmSync(folder, { recursive: true, force: true })
writeFolder(folder, JSON.parse(readFileSync(out, 'utf8')))
const m = await mcp(folder)
const made = await m.call('create_view', { tempId: 'g', name: 'Components', viewpoint: 'Components of a container' })
console.log('create_view:', made.text)
const views = () => JSON.parse(readFileSync(join(folder, 'views.json'), 'utf8'))
for (const v of views()) console.log(' ', v.name, 'places kept:', Object.keys(v.positions ?? {}).length)
const api = views().find((v) => v.name === 'API')
const sl = await m.call('smart_layout', { viewId: api.id })
console.log('smart_layout API:', sl.ok ? 'done' : 'refused', sl.text)
const uv = await m.call('update_view', { id: api.id, kind: 'table' })
console.log('update_view API kind table (what the refusal advises):', uv.ok ? 'done' : 'refused', uv.text)
await m.close()
const claimed = /arranged the 2 new views/.test(made.text)
const laid = views().filter((v) => v.partOf && Object.keys(v.positions ?? {}).length).length
const bug = (claimed && laid < 2) || !uv.ok
console.log(`claimed 2 arranged: ${claimed}; laid out: ${laid}; advised update_view accepted: ${uv.ok}`)
console.log(bug ? 'REPRODUCED: yes' : 'REPRODUCED: no')
process.exit(bug ? 1 : 0)
