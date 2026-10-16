import { test, expect, WHOLE } from '../../support/fixtures'

// The list side of the metamodel editor (the Diagram tab has its own spec).

async function openEditor(page: import('@playwright/test').Page): Promise<void> {
  await page.getByTitle('Menu', { exact: true }).click()
  await page.getByText(/Metamodel editor/).first().click()
  await expect(page.getByRole('button', { name: 'Close metamodel editor' })).toBeVisible()
}

const closeEditor = (page: import('@playwright/test').Page): Promise<void> =>
  page.getByRole('button', { name: 'Close metamodel editor' }).click()

/** The card of a node type, opened, with a new property row at its end. */
async function newPropertyRow(page: import('@playwright/test').Page, typeId: string): Promise<import('@playwright/test').Locator> {
  const card = page.locator('.mm-card', { has: page.locator('.mm-type-id', { hasText: new RegExp(`^${typeId}$`) }) })
  await card.locator('.mm-card-header').click()
  await card.getByRole('button', { name: 'Add property' }).click()
  return card.locator('.mm-prop-row').last()
}

test.describe('custom properties of a type', () => {
  test.beforeEach(async ({ studio }) => {
    await studio.seed()
    await studio.open('v-containers')
  })

  test('enum options can be typed, commas and spaces included', async ({ page, studio }) => {
    // The field was re-made from the parsed options on each key: a comma or
    // a space at the end never survived, and "gold, silver, bronze" typed
    // became one option "goldsilverbronze". (`fill` would not show it.)
    await openEditor(page)
    const row = await newPropertyRow(page, 'container')
    await row.locator('.mm-prop-key').click({ clickCount: 3 })
    await page.keyboard.type('tier')
    await row.locator('.mm-prop-type').selectOption('enum')
    const options = row.locator('.mm-prop-options')
    await options.click()
    await page.keyboard.type('gold, in progress, bronze')
    await expect(options).toHaveValue('gold, in progress, bronze')
    await closeEditor(page)
    await expect.poll(async () => {
      const doc = JSON.parse(await studio.storedJson()) as { metamodel?: { nodeTypes: Record<string, { properties?: { key: string; options?: string[] }[] }> } }
      return doc.metamodel?.nodeTypes.container.properties?.find((p) => p.key === 'tier')?.options
    }).toEqual(['gold', 'in progress', 'bronze'])
  })

  test('an enum without a value shows as not set, and its first option can be chosen', async ({ page, studio }) => {
    await openEditor(page)
    const row = await newPropertyRow(page, 'container')
    await row.locator('.mm-prop-key').fill('tier')
    await row.locator('.mm-prop-label').fill('Tier')
    await row.locator('.mm-prop-type').selectOption('enum')
    await row.locator('.mm-prop-options').fill('gold, silver')
    await row.locator('.mm-prop-label').click()
    await closeEditor(page)

    await studio.node('api').click()
    const tier = studio.attribute('Tier')
    // It showed "gold" as if set; picking gold then changed nothing.
    await expect(tier).toHaveValue('')
    await tier.selectOption('gold')
    await expect.poll(async () => {
      const doc = JSON.parse(await studio.storedJson()) as { nodes: Array<{ id: string; tier?: string }> }
      return doc.nodes.find((n) => n.id === 'api')?.tier
    }).toBe('gold')
  })

  test('a new property never gets a key another one has', async ({ page }) => {
    // Its key was counted from the list's length: Add, Add, remove the
    // first, Add gave two properties one key, which edited one value.
    await openEditor(page)
    const card = page.locator('.mm-card', { has: page.locator('.mm-type-id', { hasText: /^container$/ }) })
    await card.locator('.mm-card-header').click()
    const add = card.getByRole('button', { name: 'Add property' })
    await add.click()
    await add.click()
    const rows = card.locator('.mm-prop-row')
    const count = await rows.count()
    await rows.nth(count - 2).getByTitle('Remove property').click()
    await add.click()
    const keys = await card.locator('.mm-prop-key').evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('a property cannot be keyed like a field every element has', async ({ page, studio }) => {
    // Keyed "type", the properties panel edited the element's type with it.
    await openEditor(page)
    const row = await newPropertyRow(page, 'container')
    const key = row.locator('.mm-prop-key')
    const before = await key.inputValue()
    await key.click({ clickCount: 3 })
    await page.keyboard.type('type')
    await row.locator('.mm-prop-label').click()
    await expect(page.getByText(/"type" is a field every element has/).first()).toBeVisible()
    await expect(key).toHaveValue(before)
    // A key that only starts like one is taken.
    await key.click({ clickCount: 3 })
    await page.keyboard.type('typeOfBroker')
    await key.press('Enter')
    await expect(key).toHaveValue('typeOfBroker')
    await closeEditor(page)
    await expect.poll(async () => {
      const doc = JSON.parse(await studio.storedJson()) as { metamodel?: { nodeTypes: Record<string, { properties?: { key: string }[] }> } }
      return doc.metamodel?.nodeTypes.container.properties?.map((p) => p.key)
    }).toContain('typeOfBroker')
  })
})

test('a type\'s summary template, with how it reads, sets the summary the table shows', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-table')
  const provider = page.locator('tbody tr.tv-row', { hasText: 'Payment Provider' })
  await expect(provider).toContainText('Card payments')
  await openEditor(page)
  const card = page.locator('.mm-card', { has: page.locator('.mm-type-id', { hasText: /^system$/ }) })
  await card.locator('.mm-card-header').click()
  const field = card.getByLabel('Summary')
  // The built-in template shows as the placeholder, the tokens under it.
  await expect(field).toHaveAttribute('placeholder', /\{description\.sentence\}/)
  await expect(card.locator('.mm-hint').first()).toContainText('{technology}')
  await field.fill('{label} — {description}')
  await expect(card.locator('.mm-summary-preview')).toContainText('—')
  await closeEditor(page)
  await expect(provider).toContainText('Payment Provider — Card payments')
})

test('Reset to C4 preset is refused while the model holds what C4 has no type for', async ({ page, studio }) => {
  // It went through and left the governance elements as unknown types, with
  // nothing in the editor to bring the types back.
  await studio.seedWhole('order-machine')
  await studio.open(WHOLE)
  const before = await studio.nodes.count()
  await openEditor(page)
  page.once('dialog', (dialog) => { void dialog.accept() })
  await page.getByRole('button', { name: 'Reset to C4 preset' }).click()
  await expect(page.getByText(/Cannot reset the metamodel/).first()).toBeVisible()
  await expect(page.locator('.mm-issues-count')).toHaveText('0')
  await closeEditor(page)
  await expect(studio.nodes).toHaveCount(before)
})
