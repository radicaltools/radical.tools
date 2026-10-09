import { test, expect, fixture } from '../../support/fixtures'

// State machines in the governance preset: a transition points at its
// trigger and the events it raises by reference (ids), shown by name.

test.beforeEach(async ({ studio }) => {
  await studio.seedDocument(fixture('order-machine'))
  await studio.open('v-order')
})

test('a transition shows its events by name and picks them by reference', async ({ page, studio }) => {
  const label = page.locator('.relation-label', { hasText: '[ok]' })
  await expect(label).toHaveText('PaymentReceived [ok] / reserve ^OrderPaid')

  await page.locator('[data-testid="rf__edge-t-pay"] path').first().click({ force: true })
  const panel = page.locator('.props-content')
  await expect(panel.getByText('TRANSITION')).toBeVisible()
  await panel.locator('.props-field', { hasText: 'Event (trigger' }).locator('select').selectOption({ label: 'Cancel' })
  await panel.getByRole('button', { name: 'Remove OrderPaid' }).click()
  await expect(label).toHaveText('Cancel [ok] / reserve')

  // Stored as ids, so a rename of the event shows up on the transition.
  await expect.poll(async () => {
    const t = (await studio.storedDoc()).relations.find((r) => r.id === 't-pay') as unknown as Record<string, unknown>
    return [t.event, t.raises]
  }).toEqual(['cancel', []])
  await studio.node('cancel').click()
  const name = page.locator('.props-field').filter({ has: page.getByText('Label', { exact: true }) }).locator('input')
  await name.fill('CancelOrder')
  await name.press('Tab')
  await expect(page.locator('.relation-label', { hasText: '[ok]' })).toHaveText('CancelOrder [ok] / reserve')
})
