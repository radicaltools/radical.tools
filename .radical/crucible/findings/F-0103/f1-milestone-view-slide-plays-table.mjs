// Sample. Milestone M saved; then the Payment lifecycle state machine is deleted from the live model.
// M keeps its view Payment lifecycle (State machines group): Presenter, milestone M, that view, Add slide.
// Played from the live model (F5), the slide shows the All elements table instead of the 9 elements.
// Usage: node f1-milestone-view-slide-plays-table.mjs [port=4594]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4594)
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
const SM = '789719df-db16-4f7d-95cd-c9c244fbd575'
const drawn = () => page.locator('.react-flow__node').count()
const table = () => page.locator('.tv-table, table').count()
async function playLast() {
  await page.keyboard.press('F5'); await L.wait(page, 1000)
  await page.locator('.pres-hud-dots button').last().click(); await L.wait(page, 1500); await L.settle(page)
  const out = { hud: (await page.locator('.pres-hud-label').innerText()).replace(/\n/g, ' '), drawn: await drawn(), table: await table() }
  return out
}
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-payment-lifecycle', 'designer')
  await L.tab(page, 'Milestones')
  await page.getByRole('button', { name: 'New milestone' }).click()
  const nameBox = page.getByPlaceholder('Milestone name…')
  await nameBox.press('ControlOrMeta+a'); await nameBox.press('Backspace'); await nameBox.pressSequentially('M')
  await page.keyboard.press('Enter'); await L.wait(page, 1500)
  await L.node(page, SM).click({ position: { x: 14, y: 8 } })
  await page.keyboard.press('Delete'); await page.locator('.milestone-modal').waitFor()
  await page.getByRole('button', { name: /Remove from model/ }).click(); await L.settle(page); await L.wait(page, 2000)
  // Presenter: milestone M, its view Payment lifecycle, Add slide
  await page.locator('.toolbar-mode-btn', { hasText: 'Presenter' }).click(); await L.wait(page, 1200)
  await L.tab(page, 'Milestones')
  await page.locator('.lp-snap-card').filter({ has: page.getByText('M', { exact: true }) }).click(); await L.settle(page)
  await L.tab(page, 'Views')
  await page.locator('.lp-view-card', { hasText: 'State machines' }).first().click(); await L.wait(page, 500)
  await page.locator('.lp-group-body .lp-view-card', { hasText: 'Payment lifecycle' }).first().click(); await L.settle(page)
  console.log(`Presenter, milestone M, Payment lifecycle: ${await drawn()} elements drawn (${page.url().split('/m/')[1]})`)
  await page.getByRole('button', { name: /Add slide/ }).click(); await L.wait(page, 800)
  const slide = (await L.stored(page, id)).presentations[0].slides.at(-1)
  console.log(`saved slide "${slide.name}": viewId ${slide.viewId}, milestone ${slide.snapshotId ? 'M' : 'none'}`)
  // started while M is still picked
  let r = await playLast(); console.log('F5 with M picked, last slide:', JSON.stringify(r))
  await L.shot(page, 'f1-played-in-M')
  await page.keyboard.press('Escape'); await L.wait(page, 800)
  // back to the live model, then play
  await L.tab(page, 'Milestones'); await page.locator('.lp-snap-current').click(); await L.settle(page)
  r = await playLast(); console.log('F5 from the live model, last slide:', JSON.stringify(r))
  await L.shot(page, 'f1-played-from-live')
  await page.keyboard.press('Escape'); await L.wait(page, 800)
  // after a reload
  await page.reload(); await page.locator('.app-layout').waitFor(); await L.settle(page)
  r = await playLast(); console.log('after a reload, last slide:', JSON.stringify(r))
} finally { console.log('problems', problems); await browser.close() }
