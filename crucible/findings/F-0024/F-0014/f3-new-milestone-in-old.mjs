// "+ New milestone" while milestone v1 is shown files v1's model (11
// elements) as the newest milestone, after v4 (65), while the live model
// has 78. Sample, System Context, Designer.
import { ensureSection, launch, openSample, go, stored, waitStored, settle, sleep, milestoneCard, DIR } from './lib.mjs'
const { browser, page, problems } = await launch()
const out = {}
try {
  const id = await openSample(page)
  await go(page, id, 'designer', 'view-ctx')
  await ensureSection(page, 'Milestones', '.lp-snap-card')
  await (await milestoneCard(page, 'v1 – Core & Accounts')).click()
  await page.waitForURL(/\/s\//); await settle(page)
  await page.getByRole('button', { name: 'New milestone' }).click()
  const inp = page.getByPlaceholder('Milestone name…')
  out.defaultName = await inp.inputValue()
  await inp.press('Enter')
  const d = await waitStored(page, id, (d) => (d.snapshots ?? []).length === 5)
  out.milestones = d.snapshots.map((m) => `${m.name}: ${Object.keys(m.nodes).length} elements`)
  out.live = `${d.nodes.length} elements`
  out.shown = decodeURIComponent(page.url().replace(/.*#/, ''))
  // The newest milestone with its diff against v4.
  await (await milestoneCard(page, out.defaultName)).click(); await sleep(1500); await settle(page)
  await page.getByRole('button', { name: '⊙ diff' }).first().click(); await sleep(800)
  out.diffChip = (await page.getByRole('button', { name: /diff on/ }).first().locator('xpath=..').textContent()).replace(/\s+/g, ' ')
  await page.screenshot({ path: `${DIR}/shots/f3.png` })
} finally { out.problems = problems; console.log(JSON.stringify(out, null, 1)); await browser.close() }
