// Sample, Designer on Payment Flow (a flow view that plays the sequence Payment Processing, 7 steps).
// + New milestone "M" saves the live model with its sequences. Then Payment Processing is deleted from
// the live model (Sequences tab, the card, Delete sequence). Milestone M still holds the sequence with
// its 7 steps, but Payment Flow opened in M says "No sequence linked": the live delete unlinked the
// shared view for every milestone too.
// Args: [port=4591]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4591)
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
const lifelines = () => page.locator('.canvas-area').innerText().then((t) => t.replace(/\s+/g, ' ').slice(0, 160))
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-payflow', 'designer')
  console.log(`live Payment Flow: ${await lifelines()}`)
  await L.tab(page, 'Milestones')
  await page.getByRole('button', { name: 'New milestone' }).click()
  const nb = page.getByPlaceholder('Milestone name…')
  await nb.press('ControlOrMeta+a'); await nb.press('Backspace'); await nb.pressSequentially('M'); await nb.press('Enter')
  await L.wait(page, 1500)
  await L.tab(page, 'Sequences')
  await page.locator('.lp-view-card', { hasText: 'Payment Processing' }).last().click()
  await L.wait(page, 500)
  await page.getByRole('button', { name: /Delete sequence/ }).click()
  await L.wait(page, 2500)
  const doc = await L.stored(page, id)
  const m = doc.snapshots.find((s) => s.name === 'M')
  console.log(`saved: live sequences ${JSON.stringify(doc.sequences.map((s) => s.id))}; Payment Flow's sequence: ${doc.views.find((v) => v.id === 'view-payflow').sequenceId}`)
  console.log(`saved: milestone M holds seq-payment-flow with ${m.sequences?.['seq-payment-flow']?.relationIds.length} steps; M keeps its own Payment Flow: ${!!m.views?.['view-payflow']}`)
  await L.tab(page, 'Milestones')
  await page.locator('.lp-snap-card').filter({ has: page.getByText('M', { exact: true }) }).click()
  await L.settle(page); await L.wait(page, 800)
  await L.open(page, id, 'view-payflow', 'designer', page.url().match(/\/s\/[^/]+$/)?.[0] ?? '')
  console.log(`in M (${page.url().split('/m/')[1]}), Payment Flow: ${await lifelines()}`)
  await L.shot(page, 'f2-payflow-in-milestone')
} finally { console.log('problems', problems); await browser.close() }
