import type { Page } from '@playwright/test'
import { test, expect } from '../../support/fixtures'

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

// The properties card (RightPanel) on the bookstore System Context view:
// it lies over the canvas's right side, so the canvas keeps its size.
test.beforeEach(async ({ studio }) => {
  await studio.seed()
  await studio.open('v-context')
  await expect(studio.nodes).toHaveCount(3)
})

test('the properties card slides over the canvas on a double-click and leaves its size alone', async ({ page, studio }) => {
  const before = await studio.canvas.boundingBox()
  await expect(studio.properties).toHaveCount(0)

  await studio.node('payments').dblclick()
  await expect(studio.attribute('Name')).toHaveValue('Payment Provider')
  await expect(studio.properties.locator('.pp-type')).toHaveText(/system/i)
  expect(await studio.canvas.boundingBox()).toEqual(before)

  // Nothing selected: it goes.
  await studio.pane.click({ position: { x: 20, y: 20 } })
  await expect(studio.properties).toHaveCount(0)

  // ✕ hides it while the element stays selected, until a double-click opens it again.
  await studio.node('payments').dblclick()
  await studio.properties.getByRole('button', { name: 'Close properties' }).click()
  await expect(studio.properties).toHaveCount(0)
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(1)
  await studio.node('customer').click()
  await expect(studio.properties).toHaveCount(0)
  await studio.node('customer').dblclick()
  await expect(studio.attribute('Name')).toHaveValue('Customer')
  expect(await studio.canvas.boundingBox()).toEqual(before)
})

test('a click selects, a double-click opens the card, which then follows the selection', async ({ page, studio }) => {
  await studio.node('customer').click()
  await expect(studio.node('customer')).toHaveClass(/selected/)
  await expect(studio.properties).toHaveCount(0)
  await studio.node('customer').dblclick()
  await expect(studio.attribute('Name')).toHaveValue('Customer')
  // Open, it shows what a click selects next, until nothing is selected.
  await studio.node('bookstore').click()
  await expect(studio.attribute('Name')).toHaveValue('Bookstore')
  await studio.pane.click({ position: { x: 20, y: 20 } })
  await expect(studio.properties).toHaveCount(0)
  await studio.node('bookstore').click()
  await expect(studio.properties).toHaveCount(0)

  // A relation opens its card on a double-click too.
  await studio.open('v-containers')
  const r4 = await edgeMid(page, 'r4')
  await page.mouse.dblclick(r4.x, r4.y)
  await expect(studio.properties.getByRole('region', { name: 'Actions' }).getByRole('button', { name: /^Change source…/ })).toBeVisible()

  // A table row: a click selects, F2 renames, a double-click opens the card.
  await studio.open('v-table')
  const api = page.locator('tr.tv-row[data-node-id="api"]')
  await api.click()
  await expect(api).toHaveClass(/tv-row-selected/)
  await expect(studio.properties).toHaveCount(0)
  await page.keyboard.press('F2')
  await expect(page.locator('.tv-cell-input')).toHaveValue('API')
  await page.keyboard.press('Escape')
  await api.dblclick()
  await expect(studio.attribute('Name')).toHaveValue('API')
})

test('a long field reads as Markdown and edits on a click', async ({ page, studio }) => {
  await studio.node('payments').dblclick()
  const description = studio.properties.getByRole('button', { name: 'Edit Description' })
  await expect(description).toHaveText('Card payments')
  await description.click()
  const editor = studio.properties.getByLabel('Description', { exact: true })
  await editor.fill('**Card** payments')
  await editor.press('Escape')
  await expect(description.locator('strong')).toHaveText('Card')
  await expect.poll(async () => ((await studio.storedDoc()).nodes as Array<{ id: string; description?: string }>).find((n) => n.id === 'payments')?.description).toBe('**Card** payments')
  // Delete, the card's last section, deletes it.
  await expect(studio.properties.locator('.pp-section').last()).toContainText('Delete element')
  await studio.properties.getByRole('button', { name: 'Delete element' }).click()
  await expect(studio.node('payments')).toHaveCount(0)
})

test('the card\'s head explores from the element, in Designer and Viewer, and Viewer cannot delete it', async ({ page, studio }) => {
  await studio.node('payments').dblclick()
  const head = studio.properties.locator('.pp-head-actions')
  const buttons = () => head.getByRole('button').evaluateAll((all) => all.map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim()))
  await expect.poll(buttons).toEqual(['Explore', 'Close properties'])
  await head.getByRole('button', { name: 'Explore' }).click()
  await expect(page.locator('.explore-bar')).toContainText('Explore: Payment Provider')

  await studio.open('v-context', 'viewer')
  await studio.node('payments').dblclick()
  await expect.poll(buttons).toEqual(['Explore', 'Close properties'])
  await expect(studio.properties.getByRole('button', { name: 'Delete element' })).toHaveCount(0)
})

test('a name or a description typed letter by letter is one undo step', async ({ page, studio }) => {
  const undo = page.getByRole('button', { name: 'Undo', exact: true })
  await studio.node('payments').dblclick()
  const name = studio.attribute('Name')
  await name.click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type('Card Gateway')
  await page.keyboard.press('Tab')
  await studio.properties.getByRole('button', { name: 'Edit Description' }).click()
  await page.keyboard.type(' by card')
  await page.keyboard.press('Escape')
  await expect(studio.node('payments')).toContainText('Card Gateway')

  await undo.click()
  await expect(studio.properties.getByRole('button', { name: 'Edit Description' })).toHaveText('Card payments')
  await expect(name).toHaveValue('Card Gateway')
  await undo.click()
  await expect(name).toHaveValue('Payment Provider')
  await expect(studio.node('payments')).toContainText('Payment Provider')
})

test('the card is as wide as it was dragged, also after a reload', async ({ page, studio }) => {
  await studio.node('payments').dblclick()
  const card = studio.properties
  await page.waitForTimeout(400) // done sliding in
  const width = (await card.boundingBox())!.width
  const edge = (await card.locator('.pp-resize').boundingBox())!
  await page.mouse.move(edge.x + edge.width / 2, edge.y + 40)
  await page.mouse.down()
  await page.mouse.move(edge.x + edge.width / 2 - 100, edge.y + 40, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => Math.round((await card.boundingBox())!.width)).toBe(Math.round(width + 100))

  await page.reload()
  await studio.ready()
  // The route names the selection: the reload selects it again; its card
  // opens on a double-click, as wide as it was.
  await expect(studio.node('payments')).toHaveClass(/selected/)
  await studio.node('payments').dblclick()
  await expect.poll(async () => Math.round((await studio.properties.boundingBox())!.width)).toBe(Math.round(width + 100))
})

// Open points of runs 25 to 44: the card's Parent field listed parents a
// move then refused, and external systems, which the model leaves a box.
test('the card\'s Parent lists only where the element can go', async ({ studio }) => {
  await studio.open('v-containers')
  await studio.node('api').dblclick()
  await expect(studio.attribute('Parent').locator('option')).toHaveText(['—', 'Bookstore'])
})

test('the card lists the views that show the element and opens one', async ({ page, studio }) => {
  await studio.node('bookstore').dblclick()
  const views = studio.properties.getByRole('region', { name: 'Views' })
  await expect(views.locator('.pp-section-title')).toHaveText('Views · 3')
  // Place Order Flow lists the containers, not Bookstore; Element Table shows the whole model.
  await expect(views.locator('.pp-view-name')).toHaveText(['System Context', 'Containers', 'Element Table'])
  await expect(views.locator('[aria-current="true"] .pp-view-name')).toHaveText('System Context')

  await views.getByRole('button', { name: /^Containers/ }).click()
  await expect(page).toHaveURL(/\/v\/v-containers/)
  await expect(page.locator('.react-flow__node.selected')).toHaveAttribute('data-id', 'bookstore')
  await expect(studio.attribute('Name')).toHaveValue('Bookstore')
  await expect(views.locator('[aria-current="true"] .pp-view-name')).toHaveText('Containers')

  // A view that is no canvas opens too, the element still selected.
  await views.getByRole('button', { name: /^Element Table/ }).click()
  await expect(page).toHaveURL(/\/v\/v-table/)
  await expect(studio.attribute('Name')).toHaveValue('Bookstore')
})

test('one element\'s actions are in its card, several elements\' in a bar over the top of the canvas', async ({ page, studio }) => {
  const bar = page.getByRole('toolbar', { name: 'Selection actions' })
  await studio.node('bookstore').dblclick()
  await expect(bar).toHaveCount(0)
  const actions = studio.properties.getByRole('region', { name: 'Actions' })
  await expect(actions.getByRole('button', { name: 'Unwrap' })).toBeVisible()
  // Its menus open in the card, under their row.
  await actions.getByRole('button', { name: /^Wrap into…/ }).click()
  await expect(actions.getByRole('menu').getByRole('menuitem').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(actions.getByRole('menu')).toHaveCount(0)
  await actions.getByRole('button', { name: 'Hide from view' }).click()
  await expect(studio.node('bookstore')).toHaveCount(0)

  // Two elements: the bar, at the top of the canvas, and no card.
  await studio.node('customer').click()
  await studio.node('payments').click({ modifiers: ['Alt'] })
  await expect(bar.locator('.sel-bar-badge')).toHaveText('2')
  await expect(studio.properties).toHaveCount(0)
  const canvas = (await studio.canvas.boundingBox())!
  expect((await bar.boundingBox())!.y).toBeLessThan(canvas.y + 40)
  await bar.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(studio.nodes).toHaveCount(0)

  // Viewer: no bar, no actions; Explore is on the card's head.
  await studio.open('v-containers', 'viewer')
  await studio.node('web').click()
  await studio.node('db').click({ modifiers: ['Alt'] })
  await expect(bar).toHaveCount(0)
  await studio.node('api').dblclick()
  await expect(studio.properties.getByRole('region', { name: 'Actions' })).toHaveCount(0)
})

test('a relation\'s card changes its ends and hides it from the view', async ({ page, studio }) => {
  await studio.open('v-containers')
  const r4 = await edgeMid(page, 'r4')
  await page.mouse.dblclick(r4.x, r4.y)
  const actions = studio.properties.getByRole('region', { name: 'Actions' })
  await actions.getByRole('button', { name: /^Change source…/ }).click()
  await actions.getByRole('menuitem', { name: /^Web App/ }).click()
  await expect.poll(async () => ((await studio.storedDoc()).relations as Array<{ id: string; sourceId: string }>).find((r) => r.id === 'r4')?.sourceId).toBe('web')

  const r3 = await edgeMid(page, 'r3')
  await page.mouse.click(r3.x, r3.y)
  await actions.getByRole('button', { name: 'Hide from view' }).click()
  await expect(page.getByTestId('rf__edge-r3')).toHaveCount(0)
  await expect(studio.properties).toHaveCount(0)
})
