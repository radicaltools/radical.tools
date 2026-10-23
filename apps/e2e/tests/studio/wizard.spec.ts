import { test, expect, fixture } from '../../support/fixtures'

// The node wizard on the bookstore fixture, switched to the Governance
// metamodel (whose ADR type has a create-time wizard).
test.beforeEach(async ({ studio }) => {
  const doc = JSON.parse(fixture('bookstore'))
  doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} }
  await studio.seedDocument(JSON.stringify(doc))
})

test('dropping an ADR on the canvas opens its wizard; finishing creates it with its relations', async ({ page, studio }) => {
  await studio.open('v-context')
  await expect(studio.nodes).toHaveCount(3)

  await studio.addFromPalette('ADR', await studio.nearBottom())
  const wizard = page.getByRole('dialog', { name: /New ADR/ })
  await expect(wizard).toBeVisible()
  // Nothing is created until the wizard finishes.
  await expect(studio.nodes).toHaveCount(3)

  await wizard.getByLabel('Name').fill('Use PostgreSQL for orders')
  await expect(wizard.getByRole('radio', { name: 'proposed' })).toHaveAttribute('aria-checked', 'true')
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
  await studio.addFromPalette('ADR', await studio.nearBottom())
  await expect(page.getByRole('dialog', { name: /New ADR/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(studio.nodes).toHaveCount(3)
})

test('dropping an ADR with the special key held adds it without its wizard', async ({ page, studio }) => {
  await studio.open('v-context')
  await expect(studio.nodes).toHaveCount(3)
  await page.keyboard.down('Alt')
  await studio.addFromPalette('ADR', await studio.nearBottom())
  await page.keyboard.up('Alt')
  await expect(page.getByRole('dialog', { name: /New ADR/ })).toHaveCount(0)
  await expect(studio.nodes).toHaveCount(4)
  // Without the key, the wizard asks.
  await studio.addFromPalette('ADR', await studio.nearBottom(400))
  await expect(page.getByRole('dialog', { name: /New ADR/ })).toBeVisible()
})

// F-0033: an ADR dropped onto a system offered only that system under
// Affected elements, and Create was refused ("Bookstore holds ADR"): the
// step offered what the model then refused. Constrains is a governance
// relation (decided 2026-10-23), which may join an element and what holds
// it: the ADR is made inside the system, constraining it.
test('an ADR dropped onto a system may constrain that system', async ({ page, studio }) => {
  await studio.open('v-context')
  const pane = (await studio.pane.boundingBox())!
  const box = (await studio.nodeByLabel('Bookstore').boundingBox())!
  await studio.addFromPalette('ADR', { x: box.x - pane.x + box.width / 2, y: box.y - pane.y + box.height * 0.75 })
  const wizard = page.getByRole('dialog', { name: /New ADR/ })
  await wizard.getByLabel('Name').fill('One database per container')
  await wizard.getByRole('button', { name: /Affected elements/ }).click()
  await wizard.getByRole('checkbox', { name: /Bookstore/ }).check()
  await wizard.getByRole('button', { name: 'Create' }).click()
  await expect(wizard).toHaveCount(0)
  await expect.poll(async () => {
    const doc = await studio.storedDoc() as unknown as {
      nodes: Array<{ id: string; label: string; parentId?: string }>
      relations: Array<{ sourceId: string; targetId: string; relationType?: string }>
    }
    const adr = doc.nodes.find((n) => n.label === 'One database per container')
    return adr && { parentId: adr.parentId, constrains: doc.relations.filter((r) => r.sourceId === adr.id && r.relationType === 'constrains').map((r) => r.targetId) }
  }).toEqual({ parentId: 'bookstore', constrains: ['bookstore'] })
})
