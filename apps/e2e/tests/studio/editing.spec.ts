import { test, expect, fixture } from '../../support/fixtures'
import { addPicker } from '../../support/addPicker'
import type { Page } from '@playwright/test'

// The middle of a relation's drawn line, on screen: a route around elements
// can leave the centre of its box on something else.
async function edgeMid(page: Page, id: string): Promise<{ x: number; y: number }> {
  return page.locator(`[data-testid="rf__edge-${id}"] path.react-flow__edge-interaction`).first().evaluate((el) => {
    const path = el as SVGPathElement
    const p = path.getPointAtLength(path.getTotalLength() / 2)
    const m = path.getScreenCTM()!
    return { x: p.x * m.a + m.e, y: p.y * m.d + m.f }
  })
}

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

test('holding the connection key marks where a relation from the selected element can go, with its type', async ({ page, studio }) => {
  await studio.nodeByLabel('Customer').click()
  await page.keyboard.down('Alt')
  const targets = page.locator('.react-flow__node.connect-target')
  // Bookstore and Payment Provider, each with the type over it; Customer is the source.
  await expect(targets).toHaveCount(2)
  await expect(targets.first()).toHaveAttribute('style', /--connect-label: "[^"]+"/)
  await expect(page.locator('.react-flow__node.connecting-source')).toContainText('Customer')
  await page.keyboard.up('Alt')
  await expect(targets).toHaveCount(0)
})

test('a relation\'s end dragged with the special key shows where it can go, keeping its type', async ({ page, studio }) => {
  await studio.open('v-containers')
  // API → Payment Provider, selected: its ends show their handles.
  const r4 = await edgeMid(page, 'r4')
  await page.mouse.click(r4.x, r4.y)
  await studio.settle() // the camera frames the selection first
  const handle = page.locator('[data-testid="rf__edge-r4"] circle[r="10"]').nth(1)
  const at = (await handle.boundingBox())!
  await page.keyboard.down('Alt')
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2)
  await page.mouse.down()
  // Where the target can go, API staying the source.
  await expect(page.locator('.react-flow__node.connecting-source')).toHaveAttribute('data-id', 'api')
  await expect(page.locator('.react-flow__node.connect-target[data-id="customer"]')).toHaveAttribute('style', /--connect-label: "delivers to"/)
  // One type fits: its pill over Customer, and the drop anywhere on it moves the end.
  await expect(page.getByRole('group', { name: 'Drop on Customer' }).locator('.connect-pill')).toHaveText(['delivers to'])
  const customer = (await studio.node('customer').boundingBox())!
  await page.mouse.move(customer.x + customer.width / 2, customer.y + customer.height / 2, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await expect.poll(async () => (await studio.storedDoc()).relations.find((r) => r.id === 'r4')?.targetId).toBe('customer')
  await expect(page.locator('.react-flow__node.connect-target')).toHaveCount(0)
})

test('a container is not connected to the system that holds it, only marked as where it is', async ({ page, studio }) => {
  await studio.open('v-containers')
  await studio.nodeByLabel('API').click()
  await page.keyboard.down('Alt')
  const targets = page.locator('.react-flow__node.connect-target')
  await expect(targets.filter({ hasText: 'Web App' })).toHaveCount(1)
  await expect(targets.filter({ hasText: 'Orders DB' })).toHaveCount(1)
  // The system is marked only as where it is: "holds", no relation.
  await expect(page.locator('.react-flow__node.connect-target[data-id="bookstore"]')).toHaveAttribute('style', /--connect-label: "holds"/)
  // A line drawn onto the system's frame, beside its containers.
  const api = (await studio.nodeByLabel('API').boundingBox())!
  const frame = (await page.locator('.react-flow__node[data-id="bookstore"]').boundingBox())!
  await page.mouse.move(api.x + api.width / 2, api.y + api.height / 2)
  await page.mouse.down()
  await page.mouse.move(frame.x + 16, frame.y + 12, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up('Alt')
  // Where it is already: nothing happens.
  await page.waitForTimeout(300)
  expect((await studio.storedDoc()).relations).toHaveLength(4)
  expect(((await studio.storedDoc()).nodes as Array<{ id: string; parentId?: string }>).find((n) => n.id === 'api')?.parentId).toBe('bookstore')
})

test('the palette greys out the types a view\'s filter does not show', async ({ page, studio }) => {
  const palette = page.locator('.canvas-column .element-palette')
  // System Context lists its elements: it has no chain, and takes every type.
  await expect(palette.locator('.palette-item').first()).toBeVisible()
  await expect(palette.locator('.palette-item.disabled')).toHaveCount(0)

  // The sample's Domain map shows the domains only.
  await studio.openSample()
  await page.locator('.lp-view-card', { hasText: 'Domain map' }).click()
  await expect(palette.locator('.palette-item:not(.disabled)')).toHaveText(['Domain'])
  const person = palette.locator('.palette-item', { hasText: 'Person' })
  await expect(person).toHaveAttribute('aria-disabled', 'true')
  await expect(person).toHaveAttribute('draggable', 'false')
  await expect(person).toHaveAttribute('title', /This view's filter does not show it/)
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
  const top = addPicker(page, null)
  await top.choose('a software system')
  await top.option(/^New software system/).click()
  await page.locator('.tv-cell-input').fill('Warehouse')
  await page.keyboard.press('Enter')
  const warehouse = page.locator('.tv-row', { hasText: 'Warehouse' })
  await expect(warehouse).toBeVisible()
  // Inside it go the types a system may hold, from the + row under it.
  await page.getByRole('button', { name: 'Add under Warehouse' }).click()
  const inside = addPicker(page, 'Warehouse')
  await inside.choose('a container')
  await inside.option(/^New container/).click()
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

test('the left panel\'s sections are tabs on the activity rail, one open beside it, and say what they hold', async ({ page }) => {
  const tab = (title: string) => page.getByRole('tab', { name: title })
  const section = (title: string) => page.getByRole('tabpanel', { name: title })
  await expect(tab('Views')).toHaveAttribute('aria-selected', 'true')
  await expect(section('Views')).toBeVisible()
  // The open one folds the panel away and back, as in VS Code; the rail stays.
  await tab('Views').click()
  await expect(page.locator('.left-panel.collapsed')).toHaveCount(1)
  await expect(tab('Views')).toHaveAttribute('aria-selected', 'false')
  await expect(tab('Views')).toBeVisible()
  await tab('Views').click()
  await expect(page.locator('.left-panel.collapsed')).toHaveCount(0)
  await expect(section('Views')).toBeVisible()
  // The chevron on the panel's edge only folds it; the rail opens it again.
  await page.getByRole('button', { name: 'Collapse panel' }).click()
  await expect(page.locator('.left-panel.collapsed')).toHaveCount(1)
  await expect(page.getByRole('button', { name: /(Collapse|Expand) panel/ })).toHaveCount(0)
  await tab('Views').click()
  await expect(section('Views')).toBeVisible()
  // Another one, from a folded panel too, opens the panel on it.
  await tab('Views').click()
  await tab('Milestones').click()
  await expect(page.locator('.left-panel.collapsed')).toHaveCount(0)
  await expect(section('Views')).toBeHidden()
  await expect(section('Milestones')).toBeVisible()
  // ↓ moves to the next tab and opens it.
  await page.keyboard.press('ArrowDown')
  await expect(tab('Sequences')).toBeFocused()
  await expect(section('Sequences')).toBeVisible()
  await expect(section('Milestones')).toBeHidden()
  // Each tab gives its count, and on hover what its section holds.
  await expect(tab('Views')).toContainText(/\d+/)
  await expect(tab('Views')).toHaveAttribute('title', 'Views · Open: System Context')
  await expect(tab('Milestones')).toHaveAttribute('title', /Milestones · (Latest: |None saved yet)/)
})

test('rename an element in the properties panel', async ({ page, studio }) => {
  await studio.node('payments').dblclick()
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

test('a relation with no label shows how its type reads, as its card names it', async ({ page, studio }) => {
  await studio.connect(studio.node('payments'), studio.node('customer'))
  // Interacts to a person reads "delivers to" (Structurizr's delivers()),
  // not its id, nor "uses".
  await expect(page.locator('.relation-label', { hasText: /^delivers to$/ })).toHaveCount(1)
  await expect(page.locator('.relation-label', { hasText: /interacts|^uses$/ })).toHaveCount(0)
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

// Chrome on Windows and Linux sends Ctrl+Shift+Z as key 'Z', and with Caps
// Lock on Ctrl+Z is one too: the shortcut was compared with 'z' (F-0101).
test('Ctrl+Shift+Z redoes and Ctrl+Z undoes whatever the letter\'s case', async ({ page, studio }) => {
  await studio.addFromPalette('Software System', await studio.nearBottom())
  await expect(studio.nodes).toHaveCount(4)
  await page.keyboard.press('Control+z')
  await expect(studio.nodes).toHaveCount(3)
  await page.keyboard.press('Control+Shift+Z')
  await expect(studio.nodes).toHaveCount(4)
  await page.keyboard.press('Control+Z')
  await expect(studio.nodes).toHaveCount(3)
  await page.keyboard.press('Control+Y')
  await expect(studio.nodes).toHaveCount(4)
})

// Runs 65 to 69 (decided 2026-10-21): Viewer and Presenter showed Undo and
// Redo enabled, and they did nothing. Undo belongs to Designer.
test('Undo and Redo are Designer\'s: Viewer, Presenter and the metamodel editor show none', async ({ page, studio }) => {
  await studio.addFromPalette('Software System', await studio.nearBottom())
  await expect(studio.nodes).toHaveCount(4)
  const toolbar = page.locator('.toolbar')
  const undo = toolbar.getByRole('button', { name: 'Undo', exact: true })
  const redo = toolbar.getByRole('button', { name: 'Redo', exact: true })
  await expect(undo).toBeEnabled()
  for (const mode of ['Viewer', 'Presenter']) {
    await toolbar.getByRole('button', { name: mode, exact: true }).click()
    await expect(undo).toHaveCount(0)
    await expect(redo).toHaveCount(0)
    // Nor do the keys take Designer's step behind the user's back.
    await page.keyboard.press('ControlOrMeta+z')
  }
  await toolbar.getByRole('button', { name: 'Designer', exact: true }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: /Metamodel editor/ }).click()
  await expect(page.getByRole('button', { name: 'Close metamodel editor' })).toBeVisible()
  await expect(undo).toHaveCount(0)
  await expect(redo).toHaveCount(0)
  await page.getByRole('button', { name: 'Close metamodel editor' }).click()
  await expect(undo).toBeEnabled()
  await expect(studio.nodes).toHaveCount(4)
})

test('undoing the add of the selected element leaves no card and no selection', async ({ page, studio }) => {
  // The card stayed, empty, with "1 node selected" for an element that was gone.
  await studio.addFromPalette('Software System', await studio.nearBottom())
  await studio.nodeByLabel('System').dblclick()
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

test('the Parent field moves an element into its new parent, and offers no loop', async ({ page, studio }) => {
  await studio.open('v-containers')
  const parent = studio.attribute('Parent')
  await studio.node('payments').dblclick()
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
  // Its own child is not offered (it was, and the move was then refused).
  await expect(parent.locator('option', { hasText: 'Payment Provider' })).toHaveCount(0)
  await expect(studio.node('bookstore')).toBeVisible()
  expect((await studio.storedDoc()).nodes.find((n) => n.id === 'bookstore')?.parentId).toBeUndefined()
})

test('delete an element', async ({ page, studio }) => {
  await studio.node('payments').dblclick()
  await studio.properties.getByRole('button', { name: /^Delete element/ }).click()
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

test('Wrap into… makes room for the new parent beside what it wraps, also after a reload', async ({ page, studio }) => {
  // F-0020: the group round API lay on the database, and stayed there.
  await studio.seed()
  await studio.open('v-containers')
  expect(await studio.layoutViolations()).toEqual([])
  await studio.node('api').dblclick()
  const actions = studio.properties.getByRole('region', { name: 'Actions' })
  await actions.getByRole('button', { name: /^Wrap into…/ }).click()
  await actions.getByRole('menu').getByRole('menuitem', { name: 'Group', exact: true }).click()
  await expect.poll(async () => (await studio.storedDoc()).nodes.find((n) => n.id === 'api')?.parentId).not.toBe('bookstore')
  await studio.settle()
  expect(await studio.layoutViolations()).toEqual([])
  await page.waitForTimeout(1000)
  await page.reload()
  await studio.ready()
  expect(await studio.layoutViolations()).toEqual([])
})

test('Wrap into… leaves what it wraps where it is, hugged by the new parent, and moves nothing beside it', async ({ page, studio }) => {
  // API Gateway went 40 px right and 80 px down with its new group, below
  // Access & Security's header; the group, at 520 × 360, lay on Auth
  // Service, which was pushed 174 px up, and Access & Security and Core
  // Banking Platform grew up after it.
  await studio.openSample('view-core')
  const docId = studio.activeDocId()
  const before = await studio.positions()
  await studio.node('ctn-apigw').dblclick()
  const actions = studio.properties.getByRole('region', { name: 'Actions' })
  await actions.getByRole('button', { name: /^Wrap into…/ }).click()
  await actions.getByRole('menu').getByRole('menuitem', { name: 'Group', exact: true }).click()
  await expect.poll(async () => (await studio.storedDoc(docId)).nodes.find((n) => n.id === 'ctn-apigw')?.parentId).not.toBe('dom-access')
  await studio.settle()
  await page.waitForTimeout(1000)
  const after = await studio.positions()
  /** "translate(Xpx, Ypx) WxH" as a box. */
  const box = (p: string) => {
    const [x, y, w, h] = p.match(/-?[\d.]+/g)!.map(Number)
    return { x, y, w, h }
  }
  // It stays where it is drawn, and the group hugs it.
  expect(after['ctn-apigw']).toBe(before['ctn-apigw'])
  const group = Object.keys(after).find((id) => !before[id])!
  const [g, gw] = [box(after[group]), box(before['ctn-apigw'])]
  expect(g).toEqual({ x: gw.x - 30, y: gw.y - 70, w: gw.w + 60, h: gw.h + 100 })
  // Its parents grow round it, left and up, and no further.
  for (const id of ['dom-access', 'sys-core']) {
    const [b, a] = [box(before[id]), box(after[id])]
    expect(a.x, id).toBeLessThanOrEqual(b.x)
    expect(a.y, id).toBeLessThanOrEqual(b.y)
    // Within a pixel: the sample's frames have fractional sizes.
    expect(Math.abs(a.x + a.w - (b.x + b.w)), `${id} right`).toBeLessThan(1)
    expect(Math.abs(a.y + a.h - (b.y + b.h)), `${id} bottom`).toBeLessThan(1)
  }
  // Nothing else moves, Auth Service beside it least of all.
  expect(Object.keys(before).filter((id) => !['dom-access', 'sys-core'].includes(id) && after[id] !== before[id])
    .map((id) => `${id}: ${before[id]} → ${after[id]}`)).toEqual([])
  expect(await studio.layoutViolations(docId)).toEqual([])
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
  await page.getByRole('tab', { name: 'Sequences' }).click()
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

test('deleting a relation takes its steps out of the sequence, says so first, and Undo puts them back', async ({ page, studio }) => {
  // The step stayed: the flow numbered the steps left with gaps (D4).
  await studio.open('v-containers')
  const steps = async () => (JSON.parse(await studio.storedJson()) as StoredSequences).sequences[0].relationIds
  expect(await steps()).toEqual(['r1', 'r2', 'r3', 'r4'])
  const edge = page.locator('[data-testid="rf__edge-r3"] path.react-flow__edge-interaction').first()
  const mid = await edge.evaluate((el) => {
    const path = el as SVGPathElement
    const p = path.getPointAtLength(path.getTotalLength() / 2)
    const m = path.getScreenCTM()!
    return { x: p.x * m.a + m.e, y: p.y * m.d + m.f }
  })
  await page.mouse.click(mid.x, mid.y)
  await page.keyboard.press('Delete')
  const prompt = page.locator('.milestone-modal-backdrop')
  await expect(prompt).toContainText('The sequence step along its relations goes too.')
  await prompt.getByRole('button', { name: /Remove from model/ }).click()
  await expect.poll(steps).toEqual(['r1', 'r2', 'r4'])
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(steps).toEqual(['r1', 'r2', 'r3', 'r4'])
})

test('a step note shows the note after Undo, and leaving it unchanged writes nothing', async ({ page, studio }) => {
  // The note field was left to itself: after Undo it kept the undone text,
  // and a click into it and out wrote that text back.
  await studio.open('v-containers')
  await page.getByRole('tab', { name: 'Sequences' }).click()
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

test('a step turned to run the other way is drawn back as a response, kept, and undone', async ({ page, studio }) => {
  // A step could only run along its relation: an answer (the payment
  // provider's reply to the API) had no way to be a step of a flow.
  await page.locator('.lp-view-card', { hasText: 'Place Order Flow' }).click()
  await expect(page.locator('.seq-diagram-step')).toHaveCount(4)
  await page.getByRole('tab', { name: 'Sequences' }).click()
  await page.locator('.lp-view-card', { hasText: 'Place Order' }).last().click()
  const step = page.locator('.seq-step').nth(3)
  await expect(step).toContainText('API → Payment Provider')
  await step.hover()
  await step.getByTitle('Run the other way, as a response').click()
  await expect(step).toContainText('Payment Provider → API (response)')
  const stored = async () => (JSON.parse(await studio.storedJson()) as { sequences: Array<{ stepBackward?: boolean[] }> }).sequences[0].stepBackward
  await expect.poll(stored).toEqual([false, false, false, true])
  // The flow draws it from the provider's lifeline back to the API's, dashed.
  const back = page.locator('.seq-diagram-step[data-backward="true"]')
  await expect(back).toHaveCount(1)
  const line = back.locator('line')
  expect(Number(await line.getAttribute('x1'))).toBeGreaterThan(Number(await line.getAttribute('x2')))
  await expect(line).toHaveAttribute('stroke-dasharray', '5 3')
  // One undo step each way.
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(stored).toBeUndefined()
  await expect(back).toHaveCount(0)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect.poll(stored).toEqual([false, false, false, true])
  // Kept: the reload draws it back again.
  await page.reload()
  await expect(page.locator('.seq-diagram-step')).toHaveCount(4)
  await expect(page.locator('.seq-diagram-step[data-backward="true"]')).toHaveCount(1)
})

for (const mode of ['viewer', 'presenter'] as const) {
  test(`in ${mode}, a sequence picked is shown, and a click on a relation adds no step`, async ({ page, studio }) => {
    // Picking one turned on "Editing", and a click on a relation added a
    // step (never saved, gone back in Designer).
    await studio.open('v-containers', mode)
    await page.getByRole('tab', { name: 'Sequences' }).click()
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

test('a dialog keeps the keys: Tab stays in it, Ctrl+Z and F5 leave the model behind it alone', async ({ page, studio }) => {
  // Item 213: Ctrl+Z on the Models dialog undid a drag; F5 started a
  // presentation; the first Tab left for the toolbar behind.
  await studio.addFromPalette('Software System', await studio.nearBottom())
  await expect(studio.nodes).toHaveCount(4)
  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await page.getByRole('menuitem', { name: /Manage models/ }).click()
  const models = page.getByRole('dialog', { name: 'Models' })
  await expect(models).toBeVisible()
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    expect(await models.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('ControlOrMeta+z')
  await page.keyboard.press('F5')
  await expect(page.locator('.pres-hud')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(models).toBeHidden()
  await expect(studio.nodes).toHaveCount(4)
})

test('the activity rail keeps the app\'s menus in the metamodel editor, without the panel\'s sections', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: /Metamodel editor/ }).click()
  await expect(page.getByRole('button', { name: 'Close metamodel editor' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Views' })).toHaveCount(0)
  // Models is the folder at the toolbar's left; the rail's foot is
  // Settings, which holds the metamodel editor (marked open), AI and Export.
  await expect(page.locator('.toolbar').getByRole('button', { name: 'Models', exact: true })).toBeVisible()
  await expect(page.locator('.activity-rail').getByRole('button')).toHaveText([''])
  await expect(page.locator('.activity-rail').getByRole('button', { name: 'Settings', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('menuitemcheckbox', { name: /Metamodel editor/ })).toHaveAttribute('aria-checked', 'true')
  // Radical Forge… carries a hint while no AI provider is set up.
  for (const item of ['AI providers…', 'Radical Forge…', 'Export as PNG…', 'Export as SVG…', 'Copy to clipboard']) {
    await expect(page.getByRole('menu', { name: 'Settings' }).getByRole('menuitem', { name: new RegExp(`^${item.replace('.', '\\.')}`) })).toBeVisible()
  }
})

// With no sections above it (the metamodel editor, the Inspector), Settings
// rose to the rail's top.
test('Settings stays at the activity rail\'s foot where the rail has no sections', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: /Metamodel editor/ }).click()
  await expect(page.getByRole('button', { name: 'Close metamodel editor' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Views' })).toHaveCount(0)
  const rail = (await page.locator('.activity-rail').boundingBox())!
  const settings = (await page.locator('.activity-rail').getByRole('button', { name: 'Settings', exact: true }).boundingBox())!
  expect(rail.y + rail.height - (settings.y + settings.height)).toBeLessThan(16)
})

// F-0003: the editor's backdrop lay over the rail, so a click on Models or
// Settings closed the editor and opened no menu.
test('the activity rail\'s menus open over the metamodel editor, which stays open', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: /Metamodel editor/ }).click()
  const close = page.getByRole('button', { name: 'Close metamodel editor' })
  await expect(close).toBeVisible()
  for (const name of ['Models', 'Settings']) {
    await page.getByRole('button', { name, exact: true }).click()
    await expect(page.getByRole('menu', { name })).toBeVisible()
    await expect(close).toBeVisible()
    // Esc closes the menu, not the editor.
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu', { name })).toHaveCount(0)
    await expect(close).toBeVisible()
  }
})

test('the toolbar groups undo, navigation around Quick Search, and the branch\'s changes beside the perspectives', async ({ page }) => {
  const box = async (l: import('@playwright/test').Locator) => (await l.boundingBox())!
  const edit = await box(page.getByRole('group', { name: 'Edit' }))
  const navigate = await box(page.getByRole('group', { name: 'Navigate' }))
  const history = await box(page.getByRole('button', { name: 'History' }))
  const search = await box(page.locator('.quick-search-bar'))
  const changes = await box(page.locator('.toolbar .branch-btn'))
  const modes = await box(page.locator('.toolbar-mode-switch'))
  // Undo and Redo after Models and the model open, before the navigation.
  expect(edit.x + edit.width).toBeLessThan(navigate.x)
  // ‹ › just before Quick Search, the clock just after it, as in VS Code.
  expect(navigate.x + navigate.width).toBeLessThanOrEqual(search.x)
  expect(search.x - (navigate.x + navigate.width)).toBeLessThan(16)
  expect(history.x).toBeGreaterThanOrEqual(search.x + search.width)
  expect(history.x - (search.x + search.width)).toBeLessThan(16)
  // The branch's changes beside the perspectives, clear of the clock.
  expect(changes.x).toBeGreaterThan(history.x + history.width)
  expect(changes.x + changes.width).toBeLessThanOrEqual(modes.x)
})

// F-0001: below about 1160 px the toolbar's buttons lay on top of each
// other, and a click on Designer opened History.
test('at every window width down to the desktop app\'s narrowest, nothing in the toolbar lies on top of anything clickable', async ({ page }) => {
  const clash = () => page.evaluate(() => {
    const shown = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const items = [...document.querySelectorAll('.toolbar button, .quick-search-bar')].filter(shown)
    const name = (el: Element) => el.getAttribute('aria-label') || el.textContent?.trim() || el.className
    for (const el of items) {
      const r = el.getBoundingClientRect()
      if (r.left < 0 || r.right > window.innerWidth) return `${name(el)} is out of the window`
      if ((el as HTMLButtonElement).disabled) continue
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      if (!hit || !el.contains(hit)) return `${name(el)} is under ${hit ? name(hit) : 'nothing'}`
    }
    for (const a of items) for (const b of items) {
      if (a === b || a.contains(b) || b.contains(a)) continue
      const p = a.getBoundingClientRect(), q = b.getBoundingClientRect()
      if (p.left < q.right - 0.5 && q.left < p.right - 0.5 && p.top < q.bottom - 0.5 && q.top < p.bottom - 0.5) return `${name(a)} overlaps ${name(b)}`
    }
    return null
  })
  for (const mode of ['Designer', 'Viewer']) {
    await page.setViewportSize({ width: 1440, height: 800 })
    await page.locator('.toolbar-mode-btn', { hasText: mode }).click()
    await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(new RegExp(mode))
    for (let width = 1440; width >= 900; width -= 20) {
      await page.setViewportSize({ width, height: 800 })
      await expect.poll(clash, { message: `${mode} at ${width} px` }).toBeNull()
    }
  }
  // The perspectives still answer a click at the narrowest.
  await page.locator('.toolbar-mode-btn', { hasText: 'Designer' }).click()
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Designer/)
})

test('a menu of the activity rail answers ↑ and ↓ and closes when Tab leaves it', async ({ page }) => {
  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: /Manage models/ })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: /Import from Hub/ })).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(page.getByRole('menuitem', { name: /Manage models/ })).toBeFocused()
  await page.keyboard.press('End')
  for (let i = 0; i < 3 && await page.locator('.app-menu-popover').count(); i++) await page.keyboard.press('Tab')
  await expect(page.locator('.app-menu-popover')).toHaveCount(0)
})

test('Escape clears the selection on the canvas', async ({ page, studio }) => {
  await studio.node('customer').dblclick()
  await expect(studio.attribute('Name')).toHaveValue('Customer')
  await studio.node('customer').focus()
  await page.keyboard.press('Escape')
  await expect(studio.properties).toHaveCount(0)
  await expect(studio.node('customer')).not.toHaveClass(/selected/)
})

test('a relation\'s ends are rewired in Designer only', async ({ page, studio }) => {
  // Item 190: in Viewer and Presenter its end handles rewired it, unsaved.
  await studio.open('v-containers')
  const edge = page.locator('[data-testid="rf__edge-r2"] path.react-flow__edge-interaction').first()
  await edge.click({ force: true })
  await expect(page.getByTestId('rf__edge-r2').locator('circle.nodrag')).toHaveCount(2)
  await studio.open('v-containers', 'viewer')
  await page.locator('[data-testid="rf__edge-r2"] path.react-flow__edge-interaction').first().click({ force: true })
  await expect(page.getByTestId('rf__edge-r2')).toHaveClass(/selected/)
  await expect(page.locator('.react-flow__edge circle.nodrag')).toHaveCount(0)
})

test('⌘+ on a table leaves the browser its zoom, and the canvas after it draws without errors', async ({ page, studio }) => {
  // Item 217: the gone canvas's zoom wrote NaN (console errors, which the
  // guard fails on).
  await page.locator('.lp-view-card', { hasText: 'Element Table' }).click()
  await expect(page.locator('.tv-wrap')).toBeVisible()
  expect(await page.evaluate(() => typeof (window as unknown as { __radicalZoomIn?: unknown }).__radicalZoomIn)).toBe('undefined')
  await page.keyboard.press('ControlOrMeta+=')
  await page.locator('.lp-view-card', { hasText: 'System Context' }).click()
  await studio.settle()
  await expect(studio.nodes).toHaveCount(3)
  const scale = await page.locator('.react-flow__viewport').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a)
  expect(Number.isFinite(scale)).toBe(true)
})

test('view, milestone and sequence cards open from the keyboard', async ({ page }) => {
  // Item 215: only View properties' button was a Tab stop.
  const card = page.locator('.lp-view-card', { hasText: 'Containers' }).first()
  await card.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/v\/v-containers$/)
  const all = page.locator('.lp-view-card', { hasText: 'All elements' })
  await all.focus()
  await page.keyboard.press(' ')
  await expect(page).toHaveURL(/\/v\/all$/)
  await expect(page.locator('.lp-snap-current')).toHaveAttribute('tabindex', '0')
})

test('Move to… with many parents stays in the window and scrolls', async ({ page, studio }) => {
  // Item 168: at 1280×720 its first item stood above the window.
  await page.setViewportSize({ width: 1280, height: 720 })
  await studio.openSample('view-payment-process')
  await studio.nodeByLabel('Book the ledger').first().dblclick()
  // In the card, under its row.
  await studio.properties.getByRole('button', { name: /Move to…/ }).click()
  const menu = studio.properties.getByRole('menu')
  const box = (await menu.boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(48)
  await page.keyboard.press('ArrowDown')
  await expect(menu.getByRole('menuitem').first()).toBeFocused()
  await page.keyboard.press('End')
  await expect(menu.getByRole('menuitem').last()).toBeFocused()
  await expect(menu.getByRole('menuitem').last()).toBeInViewport()
})

// Open point of runs 45 to 64: after Enter or Tab in a table cell the
// keyboard went to the page body; Enter on the row renames it again.
test('a name written in the table leaves the keyboard on its row', async ({ page, studio }) => {
  await studio.open('v-table')
  const row = page.locator('tr.tv-row[data-node-id="api"]')
  await row.locator('.tv-chain-cell').click()
  await page.keyboard.press('F2')
  await page.locator('.tv-cell-input').fill('Orders API')
  await page.keyboard.press('Enter')
  await expect(row).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('.tv-cell-input')).toHaveValue('Orders API')
  await page.keyboard.press('Tab')
  await expect(row).toBeFocused()
})
