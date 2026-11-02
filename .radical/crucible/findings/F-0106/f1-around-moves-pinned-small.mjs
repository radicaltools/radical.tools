// Tidy around one element moves a pinned element (and one beside it) it has no relation with,
// when the view has a row alignment somewhere. Small generated model, one view.
// node f1-around-moves-pinned-small.mjs <port> [--norow]
import { join } from 'node:path'
import { here, launch, seed, open, canvas, diffPositions, align, drag, openCard, tidyAround, viewOf, pinsOf, wait, dismissToasts, fitAll } from './lib2.mjs'
const [port] = process.argv.slice(2)
const norow = process.argv.includes('--norow')
const sys = (id, x, y) => ({ id, type: 'system', label: id, x, y, width: 280, height: 180, collapsed: false })
const nodes = [sys('A', 0, 0), sys('B', 400, 0), sys('C', 800, 0), sys('X', 0, 400), sys('Y', 600, 700), sys('D', 1400, 400), sys('E', 1400, 600)]
const rel = (id, s, t) => ({ id, sourceId: s, targetId: t, label: 'uses' })
const doc = {
  nodes, relations: [rel('r1', 'X', 'Y'), rel('r2', 'A', 'X')], sequences: [], snapshots: [], presentations: [],
  views: [{ id: 'v1', name: 'Main', kind: 'static', nodeIds: nodes.map((n) => n.id), hiddenRelationIds: [], positions: Object.fromEntries(nodes.map((n) => [n.id, { x: n.x, y: n.y, width: n.width, height: n.height }])) }],
}
const s = await launch(port)
const { page } = s
await seed(page, 'f1s', doc)
await open(page, 'f1s', 'v1')
await fitAll(page)
if (!norow) { await align(page, ['A', 'B', 'C'], 'row'); await page.keyboard.press('Escape'); await wait(page, 300) }
await drag(page, 'D', 20, 0)
await wait(page, 2500)
const before = await canvas(page)
console.log('after the drag: D', JSON.stringify(before.D), 'E', JSON.stringify(before.E), '· pins', pinsOf(await viewOf(page, 'f1s', 'v1')))
await openCard(page, 'X')
const t = await tidyAround(page)
await wait(page, 1500)
const after = await canvas(page)
const moved = diffPositions(before, after)
console.log(`Tidy around X${norow ? '' : ' (row A-B-C on the view)'} ·`, t.msg)
console.log('moved:', moved.map(([id, dx, dy]) => `${id} (${dx}, ${dy})`).join(', ') || 'nothing')
const wrong = moved.filter(([id]) => id === 'D' || id === 'E')
console.log(wrong.length ? `WRONG: D (pinned) and E have no relation with X, yet moved: ${wrong.map(([id, dx, dy]) => `${id} (${dx}, ${dy})`).join(', ')}` : 'ok: D and E stayed')
console.log('pins after:', pinsOf(await viewOf(page, 'f1s', 'v1')))
await dismissToasts(page)
await page.keyboard.press('Escape'); await wait(page, 300)
await page.screenshot({ path: join(here, `shots/f1-small${norow ? '-norow' : ''}.png`) })
if (s.problems.length) console.log('problems', s.problems)
await s.close()
