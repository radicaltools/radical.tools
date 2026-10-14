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

test('the undo keys in a text field are about the typing, not the model', async ({ page, studio }) => {
  // The handler sat on the window and did not look at the focus: a typo
  // "undone" while writing took back the model's last step instead.
  await studio.addFromPalette('Software System', { x: 150, y: 750 })
  await expect(studio.nodes).toHaveCount(4)
  const search = page.getByPlaceholder(/^Search/)
  await search.click()
  await page.keyboard.type('boo')
  await page.keyboard.press('ControlOrMeta+z')
  await page.waitForTimeout(300)
  await expect(studio.nodes).toHaveCount(4)
  // Out of the field, they undo the model again.
  await page.keyboard.press('Escape')
  await studio.pane.click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('ControlOrMeta+z')
  await expect(studio.nodes).toHaveCount(3)
})

for (const perspective of ['Viewer', 'Presenter']) {
  test(`the undo keys take none of Designer's steps in ${perspective}`, async ({ page, studio }) => {
    await studio.addFromPalette('Software System', { x: 150, y: 750 })
    await expect(studio.nodes).toHaveCount(4)
    await expect.poll(async () => (await studio.storedDoc()).nodes.length).toBe(7)
    await page.getByRole('button', { name: perspective, exact: true }).click()
    await studio.settle()
    await studio.pane.click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('ControlOrMeta+z')
    await page.waitForTimeout(600)
    await expect(studio.nodes).toHaveCount(4)
    expect((await studio.storedDoc()).nodes.length).toBe(7)
    // The step is still Designer's to undo.
    await page.getByRole('button', { name: 'Designer', exact: true }).click()
    await studio.settle()
    await expect(studio.nodes).toHaveCount(4)
    await page.keyboard.press('ControlOrMeta+z')
    await expect(studio.nodes).toHaveCount(3)
  })
}

test('the Parent field moves an element into its new parent, and refuses a loop', async ({ page, studio }) => {
  await studio.open('canvas')
  const parent = page.locator('.props-field').filter({ has: page.getByText('Parent', { exact: true }) }).locator('select')
  await studio.node('payments').click()
  await parent.selectOption({ label: 'Bookstore' })
  await expect.poll(async () => (await studio.storedDoc()).nodes.find((n) => n.id === 'payments')?.parentId).toBe('bookstore')
  // It lies inside Bookstore's frame (it kept its old offset and lay outside).
  await studio.settle()
  await expect.poll(async () => studio.layoutViolations()).toEqual([])

  // Bookstore into its own child: the types allow a system in a system.
  await studio.node('bookstore').click({ position: { x: 30, y: 12 } })
  await expect(parent).toHaveValue('')
  await parent.selectOption({ label: 'Payment Provider' })
  await expect(page.getByText('Cannot move a node into itself or one of its descendants.').first()).toBeVisible()
  await expect(studio.node('bookstore')).toBeVisible()
  expect((await studio.storedDoc()).nodes.find((n) => n.id === 'bookstore')?.parentId).toBeUndefined()
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

test('a click on a collapse button reaches it even when an edge lies over it', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  const btn = studio.node('bookstore').locator('.c4-node-collapse-btn').first()
  await expect(btn).toHaveAttribute('title', 'Collapse')
  const r = (await btn.boundingBox())!
  // Edges between a container's children are drawn above the container;
  // stand in for one with an element over the button.
  await page.evaluate(([x, y, w, h]) => {
    const cover = document.createElement('div')
    cover.className = 'test-cover'
    Object.assign(cover.style, { position: 'fixed', left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, zIndex: '1000' })
    document.querySelector('.react-flow')!.appendChild(cover)
  }, [r.x - 4, r.y - 4, r.width + 8, r.height + 8])
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2)
  await expect(studio.node('bookstore').locator('.c4-node-collapse-btn').first()).toHaveAttribute('title', 'Expand')
})

test('a second relation between the same two elements is drawn and can be selected', async ({ page, studio }) => {
  // It was never drawn: invisible, and impossible to select or delete.
  await studio.open('v-containers')
  await expect(studio.edges).toHaveCount(4)
  await studio.connect(studio.node('customer'), studio.node('web'))
  await expect.poll(async () => (await studio.storedDoc()).relations.length).toBe(5)
  await expect(studio.edges).toHaveCount(5)
  const added = (await studio.storedDoc()).relations.find((r) => !['r1', 'r2', 'r3', 'r4'].includes(r.id))!
  await expect(page.getByTestId(`rf__edge-${added.id}`)).toHaveCount(1)
})

test('removing one of two steps of the same relation leaves the list as the sequence is', async ({ page, studio }) => {
  // The rows were keyed by relation id: after removing step 2 the list
  // still showed it, and removing it again took another step.
  await studio.open('v-containers')
  await page.locator('[class*=header]', { hasText: /^SEQUENCES/i }).first().click()
  await page.locator('.lp-view-card', { hasText: 'Place Order' }).last().click()
  const edge = page.locator('[data-testid="rf__edge-r2"] path.react-flow__edge-interaction').first()
  const mid = await edge.evaluate((el) => {
    const path = el as SVGPathElement
    const p = path.getPointAtLength(path.getTotalLength() / 2)
    const m = path.getScreenCTM()!
    return { x: p.x * m.a + m.e, y: p.y * m.d + m.f }
  })
  await page.mouse.click(mid.x, mid.y)
  const steps = page.locator('.seq-step')
  await expect(steps).toHaveCount(5)
  await steps.nth(1).hover()
  await steps.nth(1).getByTitle('Remove step').click()
  await expect(steps).toHaveCount(4)
  await expect(steps.nth(1)).toContainText('API')
  await expect(steps.nth(1)).toContainText('Orders DB')
  await expect.poll(async () => (JSON.parse(await studio.storedJson()) as { sequences: Array<{ relationIds: string[] }> }).sequences[0].relationIds)
    .toEqual(['r1', 'r3', 'r4', 'r2'])
})
