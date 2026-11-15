// F3 (question): the Hub's Open in Studio link (/?hub=<pack>) with no model open: the Welcome screen says the pack
// waits, but the address has lost ?hub= at once, so a reload of the Welcome screen forgets it and opening a model
// then imports nothing. Bookstore in this browser, Studio set up. Usage: node f3-hub-link-lost-on-reload.mjs [studioPort=4516] [hubPort=4616]
import { launch, wait, seed, bookstoreRadical, markSetUp, dialogs, shot } from './lib.mjs'
const port = +(process.argv[2] ?? 4516), hubPort = +(process.argv[3] ?? 4616)
const { browser, context, page } = await launch({ port, hubPort })
await seed(context, bookstoreRadical()); await markSetUp(context)
let lost = false
try {
  await page.goto('/?hub=concern-authentication')
  const status = page.locator('.welcome-overlay [role=status]')
  await status.waitFor()
  console.log(`Welcome screen: "${await status.innerText()}" — address ${page.url()}`)
  await page.reload(); await page.locator('.welcome-overlay').waitFor(); await wait(page, 1500)
  const after = await status.count() ? await status.innerText() : null
  console.log(`after a reload: ${after ? `"${after}"` : 'no pack waits'}`)
  await shot(page, 'f3-welcome-after-reload')
  await page.locator('.welcome-start-recent .msteps-row').first().click(); await wait(page, 2500)
  const open = await dialogs(page)
  console.log(`after opening the model from Recent: dialogs ${JSON.stringify(open)}`)
  lost = !after && !open.includes('Import from Hub')
} finally { await browser.close() }
console.log(lost ? 'The waiting pack is forgotten by a reload' : 'The pack still waits after a reload')
console.log(`REPRODUCED: ${lost ? 'yes' : 'no'}`)
process.exitCode = lost ? 1 : 0
