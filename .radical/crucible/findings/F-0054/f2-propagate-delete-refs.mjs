// Sample, with one more milestone "v5 – Lifecycles": the live model as it was before the transition
// Held -> Booked (on "Case approved") was added (written into the saved document before the app loads
// it, as a milestone saved earlier would be). In v5 the event "Case approved" is deleted from the Event
// catalogue (card, Delete element) and the edit is propagated. The live transition Held -> Booked still
// names the deleted event, and Validation flags it. A delete made on the live model takes the event out
// of every transition (forgetNodesInReferences); Propagate does not.
// Args: [port=4584]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4584)
const EVENT = '4e611ecf-f8d4-4ada-8f7d-f4f613cb30fe' // Case approved
const T_LATER = '979b58ac-9093-4328-997e-45f47b210dd3' // Held -> Booked on Case approved, not in v5
const T_BOTH = '87c4c784-4ffa-4d12-a51c-2dc75ab2e3a8' // another transition on Case approved, in v5 too
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
async function validation() {
  await L.openEditor(page); await L.wait(page, 800)
  const items = await page.locator('text=points at nothing').allInnerTexts()
  const badge = (await page.locator('body').innerText()).match(/Validation\s*\n?\s*(\d+)/)
  return { badge: badge ? +badge[1] : 0, dangling: items }
}
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-ctx', 'designer'); await L.wait(page, 2000)
  await page.evaluate(([id, T]) => {
    const key = `radical-doc:${id}`
    const doc = JSON.parse(localStorage.getItem(key))
    const nodes = Object.fromEntries(doc.nodes.map((n) => [n.id, n]))
    const relations = Object.fromEntries(doc.relations.filter((r) => r.id !== T).map((r) => [r.id, r]))
    doc.snapshots.push({ id: 'snap-v5', name: 'v5 – Lifecycles', timestamp: Date.now(), nodes, relations, sequences: Object.fromEntries((doc.sequences ?? []).map((s) => [s.id, s])) })
    localStorage.setItem(key, JSON.stringify(doc))
  }, [id, T_LATER])
  await L.open(page, id, 'view-event-catalogue', 'designer')
  await page.reload(); await page.locator('.app-layout').waitFor(); await L.settle(page)
  const v0 = await validation()
  console.log(`before: Validation ${v0.badge}, dangling references ${v0.dangling.length}`)
  await L.closeEditor(page); await L.wait(page, 400)

  await L.milestone(page, 'v5 – Lifecycles')
  await page.locator(`tr[data-node-id="${EVENT}"]`).dblclick()
  await page.getByRole('button', { name: /Delete element/ }).click()
  await L.wait(page, 500)
  const prompt = page.locator('.milestone-modal', { hasText: 'Propagate' })
  if (await prompt.count()) await prompt.getByText('Propagate to later milestones').click()
  else await page.getByRole('button', { name: 'Propagate', exact: true }).click()
  await L.wait(page, 1000)
  await L.milestone(page, 'live')
  await L.wait(page, 3000)
  const doc = await L.stored(page, id)
  const R = Object.fromEntries(doc.relations.map((r) => [r.id, r]))
  console.log(`live after Propagate: event in the model ${doc.nodes.some((n) => n.id === EVENT)}; transition in v5 too: event ${JSON.stringify(R[T_BOTH]?.event)}; transition Held -> Booked (not in v5): event ${JSON.stringify(R[T_LATER]?.event)}`)
  const v1 = await validation()
  console.log(`after: Validation ${v1.badge}:`, v1.dangling)
  await L.shot(page, 'f2-validation')
} finally { console.log('problems', problems); await browser.close() }
