// F3: the view per element "Modelling" (Entities of a domain), never laid out, cut from
// radical.tools' own model: the MCP server's smart_layout and Studio's first Smart Layout of
// the same view, from the same Markdown folder, start from different canvases and give
// different layouts.
//   node f3-mcp-first-layout-differs.mjs <port>
// Needs: modelling-cut.json, folder.mts, mcp.mjs, lib.mjs beside this script; the built MCP server.
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mcp } from './mcp.mjs'
import { here, repoRoot, launch, seed, open, stored, shot } from './lib.mjs'
const port = process.argv[2] ?? 4502
const viewId = '08f7bfe4-7fa8-4adc-94ef-8331230b6dcd', domain = '4dd09e43-c313-4300-b9f2-d9f937b789bf'
const work = join(here, 'work', 'f3'); rmSync(work, { recursive: true, force: true }); mkdirSync(join(work, 'model'), { recursive: true })
const conv = (...a) => execFileSync(process.execPath, ['--import', 'tsx', join(here, 'folder.mts'), ...a], { cwd: repoRoot() })
conv('to', join(here, 'modelling-cut.json'), join(work, 'model'))
conv('from', join(work, 'model'), join(work, 'start.json')) // the document both start from
const start = JSON.parse(readFileSync(join(work, 'start.json'), 'utf8'))
console.log('view has positions of its own:', Object.keys(start.views.find((v) => v.id === viewId).positions ?? {}).length)
// 1. The agent: smart_layout on the view.
const m = await mcp(join(work, 'model'))
console.log('MCP smart_layout:', (await m.call('smart_layout', { viewId })).split(' Changed:')[0])
await m.close()
conv('from', join(work, 'model'), join(work, 'mcp.json'))
const mp = JSON.parse(readFileSync(join(work, 'mcp.json'), 'utf8')).views.find((v) => v.id === viewId).positions
// 2. A person: the same document opened in Studio's Designer on that view (its first Smart Layout runs by itself).
const s = await launch(port, { width: 1600, height: 1000 })
let sp
try {
  await seed(s.page, 'f3', start)
  await open(s.page, 'f3', viewId)
  await s.page.waitForTimeout(4000)
  console.log('Studio first layout:', (await s.page.evaluate(() => window.__toasts)).slice(-1)[0]?.replace(/^Notice/, ''))
  await s.page.screenshot({ path: shot('f3-studio.png') })
  sp = (await stored(s.page, 'f3')).views.find((v) => v.id === viewId).positions
  if (s.problems.length) console.log('problems', s.problems.slice(0, 5))
} finally { await s.close() }
let diff = 0
for (const id of Object.keys(sp)) {
  const a = mp[id], b = sp[id]
  if (!a || Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1 || Math.abs((a.width ?? 0) - (b.width ?? 0)) > 1 || Math.abs((a.height ?? 0) - (b.height ?? 0)) > 1) diff++
}
console.log(`domain Modelling: MCP ${Math.round(mp[domain].width)}x${Math.round(mp[domain].height)}, Studio ${Math.round(sp[domain].width)}x${Math.round(sp[domain].height)}`)
console.log(`positions differing: ${diff} of ${Object.keys(sp).length}`)
console.log(diff ? 'FINDING: smart_layout and Studio lay the same view out differently' : 'ok: the same layout')
