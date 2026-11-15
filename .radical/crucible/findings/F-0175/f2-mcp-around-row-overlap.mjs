// F2: an agent keeps FX Engine and Payment Validator in a row (align_nodes), then
// tidies round Fraud Detection (smart_layout with around): the two components end
// on top of each other in Payments Service. Sample model, Core Banking, through the MCP server.
//   node f2-mcp-around-row-overlap.mjs [port] [around] [pin]
// Needs: sample.json, folder.mts, mcp.mjs, lib.mjs beside this script; the built MCP server.
// With a port, also opens the result in Studio (Designer) and reads the canvas.
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mcp } from './mcp.mjs'
import { here, repoRoot, launch, seed, open, canvas, shot } from './lib.mjs'
const port = process.argv[2]
const around = (process.argv[3] ?? 'ctn-fraud').split(',')
const pin = process.argv[4]
const viewId = 'view-core'
const work = join(here, 'work', 'f2'); rmSync(work, { recursive: true, force: true }); mkdirSync(join(work, 'model'), { recursive: true })
const conv = (...a) => execFileSync(process.execPath, ['--import', 'tsx', join(here, 'folder.mts'), ...a], { cwd: repoRoot() })
const doc = JSON.parse(readFileSync(join(here, 'sample.json'), 'utf8'))
if (pin) doc.views.find((v) => v.id === viewId).layoutConstraints = [{ id: 'pin1', type: 'pin', nodeIds: [pin] }]
writeFileSync(join(work, 'start.json'), JSON.stringify(doc))
conv('to', join(work, 'start.json'), join(work, 'model'))
const m = await mcp(join(work, 'model'))
console.log('align_nodes:', (await m.call('align_nodes', { viewId, axis: 'horizontal', nodeIds: ['comp-fx', 'comp-validator'] })).split(' Changed:')[0])
console.log('smart_layout:', (await m.call('smart_layout', { viewId, around })).split(' Changed:')[0])
await m.close()
conv('from', join(work, 'model'), join(work, 'after.json'))
const after = JSON.parse(readFileSync(join(work, 'after.json'), 'utf8'))
const pos = after.views.find((v) => v.id === viewId).positions
const r = (p) => `(${Math.round(p.x)}, ${Math.round(p.y)}) ${Math.round(p.width)}x${Math.round(p.height)}`
for (const id of ['ctn-payments', 'comp-fx', 'comp-validator']) console.log(`${id}: ${r(pos[id])}`)
const a = pos['comp-fx'], b = pos['comp-validator']
const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
console.log(overlap ? 'FINDING: FX Engine and Payment Validator overlap in the saved view' : 'ok: no overlap')
if (port) {
  const s = await launch(port)
  try {
    await seed(s.page, 'f2', after)
    await open(s.page, 'f2', viewId)
    await s.page.waitForTimeout(2000)
    const c = await canvas(s.page)
    console.log('Studio canvas:', ['comp-fx', 'comp-validator'].map((id) => `${id} (${Math.round(c[id].x)}, ${Math.round(c[id].y)})`).join(', '))
    await s.page.locator('.react-flow__node[data-id="ctn-payments"]').scrollIntoViewIfNeeded().catch(() => {})
    await s.page.screenshot({ path: shot('f2.png') })
  } finally { await s.close() }
}
console.log(overlap ? 'REPRODUCED: yes' : 'REPRODUCED: no')
process.exit(overlap ? 1 : 0)
