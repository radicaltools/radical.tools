// Sample, Designer, the view Payment Process (15 elements picked by hand, laid out).
// Its properties → Viewpoint → "State machine · Structure", a viewpoint that makes a view per element.
// What does the canvas show, what is saved, and what does a reload show?
// Args: [port=4583]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4583)
const VID = 'view-payment-process', NAME = 'Payment Process'
const { browser, page, problems } = await L.launch({ port, width: 1280, height: 720 })
page.setDefaultTimeout(15000)
const shownView = () => decodeURIComponent(page.url()).replace(/.*\/v\//, '')
try {
  const id = await L.openSample(page)
  await L.open(page, id, VID, 'designer'); await L.wait(page, 2500)
  const d0 = await L.stored(page, id)
  const v0 = d0.views.find((v) => v.id === VID)
  console.log(`before: ${NAME} lists ${v0.nodeIds.length} elements, ${Object.keys(v0.positions).length} positions; ${await page.locator('.react-flow__node').count()} drawn; views named "Payment lifecycle": ${d0.views.filter((v) => v.name === 'Payment lifecycle').length}`)
  await L.tab(page, 'Views')
  const card = page.locator('.lp-view-card', { hasText: NAME }).first()
  await card.hover(); await card.getByTitle('View properties').click()
  await page.getByRole('combobox', { name: 'Viewpoint' }).selectOption({ label: 'State machine · Structure' })
  await L.settle(page); await L.wait(page, 3000)
  const d1 = await L.stored(page, id)
  const g = d1.views.find((v) => v.id === VID)
  const members = d1.views.filter((v) => v.partOf === VID)
  const parentOf = Object.fromEntries(d1.nodes.map((n) => [n.id, n.parentId ?? null]))
  const f1 = await L.frames(page)
  console.log(`after: no question asked: ${!(await page.locator('.milestone-modal, [role=alertdialog]').count())}`)
  console.log(`  the canvas shown is ${shownView()} (the group itself: ${shownView() === VID})`)
  console.log(`  drawn ${Object.keys(f1).length} elements, overlapping siblings ${L.overlaps(f1, parentOf).length}`)
  console.log(`  saved: ${NAME} lists ${g.nodeIds.length} elements (was ${v0.nodeIds.length}), keeps ${Object.keys(g.positions ?? {}).length} positions, members: ${members.map((m) => m.name).join(', ')}`)
  console.log(`  views named "Payment lifecycle": ${d1.views.filter((v) => v.name === 'Payment lifecycle').length}`)
  await L.shot(page, 'f2-group-as-canvas')
  await page.reload(); await page.locator('.app-layout').waitFor(); await L.settle(page); await L.wait(page, 1500)
  console.log(`after a reload: the canvas shown is ${shownView()}, drawn ${await page.locator('.react-flow__node').count()} (before the reload ${Object.keys(f1).length})`)
} finally { if (problems.length) console.log(problems.slice(0, 5)); await browser.close() }
