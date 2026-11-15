// F1: Tidy around Payment Validator moves and resizes the pinned group Access & Security,
// which it has no relation with (sample model, Core Banking).
//   node f1-around-moves-pinned-frame.mjs <port>
// Needs: sample.json beside this script (the sample model as Studio saves it).
import { launch, seed, open, stored, canvas, shot } from './lib.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { here } from './lib.mjs'
const port = process.argv[2] ?? 4502
const viewId = 'view-core', pin = 'dom-access', around = 'comp-validator'
const doc = JSON.parse(readFileSync(join(here, 'sample.json'), 'utf8'))
const s = await launch(port)
const box = (b) => `(${Math.round(b.x)}, ${Math.round(b.y)}) ${b.w}x${b.h}`
try {
  await seed(s.page, 'smp', doc)
  await open(s.page, 'smp', viewId)
  await s.page.waitForTimeout(1500)
  // Drag Access & Security by its header 20 px right, 10 px down: it is pinned.
  const b = await s.page.locator(`.react-flow__node[data-id="${pin}"]`).boundingBox()
  const gx = b.x + b.width / 2, gy = b.y + 8
  await s.page.mouse.move(gx, gy); await s.page.mouse.down()
  await s.page.mouse.move(gx + 10, gy + 5, { steps: 4 }); await s.page.mouse.move(gx + 20, gy + 10, { steps: 4 }); await s.page.mouse.up()
  await s.page.waitForTimeout(2500)
  const pins = (d) => (d.views.find((v) => v.id === viewId).layoutConstraints ?? []).filter((c) => c.type === 'pin').flatMap((c) => c.nodeIds)
  console.log('pinned after the drag:', pins(await stored(s.page, 'smp')))
  const c1 = await canvas(s.page)
  // Tidy around Payment Validator (in Banking Services; no relation with Access & Security or its children).
  await s.page.locator(`.react-flow__node[data-id="${around}"]`).dblclick()
  await s.page.waitForTimeout(800)
  await s.page.getByRole('button', { name: 'Tidy around' }).first().click()
  await s.page.waitForTimeout(4000)
  const c2 = await canvas(s.page)
  console.log('notice:', (await s.page.evaluate(() => window.__toasts)).slice(-1)[0])
  console.log('pinned after Tidy around:', pins(await stored(s.page, 'smp')))
  for (const id of [pin, 'ctn-auth', 'ctn-apigw', 'dom-risk']) console.log(`${id}: ${box(c1[id])} -> ${box(c2[id])}`)
  await s.page.keyboard.press('Escape')
  await s.page.waitForTimeout(400)
  await s.page.screenshot({ path: shot('f1.png') })
  const moved = Math.abs(c2[pin].x - c1[pin].x) > 1 || Math.abs(c2[pin].y - c1[pin].y) > 1 || c2[pin].w !== c1[pin].w || c2[pin].h !== c1[pin].h
  console.log(moved ? 'FINDING: the pinned group moved/resized' : 'ok: the pinned group stayed')
  if (s.problems.length) console.log('problems', s.problems.slice(0, 5))
} finally { await s.close() }
