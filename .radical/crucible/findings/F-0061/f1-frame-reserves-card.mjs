// Sample, System Context, Designer, defaults (Focus on). A single click on Core Banking Platform
// selects it (no card opens: the card opens on a double-click) and the camera frames it with its
// neighbours. The framing still keeps room on the right for the properties card, which is not there:
// at 1280x720 the room left is under half the canvas, so the framing falls back to the whole canvas
// and SWIFT Network lands under the elements palette; at 1600x900 the framed group sits off to the
// left with an empty band on the right. Then a double-click (card open) for comparison.
// Args: [port=4592]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4592)
for (const [width, height] of [[1280, 720], [1600, 900]]) {
  const { browser, page, problems } = await L.launch({ port, width, height })
  page.setDefaultTimeout(8000)
  try {
    const id = await L.openSample(page)
    await L.open(page, id, 'view-ctx', 'designer')
    await L.wait(page, 800)
    const geo = async () => page.evaluate(() => {
      const pal = document.querySelector('.canvas-column .element-palette')?.getBoundingClientRect()
      const cv = document.querySelector('.react-flow')?.getBoundingClientRect()
      const card = document.querySelector('.right-panel')
      const cardOpen = !!card?.classList.contains('open')
      const nodes = [...document.querySelectorAll('.react-flow__node:not(.focus-dim)')].map((e) => ({ id: e.dataset.id, r: e.getBoundingClientRect() }))
      const minX = Math.min(...nodes.map((n) => n.r.left)), maxX = Math.max(...nodes.map((n) => n.r.right))
      const under = nodes.filter((n) => pal && n.r.left < pal.right).map((n) => `${n.id} ${Math.round(Math.min(n.r.right, pal.right) - n.r.left)} of ${Math.round(n.r.width)} px wide under the palette`)
      return { canvas: [Math.round(cv.left), Math.round(cv.right)], paletteRight: pal ? Math.round(pal.right) : null, cardOpen, cardLeft: cardOpen ? Math.round(card.getBoundingClientRect().left) : null, framed: [Math.round(minX), Math.round(maxX)], freeRight: Math.round((cardOpen ? card.getBoundingClientRect().left : cv.right) - maxX), under }
    })
    await L.node(page, 'sys-core').click({ position: { x: 10, y: 10 } }); await L.wait(page, 1500)
    const one = await geo()
    console.log(`${width}x${height} click Core Banking:`, JSON.stringify(await L.vp(page)), JSON.stringify(one))
    await L.shot(page, `f1-click-${width}`)
    await page.mouse.click(Math.round(one.canvas[1] - 30), height - 120); await L.wait(page, 1200)
    await L.node(page, 'sys-core').dblclick({ position: { x: 10, y: 10 } }); await L.wait(page, 1500)
    console.log(`${width}x${height} double-click (card):`, JSON.stringify(await L.vp(page)), JSON.stringify(await geo()))
  } finally { if (problems.length) console.log('problems', problems); await browser.close() }
}
