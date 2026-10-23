// Sample's System Context, Designer, Smart fit and Focus on (defaults), 1280x720.
// A click on KYC / AML Provider frames it (400 ms camera flight, zoom 0.368 -> 1).
// A click on the empty canvas (top-right corner) GAP ms later should bring back the camera
// from before, as the requirement "Selection brings relations forward" says. With GAP 2000 it does.
// Args: [port=4579] [gaps=2000,100,200,300]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4579)
const gaps = (process.argv[3] ?? '2000,100,200,300').split(',').map(Number)
const cam = async (page) => { const t = await page.locator('.react-flow__viewport').evaluate((e) => e.style.transform); const m = t.match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/); return { x: Math.round(+m[1]), y: Math.round(+m[2]), zoom: +(+m[3]).toFixed(3) } }
const same = (a, b) => Math.abs(a.zoom - b.zoom) < 0.005 && Math.abs(a.x - b.x) < 3 && Math.abs(a.y - b.y) < 3
for (const gap of gaps) {
  const { browser, page, problems } = await L.launch({ port })
  page.setDefaultTimeout(8000)
  try {
    const id = await L.openSample(page)
    await L.open(page, id, 'view-ctx', 'designer')
    await L.wait(page, 2500)
    const c0 = await cam(page)
    const a = await L.node(page, 'sys-kyc').boundingBox()
    const pb = await page.locator('.react-flow__pane').boundingBox()
    await page.mouse.click(a.x + 5, a.y + 5)
    await L.wait(page, gap)
    const mid = await cam(page)
    await page.mouse.click(pb.x + pb.width - 40, pb.y + 15)
    await L.wait(page, 2500)
    const c2 = await cam(page)
    const sel = await page.locator('.react-flow__node.selected').count()
    const dim = await page.locator('.react-flow__node.focus-dim').count()
    console.log(`empty click ${gap} ms after the element click: camera before ${JSON.stringify(c0)}, at the empty click ${JSON.stringify(mid)}, after ${JSON.stringify(c2)}; selected ${sel}, dimmed ${dim}; camera back: ${same(c0, c2) ? 'yes' : 'NO'}`)
    if (gap === gaps[gaps.length - 1]) await L.shot(page, 'f3-camera-left-halfway')
  } finally { if (problems.length) console.log('problems', problems); await browser.close() }
}
