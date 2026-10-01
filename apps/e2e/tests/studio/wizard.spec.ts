import { test, expect, fixture } from '../../support/fixtures'

// The node wizard on the bookstore fixture, switched to the Governance
// metamodel (whose ADR type has a create-time wizard).
test.beforeEach(async ({ studio }) => {
  const doc = JSON.parse(fixture('bookstore'))
  doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'C4 + DDD + Governance', nodeTypes: {}, relationTypes: {} }
  await studio.seedDocument(JSON.stringify(doc))
})

test('dropping an ADR on the canvas opens its wizard; finishing creates it with its relations', async ({ page, studio }) => {
  await studio.open('v-context')
  await expect(studio.nodes).toHaveCount(3)

  await studio.addFromPalette('ADR', { x: 150, y: 750 })
  const wizard = page.getByRole('dialog', { name: /New ADR/ })
  await expect(wizard).toBeVisible()
  // Nothing is created until the wizard finishes.
  await expect(studio.nodes).toHaveCount(3)

  await wizard.getByLabel('Name').fill('Use PostgreSQL for orders')
  await expect(wizard.getByLabel('Status')).toHaveValue('proposed')
  await wizard.getByRole('button', { name: 'Next' }).click()
  await wizard.getByLabel('Context').fill('Orders need transactions.')
  await wizard.getByRole('button', { name: /Affected elements/ }).click()
  await wizard.getByRole('checkbox', { name: /Bookstore/ }).check()
  await wizard.getByRole('button', { name: 'Create' }).click()

  await expect(wizard).toHaveCount(0)
  await expect(studio.nodeByLabel('Use PostgreSQL for orders')).toBeVisible()
  await expect.poll(async () => {
    const doc = await studio.storedDoc() as unknown as {
      nodes: Array<{ id: string; label: string; context?: string; status?: string }>
      relations: Array<{ sourceId: string; targetId: string; relationType?: string }>
    }
    const adr = doc.nodes.find((n) => n.label === 'Use PostgreSQL for orders')
    return adr && {
      context: adr.context,
      status: adr.status,
      constrains: doc.relations.filter((r) => r.sourceId === adr.id && r.relationType === 'constrains').map((r) => r.targetId),
    }
  }).toEqual({ context: 'Orders need transactions.', status: 'proposed', constrains: ['bookstore'] })
})

test('cancelling the wizard creates nothing', async ({ page, studio }) => {
  await studio.open('v-context')
  await studio.addFromPalette('ADR', { x: 150, y: 750 })
  await expect(page.getByRole('dialog', { name: /New ADR/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(studio.nodes).toHaveCount(3)
})

test('dropping an ADR on the table view opens the same wizard', async ({ page, studio }) => {
  await studio.open('v-table')
  await page.locator('.palette-item', { hasText: 'ADR' }).first().dragTo(page.locator('.tv-wrap'))
  const wizard = page.getByRole('dialog', { name: /New ADR/ })
  await expect(wizard).toBeVisible()
  await wizard.getByLabel('Name').fill('Event-sourced inventory')
  await page.keyboard.press('ControlOrMeta+Enter')
  await expect(wizard).toHaveCount(0)
  await expect(page.getByText('Event-sourced inventory').first()).toBeVisible()
})
