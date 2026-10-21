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
  await studio.addFromPalette('Software System', await studio.nearBottom())
  await expect(studio.nodes).toHaveCount(4)
  await expect(studio.nodeByLabel('System')).toBeVisible()
  await expect.poll(async () => (await studio.storedDoc()).nodes.length).toBe(7)
})

test('the palette stands down the canvas\'s left side, always there, and not on the table', async ({ page, studio }) => {
  const palette = page.locator('.canvas-column .element-palette')
  await expect(palette.locator('.palette-group-label', { hasText: 'C4' })).toBeVisible()
  await expect(palette.locator('.palette-item', { hasText: 'Software System' })).toBeVisible()
  // The left panel keeps only views, milestones and sequences.
  await expect(page.locator('.left-panel .palette-item')).toHaveCount(0)
  // One type to a row, down the canvas's left edge; nothing folds it away.
  const box = (await palette.boundingBox())!
  const canvas = (await studio.canvas.boundingBox())!
  expect(box.height).toBeGreaterThan(box.width)
  expect(box.x - canvas.x).toBeLessThan(30)
  const items = palette.locator('.palette-item')
  const [first, second] = [(await items.nth(0).boundingBox())!, (await items.nth(1).boundingBox())!]
  expect(second.y).toBeGreaterThan(first.y)
  await expect(page.getByRole('button', { name: /Hide the elements|Show the elements/ })).toHaveCount(0)

  // The table view has none, nor has Viewer.
  await studio.open('v-table')
  await expect(page.locator('.tv-wrap')).toBeVisible()
  await expect(page.locator('.element-palette')).toHaveCount(0)
  await studio.open('v-context', 'viewer')
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
  await expect(page.locator('.element-palette')).toHaveCount(0)
})

test('the table adds an element at the top and inside a row', async ({ page, studio }) => {
  await studio.open('v-table')
  // Many types may go at the top: the + row at the end offers them.
  await page.getByRole('button', { name: 'Add at the top' }).click()
  await page.locator('.wiki-menu').getByRole('menuitem', { name: /Software System/ }).click()
  await page.locator('.tv-cell-input').fill('Warehouse')
  await page.keyboard.press('Enter')
  const warehouse = page.locator('.tv-row', { hasText: 'Warehouse' })
  await expect(warehouse).toBeVisible()
  // Inside it go the types a system may hold, from the + row under it.
  await page.getByRole('button', { name: 'Add under Warehouse' }).click()
  await page.locator('.wiki-menu').getByRole('menuitem', { name: /^Container/ }).click()
  await page.locator('.tv-cell-input').fill('Stock API')
  await page.keyboard.press('Enter')
  await expect(page.locator('.tv-row.depth-1', { hasText: 'Stock API' })).toBeVisible()
  await expect.poll(async () => {
    const doc = await studio.storedDoc()
    const warehouseId = doc.nodes.find((n) => n.label === 'Warehouse')?.id
    return !!warehouseId && doc.nodes.find((n) => n.label === 'Stock API')?.parentId === warehouseId
  }).toBe(true)
  // Viewer adds nothing.
  await studio.open('v-table', 'viewer')
  await expect(page.locator('.tv-wrap')).toBeVisible()
  await expect(page.locator('.tv-add-row')).toHaveCount(0)
})

test('fit, zoom and Smart Layout sit on the canvas, not in the toolbar', async ({ page }) => {
  const controls = page.locator('.canvas-column .canvas-controls')
  for (const name of [/Fit All/, /Zoom out/, /Zoom in/, /Smart Layout/]) {
    await expect(controls.getByRole('button', { name }).first()).toBeVisible()
    await expect(page.locator('.toolbar').getByRole('button', { name })).toHaveCount(0)
  }
  // Only the canvas has them: not the table view.
  await page.goto(page.url().replace(/\/v\/[^/]+$/, '/v/v-table'))
  await expect(page.locator('.tv-wrap')).toBeVisible()
  await expect(page.locator('.canvas-controls')).toHaveCount(0)
})

test('a click on an open panel section folds it; another section opens alone', async ({ page }) => {
  const header = (side: string, title: string) => page.locator(`.${side}-panel .lp-section-header`, { hasText: title })
  // A folded section keeps its content, at no height.
  const isOpen = (side: string, title: string) => page.locator(`.${side}-panel .lp-section`)
    .filter({ has: page.locator('.lp-section-header', { hasText: title }) }).locator('.lp-section-body.open')
  await expect(isOpen('left', 'Views')).toHaveCount(1)
  await header('left', 'Views').click()
  await expect(isOpen('left', 'Views')).toHaveCount(0)
  await header('left', 'Views').click()
  await expect(isOpen('left', 'Views')).toHaveCount(1)
  await header('left', 'Milestones').click()
  await expect(isOpen('left', 'Views')).toHaveCount(0)
  await expect(isOpen('left', 'Milestones')).toHaveCount(1)
  await header('left', 'Sequences').click()
  await expect(isOpen('left', 'Milestones')).toHaveCount(0)
  await expect(isOpen('left', 'Sequences')).toHaveCount(1)
  // A folded section says what it holds.
  await expect(header('left', 'Views')).toContainText('Open: System Context')
  await expect(header('left', 'Milestones')).toContainText(/Latest: |None saved yet/)
})

test('rename an element in the properties panel', async ({ page, studio }) => {
  await studio.node('payments').click()
  const label = studio.attribute('Name')
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
  await studio.open('v-containers')
  await expect(studio.nodes).toHaveCount(6)
  const edges = await studio.edges.count()
  // A database never starts an interaction in the C4 metamodel.
  await studio.connect(studio.node('db'), studio.node('customer'))
  await expect(page.getByText(/Relation not allowed: Database → Person/)).toBeVisible()
  await expect(studio.edges).toHaveCount(edges)
})

test('undo and redo', async ({ page, studio }) => {
  await studio.addFromPalette('Software System', await studio.nearBottom())
  await expect(studio.nodes).toHaveCount(4)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(studio.nodes).toHaveCount(3)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(studio.nodes).toHaveCount(4)
})

test('undoing the add of the selected element leaves no card and no selection', async ({ page, studio }) => {
  // The card stayed, empty, with "1 node selected" for an element that was gone.
  await studio.addFromPalette('Software System', await studio.nearBottom())
  await studio.nodeByLabel('System').click()
  await expect(studio.attribute('Name')).toHaveValue('System')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(studio.nodes).toHaveCount(3)
  await expect(studio.properties).toHaveCount(0)
  await expect(page.getByText(/node selected/)).toHaveCount(0)
})

test('the undo keys in a text field are about the typing, not the model', async ({ page, studio }) => {
  // The handler sat on the window and did not look at the focus: a typo
  // "undone" while writing took back the model's last step instead.
  await studio.addFromPalette('Software System', await studio.nearBottom())
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
    await studio.addFromPalette('Software System', await studio.nearBottom())
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
  await studio.open('v-containers')
  const parent = studio.attribute('Parent')
  await studio.node('payments').click()
  await parent.selectOption({ label: 'Bookstore' })
  await expect.poll(async () => (await studio.storedDoc()).nodes.find((n) => n.id === 'payments')?.parentId).toBe('bookstore')
  // It lies inside Bookstore's frame (it kept its old offset and lay outside).
  await studio.settle()
  await expect.poll(async () => studio.layoutViolations()).toEqual([])

  // Bookstore into its own child: the types allow a system in a system.
  // Its header's right end: the camera framed Payment Provider, and the
  // left of Bookstore may lie under the left panel.
  const frame = (await studio.node('bookstore').boundingBox())!
  await studio.node('bookstore').click({ position: { x: frame.width - 80, y: 12 } })
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
  await studio.addFromPalette('Software System', await studio.nearBottom())
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

type StoredSequences = { sequences: Array<{ relationIds: string[]; stepDescriptions?: Array<string | null> }> }

test('a step note shows the note after Undo, and leaving it unchanged writes nothing', async ({ page, studio }) => {
  // The note field was left to itself: after Undo it kept the undone text,
  // and a click into it and out wrote that text back.
  await studio.open('v-containers')
  await page.locator('[class*=header]', { hasText: /^SEQUENCES/i }).first().click()
  await page.locator('.lp-view-card', { hasText: 'Place Order' }).last().click()
  const note = page.locator('.right-panel .seq-step input').first()
  await expect(note).toHaveValue('submits the order')
  await note.fill('EDITED NOTE')
  await note.press('Enter')
  const firstNote = async () => (JSON.parse(await studio.storedJson()) as StoredSequences).sequences[0].stepDescriptions?.[0]
  await expect.poll(firstNote).toBe('EDITED NOTE')
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(firstNote).toBe('submits the order')
  await expect(note).toHaveValue('submits the order')
  await note.click()
  await note.press('Tab')
  await page.waitForTimeout(1200)
  expect(await firstNote()).toBe('submits the order')
  // Nothing was written: Undo still has the edit before it to take back,
  // the first Redo puts the edited note back.
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect.poll(firstNote).toBe('EDITED NOTE')
})

for (const mode of ['viewer', 'presenter'] as const) {
  test(`in ${mode}, a sequence picked is shown, and a click on a relation adds no step`, async ({ page, studio }) => {
    // Picking one turned on "Editing", and a click on a relation added a
    // step (never saved, gone back in Designer).
    await studio.open('v-containers', mode)
    await page.locator('[class*=header]', { hasText: /^SEQUENCES/i }).first().click()
    await page.locator('.lp-view-card', { hasText: 'Place Order' }).last().click()
    await expect(page.getByText(/Sequence: Place Order/)).toBeVisible()
    await expect(page.getByText(/Editing: Place Order/)).toHaveCount(0)
    await expect(page.locator('.lp-view-card', { hasText: 'Place Order' }).last()).not.toContainText(/editing/i)
    if (mode === 'viewer') await expect(page.locator('.right-panel .seq-step')).toHaveCount(4)
    const edge = page.locator('[data-testid="rf__edge-r3"] path.react-flow__edge-interaction').first()
    const mid = await edge.evaluate((el) => {
      const path = el as SVGPathElement
      const p = path.getPointAtLength(path.getTotalLength() / 2)
      const m = path.getScreenCTM()!
      return { x: p.x * m.a + m.e, y: p.y * m.d + m.f }
    })
    // The relation's badge numbers its steps: 3, and 3,5 with one more.
    const badges = page.locator('.react-flow__edgelabel-renderer')
    await expect(badges.getByText('3', { exact: true })).toBeVisible()
    await page.mouse.click(mid.x, mid.y)
    await page.waitForTimeout(500)
    await expect(badges.getByText('3,5', { exact: true })).toHaveCount(0)
    await expect(badges.getByText('3', { exact: true })).toBeVisible()
  })
}
