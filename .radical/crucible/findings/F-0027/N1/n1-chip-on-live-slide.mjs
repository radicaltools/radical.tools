// Neighbour of F-0015 (decided: an unlinked slide shows the live model, whatever milestone is open).
// Sample, Designer, System Context; open milestone v1; F5. The slide draws the live model,
// yet the chip over it says "Milestone: v1 – Core & Accounts" and offers diff and Propagate.
import { railTab, launch, openSample, go, settle, sleep, milestoneCard, DIR } from './lib.mjs'
const { browser, page, problems } = await launch()
const out = {}
const ids = () => page.locator('.react-flow__node').evaluateAll((els) => els.map((e) => e.dataset.id).sort())
const chipEl = () => page.locator('span', { hasText: /^Milestone:/ }).locator('xpath=..').first()
const chip = async () => (await chipEl().innerText({ timeout: 1000 }).catch(() => null))?.replace(/\s+/g, ' ')
try {
  const id = await openSample(page)
  await go(page, id, 'designer', 'view-ctx')
  const live = await ids()
  await railTab(page, 'Milestones')
  await (await milestoneCard(page, 'v1 – Core & Accounts')).click()
  await page.waitForURL(/\/s\//); await settle(page)
  const v1 = await ids()
  out.designer = { liveSystemContext: live.length, v1SystemContext: v1.length, chip: await chip() }
  await page.keyboard.press('F5'); await sleep(1500); await settle(page)
  const slide = await ids()
  out.playing = {
    url: decodeURIComponent(page.url().replace(/.*#/, '')),
    drawn: slide.length,
    sameAsLive: JSON.stringify(slide) === JSON.stringify(live),
    sameAsV1: JSON.stringify(slide) === JSON.stringify(v1),
    notInV1: slide.filter((x) => !v1.includes(x)),
    chip: await chip(),
  }
  await page.screenshot({ path: `${DIR}/shots/n1-playing.png` })
  // The chip's diff on the playing slide.
  const diff = chipEl().getByRole('button', { name: /diff/ }).first()
  if (await diff.count()) {
    await diff.click(); await sleep(800)
    out.afterDiff = { chip: await chip(), drawn: (await ids()).length, ghostIds: (await ids()).filter((x) => !live.includes(x)) }
    await page.screenshot({ path: `${DIR}/shots/n1-diff.png` })
  }
  out.bug = out.playing.sameAsLive && /v1/.test(out.playing.chip ?? '')
} finally { out.problems = problems; console.log(JSON.stringify(out, null, 1)); await browser.close() }
