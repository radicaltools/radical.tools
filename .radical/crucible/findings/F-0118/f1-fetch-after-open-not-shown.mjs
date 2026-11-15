// F1: a model opened without deps.json never shows the other models a later
// `radical setup --depends-on` + fetch brings (deps.json and .state/federation.json
// written while Studio is open), until a reload.
//   node f1-fetch-after-open-not-shown.mjs [--port 4504]
import * as L from './lib.mjs'
const model = L.genFederation('f1')           // payments + orders, fetched with the CLI
const disk = await L.diskFiles(model)
const b = await L.startBrowser()
const { page } = b
const shown = async () => ({ button: (await L.otherModelsButton(page).allInnerTexts()).map((t) => t.replace(/\n/g, ' ')), nodes: (await L.nodeIds(page)).sort(), count: await L.counts(page) })
try {
  // 1. payments alone: its files without deps.json and .state/
  await page.goto(L.BASE + '/')
  for (const [p, c] of Object.entries(disk)) if (p !== 'deps.json' && !p.startsWith('.state/')) await L.opfsWrite(page, p, c)
  await page.goto(L.BASE + '/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await page.locator('.welcome-overlay').waitFor({ state: 'hidden' })
  await L.ready(page); await L.designer(page)
  await L.openViewCard(page, 'Landscape')
  console.log('opened alone:', JSON.stringify(await shown()))
  // 2. radical setup --depends-on orders=… writes deps.json, and fetches
  await L.opfsWrite(page, 'deps.json', disk['deps.json'])
  await L.opfsWrite(page, '.state/federation.json', disk['.state/federation.json'])
  const seen = await L.waitFor(async () => (await L.nodeIds(page)).includes('bookstore'), 20000)
  const after = await shown()
  console.log(`20 s after deps.json + federation.json written: orders shown=${seen}`, JSON.stringify(after))
  await L.shot(page, 'f1.png')
  // 3. a reload shows them
  await page.reload(); await L.ready(page); await L.sleep(1500)
  const reloaded = await shown()
  console.log('after reload:', JSON.stringify(reloaded))
  const bug = !seen && reloaded.nodes.includes('bookstore')
  console.log(bug ? 'REPRODUCED: the fetch reached the open model only after a reload' : 'not reproduced')
  if (b.errors.length) console.log('errors', b.errors)
  process.exitCode = bug ? 1 : 0
} finally { await b.close() }
