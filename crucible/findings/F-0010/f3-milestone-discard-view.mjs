// F3: a concern pack imported while a milestone is shown, then Discard: the
// pack's elements go, its view stays in the live model, listing 22 elements
// that no longer exist. It was even saved into the live document before the
// choice was made.
// node f3-milestone-discard-view.mjs   (Studio on 4572, Hub on 4672)
import { launch, APP, stored, addPack, settle, DIR } from './lib.mjs'

const { browser, page, errors, outside } = await launch()
let bug = false
const concernViews = (d) => d.views.filter((v) => v.folder === 'Concerns')
try {
  await page.goto(APP + '/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: /Sample model/ }).click()
  await page.waitForURL(/#\/d\/[^/]+\/m\/.*\/v\/view-ctx$/)
  const docId = decodeURIComponent(page.url().match(/#\/d\/([^/]+)/)[1]).replace(/^ls:/, '')
  await page.goto(`${APP}/#/d/${encodeURIComponent('ls:' + docId)}/m/designer/v/view-core`)
  await page.locator('.app-layout').waitFor(); await settle(page)
  await page.waitForTimeout(1500)
  const d0 = await stored(page, docId)
  console.log(`live before: ${d0.nodes.length} elements, ${d0.views.length} views`)
  await page.getByRole('tab', { name: 'Milestones' }).click()
  await page.locator('.lp-snap-card', { hasText: 'v3' }).first().click()
  await page.waitForURL(/\/s\//); await settle(page)
  const wizard = await addPack(page, 'Secrets')
  await wizard.getByRole('button', { name: 'Add to model' }).first().click()
  await page.locator('.milestone-modal').getByRole('button', { name: 'Continue editing (decide later)' }).click()
  await page.waitForTimeout(1500)
  const dm = await stored(page, docId)
  console.log(`saved while the milestone edit is undecided: ${dm.nodes.length} elements, ${dm.views.length} views (${concernViews(dm).map((v) => v.name).join(', ')})`)
  await page.getByRole('button', { name: 'Discard', exact: true }).first().click()
  await page.waitForTimeout(2500)
  const d1 = await stored(page, docId)
  const ids = new Set(d1.nodes.map((n) => n.id))
  console.log(`live after Discard: ${d1.nodes.length} elements, ${d1.views.length} views`)
  for (const v of concernViews(d1)) console.log(`  view "${v.name}" lists ${v.nodeIds.length} elements, ${v.nodeIds.filter((id) => !ids.has(id)).length} of them not in the model`)
  await page.getByRole('tab', { name: 'Views' }).click()
  const card = page.locator('.lp-view-card', { hasText: 'Secrets' })
  console.log('view card:', (await card.allInnerTexts()).map((t) => t.replace(/\n/g, ' ')))
  await card.first().scrollIntoViewIfNeeded().catch(() => {})
  await page.screenshot({ path: DIR + 'shots/f3.png' })
  bug = d1.views.length !== d0.views.length
  console.log('errors', errors, 'outside', outside)
} finally { await browser.close() }
console.log(bug ? 'REPRODUCED' : 'not reproduced')
process.exit(bug ? 1 : 0)
