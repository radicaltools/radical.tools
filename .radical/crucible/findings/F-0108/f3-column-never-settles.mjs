// With a column set on a view, Smart Layout never settles: every run says "3 moves." and moves nothing.
// The "Studio" view of the repository's own architecture model (f3-studio-view.radical: its 36 elements,
// made from a copy of architecture/). A column of five Studio components, then Smart Layout five times.
// node f3-column-never-settles.mjs <port> [doc] [runs] [--nocolumn]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { here, launch, seed, open, smartLayout, canvas, diffPositions, violations, align, wait, viewOf, alignsOf, spread, dismissToasts } from './lib2.mjs'
const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const [port, file = join(here, 'f3-studio-view.radical'), runs = '5'] = pos
const doc = JSON.parse(readFileSync(file, 'utf8'))
const V = doc.views.find((v) => v.name === 'Studio').id
const full = (p) => doc.nodes.find((n) => n.id.startsWith(p)).id
const label = (id) => doc.nodes.find((n) => n.id === id)?.label
const COLUMN = ['15700a5d', '44fbd164', '67e8199c', '8c78dee7', 'cb6a98d3'].map(full)
const parentOf = Object.fromEntries(doc.nodes.map((n) => [n.id, n.parentId]))
const s = await launch(port)
const { page } = s
await seed(page, 'f3', doc)
await open(page, 'f3', V)
const nocol = process.argv.includes('--nocolumn')
if (!nocol) { await align(page, COLUMN, 'column'); await page.keyboard.press('Escape'); await wait(page, 300) }
console.log('column:', COLUMN.map(label).join(', '), '·', JSON.stringify(alignsOf(await viewOf(page, 'f3', V)).map((a) => [a.type, a.axis, a.nodeIds.length])))
async function why() {
  await dismissToasts(page)
  await page.locator('button[title^="Why this layout?"]').click()
  await wait(page, 400)
  const t = await page.getByRole('dialog', { name: 'Smart Layout report' }).innerText()
  await page.keyboard.press('Escape'); await wait(page, 300)
  return t.split('\n').filter((l) => /^\d+\t/.test(l))
}
let prev = await canvas(page)
for (let i = 1; i <= +runs; i++) {
  const r = await smartLayout(page, 400000)
  const c = await canvas(page)
  const d = diffPositions(prev, c)
  console.log(`run ${i}: ${r.msg} · ${d.length} of ${Object.keys(c).length} moved · overlaps/outside ${violations(c, parentOf).length} · column spread x ${spread(c, COLUMN, 'x').toFixed(1)}`)
  if (i >= 3 && !/nothing left/.test(r.msg)) {
    console.log('  its moves: ' + (await why()).join(' / '))
    await page.screenshot({ path: join(here, 'shots/f3-run' + i + '.png') })
  }
  prev = c
}
if (s.problems.length) console.log('problems', s.problems)
await s.close()
