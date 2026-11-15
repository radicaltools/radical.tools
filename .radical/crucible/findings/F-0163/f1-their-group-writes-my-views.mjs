// F1: another model's group of views per element ("Containers of a system",
// orders' views fetched into payments) makes views of MY model: the first
// edit in Studio (or any MCP write) writes into payments' views.json a view
// per system — mine, theirs and the one just added — as members of orders'
// group, in orders' read-only view folder. The list shows Bookstore and
// Payments twice.
//   node f1-their-group-writes-my-views.mjs [--port 4520]
import * as L from './lib.mjs'
import { mcp } from './mcp.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const model = L.genFederation('f1', '--group')   // payments + orders (bookstore fixture + a group of views per system), fetched
const b = await L.startBrowser()
const { page } = b
const theirs = (views) => views.filter((v) => v.partOf === 'v-sysgroup' || v.folder === 'orders' || String(v.folder ?? '').startsWith('orders/'))
let studioBug = false
try {
  await L.openDiskFolder(page, model)
  await L.openViewCard(page, 'Landscape')
  const savedBefore = L.viewsOf(await L.opfsFiles(page)).map((v) => v.name)
  // add a Software System from the palette
  const item = page.locator('text=Software System').first()
  const box = await item.boundingBox()
  await page.mouse.move(box.x + 20, box.y + 8); await page.mouse.down()
  await page.mouse.move(600, 150, { steps: 10 }); await page.mouse.move(610, 160, { steps: 3 }); await page.mouse.up()
  await L.sleep(800); await page.keyboard.press('Escape')
  await L.waitFor(async () => !!(await L.opfsFiles(page))['metamodel.json'], 15000)
  await L.sleep(2000)
  const saved = L.viewsOf(await L.opfsFiles(page))
  await L.railTab(page, 'Views')
  const cards = await page.locator('.lp-view-card .lp-card-title').allInnerTexts()
  console.log('views.json before the edit:', savedBefore)
  console.log('views.json after adding one system:', saved.map((v) => `${v.name} (partOf ${v.partOf ?? '-'}, folder ${v.folder ?? '-'})`))
  console.log('view list:', cards)
  await L.shot(page, 'f1.png')
  studioBug = theirs(saved).length > 0
  if (b.errors.length) console.log('errors', b.errors)
} finally { await b.close() }
// the MCP server on the same kind of folder
const folder = L.genFederation('f1-mcp', '--group')
const c = await mcp(folder)
const r = await c.call('add_node', { tempId: 'l1', type: 'system', label: 'Ledger' })
await c.close()
const mcpViews = JSON.parse(readFileSync(join(folder, 'views.json'), 'utf8'))
console.log('MCP add_node answered:', r.text.split('\n')[0])
console.log('MCP views.json:', mcpViews.map((v) => `${v.name} (partOf ${v.partOf ?? '-'}, folder ${v.folder ?? '-'})`))
const mcpBug = theirs(mcpViews).length > 0
console.log(`Studio wrote ${studioBug ? 'views' : 'nothing'} of orders' group; MCP wrote ${mcpBug ? 'views' : 'nothing'} of it`)
console.log(studioBug || mcpBug ? 'REPRODUCED: yes' : 'REPRODUCED: no')
process.exitCode = studioBug || mcpBug ? 1 : 0
