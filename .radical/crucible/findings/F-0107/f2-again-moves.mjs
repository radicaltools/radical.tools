// Smart Layout run a second time on its own layout makes dozens of moves again (no budget cut).
// The repository's own architecture model, view "Forge run lifecycle" (a state machine), as a .radical document
// made from a copy of architecture/ (folder.mts from).
// node f2-again-moves.mjs <port> [doc.json] [viewName]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { here, launch, seed, open, smartLayout, canvas, diffPositions, wait, dismissToasts } from './lib2.mjs'
const args = process.argv.slice(2)
const [port, file = join(here, 'f2-forge-run-lifecycle.radical'), vname = 'Forge run lifecycle'] = args
const doc = JSON.parse(readFileSync(file, 'utf8'))
const V = doc.views.find((v) => v.name === vname).id
const label = (id) => doc.nodes.find((n) => n.id === id)?.label
const s = await launch(port)
const { page } = s
await seed(page, 'f2', doc)
await open(page, 'f2', V)
let prev = await canvas(page)
console.log(`view "${vname}": ${Object.keys(prev).length} elements drawn`)
async function why() {
  await dismissToasts(page)
  await page.locator('button[title^="Why this layout?"]').click()
  await wait(page, 400)
  const t = await page.getByRole('dialog', { name: 'Smart Layout report' }).innerText()
  await page.keyboard.press('Escape'); await wait(page, 300)
  return t
}
for (let i = 1; i <= 3; i++) {
  const r = await smartLayout(page)
  const c = await canvas(page)
  const d = diffPositions(prev, c)
  console.log(`run ${i}: ${r.msg} · ${d.length} of ${Object.keys(c).length} elements moved`)
  if (i === 2 && !/nothing left/.test(r.msg)) {
    const t = await why()
    const moves = t.split('\n').filter((l) => /^\d+\t/.test(l))
    console.log('  run 2 moves (first 12):\n   ' + moves.slice(0, 12).join('\n   '))
    console.log('  moved:', d.slice(0, 8).map(([id, dx, dy]) => `${label(id)} (${dx}, ${dy})`).join(', '))
    await page.screenshot({ path: join(here, 'shots/f2-run2.png') })
  }
  prev = c
}
if (s.problems.length) console.log('problems', s.problems)
await s.close()
