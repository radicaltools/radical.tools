// Smart Layout run again on the layout it just made keeps moving elements, three runs in a row.
// The former Hub blueprint bp-saas-b2b-platform (packages/layout/bench/models), with one more
// view "Big" that lists all its 42 elements; Designer, 1280×720.
// node f2-tidy-again.mjs <port> [blueprint file name] [runs]
import { launch, seedDoc, open, frames, diff, wait, out, smartLayout, toast, shot } from './lib.mjs'
import { bigDoc } from './mkdoc.mjs'
const port = +(process.argv[2] || 4585)
const name = process.argv[3] || 'bp-saas-b2b-platform'
const runs = +(process.argv[4] || 4)
const { browser, context, page, problems } = await launch({ port })
const res = []
try {
  const id = await seedDoc(context, bigDoc(`packages/layout/bench/models/blueprint/${name}.radical`))
  await open(page, id, 'big')
  await wait(page, 2500)
  for (let i = 0; i < runs; i++) {
    const a = await frames(page)
    const r = await smartLayout(page)
    const notice = (await toast(page)).split('\n').filter((l) => /^Smart layout/.test(l)).pop()
    const moved = diff(a, await frames(page), 1)
    res.push({ run: i + 1, ms: r.ms, elementsMoved: Object.keys(moved).length, notice })
    if (i === 1) await shot(page, 'f2-second-run')
    await wait(page, 5500) // let the notice go
  }
  out({ model: name, elements: Object.keys(await frames(page)).length, res, problems })
} finally { await browser.close() }
