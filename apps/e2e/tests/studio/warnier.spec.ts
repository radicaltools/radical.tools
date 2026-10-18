import { expect } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import type { C4Node, DiagramData } from '@radical/common/c4'

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

test('a process is drawn as a Warnier diagram and a click opens the step', async ({ page, studio }) => {
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
  const diagram = page.getByLabel('Warnier diagram')
  await expect(diagram).toBeVisible()

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
