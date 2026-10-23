// Bookstore fixture, Containers view in Viewer (or Presenter): the special key (Alt) still
// connects and nests. Alt-drag Web App onto Payment Provider; Alt-drag API onto the
// "inside" pill of Payment Provider. Then back to Designer and read the saved document.
// Args: [port=4578] [mode=viewer|presenter]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4578), mode = process.argv[3] ?? 'viewer'
const { browser, context, page, problems } = await L.launch({ port })
const count = async () => (await page.locator('input[placeholder^="Search"]').getAttribute('placeholder').catch(() => null))
try {
  const id = await L.seedFixture(context, 'bookstore')
  await L.open(page, id, 'v-containers', 'designer'); await L.wait(page, 2500)
  await L.open(page, id, 'v-containers', mode); await L.wait(page, 2500)
  const d0 = await L.stored(page, id)
  const show = (d) => ({ relations: d.relations.map((r) => r.sourceId + '->' + r.targetId).join(' '), apiParent: d.nodes.find((n) => n.id === 'api').parentId })
  console.log(`saved before (${mode}):`, show(d0), '| search bar:', await count())
  // 1. Alt-drag Web App onto Payment Provider
  await page.keyboard.down('Alt')
  const b = await L.node(page, 'web').boundingBox(), t = await L.node(page, 'payments').boundingBox()
  await page.mouse.move(b.x + 20, b.y + 20); await page.mouse.down()
  await page.mouse.move(t.x + t.width / 2, t.y + t.height - 15, { steps: 10 }); await L.wait(page, 200)
  await L.shot(page, `f2-${mode}-connecting`)
  await page.mouse.up(); await L.wait(page, 800)
  console.log(`in ${mode} after Alt-drag Web App -> Payment Provider: search bar "${await count()}"`)
  // 2. Alt-drag API onto the "inside" pill of Payment Provider
  const a = await L.node(page, 'api').boundingBox()
  await page.mouse.move(a.x + 20, a.y + 20); await page.mouse.down()
  await page.mouse.move(t.x + t.width / 2, t.y + t.height - 15, { steps: 10 }); await L.wait(page, 200)
  const pill = page.locator('.connect-pill[data-connect-target="payments"][data-connect-type="@inside"]')
  const pb = await pill.boundingBox()
  if (pb) await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2, { steps: 5 })
  console.log('inside pill offered in', mode, ':', !!pb)
  await page.mouse.up(); await page.keyboard.up('Alt'); await L.wait(page, 2500)
  await L.shot(page, `f2-${mode}-after`)
  const inPay = await page.evaluate(() => { const a = document.querySelector('[data-id="api"]').getBoundingClientRect(), p = document.querySelector('[data-id="payments"]').getBoundingClientRect(); return a.left >= p.left && a.right <= p.right && a.top >= p.top && a.bottom <= p.bottom })
  console.log(`in ${mode}: API drawn inside Payment Provider:`, inPay)
  const notes = await page.locator('[class*=notif], [class*=toast]').allTextContents()
  console.log(`in ${mode} after the gestures: search bar "${await count()}", notices`, notes)
  console.log(`saved, still in ${mode}:`, show(await L.stored(page, id)))
  await page.getByRole('button', { name: 'Designer', exact: true }).click(); await L.wait(page, 3000); await L.settle(page)
  console.log(`back in Designer: search bar "${await count()}"`)
  console.log('saved after back in Designer:', show(await L.stored(page, id)))
  await L.shot(page, `f2-${mode}-designer`)
} finally { console.log('problems', problems); await browser.close() }
