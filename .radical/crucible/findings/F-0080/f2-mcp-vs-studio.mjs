// F2: on the sample's whole model (283 elements), the MCP server's
// smart_layout and Studio's Smart Layout give different layouts of the same
// view from the same start; the MCP call takes minutes.
//   node f2-mcp-vs-studio.mjs <studio port> [work dir]
// Needs the built MCP server (apps/mcp/dist) and tsx (repo devDependency).
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, openSample, stored, seed, open, smartLayout, here, shot } from './lib.mjs'
import { mcp } from './mcp.mjs'

const [port = '4586', work = join(here, 'work', 'f2')] = process.argv.slice(2)
rmSync(work, { recursive: true, force: true })
mkdirSync(work, { recursive: true })
const docFile = join(work, 'sample-whole.json')
const folder = join(work, 'folder')

// 1. The sample as Studio saves it, with a canvas of the whole model placed as All elements places it.
{
  const s = await launch(port)
  try {
    const id = await openSample(s.page)
    await s.page.waitForTimeout(3000)
    const d = await stored(s.page, id)
    d.views.push({ id: 'v-whole', name: 'Whole model', kind: 'static', nodeIds: [], positions: structuredClone(d.defaultPositions), hiddenRelationIds: [] })
    writeFileSync(docFile, JSON.stringify(d))
  } finally { await s.close() }
}
const start = JSON.parse(readFileSync(docFile, 'utf8')).views.find((v) => v.id === 'v-whole').positions

// 2. The same document as a model folder; smart_layout on the view through the MCP server.
execFileSync(process.execPath, ['--import', 'tsx', join(here, 'folder.mts'), 'to', docFile, folder], { cwd: here, stdio: 'inherit' })
let mcpText, mcpMs
{
  const m = await mcp(folder)
  try {
    const t = Date.now()
    mcpText = await m.call('smart_layout', { viewId: 'v-whole' })
    mcpMs = Date.now() - t
  } finally { await m.close() }
}
execFileSync(process.execPath, ['--import', 'tsx', join(here, 'folder.mts'), 'from', folder, join(work, 'after-mcp.json')], { cwd: here, stdio: 'inherit' })
const byMcp = JSON.parse(readFileSync(join(work, 'after-mcp.json'), 'utf8')).views.find((v) => v.id === 'v-whole').positions

// 3. Studio's Smart Layout on the same view from the same document.
let studioMsg, studioMs, byStudio
{
  const s = await launch(port)
  try {
    await seed(s.page, 'run186-f2', readFileSync(docFile, 'utf8'))
    await open(s.page, 'run186-f2', 'v-whole')
    await s.page.waitForTimeout(2000)
    const r = await smartLayout(s.page, 180000)
    studioMsg = r.msg?.replace(/^Notice/, ''); studioMs = r.ms
    await s.page.waitForTimeout(1500)
    await s.page.screenshot({ path: shot('f2-studio.png') })
    byStudio = (await stored(s.page, 'run186-f2')).views.find((v) => v.id === 'v-whole').positions
    if (s.problems.length) console.log('problems', s.problems)
  } finally { await s.close() }
}

const ids = Object.keys(start)
const moved = (a) => ids.filter((id) => a[id] && (Math.abs(a[id].x - start[id].x) > 1 || Math.abs(a[id].y - start[id].y) > 1)).length
const differ = ids.filter((id) => byMcp[id] && byStudio[id] && Math.hypot(byMcp[id].x - byStudio[id].x, byMcp[id].y - byStudio[id].y) > 1)
const far = differ.map((id) => Math.round(Math.hypot(byMcp[id].x - byStudio[id].x, byMcp[id].y - byStudio[id].y))).sort((a, b) => b - a)
console.log(`MCP smart_layout: ${Math.round(mcpMs / 1000)} s — ${mcpText.split('\n')[0]} (moved ${moved(byMcp)} of ${ids.length})`)
console.log(`Studio Smart Layout: ${Math.round(studioMs / 1000)} s — ${studioMsg} (moved ${moved(byStudio)} of ${ids.length})`)
console.log(`elements placed differently: ${differ.length} of ${ids.length}; farthest apart ${far[0]} px, median ${far[Math.floor(far.length / 2)] ?? 0} px`)
console.log(differ.length ? 'BROKEN: the two layouts differ' : 'same layout')
