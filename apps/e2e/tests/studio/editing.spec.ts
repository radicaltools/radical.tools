import { test, expect } from '../../support/fixtures'

// Editing on the flat System Context view of the bookstore fixture
// (Customer, Bookstore, Payment Provider; 2 relations shown).
test.beforeEach(async ({ studio }) => {
  await studio.seed()
  await studio.open('v-context')
  await expect(studio.nodes).toHaveCount(3)
  await expect(studio.edges).toHaveCount(2)
})

test('add an element from the palette', async ({ studio }) => {
  await studio.addFromPalette('Software System', { x: 150, y: 750 })
  await expect(studio.nodes).toHaveCount(4)
  await expect(studio.nodeByLabel('System')).toBeVisible()
  await expect.poll(async () => (await studio.storedDoc()).nodes.length).toBe(7)
})

test('rename an element in the properties panel', async ({ page, studio }) => {
  await studio.node('payments').click()
  // The panel's <label>s are not tied to their inputs, so find the field by its caption.
  const label = page.locator('.props-field').filter({ has: page.getByText('Label', { exact: true }) }).locator('input')
  await expect(label).toHaveValue('Payment Provider')
  await label.fill('Card Gateway')
  await label.press('Tab')
  await expect(studio.node('payments')).toContainText('Card Gateway')
  await expect.poll(async () => (await studio.storedDoc()).nodes.find((n) => n.id === 'payments')?.label).toBe('Card Gateway')
})

test('connect two elements with Alt-drag', async ({ studio }) => {
  await studio.connect(studio.node('payments'), studio.node('customer'))
  await expect(studio.edges).toHaveCount(3)
  await expect.poll(async () => (await studio.storedDoc()).relations
    .some((r) => r.sourceId === 'payments' && r.targetId === 'customer')).toBe(true)
})

test('a connection the metamodel forbids is refused', async ({ page, studio }) => {
  await studio.addFromPalette('Person', { x: 150, y: 150 })
  await expect(studio.nodes).toHaveCount(4)
  const newPerson = studio.nodes.filter({ hasNot: page.getByText('Customer', { exact: true }) })
    .filter({ has: page.getByText('Person', { exact: true }) })
  // Person → person is not an allowed pair in the C4 metamodel.
  await studio.connect(studio.node('customer'), newPerson)
  await expect(page.getByText(/Relation not allowed: Person → Person/)).toBeVisible()
  await expect(studio.edges).toHaveCount(2)
})

test('undo and redo', async ({ page, studio }) => {
  await studio.addFromPalette('Software System', { x: 150, y: 750 })
  await expect(studio.nodes).toHaveCount(4)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(studio.nodes).toHaveCount(3)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(studio.nodes).toHaveCount(4)
})

test('delete an element', async ({ page, studio }) => {
  await studio.node('payments').click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(studio.node('payments')).toHaveCount(0)
  await expect(studio.edges).toHaveCount(1)
  await expect.poll(async () => (await studio.storedDoc()).nodes.some((n) => n.id === 'payments')).toBe(false)
})

test('edits survive a reload', async ({ page, studio }) => {
  await studio.addFromPalette('Software System', { x: 150, y: 750 })
  await studio.connect(studio.node('payments'), studio.node('customer'))
  await expect(studio.edges).toHaveCount(3)
  await page.reload()
  await studio.ready()
  await expect(studio.nodes).toHaveCount(4)
  await expect(studio.edges).toHaveCount(3)
})

test('⌘+ and ⌘− zoom the canvas, as the toolbar tooltips say', async ({ page, studio }) => {
  const scale = () => page.locator('.react-flow__viewport').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a)
  await studio.pane.click()
  const start = await scale()
  await page.keyboard.press('ControlOrMeta+=')
  await expect.poll(scale).toBeGreaterThan(start)
  const zoomedIn = await scale()
  await page.keyboard.press('ControlOrMeta+-')
  await expect.poll(scale).toBeLessThan(zoomedIn)
})
