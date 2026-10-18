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
    node('checkout', 'process', 'Checkout', { x: 40, y: 400, width: 900, height: 360 }),
    node('pay', 'step', 'Pay', { parentId: 'checkout', order: 3, children: 'choice', x: 560, y: 50, width: 300, height: 280 }),
    node('take', 'step', 'Take the order', { parentId: 'checkout', order: 1, x: 30, y: 60 }),
    node('reserve', 'step', 'Reserve stock', { parentId: 'checkout', order: 2, repeat: '1..n', condition: 'for each order line', x: 290, y: 60 }),
    node('card', 'step', 'By card', { parentId: 'pay', order: 1, x: 40, y: 60 }),
    node('invoice', 'step', 'By invoice', { parentId: 'pay', order: 2, x: 40, y: 170 }),
    node('shop', 'system', 'Shop', { x: 40, y: 40, width: 600, height: 300 }),
    node('api', 'container', 'Checkout API', { parentId: 'shop', x: 40, y: 80 }),
  ],
  relations: [],
  views: [{ id: 'v-shop', name: 'Shop', nodeIds: ['shop', 'api'], positions: {} }],
}

async function openFolder(page: Page, studio: { ready(): Promise<void> }, model: DiagramData): Promise<ModelFolder> {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(model, 'Shop'))) await folder.write(path, content)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  return folder
}

async function openModel(page: Page, studio: { ready(): Promise<void> }): Promise<ModelFolder> {
  const folder = await openFolder(page, studio, MODEL)
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
  // An alternative happens at most once: (0,1) under each (Warnier–Orr).
  await expect(diagram.locator('.wn-label[data-node-id="card"] .wn-repeat')).toHaveText('(0,1)')

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

test('a process and an element of a custom type are drawn on the canvas', async ({ page, studio }) => {
  // A type added in the metamodel editor (a fork of the Radical metamodel).
  const radical = builtInGovernanceMetamodel()
  const metamodel = {
    ...radical, id: 'radical-custom', name: 'Radical (custom)',
    nodeTypes: { ...radical.nodeTypes, risk: { id: 'risk', label: 'Risk', color: '#b91c1c', fg: '#ffffff', iconPath: '', width: 220, height: 100, allowedAtRoot: true, properties: [] } },
  }
  const ids = ['checkout', 'take', 'reserve', 'pay', 'card', 'invoice', 'risk1']
  await openFolder(page, studio, {
    ...MODEL,
    metamodel,
    nodes: [...MODEL.nodes, node('risk1', 'risk', 'Card fraud', { x: 1000, y: 400, description: 'Stolen cards used at checkout.' })],
    views: [...(MODEL.views ?? []), { id: 'v-canvas', name: 'Checkout canvas', nodeIds: ids, positions: {} }],
  })
  await page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: 'Checkout canvas' }) }).click()

  // Checkout is a frame; its steps are cards inside it, with what they say.
  await expect(studio.node('checkout')).toContainText('Process')
  await expect(studio.node('reserve')).toContainText('(1,n)')
  await expect(studio.node('reserve')).toContainText('for each order line')
  await expect(studio.node('pay').getByLabel('Exactly one of the steps inside happens')).toHaveText('⊕')
  await expect(studio.node('card')).toContainText('(0,1)')
  const inside = async (child: string, parent: string) => {
    const c = (await studio.node(child).boundingBox())!
    const p = (await studio.node(parent).boundingBox())!
    return c.x >= p.x && c.y >= p.y && c.x + c.width <= p.x + p.width + 0.5 && c.y + c.height <= p.y + p.height + 0.5
  }
  await expect.poll(() => inside('reserve', 'checkout')).toBe(true)
  await expect.poll(() => inside('card', 'pay')).toBe(true)
  await expect.poll(() => inside('pay', 'checkout')).toBe(true)

  // Dashed arrows from step to step, by order; none between alternatives.
  const flows = page.locator('.react-flow__edge[data-testid^="rf__edge-flow:"]')
  await expect(flows).toHaveCount(2)
  await expect(page.getByTestId('rf__edge-flow:take>reserve')).toHaveCount(1)
  await expect(page.getByTestId('rf__edge-flow:reserve>pay')).toHaveCount(1)

  // The custom type: a card naming its type, in its colour.
  const risk = studio.node('risk1').locator('.c4-node-generic')
  await expect(risk).toContainText('Risk')
  await expect(risk).toContainText('Card fraud')
  await expect(risk).toHaveCSS('background-color', 'rgb(185, 28, 28)')
})

test('a step dropped on a step goes inside it, and every frame holds what it holds', async ({ page, studio }) => {
  await openFolder(page, studio, {
    metamodel: builtInGovernanceMetamodel(),
    nodes: [node('note', 'need', 'Checkout brief', { x: 1200, y: 40 })],
    relations: [],
    views: [{ id: 'v', name: 'Canvas', nodeIds: [], positions: {} }],
  })
  await page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: /^Canvas$/ }) }).click()
  const pane = (await studio.pane.boundingBox())!
  // Where an element is once the camera has stopped (it frames what was added).
  const centre = async (selector: string) => {
    let last = ''
    await expect.poll(async () => {
      const b = await page.locator(selector).first().boundingBox()
      const now = JSON.stringify(b)
      const still = now === last
      last = now
      return still
    }, { intervals: [150] }).toBe(true)
    const b = JSON.parse(last) as { x: number; y: number; width: number; height: number }
    return { x: b.x - pane.x + b.width / 2, y: b.y - pane.y + b.height / 2 }
  }
  // A process, a step into the process, a step into the step.
  await studio.addFromPalette('Process', { x: 300, y: 200 })
  await expect(page.locator('.react-flow__node-process')).toHaveCount(1)
  await studio.addFromPalette('Step', await centre('.react-flow__node-process'))
  await expect(page.locator('.react-flow__node-step')).toHaveCount(1)
  await studio.addFromPalette('Step', await centre('.react-flow__node-step'))
  await expect(page.locator('.react-flow__node-step')).toHaveCount(2)

  // Each frame holds its child: the step grew, and the process with it.
  const boxes = async () => page.locator('.react-flow__node').evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect()
    return { type: /react-flow__node-(\w+)/.exec(el.className)?.[1], x: r.x, y: r.y, r: r.x + r.width, b: r.y + r.height }
  }))
  const nested = async () => {
    const all = await boxes()
    const [proc] = all.filter((b) => b.type === 'process')
    const steps = all.filter((b) => b.type === 'step').sort((a, b) => (a.r - a.x) - (b.r - b.x))
    const inside = (c: typeof proc, p: typeof proc) => c.x >= p.x && c.y >= p.y && c.r <= p.r + 0.5 && c.b <= p.b + 0.5
    return steps.length === 2 && inside(steps[0], steps[1]) && inside(steps[1], proc)
  }
  await expect.poll(nested).toBe(true)
})
