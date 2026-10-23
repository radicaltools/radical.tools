// Sample, Domain model (entities only; the domains they are in are not drawn): a calm drag of
// Payment to an empty spot. Which elements move besides Payment, and are they covered by it?
// Args: [port=4582] [dx=-500] [dy=300] [node=Payment's id]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4582), dx = Number(process.argv[3] ?? -500), dy = Number(process.argv[4] ?? 300)
const held = process.argv[5] ?? '73809fc5-c735-440f-abe5-62c8ce5dd226'
const view = 'view-domain-model'
const { browser, page, problems } = await L.launch({ port, width: 1600, height: 1000 })
try {
  const id = await L.openSample(page)
  await L.open(page, id, view); await L.focusOff(page)
  await L.wait(page, 2000); await L.settle(page)
  const doc = await L.stored(page, id)
  const by = Object.fromEntries(doc.nodes.map((n) => [n.id, n]))
  const name = (k) => `${by[k]?.label} (${by[k]?.type}${by[k]?.parentId ? ` in ${by[by[k].parentId]?.label} [${by[by[k].parentId]?.type}${(await0[by[k].parentId] ? ', drawn' : ', not drawn')}]` : ''})`
  const await0 = await L.frames(page)
  const f0 = await0
  console.log('drawn:', Object.keys(f0).map(name).join('; '))
  await L.shot(page, 'f2-before')
  const zoom = await page.evaluate(() => +document.querySelector('.react-flow__viewport').style.transform.match(/scale\(([\d.]+)\)/)[1])
  await L.drag(page, held, dx * zoom, dy * zoom)
  await L.wait(page, 3000); await L.settle(page)
  const f1 = await L.frames(page)
  const P = f1[held]
  console.log(`dropped ${name(held)}: ${JSON.stringify(f0[held])} -> ${JSON.stringify(P)}`)
  for (const [k, d] of Object.entries(L.diff(f0, f1))) {
    if (k === held) continue
    const B = f0[k]
    const covered = Math.min(P.x + P.w, B.x + B.w) > Math.max(P.x, B.x) && Math.min(P.y + P.h, B.y + B.h) > Math.max(P.y, B.y)
    const gap = Math.max(B.x - (P.x + P.w), P.x - (B.x + B.w), B.y - (P.y + P.h), P.y - (B.y + B.h))
    console.log(`  moved: ${name(k)} ${JSON.stringify(d)}; covered by the drop: ${covered}; gap to it before: ${gap.toFixed(0)} px`)
  }
  await L.shot(page, 'f2-after')
} finally { console.log('problems', problems); await browser.close() }
