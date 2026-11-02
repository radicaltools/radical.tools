// F3. Bookstore fixture, Containers view. Select Web App, API and Orders DB with a special-key box drawn from the
// empty inside of the Bookstore frame (the F-0085 gesture), then use the special key on one of them:
//  viewer|presenter|designer click: a special-key click on API, to take it out of the selection -> nothing happens
//  designer drag: a special-key drag from API onto Payment Provider, to relate the selection to it -> no relation;
//                 the selection is dragged over there instead, Bookstore grows and pushes its neighbours.
// Compare: the same after selecting by clicks (mode ... clicks) works as the manual says.
// Args: [port=4598] [viewer|presenter|designer] [click|drag] [box|clicks]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4598), mode = process.argv[3] ?? 'viewer', act = process.argv[4] ?? 'click', how = process.argv[5] ?? 'box'
const { browser, context, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
try {
  const id = await L.seedFixture(context, 'bookstore')
  await L.open(page, id, 'v-containers', mode); await L.wait(page, 3000)
  const sel = () => page.locator('.react-flow__node.selected').evaluateAll((e) => e.map((x) => x.dataset.id))
  const at = async (n) => { const b = await L.node(page, n).boundingBox(); return [b.x + b.width / 2, b.y + b.height - 5] }
  const ids = mode === 'designer' && act === 'drag' ? ['web', 'api'] : ['web', 'api', 'db']
  if (how === 'box') {
    const bx = await Promise.all(ids.map((n) => L.node(page, n).boundingBox()))
    const fb = await L.node(page, 'bookstore').boundingBox()
    const x0 = mode === 'designer' ? fb.x - 15 : Math.min(...bx.map((b) => b.x)) - 15, y0 = mode === 'designer' ? fb.y - 15 : Math.min(...bx.map((b) => b.y)) - 15
    const x1 = Math.max(...bx.map((b) => b.x + b.width)) + 15, y1 = Math.max(...bx.map((b) => b.y + b.height)) + 15
    await page.keyboard.down('Alt'); await page.mouse.move(x0, y0); await page.mouse.down()
    await page.mouse.move(x1, y1, { steps: 10 }); await page.mouse.up(); await page.keyboard.up('Alt'); await L.wait(page, 800)
  } else {
    const [x, y] = await at(ids[0]); await page.mouse.click(x, y); await L.wait(page, 400)
    for (const n of ids.slice(1)) { const [x, y] = await at(n); await page.keyboard.down('Alt'); await page.mouse.click(x, y); await page.keyboard.up('Alt'); await L.wait(page, 400) }
  }
  console.log(mode, how, 'selected:', await sel())
  await L.wait(page, 1500)
  const before = await L.stored(page, id)
  const f0 = await L.frames(page)
  const [ax, ay] = await at('api')
  await page.keyboard.down('Alt'); await L.wait(page, 300)
  console.log('under API\'s point with the key held:', await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e?.closest('.react-flow__node')?.dataset.id ?? e?.className }, [ax, ay]))
  if (act === 'click') {
    await page.mouse.click(ax, ay); await page.keyboard.up('Alt'); await L.wait(page, 800)
    console.log('after a special-key click on API, selected:', await sel())
    await L.shot(page, `f3-${mode}-${how}-click`)
  } else {
    const [px, py] = await at('payments')
    await page.mouse.move(ax, ay); await page.mouse.down()
    await page.mouse.move(px, py, { steps: 12 }); await L.wait(page, 300)
    await L.shot(page, `f3-${mode}-${how}-drag-during`)
    await page.mouse.up(); await page.keyboard.up('Alt'); await L.wait(page, 2500); await L.settle(page)
    const after = await L.stored(page, id)
    console.log('relations added:', after.relations.filter((r) => !before.relations.some((b) => b.id === r.id)).map((r) => `${r.sourceId}->${r.targetId}`))
    console.log('moved:', JSON.stringify(L.diff(f0, await L.frames(page))))
  }
  await L.wait(page, 1500)
  console.log('document changed:', JSON.stringify(await L.stored(page, id)) !== JSON.stringify(before))
} finally { console.log('problems', problems); await browser.close() }
