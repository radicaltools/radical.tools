// Sample. Slide 2 (Core Banking) is linked to milestone v3 in Presenter and played (F5): v3 draws
// Payments Service with its two components. Then Payments Service is deleted from the live model in
// Designer (Delete key, Remove from model). Played again, the slide of v3 has lost them, and so has
// v3 opened in Designer on Core Banking, though v3 still holds all three.
// Args: [port=4584]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4584)
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
const ids = () => page.locator('.react-flow__node').evaluateAll((els) => els.map((e) => e.dataset.id).sort())
const gone = ['ctn-payments', 'comp-validator', 'comp-fx']
async function play() {
  await page.locator('.pres-dock .pres-slide-card').nth(1).click()
  await L.settle(page)
  await page.keyboard.press('F5')
  await L.wait(page, 1200); await L.settle(page)
  const drawn = await ids()
  return drawn
}
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-core', 'presenter')
  const card = page.locator('.pres-dock .pres-slide-card').nth(1)
  await card.click(); await L.settle(page); await card.hover()
  await card.getByTitle('Link milestone').click()
  await page.locator('.pres-snap-item', { hasText: 'v3' }).click()
  await L.wait(page, 500)
  const before = await play()
  console.log(`slide 2 (v3) played before the delete: ${before.length} drawn; Payments Service and its components: ${gone.filter((g) => before.includes(g)).length} of 3`)
  await L.shot(page, 'f1-slide-before')
  await page.keyboard.press('Escape'); await L.wait(page, 500)

  await L.open(page, id, 'view-core', 'designer')
  await L.node(page, 'ctn-payments').click({ position: { x: 14, y: 8 } })
  await page.keyboard.press('Delete')
  await page.locator('.milestone-modal').waitFor()
  await page.getByRole('button', { name: /Remove from model/ }).click()
  await L.settle(page); await L.wait(page, 2500)
  console.log(`live Core Banking after the delete: ${(await ids()).length} drawn`)

  const doc = await L.stored(page, id)
  const v3 = doc.snapshots.find((s) => s.name.startsWith('v3'))
  const has = (k) => !!(Array.isArray(v3.nodes) ? v3.nodes.find((n) => n.id === k) : v3.nodes[k])
  console.log(`v3 in the saved document still holds: ${gone.filter(has).length} of 3`)

  await L.milestone(page, 'v3 – Full Platform')
  const designerV3 = await ids()
  console.log(`v3 opened in Designer on Core Banking: ${designerV3.length} drawn; the three: ${gone.filter((g) => designerV3.includes(g)).length} of 3`)
  await L.milestone(page, 'live')

  await L.open(page, id, 'view-core', 'presenter')
  const after = await play()
  console.log(`slide 2 (v3) played after the delete: ${after.length} drawn; the three: ${gone.filter((g) => after.includes(g)).length} of 3; missing ${JSON.stringify(before.filter((x) => !after.includes(x)))}`)
  await L.shot(page, 'f1-slide-after')
  await page.keyboard.press('Escape')
} finally { console.log('problems', problems); await browser.close() }
