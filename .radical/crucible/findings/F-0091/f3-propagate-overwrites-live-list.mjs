// Sample, Designer, Core Banking: delete Fraud Detection (Remove from model), so v3 keeps its own copy of
// Core Banking's element list. Still on the current model, drag a Software System from the palette onto
// Core Banking ("System", listed in the view). Open v3, double-click
// Transactions DB, Actions › Hide from view, Propagate. Back on Current (live): Core Banking no longer
// draws the new System (still in the model) and its saved list names the deleted Fraud Detection again:
// the milestone's copy of the list replaced the live view's.
// Args: [port=4593]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4593)
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-core', 'designer')
  await L.removeFromModel(page, 'ctn-fraud')
  const before = await L.ids(page)
  const pane = await page.locator('.react-flow__pane').boundingBox()
  await page.locator('.palette-item', { hasText: /^Software System$/ }).first().dragTo(page.locator('.react-flow__pane'), { targetPosition: { x: pane.width - 120, y: 60 }, force: true })
  await L.wait(page, 800)
  await page.keyboard.press('Escape').catch(() => {})
  await L.settle(page); await L.wait(page, 2500)
  const added = (await L.ids(page)).filter((x) => !before.includes(x))
  let d = await L.stored(page, id)
  const nid = added[0]
  console.log('live before v3: added', added, 'label', (d.nodes.find?.((n) => n.id === nid) ?? d.nodes[nid])?.label, 'listed live', d.views.find((v) => v.id === 'view-core').nodeIds.includes(nid))
  await L.milestone(page, 'v3')
  await L.node(page, 'ctn-db-tx').dblclick({ position: { x: 14, y: 8 } })
  await page.getByRole('region', { name: 'Actions' }).getByRole('button', { name: 'Hide from view' }).click()
  await page.locator('.milestone-modal').waitFor()
  await page.locator('.milestone-option', { hasText: 'Propagate' }).click()
  await L.settle(page); await L.wait(page, 1500)
  await L.milestone(page, 'live'); await L.wait(page, 2500)
  const ids = await L.ids(page)
  d = await L.stored(page, id)
  const core = d.views.find((v) => v.id === 'view-core')
  console.log('live Core Banking after Propagate: new system drawn', ids.includes(nid), '| Transactions DB drawn', ids.includes('ctn-db-tx'),  '| saved list has new system', core.nodeIds.includes(nid), 'has deleted Fraud Detection', core.nodeIds.includes('ctn-fraud'), '| model has new system', !!(d.nodes.find?.((n) => n.id === nid) ?? d.nodes[nid]))
  await L.tab(page, 'Views')
  console.log('card:', (await page.locator('.lp-view-card').filter({ hasText: 'Core Banking' }).first().innerText()).replace(/\s+/g, ' '))
  await L.shot(page, 'f3-live-after-propagate')
} finally { console.log('problems', problems); await browser.close() }
