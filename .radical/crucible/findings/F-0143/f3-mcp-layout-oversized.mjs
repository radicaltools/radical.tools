// A view of more elements than a canvas draws: Studio neither draws nor lays it
// out (the notice "A canvas draws up to 1,000"; no Smart Layout button or command).
// The MCP server's smart_layout lays it out anyway and writes its places.
//   node f3-mcp-layout-oversized.mjs [elements=3000]
import { rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DIR } from './lib.mjs'
import { mcp, writeFolder } from './mcp.mjs'
import { flatModel } from './flat.mjs'
const n = Number(process.argv[2] ?? 3000)
const folder = join(DIR, 'work/f3'); rmSync(folder, { recursive: true, force: true })
writeFolder(folder, flatModel(n))
const m = await mcp(folder)
const placed = () => Object.keys(JSON.parse(readFileSync(join(folder, 'views.json'), 'utf8')).find((v) => v.id === 'v-reqs')?.positions ?? {}).length
console.log('view "Every requirement":', n, 'elements; places kept before:', placed())
for (const [what, args] of [['smart_layout', { viewId: 'v-reqs' }], ['grid_nodes', { viewId: 'v-reqs', nodeIds: ['r0', 'r1', 'r2', 'r3'], columns: 2 }]]) {
  const t = Date.now()
  const r = await m.call(what, args)
  console.log(`${what}: ${r.ok ? 'done' : 'refused'} in ${Math.round((Date.now() - t) / 100) / 10} s: ${r.text.slice(0, 200)}`)
}
console.log('places kept after:', placed())
await m.close()
