// F1. Sample, Authorization view at Fit All (zoom about 0.23). Select "Break-glass use alerts", hold the special key:
// a "derives from" pill over each element it can go to. The pill of "Unpermitted calls refused" lies over the whole
// of "Leavers lose access", itself a target with one way ("derives from").
//  drop:  special-key drag from Break-glass use alerts, release on the centre of Leavers lose access
//         -> a relation to Unpermitted calls refused is made instead.
//  click: special-key click on the centre of Leavers lose access (to add it to the selection) -> nothing happens.
// Args: [port=4598] [drop|click]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4598), how = process.argv[3] ?? 'drop'
const VIEW = 'view-authorization', SRC = 'dfd072e9-a9f7-45bf-8adb-c4a9b287af20', TGT = 'c8fdf808-27c6-4a35-b117-6b3c2cf45786'
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
try {
  const id = await L.openSample(page)
  await L.open(page, id, VIEW); await L.wait(page, 1500)
  const focus = page.getByRole('button', { name: 'Focus', exact: true })
  if ((await focus.getAttribute('aria-pressed')) !== 'false') await focus.click()
  await page.getByRole('button', { name: 'Fit All', exact: true }).click(); await L.wait(page, 800)
  const before = await L.stored(page, id)
  const name = (n) => before.nodes.find((x) => x.id === n)?.label ?? n
  const zoom = await page.evaluate(() => +getComputedStyle(document.querySelector('.react-flow__viewport')).transform.split('(')[1].split(',')[0])
  const s = await L.node(page, SRC).boundingBox()
  await page.mouse.click(s.x + s.width / 2, s.y + s.height - 3); await L.wait(page, 500)
  await page.keyboard.down('Alt'); await L.wait(page, 400)
  const t = await L.node(page, TGT).boundingBox()
  const tx = t.x + t.width / 2, ty = t.y + t.height / 2
  const under = async () => page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); const p = e?.closest('.connect-pills'); return p ? `the "${e.textContent}" pill of ${p.dataset.connectOver}` : `element ${e?.closest('.react-flow__node')?.dataset.id}` }, [tx, ty])
  console.log(`zoom ${zoom.toFixed(2)}; pills over "${name(TGT)}":`, await page.locator(`.connect-pills[data-connect-over="${TGT}"] .connect-pill`).allInnerTexts(), '; under its centre:', await under())
  if (how === 'drop') {
    await page.mouse.move(s.x + s.width / 2, s.y + s.height - 3); await page.mouse.down()
    await page.mouse.move(tx, ty, { steps: 10 }); await L.wait(page, 400)
    await L.shot(page, 'f1-drop-during')
    await page.mouse.up(); await page.keyboard.up('Alt'); await L.wait(page, 2500)
    const after = await L.stored(page, id)
    const added = after.relations.filter((r) => !before.relations.some((b) => b.id === r.id)).map((r) => `"${name(r.sourceId)}" ${r.relationType} "${name(r.targetId)}"`)
    console.log(`released on the centre of "${name(TGT)}"; relations added:`, added)
  } else {
    await page.mouse.click(tx, ty); await page.keyboard.up('Alt'); await L.wait(page, 800)
    const sel = await page.locator('.react-flow__node.selected').evaluateAll((e) => e.map((n) => n.dataset.id))
    console.log(`special-key click on the centre of "${name(TGT)}"; selected:`, sel.map(name))
    await L.shot(page, 'f1-click-after')
  }
} finally { console.log('problems', problems); await browser.close() }
