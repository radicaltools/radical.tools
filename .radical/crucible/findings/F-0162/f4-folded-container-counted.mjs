// A view listing a container folded with 1,100 components inside: counted, drawn?
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { DIR, launch, seed, openFolder, shot, wait, settle } from './lib.mjs'
const port = Number(process.argv[2] ?? 4514)
const n = Number(process.argv[3] ?? 1100)
const out = join(DIR, `g${n}.json`)
if (!existsSync(out)) { const r = spawnSync(process.execPath, ['--import', 'tsx', join(DIR, 'gen3.mts'), String(n), out], { cwd: DIR, encoding: 'utf8' }); if (r.status) throw new Error(r.stderr) }
const files = JSON.parse(readFileSync(out, 'utf8'))
const views = JSON.parse(files['views.json'])
views.push({ id: 'v-fold', name: 'API folded', nodeIds: ['shop', 'api', ...Array.from({ length: n }, (_, i) => `c${i}`)], collapsedNodeIds: ['api'], positions: {} })
files['views.json'] = JSON.stringify(views, null, 2)
const { page, problems, close } = await launch({ port })
await page.goto('/')
await seed(page, files)
await openFolder(page, { least: 2 })
await page.goto(page.url().replace(/\/m\/viewer\/v\/.*/, '/m/designer/v/v-fold'))
await page.locator('.app-layout').waitFor()
await wait(page, 3000)
await settle(page)
const notice = page.getByRole('main', { name: 'View too large for a canvas' })
console.log('notice', await notice.count(), (await notice.innerText().catch(() => '')).replace(/\s+/g, ' '))
console.log('rf nodes', await page.locator('.react-flow__node').count())
await shot(page, `f4-folded-${n}.png`)
console.log('problems', problems.slice(0, 5))
const bug = (await notice.count()) > 0
console.log(bug ? `the view draws 2 elements (Shop, API folded) but shows the notice for ${n + 2}` : 'drawn on the canvas')
console.log(bug ? 'REPRODUCED: yes' : 'REPRODUCED: no')
await close()
process.exit(bug ? 1 : 0)
