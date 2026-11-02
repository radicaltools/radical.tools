// Sample, Designer, Core Banking: delete Fraud Detection (Remove from model). Milestones v3 and v4 hold it,
// so they keep their own copy of Core Banking's element list. Then, on the current model, fold Access &
// Security and set the view's Lines to Orthogonal. v1 and v2 show both; v3 and v4 show neither.
// Second part: open v3, fold Risk & Data there and Propagate: v3, the current model, v1 and v2 show it
// folded; v4, a later milestone, does not.
// Args: [port=4593]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4593)
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
const pathKinds = () => page.locator('.react-flow__edge-path').evaluateAll((els) => { let c = 0, s = 0; for (const e of els) (/C/.test(e.getAttribute('d')) ? c++ : s++); return `${s} straight / ${c} curved lines` })
const state = async () => { const ids = await L.ids(page); return `Access & Security ${ids.includes('ctn-apigw') ? 'open' : 'FOLDED'}, Risk & Data ${ids.includes('ctn-db-acc') ? 'open' : 'FOLDED'}, ${await pathKinds()}` }
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-core', 'designer')
  await L.removeFromModel(page, 'ctn-fraud')
  await L.node(page, 'dom-access').locator('.c4-node-collapse-btn').first().click()
  await L.settle(page)
  await L.tab(page, 'Views')
  const card = page.locator('.lp-view-card').filter({ hasText: 'Core Banking' }).first()
  await card.hover(); await card.getByTitle('View properties').click()
  await page.getByLabel('Lines').selectOption('orthogonal')
  await L.wait(page, 500); await page.locator('.left-panel .rp-back-btn').click()
  await L.settle(page); await L.wait(page, 2000)
  console.log('Part 1: folded and orthogonal on the current model')
  console.log(`  current: ${await state()}`)
  for (const m of ['v1', 'v2', 'v3', 'v4']) { await L.milestone(page, m); console.log(`  ${m}: ${await state()}`); if (m === 'v4') await L.shot(page, 'f1-v4-not-folded') }
  console.log('Part 2: in v3, fold Risk & Data, Propagate')
  await L.milestone(page, 'v3')
  await L.node(page, 'dom-risk').locator('.c4-node-collapse-btn').first().click()
  await page.locator('.milestone-modal').waitFor()
  await page.locator('.milestone-option', { hasText: 'Propagate' }).click()
  await L.settle(page); await L.wait(page, 1500)
  await L.milestone(page, 'live'); await L.wait(page, 1500)
  console.log(`  current: ${await state()}`)
  for (const m of ['v1', 'v2', 'v3', 'v4']) { await L.milestone(page, m); console.log(`  ${m}: ${await state()}`) }
  const d = await L.stored(page, id)
  console.log('saved Core Banking:', JSON.stringify({ current: [d.views.find((v) => v.id === 'view-core').collapsedNodeIds, d.views.find((v) => v.id === 'view-core').edgeStyle], ...Object.fromEntries(d.snapshots.map((s) => [s.name.slice(0, 2), s.views?.['view-core'] ? [s.views['view-core'].collapsedNodeIds, s.views['view-core'].edgeStyle ?? 'model'] : 'shared'])) }))
} finally { console.log('problems', problems); await browser.close() }
