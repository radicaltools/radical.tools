// Sample, Core Banking (Designer): a calm drag (no Cmd/Ctrl) of API Gateway a few px inside
// Access & Security. Measures every drawn element before and after; nothing but the dragged
// element (and what it covers) may move.   Args: [port=4576] [dx=20] [dy=0] [node=ctn-apigw]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4576), dx = Number(process.argv[3] ?? 20), dy = Number(process.argv[4] ?? 0)
const held = process.argv[5] ?? 'ctn-apigw'
const { browser, page, problems } = await L.launch({ port })
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-core')
  await L.wait(page, 1500); await L.settle(page)
  const before = await L.frames(page)
  await L.shot(page, 'f1-before-drag')
  const doc0 = await L.stored(page, id)
  const parentOf = Object.fromEntries(doc0.nodes.map((n) => [n.id, n.parentId]))
  const chain = []; for (let p = parentOf[held]; p; p = parentOf[p]) chain.push(p)
  console.log('held', held, 'ancestors', chain.join(' < '))
  for (const k of [held, ...chain]) console.log('before', k, JSON.stringify(before[k]))
  await L.drag(page, held, dx, dy)
  await L.wait(page, 3000); await L.settle(page)
  const after = await L.frames(page)
  for (const k of [held, ...chain]) console.log('after ', k, JSON.stringify(after[k]))
  const d = L.diff(before, after)
  const others = Object.fromEntries(Object.entries(d).filter(([k]) => k !== held))
  const margins = (fr) => Object.fromEntries([...chain].map((g) => {
    const kids = Object.keys(fr).filter((k) => parentOf[k] === g)
    const l = Math.min(...kids.map((k) => fr[k].x)), t = Math.min(...kids.map((k) => fr[k].y))
    const r = Math.max(...kids.map((k) => fr[k].x + fr[k].w)), b = Math.max(...kids.map((k) => fr[k].y + fr[k].h))
    const f = fr[g]
    return [g, `left ${(l - f.x).toFixed(0)} top ${(t - f.y).toFixed(0)} right ${(f.x + f.w - r).toFixed(0)} bottom ${(f.y + f.h - b).toFixed(0)}`]
  }))
  console.log('frame margins around their children, before:', JSON.stringify(margins(before)))
  console.log('frame margins around their children, after: ', JSON.stringify(margins(after)))
  console.log(`moved/resized besides ${held}: ${Object.keys(others).length}`)
  L.out(others)
  await L.shot(page, 'f1-after-drag')
  const saved = (await L.stored(page, id)).views.find((v) => v.id === 'view-core').positions
  console.log('saved', ['sys-core', ...chain.slice(0, -1), held].map((k) => `${k} ${JSON.stringify(saved[k])}`).join('; '))
  await page.reload(); await page.locator('.app-layout').waitFor(); await L.settle(page); await L.wait(page, 1500)
  const reloaded = await L.frames(page)
  console.log('reload vs after the drop:', JSON.stringify(L.diff(after, reloaded)))
} finally { console.log('problems', problems); await browser.close() }
