import { expect } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { deserializeFromMdFolder } from '@radical/common/formats/mdFolder'
import type { C4Node, DiagramData } from '@radical/common/c4'
import type { Page } from '@playwright/test'

// Warnier–Orr diagrams: a process of steps, and any view's hierarchy, drawn
// left to right in braces, with how often a step runs (1,n), alternatives ⊕
// and what runs at once +. The viewpoint Process (Warnier) draws the
// processes; any view can be switched to the Warnier view type.

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 220, height: 80, collapsed: false, ...props }) as C4Node

const MODEL: DiagramData = {
  metamodel: builtInGovernanceMetamodel(),
  nodes: [
    node('checkout', 'process', 'Checkout'),
    node('pay', 'step', 'Pay', { parentId: 'checkout', order: 3, children: 'choice' }),
    node('take', 'step', 'Take the order', { parentId: 'checkout', order: 1 }),
    node('reserve', 'step', 'Reserve stock', { parentId: 'checkout', order: 2, repeat: '1..n', condition: 'for each order line' }),
    node('card', 'step', 'By card', { parentId: 'pay', order: 1 }),
    node('invoice', 'step', 'By invoice', { parentId: 'pay', order: 2 }),
    node('shop', 'system', 'Shop', { x: 40, y: 40, width: 600, height: 300 }),
    node('api', 'container', 'Checkout API', { parentId: 'shop', x: 40, y: 80 }),
  ],
  relations: [],
  views: [{ id: 'v-shop', name: 'Shop', nodeIds: ['shop', 'api'], positions: {} }],
}

async function openModel(page: Page, studio: { ready(): Promise<void> }): Promise<ModelFolder> {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(MODEL, 'Shop'))) await folder.write(path, content)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  // New view → Process (Warnier).
  await page.getByRole('button', { name: 'New view' }).click()
  const menu = page.getByRole('menu', { name: 'New view' })
  await menu.getByRole('group', { name: 'Process' }).getByRole('menuitem', { name: /^Process \(Warnier\)/ }).click()
  await expect(page.getByLabel('Warnier diagram')).toBeVisible()
  return folder
}

test('a process is drawn as a Warnier diagram and a click opens the step', async ({ page, studio }) => {
  await openModel(page, studio)
  const diagram = page.getByLabel('Warnier diagram')

  // Checkout on the left, its steps in a brace, in their order.
  const checkout = diagram.locator('.wn-roots > .wn-item')
  await expect(checkout).toHaveCount(1)
  await expect(checkout.locator(':scope > .wn-label .wn-name')).toHaveText('Checkout')
  await expect(checkout.locator(':scope > .wn-brace')).toBeVisible()
  await expect(checkout.locator(':scope > .wn-children > .wn-item > .wn-label .wn-name')).toHaveText(['Take the order', 'Reserve stock', 'Pay'])
  const reserve = diagram.locator('.wn-label[data-node-id="reserve"]')
  await expect(reserve.locator('.wn-repeat')).toHaveText('(1,n)')
  await expect(reserve.locator('.wn-condition')).toHaveText('for each order line')
  // Pay by card or by invoice: ⊕ between them.
  const pay = diagram.locator('.wn-item', { has: page.locator(':scope > .wn-label[data-node-id="pay"]') })
  await expect(pay.locator(':scope > .wn-children > .wn-item > .wn-label .wn-name')).toHaveText(['By card', 'By invoice'])
  await expect(pay.locator(':scope > .wn-children > .wn-operator')).toHaveText('⊕')

  // A click selects the step and opens its card.
  await diagram.locator('.wn-label[data-node-id="card"]').click()
  await expect(studio.attribute('Name')).toHaveValue('By card')
  await expect(diagram.locator('.wn-label[data-node-id="card"]')).toHaveClass(/selected/)

  // Any view reads as braces: the Shop structure view switched to Warnier.
  await page.locator('.rp-back-btn').click()
  const shopCard = page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: /^Shop$/ }) })
  await shopCard.click()
  await shopCard.getByTitle('View properties').click()
  await page.getByRole('group', { name: 'View type' }).getByRole('button', { name: 'Warnier' }).click()
  await expect(shopCard.locator('.lp-view-kind')).toHaveText('warnier')
  const shop = diagram.locator('.wn-roots > .wn-item')
  await expect(shop.locator(':scope > .wn-label .wn-name')).toHaveText('Shop')
  await expect(shop.locator(':scope > .wn-children > .wn-item > .wn-label .wn-name')).toHaveText(['Checkout API'])
})

test('a process is written in the Warnier view from the keyboard', async ({ page, studio }) => {
  const folder = await openModel(page, studio)
  const diagram = page.getByLabel('Warnier diagram')
  const label = (id: string) => diagram.locator(`.wn-label[data-node-id="${id}"]`)
  const names = (parentId: string) => diagram.locator('.wn-item', { has: page.locator(`:scope > .wn-label[data-node-id="${parentId}"]`) })
    .locator(':scope > .wn-children > .wn-item > .wn-label .wn-name')
  /** The steps of the model as saved: label → [parent label, order]. */
  const saved = async (): Promise<Record<string, [string, unknown]>> => {
    const data = deserializeFromMdFolder(await folder.files()).data
    const byId = Object.fromEntries(data.nodes.map((n) => [n.id, n]))
    return Object.fromEntries(data.nodes.filter((n) => n.type === 'step').map((n) => [n.label, [byId[n.parentId ?? '']?.label ?? '', (n as unknown as { order?: unknown }).order]]))
  }

  // Enter after Take the order: a new step, its name open.
  await label('take').click()
  await page.keyboard.press('Enter')
  const input = diagram.getByRole('textbox', { name: 'Name' })
  await expect(input).toHaveValue('New step')
  await input.fill('Check stock')
  await input.press('Enter')
  await expect(names('checkout')).toHaveText(['Take the order', 'Check stock', 'Reserve stock', 'Pay'])

  // Tab: inside Take the order; 1..n from the bar.
  await page.keyboard.press('Tab')
  await expect(names('take')).toHaveText(['Check stock'])
  await expect(names('checkout')).toHaveText(['Take the order', 'Reserve stock', 'Pay'])
  await page.getByRole('toolbar', { name: 'Edit outline' }).getByRole('combobox', { name: 'Repeat' }).selectOption('1..n')
  const checkStock = diagram.locator('.wn-label', { hasText: 'Check stock' })
  await expect(checkStock.locator('.wn-repeat')).toHaveText('(1,n)')

  // Alt+Up on Pay: before Reserve stock; the orders follow.
  await label('pay').click()
  await page.keyboard.press('Alt+ArrowUp')
  await expect(names('checkout')).toHaveText(['Take the order', 'Pay', 'Reserve stock'])
  await expect.poll(saved).toMatchObject({
    'Take the order': ['Checkout', 1], 'Pay': ['Checkout', 2], 'Reserve stock': ['Checkout', 3], 'Check stock': ['Take the order', 1],
  })

  // Shift+Tab on Check stock: out again, after Take the order.
  await checkStock.click()
  await page.keyboard.press('Shift+Tab')
  await expect(names('checkout')).toHaveText(['Take the order', 'Check stock', 'Pay', 'Reserve stock'])
  await expect.poll(saved).toMatchObject({ 'Take the order': ['Checkout', 1], 'Check stock': ['Checkout', 2], 'Pay': ['Checkout', 3], 'Reserve stock': ['Checkout', 4] })

  // One undo puts it back inside, orders and all.
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(names('take')).toHaveText(['Check stock'])
  await expect(names('checkout')).toHaveText(['Take the order', 'Pay', 'Reserve stock'])
  await expect.poll(saved).toMatchObject({ 'Check stock': ['Take the order', 1], 'Pay': ['Checkout', 2] })
})
