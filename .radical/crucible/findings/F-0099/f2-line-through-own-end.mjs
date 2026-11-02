// Sample, view Authorization: the relations "Denied by default" -> "Everyone sees only theirs" and
// "Checked on each record" -> "Everyone sees only theirs" (derives) are drawn down through the need card
// itself, across its name and description, and come back into its left side from below. Since F-0076's
// fix the keep-out behind a line's end is blocked unpadded (60 px deep), and the end element itself is no
// obstacle, so A* routes through the rest of it. At 31dcffed both lines came straight in from the left.
// Args: [port=4596] [style=curved|orthogonal]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4596), style = process.argv[3] ?? 'curved'
const { browser, page, problems } = await L.launch({ port, width: 1600, height: 1000 })
const T = '0e7b714e-3940-4bfc-8c37-20e186ccf505' // need "Everyone sees only theirs"
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-authorization'); await L.focusOff(page)
  if (style !== 'curved') { await L.setLines(page, 'Authorization', style); await L.wait(page, 800); await L.settle(page) }
  const doc = await L.stored(page, id)
  const label = Object.fromEntries(doc.nodes.map((n) => [n.id, n.label]))
  const fr = await L.frames(page)
  const bad = L.ownEndProblems(await L.edgeEnds(page), fr)
  console.log(`"${label[T]}" at ${JSON.stringify(fr[T])}`)
  for (const p of bad) {
    const m = p.match(/^(\S+) \((\S+)->(\S+)\) runs (\d+) px inside its own end (\S+)$/)
    console.log(`  ${label[m[2]]} -> ${label[m[3]]}: the line runs ${m[4]} px inside "${label[m[5]]}"`)
  }
  // Zoom in on the need card to see it.
  let b = await L.node(page, T).boundingBox()
  for (let i = 0; i < 8; i++) { await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.wheel(0, -200); await L.wait(page, 200) }
  await L.settle(page); await L.wait(page, 800)
  b = await L.node(page, T).boundingBox()
  const x = Math.max(0, b.x - 500), y = Math.max(0, b.y - 300)
  await page.screenshot({ path: `${L.DIR}/shots/f2-${style}.png`, clip: { x, y, width: Math.min(1100, 1600 - x), height: Math.min(700, 1000 - y) } })
  console.log(bad.length ? `REPRODUCED: ${bad.length} lines run through their own end element` : 'not reproduced')
} finally { console.log('problems', problems); await browser.close() }
