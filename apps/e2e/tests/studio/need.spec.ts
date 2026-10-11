import { test, expect, fixture } from '../../support/fixtures'

// The governance `need` type — raw free-text input that EARS requirements
// derive from — and Radical Forge storing / reusing its description as one.
function governanceBookstore(): Record<string, unknown> & { nodes: unknown[]; relations: unknown[]; views: unknown[] } {
  const doc = JSON.parse(fixture('bookstore'))
  doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} }
  return doc
}

test.describe('on the governance bookstore', () => {
  test.beforeEach(async ({ studio }) => {
    await studio.seedDocument(JSON.stringify(governanceBookstore()))
  })

  const BRIEF = 'Readers want to reserve a book online and pick it up in the shop within 3 days.'

  test('a Need is created through its wizard and shows the start of its text on the canvas', async ({ page, studio }) => {
    await studio.open('v-context')
    await studio.addFromPalette('Need', { x: 150, y: 750 })
    const wizard = page.getByRole('dialog', { name: /New Need/ })
    await expect(wizard).toBeVisible()

    await wizard.getByLabel('Name').fill('Click & collect brief')
    await wizard.getByRole('button', { name: 'Next' }).click()
    await wizard.getByLabel('Text').fill(BRIEF)
    await wizard.getByRole('button', { name: 'Create' }).click()

    await expect(wizard).toHaveCount(0)
    const node = studio.nodeByLabel('Click & collect brief')
    await expect(node).toBeVisible()
    await expect(node).toContainText('Readers want to reserve a book')
    await expect.poll(async () => {
      const doc = await studio.storedDoc() as unknown as { nodes: Array<{ label: string; type: string; description?: string; status?: string; kind?: string }> }
      const need = doc.nodes.find((n) => n.label === 'Click & collect brief')
      return need && { type: need.type, description: need.description, kind: need.kind, status: need.status }
    }).toEqual({ type: 'need', description: BRIEF, kind: 'brief', status: undefined })
  })

  test('Radical Forge stores its description as a Need and offers existing Needs as input', async ({ page, studio }) => {
    await studio.open('v-context')
    const openForge = async () => {
      await page.getByTitle('Menu').click()
      await page.getByRole('menuitem', { name: 'Radical Forge…' }).click()
    }

    await openForge()
    const forge = page.locator('.forge-body')
    // No needs in the model yet: just the free-text box.
    await expect(forge.locator('.forge-need-picker')).toHaveCount(0)
    await forge.locator('.forge-textarea').fill(`# Click & collect\n\n${BRIEF}`)
    await page.getByRole('button', { name: 'Start →' }).click()

    await expect.poll(async () => {
      const doc = await studio.storedDoc() as unknown as { nodes: Array<{ label: string; type: string; description?: string; source?: string }> }
      return doc.nodes.filter((n) => n.type === 'need').map((n) => ({ label: n.label, description: n.description, source: n.source }))
    }).toEqual([{ label: 'Click & collect', description: `# Click & collect\n\n${BRIEF}`, source: 'Radical Forge' }])

    // Back and Start again updates that need rather than adding a second one.
    await page.getByRole('button', { name: '← Back' }).click()
    await forge.locator('.forge-textarea').fill(`# Click & collect\n\n${BRIEF} Payment happens in the shop.`)
    await page.getByRole('button', { name: 'Start →' }).click()
    await expect.poll(async () => {
      const doc = await studio.storedDoc() as unknown as { nodes: Array<{ type: string; description?: string }> }
      return doc.nodes.filter((n) => n.type === 'need').map((n) => n.description)
    }).toEqual([`# Click & collect\n\n${BRIEF} Payment happens in the shop.`])

    // A new Forge run offers the stored need as its input.
    await page.keyboard.press('Escape')
    await openForge()
    const picker = forge.locator('.forge-need-picker select')
    await expect(picker).toBeVisible()
    await expect(forge.locator('.forge-textarea')).toHaveValue('')
    await picker.selectOption({ label: 'Click & collect' })
    await expect(forge.locator('.forge-textarea')).toHaveValue(`# Click & collect\n\n${BRIEF} Payment happens in the shop.`)
  })
})

test('needs nest under a broader need: a tree in the table, and Add child on its wiki page', async ({ page, studio }) => {
  const doc = governanceBookstore()
  const need = (id: string, label: string) =>
    ({ id, type: 'need', label, description: `${label} text`, kind: 'brief', x: 0, y: 900, width: 200, height: 80, collapsed: false })
  doc.nodes.push(
    need('need-discovery', 'Click & collect discovery'),
    need('need-shop', 'Shop staff interviews'),
    { id: 'req-pickup', type: 'requirement', label: 'Pick-up window', ears_type: 'ubiquitous', action: 'hold a reserved book for 3 days', x: 0, y: 1100, width: 200, height: 80, collapsed: false },
  )
  doc.relations.push(
    { id: 'd-shop', sourceId: 'need-shop', targetId: 'need-discovery', relationType: 'derives' },
    { id: 'd-pickup', sourceId: 'req-pickup', targetId: 'need-shop', relationType: 'derives' },
  )
  doc.views.push({ id: 'v-wiki', name: 'Wiki', kind: 'wiki', nodeIds: ['need-discovery', 'need-shop', 'req-pickup'], positions: {} })
  await studio.seedDocument(JSON.stringify(doc))

  // Table: the sub-need is indented under its parent; the requirement stays a root of its own tab.
  await studio.open('v-table')
  await page.locator('.tv-tab', { hasText: 'Need' }).click()
  await expect(page.locator('tr[data-node-id="need-shop"] .tv-tree-indent')).toBeVisible()
  await expect(page.locator('tr[data-node-id="need-discovery"] .tv-tree-indent')).toHaveCount(0)
  await page.locator('.tv-tab', { hasText: 'Requirement' }).click()
  await expect(page.locator('tr[data-node-id="req-pickup"]')).toBeVisible()
  await expect(page.locator('tr[data-node-id="req-pickup"] .tv-tree-indent')).toHaveCount(0)

  // Wiki: the sub-need is listed under "Derives from this", and Add child offers a Need, linked on creation.
  await studio.open('v-wiki/f/need-discovery')
  await expect(page.getByRole('heading', { name: /Derives from this/ })).toBeVisible()
  await expect(page.getByText('Shop staff interviews').first()).toBeVisible()
  await page.getByRole('button', { name: 'Add child' }).click()
  await page.locator('.wiki-add-item', { hasText: 'Need' }).click()
  const wizard = page.getByRole('dialog', { name: /New Need/ })
  await expect(wizard).toBeVisible()
  await wizard.getByLabel('Name').fill('Customer survey')
  await wizard.getByRole('button', { name: 'Create' }).click()
  await expect(wizard).toHaveCount(0)
  await expect.poll(async () => {
    const saved = await studio.storedDoc() as unknown as {
      nodes: Array<{ id: string; label: string }>
      relations: Array<{ sourceId: string; targetId: string; relationType?: string }>
    }
    const created = saved.nodes.find((n) => n.label === 'Customer survey')
    return created && saved.relations.some((r) => r.sourceId === created.id && r.targetId === 'need-discovery' && r.relationType === 'derives')
  }, { timeout: 15_000 }).toBe(true)
})
