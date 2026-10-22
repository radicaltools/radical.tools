// F3: An exploration in the window's history: History and the ‹ tooltip name it by a raw id
// ("explore:<uuid>") instead of "Explore: API"; once it is closed, ‹ Back from the view it
// was opened from goes to All elements (route.ts: "one closed since is gone"), a place never visited.
// Bookstore; Containers (Designer); select API; Explore; Esc; ×; read History; ‹ Back.
import { launch, seed, fixture, open, card, settle, shot, clickNode } from './lib.mjs'
const { browser, page, problems } = await launch()
const where = () => decodeURIComponent(page.url().replace(/.*\/m\/designer\/v\//, ''))
let ok = false
try {
  await seed(page, fixture('bookstore'))
  await open(page, 'v-containers')
  await clickNode(page, 'api')
  await page.waitForTimeout(400)
  console.log('1 at', where())
  await card(page).getByRole('button', { name: 'Explore', exact: true }).click()
  await page.getByRole('menu', { name: 'Add to API' }).waitFor()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  console.log('2 at', where())
  const history = page.getByRole('button', { name: /History/ }).first()
  await history.click(); await page.waitForTimeout(300)
  const whileOpen = (await page.locator('.nav-history, [role="menu"], [role="listbox"]').filter({ hasText: 'HISTORY' }).first().textContent().catch(() => null)) ?? (await page.getByText('History', { exact: true }).locator('..').locator('..').textContent())
  console.log('History while the exploration is open:', JSON.stringify(whileOpen))
  await page.keyboard.press('Escape')
  await page.locator('.explore-bar').getByRole('button', { name: 'Close the exploration' }).click()
  await page.waitForTimeout(600)
  console.log('3 at', where())
  await history.click(); await page.waitForTimeout(300)
  const afterClose = await page.getByText('this window').locator('..').locator('..').textContent()
  console.log('History after ×:', JSON.stringify(afterClose))
  await shot(page, 'f3-history.png')
  await page.keyboard.press('Escape')
  const tip = await page.locator('#nav-tip-back').textContent().catch(() => null)
  console.log('‹ names:', JSON.stringify(tip))
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.waitForTimeout(800)
  const landed = where()
  console.log('4 after ‹ Back:', landed, '| drawn', await page.locator('.react-flow__node').count(), '| table rows', await page.locator('tr[data-node-id]').count())
  await shot(page, 'f3-back.png')
  const rawId = /explore:[0-9a-f-]{8,}/.test(afterClose ?? '') || /explore:[0-9a-f-]{8,}/.test(whileOpen ?? '')
  ok = !rawId
  console.log('raw id in History:', rawId, '| Back landed on All elements:', /^all/.test(landed))
} finally { console.log('problems', problems); await browser.close() }
console.log(ok ? 'PASS' : 'FAIL: History and the ‹ tooltip name the exploration by its raw id')
process.exitCode = ok ? 0 : 1
