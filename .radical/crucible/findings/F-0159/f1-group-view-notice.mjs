// Studio: the notice of a view per element (a group's view) larger than a canvas:
// Show as a table does nothing, Edit the filter opens a filter that cannot be edited.
// The view per element of a container with more components than a canvas draws: its notice's buttons.
//   node e7-group-notice.mjs <app port> [components=1100]
import { readFileSync, readdirSync, statSync, rmSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'
import { DIR, launch, seed, openFolder, shot, wait } from './lib.mjs'
import { mcp, writeFolder } from './mcp.mjs'
const port = Number(process.argv[2] ?? 4514)
const n = Number(process.argv[3] ?? 1100)
const out = join(DIR, `g${n}.json`)
if (!existsSync(out)) { const r = spawnSync(process.execPath, ['--import', 'tsx', join(DIR, 'gen3.mts'), String(n), out], { cwd: DIR, encoding: 'utf8' }); if (r.status) throw new Error(r.stderr) }
const folder = join(DIR, 'work/f1'); rmSync(folder, { recursive: true, force: true })
writeFolder(folder, JSON.parse(readFileSync(out, 'utf8')))
const m = await mcp(folder)
const made = await m.call('create_view', { tempId: 'g', name: 'Components', viewpoint: 'Components of a container' })
await m.close()
console.log('create_view:', made.text.slice(0, 160))
rmSync(join(folder, '.state'), { recursive: true, force: true })
const files = {}
const walk = (d) => { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else files[relative(folder, p)] = readFileSync(p, 'utf8') } }
walk(folder)
const views = JSON.parse(files['views.json'])
const api = views.find((v) => v.name === 'API')
const { page, problems, close } = await launch({ port })
await page.goto('/')
await seed(page, files)
await openFolder(page, { least: 2 })
await page.goto(page.url().replace(/\/m\/viewer\/v\/.*/, `/m/designer/v/${api.id}`))
await page.locator('.app-layout').waitFor()
const notice = page.getByRole('main', { name: 'View too large for a canvas' })
await notice.waitFor()
console.log('notice:', (await notice.innerText()).replace(/\s+/g, ' '))
await notice.getByRole('button', { name: 'Show as a table' }).click()
await wait(page, 1500)
const table = await page.locator('.table-view, [aria-label*="table" i]').count()
const after = await notice.count()
console.log(`after Show as a table: notice still shown ${after}, undo enabled ${await page.getByRole('button', { name: /^Undo/ }).isEnabled().catch(() => '?')}`)
await shot(page, 'f1-after-table.png')
if (after) {
  await notice.getByRole('button', { name: 'Edit the filter' }).click()
  await wait(page, 1000)
  await shot(page, 'f1-after-filter.png')
  const right = await page.locator('.right-panel, aside').last().innerText().catch(() => '')
  console.log('panel:', right.replace(/\s+/g, ' ').slice(0, 600))
}
console.log('problems', problems.slice(0, 5))
console.log(after ? 'REPRODUCED: yes' : 'REPRODUCED: no')
await close()
process.exit(after ? 1 : 0)
