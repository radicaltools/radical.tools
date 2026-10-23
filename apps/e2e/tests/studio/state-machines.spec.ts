import { test, expect, fixture } from '../../support/fixtures'

// State machines in the governance preset: a transition points at its
// trigger and the events it raises by reference (ids), shown by name.

test.beforeEach(async ({ studio }) => {
  await studio.seedDocument(fixture('order-machine'))
  await studio.open('v-order')
})

test('a machine is named after the entity it is the lifecycle of', async ({ studio }) => {
  await expect(studio.node('order')).toContainText('State machine · Order')
  await expect(studio.node('order-entity')).toContainText('Aggregate root')
})

test('a transition shows its events by name and picks them by reference', async ({ page, studio }) => {
  const label = page.locator('.relation-label', { hasText: '[ok]' })
  await expect(label).toHaveText('PaymentReceived [ok] / reserve ^OrderPaid')

  await page.locator('[data-testid="rf__edge-t-pay"] path').first().dblclick({ force: true })
  const panel = studio.properties
  await expect(panel.locator('.pp-type')).toHaveText(/transition/i)
  await panel.getByLabel(/^Event \(trigger/).selectOption({ label: 'Cancel' })
  await panel.getByRole('button', { name: 'Remove OrderPaid' }).click()
  await expect(label).toHaveText('Cancel [ok] / reserve')

  // Stored as ids, so a rename of the event shows up on the transition.
  await expect.poll(async () => {
    const t = (await studio.storedDoc()).relations.find((r) => r.id === 't-pay') as unknown as Record<string, unknown>
    return [t.event, t.raises]
  }).toEqual(['cancel', []])
  await studio.node('cancel').click()
  const name = studio.attribute('Name')
  await name.fill('CancelOrder')
  await name.press('Tab')
  await expect(page.locator('.relation-label', { hasText: '[ok]' })).toHaveText('CancelOrder [ok] / reserve')
})

// Open points of runs 45 to 64 on the card of a transition and the Delete
// prompt: the card was titled "No label" while the line read "PaymentReceived
// [ok] / reserve ^OrderPaid"; Event (none) stored event: ""; the prompt
// counted the selection, not what goes with it.
test('a transition\'s card reads as its line, and Event (none) stores no event', async ({ page, studio }) => {
  await page.locator('[data-testid="rf__edge-t-pay"] path').first().dblclick({ force: true })
  const panel = studio.properties
  await expect(panel.getByRole('textbox').first()).toHaveAttribute('placeholder', 'PaymentReceived [ok] / reserve ^OrderPaid')
  await panel.getByLabel(/^Event \(trigger/).selectOption({ index: 0 })
  await expect.poll(async () => 'event' in ((await studio.storedDoc()).relations.find((r) => r.id === 't-pay') as object)).toBe(false)
})

test('the Delete prompt says what Remove from model takes', async ({ page, studio }) => {
  await studio.node('order').click()
  await page.keyboard.press('Delete')
  // The machine, its 7 states, pseudostates and events; its 4 relations.
  await expect(page.locator('.milestone-modal')).toContainText('8 elements and 4 relations')
})

// Item 221 in Studio: Alt-drag from a final state added a transition the
// validation then flagged.
test('a transition from a final state is refused, with the reason', async ({ page, studio }) => {
  await studio.connect(studio.node('cancelled'), studio.node('pending'))
  await expect(page.getByText('Relation not allowed: Final state "Cancelled" cannot have outgoing transitions.')).toBeVisible()
  expect((await studio.storedDoc()).relations).toHaveLength(4)
})

// Item 223: the card's sentence said "While ‹precondition›" where the
// canvas and the wiki say "While the Order is Confirmed".
test('the card\'s sentence of a requirement in a state names the state', async ({ page, studio }) => {
  // Before the app boots on the next load (it saves its own copy on the way out).
  await page.addInitScript(() => {
    const key = 'radical-doc:e2e-doc'
    const doc = JSON.parse(localStorage.getItem(key)!)
    if (doc.nodes.some((n: { id: string }) => n.id === 'hold')) return
    doc.nodes.push({ id: 'hold', type: 'requirement', label: 'Hold stock', ears_type: 'state-driven', action: 'hold the stock', precondition_state: 'confirmed', x: 0, y: 700, width: 240, height: 100, collapsed: false })
    doc.views = doc.views.map((v: { id: string; nodeIds: string[] }) => (v.id === 'v-order' && v.nodeIds.length ? { ...v, nodeIds: [...v.nodeIds, 'hold'] } : v))
    localStorage.setItem(key, JSON.stringify(doc))
  })
  await page.reload()
  await studio.ready()
  await studio.node('hold').dblclick()
  await expect(studio.properties.locator('.ears-sentence-sm')).toHaveText('While the Order is Confirmed, the system shall hold the stock.')
})
