// Sample, Designer on Payment lifecycle (a view of the State machines group, a view per state machine).
// + New milestone "M" saves the live model, which holds the Payment lifecycle state machine. Then the
// state machine is deleted from the live model (Delete, Remove from model): its view goes, as the manual
// says. Opened, milestone M still holds the state machine and its 9 elements, but the State machines
// group shows only Fraud case lifecycle: the milestone has no view of Payment lifecycle any more.
// Args: [port=4591]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4591)
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
const SM = '789719df-db16-4f7d-95cd-c9c244fbd575'
const groupViews = async (id) => (await L.stored(page, id)).views.filter((v) => v.partOf === 'view-state-machines').map((v) => v.name)
const cards = async () => { await L.tab(page, 'Views'); return (await L.viewCards(page)).filter((s) => /lifecycle\d|State machines\d/.test(s)) }
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-payment-lifecycle', 'designer')
  console.log(`live Payment lifecycle drawn: ${(await L.ids(page)).length}; group views: ${JSON.stringify(await groupViews(id))}`)
  await L.tab(page, 'Milestones')
  await page.getByRole('button', { name: 'New milestone' }).click()
  const nameBox = page.getByPlaceholder('Milestone name…')
  await nameBox.press('ControlOrMeta+a'); await nameBox.press('Backspace')
  await nameBox.pressSequentially('M')
  await page.keyboard.press('Enter')
  await L.wait(page, 1500)
  await L.node(page, SM).click({ position: { x: 14, y: 8 } })
  await page.keyboard.press('Delete')
  await page.locator('.milestone-modal').waitFor()
  await page.getByRole('button', { name: /Remove from model/ }).click()
  await L.settle(page); await L.wait(page, 2500)
  console.log(`live after the delete, group views: ${JSON.stringify(await groupViews(id))}`)
  const doc = await L.stored(page, id)
  const m = doc.snapshots.find((s) => s.name.trim() === 'M') ?? doc.snapshots.at(-1)
  const held = Object.values(m.nodes).filter((n) => n.id === SM || n.parentId === SM).length
  console.log(`milestone M in the saved document holds the state machine: ${!!m.nodes[SM]} (${held} elements with its children; name ${JSON.stringify(m.name)}); M.views: ${JSON.stringify(Object.keys(m.views ?? {}))}`)
  await L.tab(page, 'Milestones')
  await page.locator('.lp-snap-card').filter({ has: page.getByText('M', { exact: true }) }).click()
  await L.settle(page)
  console.log(`in M: url ${page.url().split('/m/')[1]}, chip: ${await page.locator('.milestone-chip, [class*=chip]').first().textContent().catch(() => '?')}`)
  console.log(`in M, view cards: ${JSON.stringify(await cards())}`)
  await L.shot(page, 'f1-in-milestone')
  const r = await page.goto(`${page.url().replace(/\/v\/[^/]+/, '/v/view-payment-lifecycle')}`)
  await L.wait(page, 1500); await L.settle(page)
  console.log(`in M, deep link to view-payment-lifecycle: url ${page.url().split('/m/')[1]}, drawn ${(await L.ids(page)).length}`)
} finally { console.log('problems', problems); await browser.close() }
