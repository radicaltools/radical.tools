// F1: With a milestone shown, opening a view from the properties card's Views asks
// "Editing milestone" (and the chip says unsaved) when the element sits in a folded container there.
// Sample; Core Banking (Designer): fold Banking Services; Milestones → v3; Payments Domain;
// select Payments Service; card Views → Core Banking.
import { launch, openSample, open, card, node, settle, shot, clickNode, railTab, openView } from './lib.mjs'
const { browser, page, problems } = await launch()
let ok = false
try {
  const id = await openSample(page)
  await open(page, 'view-core', 'designer', id)
  await node(page, 'dom-banking').locator('.c4-node-collapse-btn').first().dispatchEvent('click')
  await settle(page); await page.waitForTimeout(2500)
  await railTab(page, 'Milestones')
  await page.locator('.lp-snap-card', { hasText: 'v3' }).first().click()
  await page.waitForTimeout(1000)
  await openView(page, 'Payments Domain')
  await clickNode(page, 'ctn-payments')
  await page.waitForTimeout(600)
  const chip = page.locator('.canvas-area div.nodrag', { hasText: 'Milestone:' }).first()
  console.log('before: chip', JSON.stringify(await chip.textContent()), '| prompt', await page.locator('.milestone-modal').count())
  await card(page).getByRole('region', { name: 'Views' }).getByRole('button', { name: /^Core Banking/ }).click()
  await page.waitForTimeout(1500)
  const prompt = await page.locator('.milestone-modal').count()
  console.log('after the click on Core Banking in the card: url', page.url().replace(/.*\/m\//, ''))
  console.log('prompt "Editing milestone" open:', prompt, prompt ? JSON.stringify((await page.locator('.milestone-modal').first().textContent()).slice(0, 80)) : '')
  await shot(page, 'f1.png')
  if (prompt) await page.locator('.milestone-modal').getByRole('button', { name: /Continue editing/ }).click()
  await page.waitForTimeout(400)
  console.log('chip after:', JSON.stringify(await chip.textContent().catch(() => '?')))
  ok = prompt === 0
} finally { console.log('problems', problems); await browser.close() }
console.log(ok ? 'PASS (no prompt)' : 'FAIL: opening a view from the card asked how to save a milestone edit nobody made')
process.exitCode = ok ? 0 : 1
