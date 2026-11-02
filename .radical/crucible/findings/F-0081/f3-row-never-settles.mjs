// F3: a generated pile of 300 elements (systems with containers and
// databases, people, ADRs) with one row alignment of five top-level
// elements on its canvas. Smart Layout sketches and tidies it; every further
// Smart Layout then finds dozens of moves again and shifts the whole canvas,
// where the same pile without the row settles after the first run.
//   node f3-row-never-settles.mjs <studio port> [elements] [runs]
import { launch, seed, open, smartLayout, canvas, diffPositions, shot } from './lib.mjs'
import { generate } from './gen.mjs'
const [port = '4586', n = '300', runs = '4'] = process.argv.slice(2)

async function series(withRow) {
  const s = await launch(port)
  const { page } = s
  const ID = withRow ? 'run186-row' : 'run186-norow'
  const out = []
  try {
    const doc = generate(Number(n), 'pile')
    if (withRow) doc.views[0].layoutConstraints = [{ id: 'row1', type: 'align', axis: 'horizontal', nodeIds: ['adr0', 'sys3', 'person6', 'adr10', 'sys15'] }]
    await seed(page, ID, doc)
    await open(page, ID, 'v-all')
    await page.waitForTimeout(2000)
    let prev = await canvas(page)
    for (let k = 1; k <= Number(runs); k++) {
      const r = await smartLayout(page, 180000)
      const c = await canvas(page)
      const moved = diffPositions(prev, c)
      // What moved other than the shift most of the canvas took together.
      const shifts = {}
      for (const [, dx, dy] of moved) shifts[`${dx},${dy}`] = (shifts[`${dx},${dy}`] ?? 0) + 1
      const [common, count] = Object.entries(shifts).sort((a, b) => b[1] - a[1])[0] ?? ['0,0', 0]
      out.push(`run ${k}: ${(r.msg ?? '').replace(/^Notice/, '').slice(0, 110)} | ${moved.length} of ${Object.keys(c).length} moved (${count} by ${common}, ${moved.length - count} otherwise)`)
      prev = c
    }
    if (withRow) await page.screenshot({ path: shot('f3-row.png') })
    if (s.problems.length) out.push(`problems ${s.problems.join('; ')}`)
  } finally { await s.close() }
  return out
}

const without = await series(false)
console.log(`Without the row:\n  ${without.join('\n  ')}`)
const withRow = await series(true)
console.log(`With a row of five top-level elements:\n  ${withRow.join('\n  ')}`)
const unsettled = withRow.slice(1).filter((l) => !/nothing left to tidy/.test(l)).length
console.log(unsettled ? `BROKEN: ${unsettled} of ${withRow.length - 1} later runs still moved the canvas` : 'settled')
