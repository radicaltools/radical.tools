// F2: a view never laid out (the view per element "Modelling" of the group "Entities of a domain",
// cut from radical.tools' own model) opened in Viewer: with no input its elements glide together
// for about 6 s, up to 11,000 px.
//   node f2-viewer-unlaid-view-drifts.mjs <port>
// Needs: modelling-cut.json beside this script.
import { launch, seed, canvas, diffPositions, shot, here } from './lib.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const port = process.argv[2] ?? 4502
const viewId = '08f7bfe4-7fa8-4adc-94ef-8331230b6dcd'
const doc = JSON.parse(readFileSync(join(here, 'modelling-cut.json'), 'utf8'))
console.log('view has positions of its own:', Object.keys(doc.views.find((v) => v.id === viewId).positions ?? {}).length)
const s = await launch(port, { width: 1600, height: 1000 })
try {
  await seed(s.page, 'cut', doc)
  await s.page.goto(`/#/d/ls%3Acut/m/viewer/v/${viewId}`)
  await s.page.locator('.react-flow__node').first().waitFor()
  await s.page.waitForTimeout(1000)
  const first = await canvas(s.page)
  await s.page.screenshot({ path: shot('f2-1s.png') })
  let prev = first, still = 0, t = 1
  for (; t <= 20 && still < 2; t++) {
    await s.page.waitForTimeout(1000)
    const c = await canvas(s.page)
    const n = diffPositions(prev, c).length
    console.log(`t=${t + 1}s: ${n} of ${Object.keys(c).length} elements moved in the last second`)
    still = n ? 0 : still + 1
    prev = c
  }
  await s.page.screenshot({ path: shot('f2-rest.png') })
  const total = diffPositions(first, prev)
  const max = Math.max(0, ...total.map(([, dx, dy]) => Math.hypot(dx, dy)))
  console.log(`between 1 s and rest: ${total.length} elements moved, the farthest ${max.toFixed(0)} px`)
  console.log(total.length ? 'FINDING: the view moved by itself in Viewer' : 'ok: nothing moved')
  if (s.problems.length) console.log('problems', s.problems.slice(0, 5))
} finally { await s.close() }
