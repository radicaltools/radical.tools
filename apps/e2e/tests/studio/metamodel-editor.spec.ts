import { test, expect, WHOLE, fixture } from '../../support/fixtures'
import { builtInC4Metamodel } from '@radical/common/metamodel'

// The list side of the metamodel editor (the Diagram tab has its own spec).

async function openEditor(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Metamodel editor', exact: true }).click()
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

// D3: narrowing the metamodel below what the model holds was done without a
// word (only Validation said so). It is done after a confirmation that lists
// what it breaks.
test('narrowing a type\'s parents below what the model holds asks first, listing what it breaks', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  await openEditor(page)
  const card = page.locator('.mm-card', { has: page.locator('.mm-type-id', { hasText: /^container$/ }) })
  await card.locator('.mm-card-header').click()
  const system = card.locator('.mm-parent-grid label', { hasText: /^Software System$/ }).locator('input')
  await expect(system).toBeChecked()
  let asked = ''
  page.once('dialog', (d) => { asked = d.message(); void d.dismiss() })
  await system.uncheck().catch(() => {})
  await expect.poll(() => asked).toContain('Container "API" cannot be inside Software System')
  await expect(system).toBeChecked()
  page.once('dialog', (d) => { void d.accept() })
  await system.uncheck()
  await expect(system).not.toBeChecked()
})

// Item 208: an enum option removed while an element held it showed as
// another option in the card, and nothing flagged it.
test('a value that is no option any more shows as it is in the card', async ({ page, studio }) => {
  const doc = JSON.parse(fixture('bookstore'))
  doc.nodes = doc.nodes.map((n: { id: string }) => (n.id === 'api' ? { ...n, tier: 'silver' } : n))
  await studio.seedDocument(JSON.stringify(doc))
  await studio.open('v-containers')
  await openEditor(page)
  const row = await newPropertyRow(page, 'container')
  await row.locator('.mm-prop-key').fill('tier')
  await row.locator('.mm-prop-label').fill('Tier')
  await row.locator('.mm-prop-type').selectOption('enum')
  // API's "silver" is no option: the editor asks first (D3).
  let asked = ''
  page.once('dialog', (d) => { asked = d.message(); void d.accept() })
  await row.locator('.mm-prop-options').fill('gold, bronze')
  await row.locator('.mm-prop-label').click()
  await expect.poll(() => asked).toContain('"Tier" is "silver"')
  await expect(page.locator('.mm-editor-side')).toContainText('"Tier" is "silver", which is not one of its options (gold, bronze)')
  await closeEditor(page)
  await studio.node('api').click()
  const tier = studio.attribute('Tier')
  await expect(tier).toHaveValue('silver')
  await expect(tier.locator('option:checked')).toHaveText('silver (not an option)')
})

// Item 243: typing the first options of an enum whose elements hold a
// value asked at each letter ("g", "go", "gol": the empty list allowed any
// value, so each letter narrowed it), and once stored ["gold", "s"] while
// the field showed "gold, silver".
test('typing an enum\'s first options asks nothing until the field is left', async ({ page, studio }) => {
  const doc = JSON.parse(fixture('bookstore'))
  doc.nodes = doc.nodes.map((n: { id: string }) => (n.id === 'api' ? { ...n, tier: 'gold' } : n))
  await studio.seedDocument(JSON.stringify(doc))
  await studio.open('v-containers')
  await openEditor(page)
  const row = await newPropertyRow(page, 'container')
  await row.locator('.mm-prop-key').fill('tier')
  await row.locator('.mm-prop-label').fill('Tier')
  await row.locator('.mm-prop-type').selectOption('enum')
  const asked: string[] = []
  page.on('dialog', (d) => { asked.push(d.message()); void d.dismiss() })
  await row.locator('.mm-prop-options').click()
  await page.keyboard.type('gold, silver', { delay: 40 })
  await expect(row.locator('.mm-prop-options')).toHaveValue('gold, silver')
  await row.locator('.mm-prop-label').click()
  await closeEditor(page)
  await expect.poll(async () => {
    const stored = JSON.parse(await studio.storedJson()) as { metamodel?: { nodeTypes: Record<string, { properties?: { key: string; options?: string[] }[] }> } }
    return stored.metamodel?.nodeTypes.container.properties?.find((p) => p.key === 'tier')?.options
  }).toEqual(['gold', 'silver'])
  expect(asked).toEqual([])
})

// Item 242: deleting a relation type, Reset to C4 and Add relation type
// changed what the model holds against the metamodel without the list the
// editor shows for a narrowed type (Validation went 0 → 1 unasked).
test.describe('metamodel changes that leave the model against it ask first', () => {
  // Bookstore, its C4 metamodel with an any-pair type "Misc", and Orders DB
  // → Customer, which only Misc lets through (C4 has no database → person).
  const withMisc = (): string => {
    const doc = JSON.parse(fixture('bookstore'))
    const c4 = builtInC4Metamodel()
    doc.metamodel = { ...c4, id: 'custom-c4', name: 'Custom', relationTypes: { ...c4.relationTypes, misc: { id: 'misc', label: 'Misc', allowedPairs: [], builtin: false } } }
    // Two types fit them now: they say which.
    doc.relations = doc.relations.map((r: Record<string, unknown>) => ({ ...r, relationType: 'interacts' }))
    // Untyped (written by an older Studio or by hand), it reads as the one
    // type that fits: Misc. Deleting Misc is not refused for it.
    doc.relations.push({ id: 'r-db', sourceId: 'db', targetId: 'customer', label: 'emails' })
    return JSON.stringify(doc)
  }
  const relationTypeIds = async (studio: { storedJson(): Promise<string> }): Promise<string[]> =>
    Object.keys((JSON.parse(await studio.storedJson()) as { metamodel?: { relationTypes?: Record<string, unknown> } }).metamodel?.relationTypes ?? {})

  test('deleting a relation type lists what it breaks', async ({ page, studio }) => {
    await studio.seedDocument(withMisc())
    await studio.open('v-containers')
    await openEditor(page)
    let asked = ''
    page.once('dialog', (d) => { asked = d.message(); void d.dismiss() })
    await page.locator('.mm-card', { has: page.locator('.mm-type-label', { hasText: /^Misc$/ }) }).getByTitle('Delete relation type').click()
    await expect.poll(() => asked).toContain('"Orders DB" → "Customer"')
    await expect(page.locator('.mm-issues-count')).toHaveText('0')
    expect(await relationTypeIds(studio)).toContain('misc')
    page.once('dialog', (d) => { void d.accept() })
    await page.locator('.mm-card', { has: page.locator('.mm-type-label', { hasText: /^Misc$/ }) }).getByTitle('Delete relation type').click()
    await expect(page.locator('.mm-issues-count')).toHaveText('1')
  })

  test('Reset to C4 lists what it breaks in its one question', async ({ page, studio }) => {
    await studio.seedDocument(withMisc())
    await studio.open('v-containers')
    await openEditor(page)
    const asked: string[] = []
    page.on('dialog', (d) => { asked.push(d.message()); void d.dismiss() })
    await page.getByRole('button', { name: 'Reset to C4 preset' }).click()
    await expect.poll(() => asked.length).toBe(1)
    expect(asked[0]).toContain('Custom types will be lost')
    expect(asked[0]).toContain('"Orders DB" → "Customer"')
    await expect(page.locator('.mm-issues-count')).toHaveText('0')
    expect(await relationTypeIds(studio)).toContain('misc')
  })

  test('Add relation type says which untyped relations it leaves without a type', async ({ page, studio }) => {
    // A relation type with no pairs fits every pair: the untyped relations
    // that read as Interacts could now be either (decided 2026-10-21).
    await studio.seedWhole()
    await studio.open('v-containers')
    await openEditor(page)
    let asked = ''
    page.once('dialog', (d) => { asked = d.message(); void d.dismiss() })
    await page.getByRole('button', { name: 'Add relation type' }).click()
    await expect.poll(() => asked).toContain('has no type')
    await expect(page.locator('.mm-type-label', { hasText: /^New relation 1$/ })).toHaveCount(0)
  })
})

// Item 243: options typed after others went in letter by letter, and the
// editor closed with Esc kept the first letter: ["gold", "s"] while the
// field had shown "gold, silver".
test('enum options typed and the editor closed with Esc are kept as the field showed them', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  await openEditor(page)
  const row = await newPropertyRow(page, 'container')
  await row.locator('.mm-prop-key').fill('tier')
  await row.locator('.mm-prop-type').selectOption('enum')
  const options = row.locator('.mm-prop-options')
  await options.fill('gold')
  await row.locator('.mm-prop-key').click()
  await options.click()
  await page.keyboard.press('End')
  await page.keyboard.type(', silver', { delay: 40 })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Close metamodel editor' })).toHaveCount(0)
  await expect.poll(async () => {
    const stored = JSON.parse(await studio.storedJson()) as { metamodel?: { nodeTypes: Record<string, { properties?: { key: string; options?: string[] }[] }> } }
    return stored.metamodel?.nodeTypes.container.properties?.find((p) => p.key === 'tier')?.options
  }).toEqual(['gold', 'silver'])
})

// F-0017: a type's last allowed parent unticked was taken without a word and
// Validation stayed silent (it read no parents as any parent), while Studio
// then refused to place the type anywhere (it reads them as none).
test('unticking a type\'s last allowed parent asks first, naming what it leaves out', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  await openEditor(page)
  const card = page.locator('.mm-card', { has: page.locator('.mm-type-id', { hasText: /^database$/ }) })
  await card.locator('.mm-card-header').click()
  const parent = (name: string) => card.locator('.mm-parent-grid label', { hasText: new RegExp(`^${name}$`) }).locator('input')
  await parent('Group').uncheck()
  await expect(parent('Group')).not.toBeChecked()
  let asked = ''
  page.once('dialog', (d) => { asked = d.message(); void d.dismiss() })
  await parent('Software System').uncheck().catch(() => {})
  await expect.poll(() => asked).toContain('Database "Orders DB" cannot be inside Software System')
  await expect(parent('Software System')).toBeChecked()
  page.once('dialog', (d) => { void d.accept() })
  await parent('Software System').uncheck()
  await expect(parent('Software System')).not.toBeChecked()
  await expect(page.locator('.mm-issues-count')).toHaveText('1')
})

// F-0019: a type's Label could be emptied, which left a blank palette entry
// and card header; upsert_node_type refuses a blank label.
test('an emptied name of a type, a relation type or a property goes back to the one it had', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  await openEditor(page)
  const card = page.locator('.mm-card', { has: page.locator('.mm-type-id', { hasText: /^database$/ }) })
  await card.locator('.mm-card-header').click()
  const label = card.locator('.mm-field', { hasText: /^Label/ }).locator('input')
  await label.fill('')
  await label.press('Tab')
  await expect(label).toHaveValue('Database')
  await expect(card.locator('.mm-type-label')).toHaveText('Database')
  // A name typed over it is taken, trimmed.
  await label.fill(' Store ')
  await label.press('Tab')
  await expect(label).toHaveValue('Store')

  const rel = page.locator('.mm-card', { has: page.locator('.mm-type-id', { hasText: /^interacts$/ }) })
  await rel.locator('.mm-card-header').click()
  const relLabel = rel.locator('.mm-field', { hasText: /^Label/ }).locator('input')
  const relName = await relLabel.inputValue()
  await relLabel.fill('')
  await relLabel.press('Tab')
  await expect(relLabel).toHaveValue(relName)

  const row = await newPropertyRow(page, 'container')
  await row.locator('.mm-prop-label').fill('')
  await row.locator('.mm-prop-label').press('Tab')
  await expect(row.locator('.mm-prop-label')).toHaveValue('New property')

  await closeEditor(page)
  await expect(page.locator('.palette-item', { hasText: /^\s*Store\s*$/ })).toHaveCount(1)
  await expect.poll(async () => {
    const doc = JSON.parse(await studio.storedJson()) as { metamodel?: { nodeTypes: Record<string, { label: string; properties?: { label: string }[] }>; relationTypes: Record<string, { label: string }> } }
    const mm = doc.metamodel
    return mm && [mm.nodeTypes.database.label, mm.relationTypes.interacts.label, mm.nodeTypes.container.properties?.at(-1)?.label]
  }).toEqual(['Store', relName, 'New property'])
})
