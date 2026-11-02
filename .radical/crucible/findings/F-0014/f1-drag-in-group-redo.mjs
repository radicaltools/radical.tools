// Sample, Core Banking (Designer): drag API Gateway 30 px to the right inside Access & Security.
// The canvas draws it at one place, the store keeps another: Redo after Undo, and a reload,
// put it back left of where the drop left it.   Args: [dx=30]
import * as L from './lib.mjs'
const dx = Number(process.argv[2] ?? 30)
const { browser, page, problems } = await L.launch()
const x = (t) => Number(t.match(/translate\((-?[\d.]+)px/)[1])
const cmp = (a, b) => Object.keys(a).filter((k) => a[k] !== b[k]).map((k) => `${k}: x ${x(a[k]).toFixed(1)} -> ${x(b[k]).toFixed(1)}`)
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-core')
  await L.drag(page, 'ctn-apigw', dx, 0)
  await L.wait(page, 4000)
  const drop = await L.positions(page)
  const saved = L.viewOf(await L.stored(page, id), 'view-core').positions
  console.log(`after the drop: API Gateway drawn ${(x(drop['ctn-apigw']) - x(drop['dom-access'])).toFixed(1)} px right of Access & Security's left edge; saved ${saved['ctn-apigw'].x} px`)
  await L.shot(page, 'f1-drop')
  await L.undo(page); await L.wait(page, 1500)
  await L.redo(page); await L.wait(page, 1500)
  console.log('Redo vs the drop:', cmp(drop, await L.positions(page)))
  await page.reload(); await page.locator('.app-layout').waitFor(); await L.settle(page); await L.wait(page, 1000)
  console.log('reload vs the drop:', cmp(drop, await L.positions(page)))
  await L.shot(page, 'f1-reload')
} finally { console.log('problems', problems); await browser.close() }
