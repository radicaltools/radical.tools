// F3: on another model's wiki (orders' "Orders wiki"), the read-only bar
// ("A view of the model orders … Copy to this model") lies over the wiki's
// Single page / Multi page buttons: a click on Multi page lands on the bar
// and the wiki stays one page at a time. Seen at 1280, 1600 and 1920 px wide.
//   node f3-bar-covers-wiki-page-mode.mjs [--port 4520]
import * as L from './lib.mjs'
const model = L.genFederation('f3', '--kinds')   // payments + orders, orders with a wiki of every element, fetched
const b = await L.startBrowser()
const { page } = b
let bug = false
try {
  await L.openDiskFolder(page, model)
  await L.openViewCard(page, 'Orders wiki')
  const btn = page.getByRole('button', { name: 'Multi page' })
  const r = await btn.boundingBox()
  const x = r.x + r.width / 2, y = r.y + r.height / 2
  const onTop = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e?.closest('.other-model-bar') ? 'the other-model bar' : e?.closest('button')?.textContent ?? e?.tagName }, [x, y])
  const bar = await page.locator('.other-model-bar').boundingBox()
  await page.mouse.click(x, y)
  await L.sleep(600)
  const active = await page.locator('.wiki-page-mode-toggle button.active').innerText()
  console.log(`Multi page button at (${Math.round(r.x)}, ${Math.round(r.y)}) ${Math.round(r.width)}×${Math.round(r.height)}; bar at (${Math.round(bar.x)}, ${Math.round(bar.y)}) ${Math.round(bar.width)}×${Math.round(bar.height)}`)
  console.log(`on top at its middle: ${onTop}; after a click on it the wiki is on: ${active}`)
  await L.shot(page, 'f3.png')
  bug = active !== 'Multi page'
  if (b.errors.length) console.log('errors', b.errors)
} finally { await b.close() }
console.log(bug ? 'REPRODUCED: yes' : 'REPRODUCED: no')
process.exitCode = bug ? 1 : 0
