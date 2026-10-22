// Propagate pressed while an F5 presentation plays a milestone slide
// propagates the slide's model: elements of v2, v3, v4 and the live model
// are deleted. Sample, All elements (table), Designer, milestone v2.
// node f2-propagate-while-playing.mjs
import { ensureSection, launch, openSample, go, stored, settle, sleep, milestoneCard, DIR } from './lib.mjs'
const { browser, page, problems } = await launch()
const out = {}
const how = process.argv[2] ?? 'modal'
const counts = (d) => ({ live: `${d.nodes.length} elements, ${d.relations.length} relations`, milestones: d.snapshots.map((m) => `${m.name.slice(0, 2)}: ${Object.keys(m.nodes).length}`).join(', ') })
try {
  const id = await openSample(page)
  await go(page, id, 'designer', 'canvas')
  await sleep(2000)
  await ensureSection(page, 'Milestones', '.lp-snap-card')
  await (await milestoneCard(page, 'v2 – Payments & Events')).click()
  await page.waitForURL(/\/s\//); await settle(page)
  out.before = counts(await stored(page, id))
  // 1. An edit of v2: a component added under API Gateway.
  await page.getByRole('button', { name: 'Add under API Gateway' }).click()
  await page.locator('.milestone-modal').waitFor()
  if (how === 'chip') {
    await page.locator('.milestone-modal').getByRole('button', { name: 'Continue editing (decide later)' }).click()
    await page.keyboard.press('Escape')
    await page.evaluate(() => document.activeElement?.blur())
  }
  // 2. F5, then to the last slide, "12 – v1 MVP (Milestone)".
  await page.keyboard.press('F5'); await sleep(1500)
  for (let i = 0; i < Number(process.env.SLIDE ?? 12) - 1; i++) { await page.keyboard.press('ArrowRight'); await sleep(250) }
  await sleep(1000)
  out.playing = decodeURIComponent(page.url().replace(/.*#/, ''))
  out.chipWhilePlaying = await page.locator('.milestone-chip').first().textContent().catch(() => null)
  await page.screenshot({ path: `${DIR}/shots/f2-playing.png` })
  // 3. Propagate.
  if (how === 'chip') await page.locator('.milestone-chip').getByRole('button', { name: 'Propagate' }).click()
  else await page.locator('.milestone-modal').getByText('Propagate to later milestones', { exact: true }).click()
  await sleep(1000)
  // 4. Esc ends the presentation.
  await page.keyboard.press('Escape'); await sleep(4000)
  out.after = counts(await stored(page, id))
  out.canvasSays = await page.locator('input[placeholder^="Search"]').getAttribute('placeholder').catch(() => null)
  await page.screenshot({ path: `${DIR}/shots/f2-after.png` })
  // 5. Fresh look: the live model.
  await ensureSection(page, 'Milestones', '.lp-snap-card')
  await page.locator('.lp-snap-current').click(); await sleep(1500)
  out.liveCanvasSays = await page.locator('input[placeholder^="Search"]').getAttribute('placeholder').catch(() => null)
  out.undoEnabled = await page.getByRole('button', { name: 'Undo', exact: true }).isEnabled().catch(() => 'n/a')
} finally { out.problems = problems; console.log(JSON.stringify(out, null, 1)); await browser.close() }
