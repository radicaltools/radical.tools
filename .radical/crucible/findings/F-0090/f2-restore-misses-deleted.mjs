// Sample, Designer, Core Banking: delete Fraud Detection (Remove from model). Milestone v3 holds it and
// still draws it on Core Banking (14 elements). Milestones: Milestone properties of v3, Restore to live.
// The live model has Fraud Detection again (30 elements, as v3), but Core Banking draws 13 without it,
// and no view lists it; v3 itself still draws it on Core Banking.
// Args: [port=4593]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4593)
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-core', 'designer')
  console.log('start drawn', (await L.ids(page)).length)
  await L.removeFromModel(page, 'ctn-fraud')
  console.log('after delete drawn', (await L.ids(page)).length)
  await L.milestone(page, 'v3')
  console.log('v3 drawn', (await L.ids(page)).length, (await L.ids(page)).includes('ctn-fraud'))
  await L.milestone(page, 'live')
  await L.milestoneProps(page, 'v3')
  await page.getByRole('button', { name: /Restore to live/ }).click()
  await L.settle(page); await L.wait(page, 2500)
  const ids = await L.ids(page)
  const d = await L.stored(page, id)
  console.log('after restore: model has fraud', !!(d.nodes.find?.((n) => n.id === 'ctn-fraud') ?? d.nodes['ctn-fraud']), 'count', (d.nodes.length ?? Object.keys(d.nodes).length),
    '| Core Banking drawn', ids.length, 'fraud drawn', ids.includes('ctn-fraud'), '| view-core lists', d.views.find((v) => v.id === 'view-core').nodeIds.includes('ctn-fraud'))
  console.log('views listing fraud', d.views.filter((v) => v.nodeIds.includes('ctn-fraud')).map((v) => v.name), 'v3 own copies', Object.keys(d.snapshots[2].views ?? {}))
  await L.shot(page, 'f2-after-restore')
  await L.milestone(page, 'v3')
  console.log('v3 again drawn', (await L.ids(page)).length, (await L.ids(page)).includes('ctn-fraud'))
} finally { console.log('problems', problems); await browser.close() }
