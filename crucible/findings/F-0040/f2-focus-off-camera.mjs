// Sample's System Context, Designer, zoomed out three steps (relation labels hidden).
// A click on Core Banking with Focus on frames it (zoom ~0.86). Focus is switched off, then
// Digital Channels is clicked: with Focus off a selection should move no camera.
// Control: the same click with Focus off from the start leaves the camera.
// Args: [port=4579]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4579)
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
const vp = async () => {
  const t = await page.locator('.react-flow__viewport').evaluate((e) => e.style.transform)
  const m = t.match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/)
  return { x: Math.round(+m[1]), y: Math.round(+m[2]), zoom: +(+m[3]).toFixed(3) }
}
const focusBtn = () => page.locator('.canvas-focus-toggle')
const click = async (id) => { await L.node(page, id).click({ position: { x: 10, y: 10 } }); await L.wait(page, 1500) }
async function zoomedOut() {
  await page.getByTitle('Fit all visible nodes to viewport').click(); await L.wait(page, 1200)
  for (let i = 0; i < 3; i++) { await page.getByTitle(/Zoom out/).click(); await L.wait(page, 400) }
  await L.wait(page, 1000)
}
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-ctx', 'designer')
  await zoomedOut()
  console.log('A. zoomed out:', JSON.stringify(await vp()))
  await click('sys-core')
  console.log('   Focus on, click Core Banking (framed):', JSON.stringify(await vp()))
  await focusBtn().click(); await L.wait(page, 800)
  console.log('   Focus switched off, aria-pressed', await focusBtn().getAttribute('aria-pressed'), JSON.stringify(await vp()))
  const before = await vp()
  await click('sys-channels')
  const after = await vp()
  console.log('   Focus off, click Digital Channels:', JSON.stringify(after), sameish(before, after) ? 'camera stayed' : 'CAMERA MOVED')
  await L.shot(page, 'f2-focus-off-camera')
  // Control: Focus off from the start.
  await page.reload(); await page.locator('.app-layout').waitFor(); await L.settle(page)
  await zoomedOut()
  const c0 = await vp()
  await click('sys-core')
  const c1 = await vp()
  console.log('B. control, Focus off from the start, click Core Banking:', JSON.stringify(c0), '->', JSON.stringify(c1), sameish(c0, c1) ? 'camera stayed' : 'CAMERA MOVED')
} finally { console.log('problems', problems); await browser.close() }
function sameish(a, b) { return Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2 && Math.abs(a.zoom - b.zoom) < 0.005 }
