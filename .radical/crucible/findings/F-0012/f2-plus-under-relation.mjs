// F2: In an exploration, the + of an element lies under the line of its relation:
// a click on it selects the relation and the + menu does not open.
// Bookstore fixture, Containers, API selected, Explore, Show all; select Web App, click its + with the mouse.
import { launch, seed, fixture, open, card, settle, shot, clickNode } from './lib.mjs'
const { browser, page, problems } = await launch()
let ok = false
try {
  await seed(page, fixture('bookstore'))
  await open(page, 'v-containers')
  await clickNode(page, 'api')
  await card(page).getByRole('button', { name: 'Explore', exact: true }).click()
  const first = page.getByRole('menu', { name: 'Add to API' })
  await first.waitFor()
  await first.getByRole('menuitem', { name: /^Show all/ }).click()
  await settle(page); await page.waitForTimeout(1000)
  // Web App selected (its card opens), then its + clicked.
  await clickNode(page, 'web')
  await settle(page); await page.waitForTimeout(600)
  const pill = page.getByRole('button', { name: /^Show \d+ more related to Web App$/ })
  const pb = await pill.boundingBox()
  const top = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return (e.closest('[data-testid]')?.getAttribute('data-testid') ?? e.tagName) + ' ' + (e.getAttribute('class') ?? '') }, [pb.x + pb.width / 2, pb.y + pb.height / 2])
  console.log('Web App +', JSON.stringify(pb), 'what is on top at its centre:', top)
  await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2)
  await page.waitForTimeout(800)
  const menuOpen = await page.getByRole('menu', { name: 'Add to Web App' }).count()
  const cardType = await card(page).count() ? (await card(page).locator('.pp-type').first().textContent().catch(() => '?')) : 'no card'
  const cardName = await card(page).count() ? await card(page).getByLabel('Name', { exact: true }).inputValue().catch(() => '?') : ''
  console.log('menu "Add to Web App" open:', menuOpen, '| card:', cardType, cardName)
  await shot(page, 'f2.png')
  ok = menuOpen === 1
} finally { console.log('problems', problems); await browser.close() }
console.log(ok ? 'PASS (the + opened its menu)' : 'FAIL: the + did not open its menu; the click went to the relation under it')
process.exitCode = ok ? 0 : 1
