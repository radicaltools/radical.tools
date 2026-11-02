// Bookstore fixture, System Context. A dragged element is pinned and, once selected, shows its
// Unpin pin; two elements kept in a row show the alignment's dashed guide and its buttons
// (order, remove). Export → Export as SVG… / PNG: the picture carries the Unpin pin, the guide and
// its buttons, though an export leaves out the editing controls (requirement "Export view as image").
// Args: [port=4599]
import * as L from './lib.mjs'
import { readFileSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
const port = Number(process.argv[2] ?? 4599)
const { context, page, problems, close } = await L.launch({ port })
page.setDefaultTimeout(10000)
async function exportAs(kind) {
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: `Export as ${kind}…` }).click()])
  return download.path()
}
const count = (svg, re) => (svg.match(re) ?? []).length
try {
  const id = await L.seedFixture(context, 'bookstore', 'run199-doc')
  await L.openLs(page, id, 'v-context')
  // 1. Drag Payment Provider: dropped, it is pinned; a click selects it and shows its Unpin pin.
  const pay = L.node(page, 'payments')
  const b = await pay.boundingBox()
  await page.mouse.move(b.x + 40, b.y + 15); await page.mouse.down()
  await page.mouse.move(b.x + 80, b.y + 60, { steps: 8 }); await page.mouse.move(b.x + 100, b.y + 80, { steps: 4 }); await page.mouse.up()
  await L.settle(page)
  await pay.click({ position: { x: 60, y: 60 } }); await L.wait(page, 500)
  const onScreen = await page.locator('.alignment-guide-btn').evaluateAll((es) => es.map((e) => e.getAttribute('aria-label') || e.title))
  const svg1 = readFileSync(await exportAs('SVG'), 'utf8')
  console.log(`pinned + selected: on screen ${JSON.stringify(onScreen)}; exported SVG: alignment-guide-btn ×${count(svg1, /alignment-guide-btn/g)}, aria-label="Unpin" ×${count(svg1, /aria-label="Unpin"/g)}`)
  copyFileSync(await exportAs('PNG'), join(L.DIR, 'shots', 'f3-pin-exported.png'))
  // 2. Bookstore and Payment Provider kept in a row: the guide and its buttons show while one is selected.
  await L.node(page, 'bookstore').click({ position: { x: 60, y: 60 } })
  await pay.click({ position: { x: 60, y: 60 }, modifiers: ['Alt'] }); await L.wait(page, 300)
  const align = page.getByRole('button', { name: /^Align…/ })
  if (await align.count()) {
    await align.first().click()
    await page.getByRole('menuitem', { name: /Keep in a row/ }).click()
    await L.settle(page); await L.wait(page, 500)
    await L.node(page, 'bookstore').click({ position: { x: 60, y: 60 } }); await L.wait(page, 500)
    const guides = await page.locator('.alignment-guide-btn').evaluateAll((es) => es.map((e) => e.getAttribute('aria-label') || e.title))
    const svg2 = readFileSync(await exportAs('SVG'), 'utf8')
    console.log(`row kept, member selected: on screen ${JSON.stringify(guides)}; exported SVG: alignment-guides layer ×${count(svg2, /data-testid="alignment-guides"/g)}, alignment-guide-btn ×${count(svg2, /alignment-guide-btn/g)}`)
    copyFileSync(await exportAs('PNG'), join(L.DIR, 'shots', 'f3-row-exported.png'))
  } else console.log('no Align… button for the selection')
  await L.shot(page, 'f3-canvas')
} finally { console.log('problems', problems); await close() }
