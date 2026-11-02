// Sample. Take an element out of its container to the top of the model, with the special key (drop
// on the empty canvas) or the card's Parent field set to "—": it does not stay where it stood (nor go
// where it was dropped), but jumps to the top right of the view.
//  domain:  Domain model view, entity Payment (in the Payments domain, which the view does not draw)
//  screens: Screen Map view, mockup Payment On Hold (in the group Customer journey, drawn)
// Args: [port=4590] [domain|screens] [key|card]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4590), which = process.argv[3] ?? 'domain', how = process.argv[4] ?? 'key'
const cfg = which === 'screens'
  ? { view: 'view-screens', X: 'mk-hold', name: 'Payment On Hold' }
  : { view: 'view-domain-model', X: '73809fc5-c735-440f-abe5-62c8ce5dd226', name: 'Payment' }
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
try {
  const id = await L.openSample(page)
  await L.open(page, id, cfg.view); await L.wait(page, 1500)
  const focus = page.getByRole('button', { name: 'Focus', exact: true })
  if ((await focus.getAttribute('aria-pressed')) !== 'false') await focus.click()
  await page.getByRole('button', { name: 'Fit All', exact: true }).click(); await L.wait(page, 1000)
  const f0 = await L.frames(page)
  const parentOf = async () => (await L.stored(page, id)).nodes.find((n) => n.id === cfg.X).parentId ?? '(top)'
  console.log(`${cfg.name} at (${f0[cfg.X].x}, ${f0[cfg.X].y}) in ${await parentOf()}`)
  const others = Object.entries(f0).filter(([k, b]) => k !== cfg.X && b.w < 400)
  const bbox = { x0: Math.min(...others.map(([, b]) => b.x)), y0: Math.min(...others.map(([, b]) => b.y)), x1: Math.max(...others.map(([, b]) => b.x + b.w)), y1: Math.max(...others.map(([, b]) => b.y + b.h)) }
  const s = await L.node(page, cfg.X).boundingBox()
  await L.shot(page, `f3-${which}-${how}-before`)
  if (how === 'key') {
    await page.mouse.click(s.x + 12, s.y + 8); await L.wait(page, 500)
    await page.keyboard.down('Alt'); await L.wait(page, 300)
    await page.mouse.move(s.x + 12, s.y + 8); await page.mouse.down()
    // A spot of the empty canvas near the bottom right of the pane.
    const pane = await page.locator('.react-flow__pane').boundingBox()
    const spot = await page.evaluate(([px, py, pw, ph]) => { for (let y = py + ph - 120; y > py; y -= 30) for (let x = px + pw - 40; x > px + 200; x -= 30) { const e = document.elementFromPoint(x, y); if (e && !e.closest('.react-flow__node, .react-flow__edge, .react-flow__panel, .canvas-controls')) return [x, y] } return null }, [pane.x, pane.y, pane.width, pane.height])
    await page.mouse.move(spot[0], spot[1], { steps: 10 }); await L.wait(page, 300)
    const [tx, ty, k] = (await page.locator('.react-flow__viewport').evaluate((e) => e.style.transform)).match(/-?[\d.]+/g).map(Number)
    const rf = await page.locator('.react-flow').boundingBox()
    console.log(`released on the empty canvas at (${((spot[0] - rf.x - tx) / k).toFixed(0)}, ${((spot[1] - rf.y - ty) / k).toFixed(0)})`)
    await page.mouse.up(); await page.keyboard.up('Alt')
  } else {
    await page.mouse.dblclick(s.x + 12, s.y + 8); await L.wait(page, 800)
    await page.getByLabel('Parent', { exact: true }).selectOption('')
  }
  await L.wait(page, 3000); await L.settle(page)
  console.log('notices:', JSON.stringify(await page.locator('.toast-message').allInnerTexts()))
  const f1 = await L.frames(page)
  console.log(`now in ${await parentOf()}; moved: ${JSON.stringify(L.diff(f0, f1))}`)
  console.log(`the view's other elements span x ${bbox.x0.toFixed(0)}..${bbox.x1.toFixed(0)}, y ${bbox.y0.toFixed(0)}..${bbox.y1.toFixed(0)}`)
  await L.shot(page, `f3-${which}-${how}-after`)
  await L.wait(page, 2000)
  await page.reload(); await page.locator('.app-layout').waitFor(); await L.settle(page); await L.wait(page, 1500)
  const f2 = await L.frames(page)
  console.log(`after a reload ${cfg.name} at (${f2[cfg.X]?.x}, ${f2[cfg.X]?.y})`)
} finally { console.log('problems', problems); await browser.close() }
