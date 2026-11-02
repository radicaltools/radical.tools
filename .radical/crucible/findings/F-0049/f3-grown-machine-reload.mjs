// Sample, Payment lifecycle (a view per element; the state machine's domain is not drawn): a calm
// drag of the state Refused 300 px down inside the state machine, which grows to hold it. Then a
// view switch away and back, and a reload: is the canvas what it was, and what the file says?
// Args: [port=4582] [view=view-payment-lifecycle] [node=Refused] [dx=0] [dy=300] [other view card=Fraud case lifecycle]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4582), view = process.argv[3] ?? 'view-payment-lifecycle'
const held = process.argv[4] ?? '1bd9d3a0-f691-4c15-b48e-f652173a9f88', dx = Number(process.argv[5] ?? 0), dy = Number(process.argv[6] ?? 300)
const otherCard = process.argv[7] ?? 'Fraud case lifecycle'
const { browser, page, problems } = await L.launch({ port, width: 1600, height: 1000 })
const goView = async (name) => { await L.tab(page, 'Views'); const c = page.locator('.lp-view-card').filter({ hasText: name }).first(); await c.scrollIntoViewIfNeeded(); await c.click(); await L.settle(page); await L.wait(page, 2500); await L.settle(page) }
const count = (d) => `${Object.keys(d).length} moved/resized`
try {
  const id = await L.openSample(page)
  await L.open(page, id, view); await L.focusOff(page); await L.wait(page, 2500); await L.settle(page)
  const doc = await L.stored(page, id)
  const by = Object.fromEntries(doc.nodes.map((n) => [n.id, n]))
  const name = (k) => by[k]?.label ?? k
  const f0 = await L.frames(page)
  const zoom = await page.evaluate(() => +document.querySelector('.react-flow__viewport').style.transform.match(/scale\(([\d.]+)\)/)[1])
  await L.drag(page, held, dx * zoom, dy * zoom)
  await L.wait(page, 3000); await L.settle(page)
  const f1 = await L.frames(page)
  console.log(`drag of ${name(held)}: ${count(L.diff(f0, f1))}: ${Object.keys(L.diff(f0, f1)).map(name).join(', ')}`)
  console.log(`  ${name(held)} drawn at ${JSON.stringify(f1[held])}`)
  await L.shot(page, 'f3-after-drag')
  await L.wait(page, 2000)
  const s1 = await L.viewPos(page, id, view)
  await goView(otherCard)
  await goView(by[doc.views.find((v) => v.id === view).subject]?.label ?? 'Payment lifecycle')
  const f2 = await L.frames(page)
  const d2 = L.diff(f1, f2)
  console.log(`after switching to ${otherCard} and back: ${count(d2)}`)
  console.log(`  ${name(held)} drawn at ${JSON.stringify(f2[held])}`)
  await L.shot(page, 'f3-after-switch')
  await page.reload(); await page.locator('.app-layout').waitFor(); await L.settle(page); await L.wait(page, 2500); await L.settle(page)
  const f3 = await L.frames(page)
  console.log(`after a reload, against the canvas after the drag: ${count(L.diff(f1, f3))}; ${name(held)} drawn at ${JSON.stringify(f3[held])}`)
  console.log(`  saved positions changed since the drag: ${Object.keys(L.posDiff(s1, await L.viewPos(page, id, view))).length}; saved ${name(held)}: ${JSON.stringify(s1[held])}`)
  console.log('  violations', L.violations(f3, Object.fromEntries(doc.nodes.map((n) => [n.id, n.parentId]))))
  await L.shot(page, 'f3-after-reload')
} finally { console.log('problems', problems); await browser.close() }
