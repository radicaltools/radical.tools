// F1: Keep in a row on the two components of Payments Service moves and resizes
// Access & Security, which I pinned and which has nothing to do with the row
// (and refits Risk & Data too). Sample model, Core Banking.
//   node f1-align-moves-pinned-frame.mjs <port>
// Needs: sample.json beside this script (the sample model as Studio saves it), lib.mjs.
import { launch, seed, open, stored, canvas, shot, here } from './lib.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const port = process.argv[2] ?? 4513
const viewId = 'view-core', pin = 'dom-access', holder = 'ctn-payments'
const doc = JSON.parse(readFileSync(join(here, 'sample.json'), 'utf8'))
const s = await launch(port)
const box = (b) => `(${Math.round(b.x)}, ${Math.round(b.y)}) ${b.w}x${b.h}`
const same = (a, b) => Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1 && a.w === b.w && a.h === b.h
let bad = false
try {
  await seed(s.page, 'smp', doc)
  await open(s.page, 'smp', viewId)
  await s.page.waitForTimeout(1500)
  // Drag Access & Security by its header 30 px right, 20 px down: it is pinned.
  const b = await s.page.locator(`.react-flow__node[data-id="${pin}"]`).boundingBox()
  const gx = b.x + b.width / 2, gy = b.y + 8
  await s.page.mouse.move(gx, gy); await s.page.mouse.down()
  await s.page.mouse.move(gx + 15, gy + 10, { steps: 4 }); await s.page.mouse.move(gx + 30, gy + 20, { steps: 4 }); await s.page.mouse.up()
  await s.page.waitForTimeout(3000)
  const pins = (d) => (d.views.find((v) => v.id === viewId).layoutConstraints ?? []).filter((c) => c.type === 'pin').flatMap((c) => c.nodeIds)
  console.log('pinned after the drag:', pins(await stored(s.page, 'smp')))
  const c1 = await canvas(s.page)
  // Payments Service → Align children… → Keep in a row (FX Engine, Payment Validator).
  await s.page.locator(`.react-flow__node[data-id="${holder}"]`).dblclick()
  await s.page.waitForTimeout(800)
  await s.page.getByRole('button', { name: /^Align children/ }).first().click()
  await s.page.waitForTimeout(300)
  await s.page.getByText('Keep in a row', { exact: true }).first().click()
  await s.page.waitForTimeout(3500)
  await s.page.keyboard.press('Escape')
  await s.page.waitForTimeout(400)
  const c2 = await canvas(s.page)
  const d = await stored(s.page, 'smp')
  console.log('constraints:', JSON.stringify(d.views.find((v) => v.id === viewId).layoutConstraints.map((c) => [c.type, c.nodeIds])))
  for (const id of [pin, 'ctn-auth', 'ctn-apigw', 'dom-risk', 'ctn-fraud', 'comp-fx', 'comp-validator']) console.log(`${id}: ${box(c1[id])} -> ${box(c2[id])}`)
  await s.page.screenshot({ path: shot('f1.png') })
  bad = !same(c1[pin], c2[pin])
  console.log(bad ? 'FINDING: the pinned group Access & Security moved/resized' : 'ok: the pinned group stayed')
  if (s.problems.length) console.log('problems', s.problems.slice(0, 5))
} finally { await s.close() }
console.log(bad ? 'REPRODUCED: yes' : 'REPRODUCED: no')
process.exit(bad ? 1 : 0)
