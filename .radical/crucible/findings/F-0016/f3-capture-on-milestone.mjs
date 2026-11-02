// Sample, Presenter: click slide 2 (Core Banking, live model), show milestone v1 (rail >
// Milestones), press Capture on slide 2's card. The slide is not linked to v1 but keeps a copy
// of v1's model: its card names no milestone, and after Delete milestone v1 it still shows v1.
import * as L from './lib.mjs'
const { browser, page, problems } = await L.launch()
const slide = async (id) => { const s = (await L.stored(page, id)).presentations[0].slides[1]; return `snapshotId=${s.snapshotId} modelSnapshot=${s.modelSnapshot ? Object.keys(s.modelSnapshot.nodes).length + ' nodes' : 'none'}` }
const search = () => page.locator('input[placeholder^="Search"]').getAttribute('placeholder')
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-core')
  await L.mode(page, 'Presenter')
  const card = page.locator('.pres-dock-card-wrap').nth(1)
  await card.click(); await L.settle(page)
  console.log(`slide 2 before: ${await slide(id)}; draws ${(await L.drawn(page)).length} (${await search()})`)
  await L.milestone(page, 'v1')
  console.log(`v1 shown: draws ${(await L.drawn(page)).length} (${await search()})`)
  await card.getByTitle(/^Capture canvas state/).click(); await L.wait(page, 2000)
  console.log(`slide 2 after Capture on v1: ${await slide(id)}; milestone tag on its card: ${await card.locator('.pres-slide-snap-tag').count()}`)
  await L.mode(page, 'Designer')
  await L.milestone(page, 'live')
  const v1 = page.locator('.lp-snap-card', { hasText: 'v1' }).first()
  await v1.hover(); await v1.getByTitle(/Milestone properties/).click()
  await page.getByRole('button', { name: /^Delete/ }).last().click(); await L.wait(page, 500)
  const confirm = page.locator('.milestone-modal').getByRole('button', { name: /Delete/ })
  if (await confirm.count()) await confirm.first().click()
  await L.wait(page, 2000)
  console.log(`milestones now: ${(await L.stored(page, id)).snapshots.map((s) => s.name).join(', ')}`)
  console.log(`slide 2 after Delete milestone v1: ${await slide(id)}`)
  await L.mode(page, 'Presenter')
  await card.click(); await L.settle(page)
  console.log(`slide 2 shows: ${(await L.drawn(page)).length} drawn (${await search()}); the live model has 78 nodes`)
  await L.shot(page, 'f3')
} finally { console.log('problems', problems); await browser.close() }
