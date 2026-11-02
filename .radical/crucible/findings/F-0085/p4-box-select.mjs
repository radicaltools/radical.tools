// Probe: special-key box select on the empty canvas, Designer vs Viewer vs Presenter; then a key click.
// Args: [port=4590] [mode=designer]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4590), mode = process.argv[3] ?? 'designer'
const { browser, context, page, problems } = await L.launch({ port })
try {
  const id = await L.seedFixture(context, 'bookstore')
  await L.open(page, id, 'v-containers', mode); await L.wait(page, 2000)
  const d0 = JSON.stringify(await L.stored(page, id))
  const pane = await page.locator('.react-flow__pane').boundingBox()
  const boxes = await Promise.all(['web', 'api', 'db'].map((n) => L.node(page, n).boundingBox()))
  const bs = await L.node(page, 'bookstore').boundingBox()
  const out = process.argv[4] === 'outside'
  const x0 = out ? bs.x - 20 : Math.min(...boxes.map((b) => b.x)) - 15, y0 = out ? bs.y - 20 : Math.min(...boxes.map((b) => b.y)) - 15
  const x1 = Math.max(...boxes.map((b) => b.x + b.width)) + 15, y1 = Math.max(...boxes.map((b) => b.y + b.height)) + 15
  if (process.argv[4] === 'outside') { const b = await L.node(page, 'bookstore').boundingBox(); console.log('bookstore', b); }
  console.log('box from', x0, y0, 'to', x1, y1, 'pane', pane)
  await page.keyboard.down('Alt')
  await page.mouse.move(x0, y0); await page.mouse.down()
  await page.mouse.move(x1, y1, { steps: 10 }); await page.mouse.up()
  await page.keyboard.up('Alt'); await L.wait(page, 800)
  console.log(mode, 'selected after box:', await page.locator('.react-flow__node.selected').evaluateAll((e) => e.map((x) => x.dataset.id)))
  await L.shot(page, `p4-${mode}`)
  await L.wait(page, 1500)
  console.log('document changed:', JSON.stringify(await L.stored(page, id)) !== d0)
} finally { console.log('problems', problems); await browser.close() }
