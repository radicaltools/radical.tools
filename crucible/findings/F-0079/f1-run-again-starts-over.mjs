// F1: on a canvas of the whole sample (283 elements) Smart Layout stops at
// its 10 s budget and says "run it again for more"; the second run starts
// over from the same rough sketch, says the same number of moves again and
// moves (almost) nothing. The manual: "another run continues".
//   node f1-run-again-starts-over.mjs <studio port>
import { launch, openSample, stored, open, smartLayout, canvas, diffPositions, shot } from './lib.mjs'
const [port = '4586'] = process.argv.slice(2)
const s = await launch(port)
const { page } = s
async function why() {
  const button = page.getByTitle(/^Why this layout\?/)
  await button.first().click()
  await page.waitForTimeout(300)
  const rows = await page.locator('.smart-layout-report-table:not(.smart-layout-report-parts) tbody tr').allInnerTexts()
  await button.first().click().catch(() => {})
  return rows.map((r) => r.replace(/\s+/g, ' '))
}
try {
  // The sample on a canvas of the whole model (its All elements is a table).
  const id = await openSample(page)
  await page.waitForTimeout(2500)
  const d = await stored(page, id)
  d.views.push({ id: 'v-whole', name: 'Whole model', kind: 'static', nodeIds: [], positions: {} })
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`radical-doc:${id}`, JSON.stringify(d)])
  await page.reload()
  await open(page, id, 'v-whole')
  await page.waitForTimeout(2000)
  const c0 = await canvas(page)
  const r1 = await smartLayout(page, 180000)
  const c1 = await canvas(page)
  const w1 = await why()
  console.log('run 1:', r1.msg?.replace(/^Notice/, ''), `| ${diffPositions(c0, c1).length} of ${Object.keys(c0).length} moved | first move: ${w1[0]}`)
  const r2 = await smartLayout(page, 180000)
  const c2 = await canvas(page)
  const w2 = await why()
  await page.screenshot({ path: shot('f1-run2.png') })
  const moved2 = diffPositions(c1, c2)
  console.log('run 2:', r2.msg?.replace(/^Notice/, ''), `| ${moved2.length} of ${Object.keys(c1).length} moved ${JSON.stringify(moved2.slice(0, 3))} | first move: ${w2[0]}`)
  const startedOver = /rough layout first/i.test(w2[0] ?? '')
  console.log(startedOver ? 'BROKEN: the second run started over from a rough sketch instead of continuing' : 'the second run continued from the first')
  if (s.problems.length) console.log('problems', s.problems)
} finally { await s.close() }
