// F2: following an agent's Assay run, the agent's write opens another view while the user types an element's name in its
// card: the card closes, the focus goes to the page and the next keys are lost (item 189 fixed this for a plain agent write).
// Bookstore fixture moved to a folder; a real MCP server (apps/mcp/dist) on a disk copy runs Assay on two small code
// repositories; its changed files are copied into Studio's folder after each call. Usage: node f2-…mjs [--port 4506]
import { startBrowser, seed, open, saveAsFolder, fixture, sleep, shot, waitFor, opfsFiles } from './flib.mjs'
import { assayAgent, C4 } from './alib.mjs'

const b = await startBrowser()
const { page, errors } = b
let agent
let reproduced = false
try {
  await seed(page, fixture('bookstore'))
  await open(page, 'v-context')
  await saveAsFolder(page)
  await sleep(1500)
  agent = await assayAgent(page)
  await agent.call('assay_start', { directories: ['../code'] })
  await waitFor(async () => (await page.locator('.qs-assay-toggle').count()) > 0, 10000)
  await page.locator('.qs-assay-toggle').click()
  await page.getByRole('dialog', { name: 'Radical Assay — agent run' }).getByRole('button', { name: 'Follow on the canvas' }).click()
  await sleep(500)

  // The user renames Customer in its card.
  await page.locator('.react-flow__node[data-id="customer"]').dblclick()
  const name = page.locator('.right-panel.open').getByLabel('Name', { exact: true })
  await name.waitFor({ timeout: 5000 })
  await name.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' (online)')

  // Meanwhile the agent writes its C4 plan and a view of it.
  await agent.call('assay_apply', { plan: C4 })
  const rows = JSON.parse((await agent.call('search_model', { query: 'LIST NODES' })).text).rows
  const id = (label) => rows.find((n) => n.label === label).id
  await agent.call('create_view', { tempId: 'v2', name: 'Shop', nodeIds: [id('Shop'), id('Orders service'), id('Point of sale')] })
  const openView = () => page.evaluate(() => /Structure: (.+)/.exec(document.body.innerText)?.[1] ?? '?')
  await waitFor(async () => (await openView()) !== 'System Context', 8000)
  await sleep(800)
  const view = await openView()
  const cardOpen = await page.locator('.right-panel.open').count()
  const focus = await page.evaluate(() => `${document.activeElement?.tagName} ${document.activeElement?.getAttribute('aria-label') ?? ''}`.trim())
  await page.keyboard.type(' shopper')
  await sleep(600)
  await shot(page, 'f2-card-gone.png')
  console.log(`after the agent's write: ${view} open, card open: ${cardOpen}, focus on: ${focus}`)
  // Studio holds its saves for 15 s after an agent's write.
  await sleep(17000)
  const files = await opfsFiles(page)
  const custFile = Object.entries(files).find(([p, c]) => p.startsWith('nodes/') && /^id:\s*"?customer"?/m.test(c))
  const label = /label:\s*"?([^"\n]*)"?/.exec(custFile?.[1] ?? '')?.[1]
  console.log(`Customer's name saved: "${label}" (typed: "Customer (online) shopper")`)
  reproduced = cardOpen === 0 || label !== 'Customer (online) shopper'
  if (errors.length) console.log('errors', errors)
  console.log(reproduced ? 'REPRODUCED' : 'not reproduced')
} finally {
  await agent?.close()
  await b.close()
}
process.exitCode = reproduced ? 1 : 0
