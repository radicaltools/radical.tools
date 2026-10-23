// Sample, Presenter (not playing). Slide 1 (System Context) is linked to milestone v2 from its card;
// slide 2 (Core Banking) stays unlinked (the live model). Milestone v1 is picked on the Milestones
// tab, then a slide card is clicked. Does the chip name the model the canvas shows?
// Args: [port=4576]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4576)
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
const ids = () => page.locator('.react-flow__node').evaluateAll((els) => els.map((e) => e.dataset.id).sort())
const chip = async () => {
  const c = page.locator('.milestone-chip:visible')
  return (await c.count()) ? (await c.first().innerText()).replace(/\s+/g, ' ') : null
}
const url = () => decodeURIComponent(page.url().replace(/.*#/, '')).replace(/ls:[\w-]+/, 'ls:<id>')
const pickV1 = async () => { await L.milestone(page, 'live'); await L.milestone(page, 'v1 – Core & Accounts'); await L.wait(page, 500) }
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-ctx', 'presenter')
  const cards = page.locator('.pres-dock .pres-slide-card')
  await cards.nth(0).getByTitle('Link milestone').click()
  await page.locator('.pres-snap-item', { hasText: 'v2' }).click()
  await L.wait(page, 500)
  await cards.nth(0).click(); await L.settle(page)
  const v2Ctx = await ids()
  console.log(`slide 1 linked to v2, nothing picked: drawn ${v2Ctx.length}, chip ${JSON.stringify(await chip())}, url ${url()}`)
  await cards.nth(1).click(); await L.settle(page)
  const liveCore = await ids()
  console.log(`slide 2 (unlinked), nothing picked: drawn ${liveCore.length}, chip ${JSON.stringify(await chip())}, url ${url()}`)

  // A. v1 picked, then the unlinked slide 2.
  await pickV1()
  const v1Core = await ids()
  console.log(`A. picked v1 on Core Banking: drawn ${v1Core.length}, chip ${JSON.stringify(await chip())}`)
  await cards.nth(0).click(); await L.settle(page)
  await pickV1()
  console.log(`   picked v1 on System Context: drawn ${(await ids()).length}, chip ${JSON.stringify(await chip())}`)
  await cards.nth(1).click(); await L.settle(page); await L.wait(page, 500)
  const a = await ids()
  console.log(`   then slide 2 (unlinked): drawn ${a.length} (live ${liveCore.length}, v1 ${v1Core.length}), live model ${JSON.stringify(a) === JSON.stringify(liveCore)}, chip ${JSON.stringify(await chip())}, url ${url()}`)
  await L.shot(page, 'f3-unlinked-slide')

  // B. v1 picked, then slide 1, linked to v2.
  await pickV1()
  const v1Ctx = await ids()
  console.log(`B. picked v1 on Core Banking: drawn ${v1Ctx.length}, chip ${JSON.stringify(await chip())}`)
  await cards.nth(0).click(); await L.settle(page); await L.wait(page, 500)
  const b = await ids()
  console.log(`   then slide 1 (v2): drawn ${b.length} (v2 ${v2Ctx.length}), v2 model ${JSON.stringify(b) === JSON.stringify(v2Ctx)}, chip ${JSON.stringify(await chip())}, url ${url()}`)
  await L.shot(page, 'f3-v2-slide')
} finally { console.log('problems', problems); await browser.close() }
