// F1: a concern pack bound to an element inside a container: its view in
// Concerns loses its column layout the first time it is opened, and the
// container the manual says stands on the left is not drawn.
// node f1-pack-view-relaid.mjs   (Studio on 4572, Hub on 4672)
import { launch, seed, open, stored, waitFor, addPack, canvasNodes, openViewCard, fixture, RADICAL_MM, settle, DIR } from './lib.mjs'

const { browser, page, errors, outside } = await launch()
let bug = false
try {
  const doc = JSON.parse(fixture('bookstore'))
  doc.metamodel = RADICAL_MM
  await seed(page, doc)
  await open(page, 'v-containers')
  const before = await stored(page)
  const wizard = await addPack(page, 'Authentication')
  const checked = await wizard.getByRole('group', { name: 'Bind to' }).getByRole('checkbox', { checked: true }).allInnerTexts()
  console.log('bound to (suggested):', checked.map((t) => t.split('\n')[0]))
  await wizard.getByRole('button', { name: 'Add to model' }).first().click()
  await wizard.waitFor({ state: 'hidden' })
  await waitFor(async () => (await stored(page)).nodes.length > before.nodes.length)
  await page.waitForTimeout(2000)
  const d1 = await stored(page)
  const v1 = d1.views.find((v) => v.folder === 'Concerns')
  const label = Object.fromEntries(d1.nodes.map((n) => [n.id, n.label]))
  console.log(`pack view "${v1.name}": ${v1.nodeIds.length} nodeIds, positions for ${Object.keys(v1.positions).length}`)
  console.log('  listed without a position:', v1.nodeIds.filter((id) => !v1.positions[id]).map((id) => label[id]))
  console.log('  positioned but not listed:', Object.keys(v1.positions).filter((id) => !v1.nodeIds.includes(id)).map((id) => label[id]))
  await openViewCard(page, v1.name)
  await page.waitForTimeout(4000)
  await settle(page)
  const d2 = await stored(page)
  const v2 = d2.views.find((v) => v.id === v1.id)
  const pack = v1.nodeIds.filter((id) => v1.positions[id])
  const moved = pack.filter((id) => v2.positions[id] && Math.hypot(v2.positions[id].x - v1.positions[id].x, v2.positions[id].y - v1.positions[id].y) > 1)
  const dist = moved.map((id) => Math.round(Math.hypot(v2.positions[id].x - v1.positions[id].x, v2.positions[id].y - v1.positions[id].y)))
  console.log(`opening the view moved ${moved.length} of ${pack.length} pack elements (by ${Math.min(...dist)}..${Math.max(...dist)} px)`)
  const drawn = await canvasNodes(page)
  const container = d1.nodes.find((n) => n.id === 'bookstore')
  console.log('drawn:', drawn.length, 'elements; Bookstore drawn:', drawn.some((n) => n.id === 'bookstore'))
  await page.screenshot({ path: DIR + 'shots/f1.png' })
  bug = moved.length > 0 || !drawn.some((n) => n.id === 'bookstore')
  console.log('errors', errors, 'outside', outside)
} finally { await browser.close() }
console.log(bug ? 'REPRODUCED' : 'not reproduced')
process.exit(bug ? 1 : 0)
