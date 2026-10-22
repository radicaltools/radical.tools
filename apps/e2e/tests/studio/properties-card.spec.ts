import { test, expect } from '../../support/fixtures'

// The properties card (RightPanel) on the bookstore System Context view:
// it lies over the canvas's right side, so the canvas keeps its size.
test.beforeEach(async ({ studio }) => {
  await studio.seed()
  await studio.open('v-context')
  await expect(studio.nodes).toHaveCount(3)
})

test('the properties card slides over the canvas on a selection and leaves its size alone', async ({ page, studio }) => {
  const before = await studio.canvas.boundingBox()
  await expect(studio.properties).toHaveCount(0)

  await studio.node('payments').click()
  await expect(studio.attribute('Name')).toHaveValue('Payment Provider')
  await expect(studio.properties.locator('.pp-type')).toHaveText(/system/i)
  expect(await studio.canvas.boundingBox()).toEqual(before)

  // Nothing selected: it goes.
  await studio.pane.click({ position: { x: 20, y: 20 } })
  await expect(studio.properties).toHaveCount(0)

  // ✕ hides it while the element stays selected; the next selection brings it back.
  await studio.node('payments').click()
  await studio.properties.getByRole('button', { name: 'Close properties' }).click()
  await expect(studio.properties).toHaveCount(0)
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(1)
  await studio.node('customer').click()
  await expect(studio.attribute('Name')).toHaveValue('Customer')
  expect(await studio.canvas.boundingBox()).toEqual(before)
})

test('after ✕ the card opens again for the element once something else was selected', async ({ studio }) => {
  // The card stayed hidden for that element until another ✕.
  const close = () => studio.properties.getByRole('button', { name: 'Close properties' }).click()
  await studio.node('customer').click()
  await close()
  await expect(studio.properties).toHaveCount(0)
  await studio.node('payments').click()
  await expect(studio.attribute('Name')).toHaveValue('Payment Provider')
  await studio.node('customer').click()
  await expect(studio.attribute('Name')).toHaveValue('Customer')

  // Nothing selected in between, and a view switch, count too.
  await close()
  await expect(studio.properties).toHaveCount(0)
  await studio.pane.click({ position: { x: 20, y: 20 } })
  await studio.node('customer').click()
  await expect(studio.attribute('Name')).toHaveValue('Customer')
  await close()
  await studio.open('v-containers')
  await studio.open('v-context')
  await studio.node('customer').click()
  await expect(studio.attribute('Name')).toHaveValue('Customer')
})

test('a long field reads as Markdown and edits on a click', async ({ page, studio }) => {
  await studio.node('payments').click()
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
  await studio.node('payments').click()
  const head = studio.properties.locator('.pp-head-actions')
  const buttons = () => head.getByRole('button').evaluateAll((all) => all.map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim()))
  await expect.poll(buttons).toEqual(['Explore', 'Close properties'])
  await head.getByRole('button', { name: 'Explore' }).click()
  await expect(page.locator('.explore-bar')).toContainText('Explore: Payment Provider')

  await studio.open('v-context', 'viewer')
  await studio.node('payments').click()
  await expect.poll(buttons).toEqual(['Explore', 'Close properties'])
  await expect(studio.properties.getByRole('button', { name: 'Delete element' })).toHaveCount(0)
})

test('a name or a description typed letter by letter is one undo step', async ({ page, studio }) => {
  const undo = page.getByRole('button', { name: 'Undo', exact: true })
  await studio.node('payments').click()
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
  await studio.node('payments').click()
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
  // The route names the selection: the reload selects it again and opens its card.
  await expect(studio.node('payments')).toHaveClass(/selected/)
  await expect.poll(async () => Math.round((await studio.properties.boundingBox())!.width)).toBe(Math.round(width + 100))
})

// Open points of runs 25 to 44: the card's Parent field listed parents a
// move then refused, and external systems, which the model leaves a box.
test('the card\'s Parent lists only where the element can go', async ({ studio }) => {
  await studio.open('v-containers')
  await studio.node('api').click()
  await expect(studio.attribute('Parent').locator('option')).toHaveText(['—', 'Bookstore'])
})

test('the card lists the views that show the element and opens one', async ({ page, studio }) => {
  await studio.node('bookstore').click()
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
  await studio.node('bookstore').click()
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
  await studio.node('payments').click({ modifiers: ['Shift'] })
  await expect(bar.locator('.sel-bar-badge')).toHaveText('2')
  await expect(studio.properties).toHaveCount(0)
  const canvas = (await studio.canvas.boundingBox())!
  expect((await bar.boundingBox())!.y).toBeLessThan(canvas.y + 40)
  await bar.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(studio.nodes).toHaveCount(0)

  // Viewer: no bar, no actions; Explore is on the card's head.
  await studio.open('v-containers', 'viewer')
  await studio.node('web').click()
  await studio.node('db').click({ modifiers: ['Shift'] })
  await expect(bar).toHaveCount(0)
  await studio.node('api').click()
  await expect(studio.properties.getByRole('region', { name: 'Actions' })).toHaveCount(0)
})

test('a relation\'s card changes its ends and hides it from the view', async ({ page, studio }) => {
  await studio.open('v-containers')
  await page.locator('[data-testid="rf__edge-r4"] path.react-flow__edge-interaction').first().click({ force: true })
  const actions = studio.properties.getByRole('region', { name: 'Actions' })
  await actions.getByRole('button', { name: /^Change source…/ }).click()
  await actions.getByRole('menuitem', { name: /^Web App/ }).click()
  await expect.poll(async () => ((await studio.storedDoc()).relations as Array<{ id: string; sourceId: string }>).find((r) => r.id === 'r4')?.sourceId).toBe('web')

  await page.locator('[data-testid="rf__edge-r3"] path.react-flow__edge-interaction').first().click({ force: true })
  await actions.getByRole('button', { name: 'Hide from view' }).click()
  await expect(page.getByTestId('rf__edge-r3')).toHaveCount(0)
  await expect(studio.properties).toHaveCount(0)
})
