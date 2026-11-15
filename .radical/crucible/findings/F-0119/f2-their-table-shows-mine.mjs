// F2: another model's table view (orders' "Element Table", which lists every
// element in orders) shows this model's own elements too, though its card
// counts orders' only and the manual says it shows what it shows in orders.
//   node f2-their-table-shows-mine.mjs [--port 4504]
import * as L from './lib.mjs'
const model = L.genFederation('f2')           // payments + orders (the bookstore fixture), fetched with the CLI
const b = await L.startBrowser()
const { page } = b
try {
  await L.openDiskFolder(page, model)
  await L.railTab(page, 'Views')
  const card = page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: /^Element Table$/ }) })
  const cardCount = await card.locator('text=/\\d+ nodes?/').first().innerText()
  await L.openViewCard(page, 'Element Table')
  await L.sleep(800)
  const rows = await page.locator('tr.tv-row').evaluateAll((els) => els.map((e) => ({ id: e.getAttribute('data-node-id'), origin: e.querySelector('.tv-origin')?.textContent ?? null, text: e.innerText.split('\n')[0] })))
  const mine = rows.filter((r) => !r.origin)
  console.log('bar:', (await page.locator('.other-model-bar').innerText()).split('\n')[0])
  console.log('card:', cardCount, '| rows:', rows.length, '| rows of no other model:', JSON.stringify(mine))
  await L.shot(page, 'f2.png')
  const bug = mine.length > 0
  console.log(bug ? `REPRODUCED: orders' table lists ${mine.length} of payments' own elements (${mine.map((r) => r.id).join(', ')})` : 'not reproduced')
  if (b.errors.length) console.log('errors', b.errors)
  process.exitCode = bug ? 1 : 0
} finally { await b.close() }
