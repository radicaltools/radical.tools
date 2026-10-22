// Undo in Designer re-links a slide that Presenter set to the live model. Sample, All elements.
// Designer edit; Presenter: slide 12 (linked to v1) set to the live model; Designer Ctrl+Z.
import { launch, openSample, go, stored, waitStored, settle, sleep, DIR } from './lib.mjs'
const { browser, page, problems } = await launch()
const out = {}
const links = (d) => d.presentations.flatMap((p) => p.slides.filter((s) => s.snapshotId).map((s) => `${s.name}→${s.snapshotId}`))
try {
  const id = await openSample(page)
  await go(page, id, 'designer', 'canvas')
  await page.getByRole('button', { name: 'Add under API Gateway' }).click()
  await page.locator('input.tv-cell-input').waitFor()
  await page.keyboard.press('Meta+A'); await page.keyboard.type('Live1'); await page.keyboard.press('Enter')
  let d = await waitStored(page, id, (d) => d.nodes.some((n) => n.label === 'Live1'))
  out.before = links(d)
  await page.locator('.toolbar-mode-btn', { hasText: 'Presenter' }).click(); await sleep(1500); await settle(page)
  const card = page.locator('.pres-slide-card', { hasText: '12 – v1 MVP' })
  await card.locator('.pres-slide-name').click(); await sleep(800)
  await card.hover(); await card.getByTitle('Link milestone').click(); await sleep(400)
  out.pickerItems = await page.locator('.pres-snap-item').allTextContents()
  await page.screenshot({ path: `${DIR}/shots/x-unlink-picker.png` })
  const live = page.locator('.pres-snap-item').filter({ hasText: /live|none|current/i }).first()
  await live.click(); await sleep(1500)
  d = await waitStored(page, id, (d) => links(d).length < out.before.length)
  out.unlinked = links(d)
  await page.locator('.toolbar-mode-btn', { hasText: 'Designer' }).click(); await sleep(1500); await settle(page)
  await page.evaluate(() => document.activeElement?.blur())
  await page.keyboard.press('Control+z')
  d = await waitStored(page, id, (d) => !d.nodes.some((n) => n.label === 'Live1'))
  await sleep(1500); d = await stored(page, id)
  out.afterUndo = { live1: d.nodes.some((n) => n.label === 'Live1'), links: links(d) }
  await page.locator('.toolbar-mode-btn', { hasText: 'Presenter' }).click(); await sleep(1500)
  await page.screenshot({ path: `${DIR}/shots/f4-after-undo.png` })
} finally { out.problems = problems; console.log(JSON.stringify(out, null, 1)); await browser.close() }
