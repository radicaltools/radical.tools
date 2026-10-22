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

async function openFolder(page: Page, studio: { ready(): Promise<void>; designer(): Promise<void> }, model: DiagramData): Promise<ModelFolder> {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(model, 'Shop'))) await folder.write(path, content)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  // Opened without a link, it starts in Viewer; these tests edit.
  await studio.designer()
  return folder
}

async function openModel(page: Page, studio: { ready(): Promise<void>; designer(): Promise<void> }): Promise<ModelFolder> {
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
  await expect(checkout.locator(':scope > .wn-node > .wn-label .wn-name')).toHaveText('Checkout')
  await expect(checkout.locator(':scope > .wn-brace')).toBeVisible()
  await expect(checkout.locator(':scope > .wn-children > .wn-item > .wn-node > .wn-label .wn-name')).toHaveText(['Take the order', 'Reserve stock', 'Pay'])
  const reserve = diagram.locator('.wn-label[data-node-id="reserve"]')
  await expect(reserve.locator('.wn-repeat')).toHaveText('(1,n)')
  await expect(reserve.locator('.wn-condition')).toHaveText('for each order line')
  // Pay by card or by invoice: ⊕ between them.
  const pay = diagram.locator('.wn-item', { has: page.locator(':scope > .wn-node > .wn-label[data-node-id="pay"]') })
  await expect(pay.locator(':scope > .wn-children > .wn-item > .wn-node > .wn-label .wn-name')).toHaveText(['By card', 'By invoice'])
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
  await expect(shop.locator(':scope > .wn-node > .wn-label .wn-name')).toHaveText('Shop')
  await expect(shop.locator(':scope > .wn-children > .wn-item > .wn-node > .wn-label .wn-name')).toHaveText(['Checkout API'])
})

test('a process is written in the Warnier view from the keyboard', async ({ page, studio }) => {
  const folder = await openModel(page, studio)
  const diagram = page.getByLabel('Warnier diagram')
  const label = (id: string) => diagram.locator(`.wn-label[data-node-id="${id}"]`)
  const names = (parentId: string) => diagram.locator('.wn-item', { has: page.locator(`:scope > .wn-node > .wn-label[data-node-id="${parentId}"]`) })
    .locator(':scope > .wn-children > .wn-item > .wn-node > .wn-label .wn-name')
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

  // Tab: inside Take the order; (1,n) from its repetition mark.
  await page.keyboard.press('Tab')
  await expect(names('take')).toHaveText(['Check stock'])
  await expect(names('checkout')).toHaveText(['Take the order', 'Reserve stock', 'Pay'])
  await diagram.getByRole('button', { name: 'Set the repeat of Check stock' }).click()
  await page.getByRole('dialog', { name: 'Repeat of Check stock' }).getByRole('button', { name: '(1,n)' }).click()
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

test('an element added after another stays after it, whatever its name', async ({ page, studio }) => {
  // Steps made elsewhere, with no order: they stand by name.
  await openFolder(page, studio, {
    metamodel: builtInGovernanceMetamodel(),
    nodes: [node('p', 'process', 'Checkout'), node('z', 'step', 'Zeta', { parentId: 'p' }), node('a', 'step', 'Alpha', { parentId: 'p' })],
    relations: [],
    views: [{ id: 'w', name: 'Processes', kind: 'warnier', viewpoint: 'process-warnier', nodeIds: [], positions: {}, pipeline: { levels: [{ ways: [{ types: ['process', 'step'] }] }] } }],
  })
  await page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: 'Processes' }) }).click()
  const diagram = page.getByLabel('Warnier diagram')
  const names = diagram.locator('.wn-name')
  const addAfter = async (after: string, name: string) => {
    await diagram.locator('.wn-label', { hasText: after }).click()
    await page.keyboard.press('Enter')
    await diagram.locator('.wn-name-input').fill(name)
    await diagram.locator('.wn-name-input').press('Enter')
  }
  await expect(names).toHaveText(['Checkout', 'Alpha', 'Zeta'])
  await addAfter('Alpha', 'Beta')
  await expect(names).toHaveText(['Checkout', 'Alpha', 'Beta', 'Zeta'])
  // A process after Checkout, named to come first by name: it stays after.
  await addAfter('Checkout', 'Billing')
  await expect(names).toHaveText(['Checkout', 'Alpha', 'Beta', 'Zeta', 'Billing'])
})

test('a process is built by clicking where it is drawn, from an empty Warnier view', async ({ page, studio }) => {
  await openFolder(page, studio, { metamodel: builtInGovernanceMetamodel(), nodes: [], relations: [] })
  await page.getByRole('button', { name: 'New view' }).click()
  await page.getByRole('menu', { name: 'New view' }).getByRole('menuitem', { name: /^Process \(Warnier\)/ }).click()
  const diagram = page.getByLabel('Warnier diagram')
  const input = diagram.locator('.wn-name-input')
  const name = async (text: string) => { await input.fill(text); await input.press('Enter') }
  const card = (text: string) => diagram.locator('.wn-label', { has: page.locator('.wn-name', { hasText: new RegExp(`^${text}$`) }) })
  const item = (text: string) => diagram.locator('.wn-item', { has: page.locator(':scope > .wn-node .wn-name', { hasText: new RegExp(`^${text}$`) }) })

  // An empty view offers a process; + beside it adds its first step, + under the brace the next.
  await diagram.getByRole('button', { name: '+ Process' }).click()
  await name('Checkout')
  await diagram.getByRole('button', { name: 'Add a step inside Checkout' }).click()
  // Typed, not yet kept with Enter: the next + keeps it and adds the next.
  await input.fill('Take the order')
  await diagram.getByRole('button', { name: 'Add a step to Checkout' }).click()
  await expect(input).toHaveValue('New step')
  await input.fill('Reserve stock')
  await diagram.getByRole('button', { name: 'Add a step to Checkout' }).click()
  await name('Pay')
  await expect(diagram.locator('.wn-name')).toHaveText(['Checkout', 'Take the order', 'Reserve stock', 'Pay'])
  // Its controls show under the pointer without changing its size.
  await page.mouse.click(1000, 800)
  const before = await card('Take the order').boundingBox()
  await card('Take the order').hover()
  await expect(diagram.getByRole('group', { name: 'Actions of Take the order' })).toBeVisible()
  expect(await card('Take the order').boundingBox()).toEqual(before)
  // (1,n) for each order line, from the repetition mark.
  await card('Reserve stock').click()
  await diagram.getByRole('button', { name: 'Set the repeat of Reserve stock' }).click()
  const repeat = page.getByRole('dialog', { name: 'Repeat of Reserve stock' })
  await repeat.getByRole('button', { name: '(1,n)' }).click()
  await repeat.getByRole('textbox', { name: 'Condition' }).fill('for each order line')
  await repeat.getByRole('textbox', { name: 'Condition' }).press('Enter')
  await expect(card('Reserve stock').locator('.wn-repeat')).toHaveText('(1,n)')
  await expect(card('Reserve stock').locator('.wn-condition')).toHaveText('for each order line')
  // Pay by card or by invoice: a click on Pay's brace makes them a choice.
  await card('Pay').click()
  await diagram.getByRole('button', { name: 'Add a step inside Pay' }).click()
  // The + beside a step being named: kept, and its first step added.
  await input.fill('By card')
  await diagram.getByRole('button', { name: 'Add a step to Pay' }).click()
  await expect(input).toHaveValue('New step')
  await input.press('Escape')
  await page.keyboard.press('Delete')
  await page.locator('.milestone-modal-backdrop').getByRole('button', { name: /Remove from model/ }).click()
  await expect(diagram.locator('.wn-name')).toHaveText(['Checkout', 'Take the order', 'Reserve stock', 'Pay', 'By card'])
  await diagram.getByRole('button', { name: 'Add a step to Pay' }).click()
  await name('By invoice')
  await item('Pay').locator(':scope > .wn-brace').click()
  await expect(diagram.locator('.wn-name')).toHaveText(['Checkout', 'Take the order', 'Reserve stock', 'Pay', 'By card', 'By invoice'])
  await expect(diagram.locator('.wn-operator')).toHaveText(['⊕'])

  // The card's actions: indent and outdent say nothing; Escape closes the delete prompt.
  await card('Pay').click()
  const actions = diagram.getByRole('group', { name: 'Actions of Pay' })
  await actions.getByRole('button', { name: 'Indent' }).click()
  await expect(item('Reserve stock').locator(':scope > .wn-children .wn-name').first()).toHaveText('Pay')
  await diagram.getByRole('group', { name: 'Actions of Pay' }).getByRole('button', { name: 'Outdent' }).click()
  await expect(page.getByRole('region', { name: 'Notifications' })).toHaveCount(0)
  await diagram.getByRole('group', { name: 'Actions of Pay' }).getByRole('button', { name: 'Delete' }).click()
  await expect(page.locator('.milestone-modal-backdrop')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.locator('.milestone-modal-backdrop')).toHaveCount(0)
  await expect(diagram.locator('.wn-name')).toHaveText(['Checkout', 'Take the order', 'Reserve stock', 'Pay', 'By card', 'By invoice'])

  // + Process under the processes adds the next.
  await diagram.getByRole('button', { name: '+ Process' }).click()
  await name('Billing')
  await expect(diagram.locator('.wn-roots > .wn-item > .wn-node > .wn-label .wn-name')).toHaveText(['Checkout', 'Billing'])
})

test('in a milestone, the name of the first element added stays open through the question how to save it', async ({ page, studio }) => {
  // The question opens on the first edit of a milestone; a click on it took
  // the focus from the new process's name, which closed: what was typed
  // then was lost, and Enter added a second "New process".
  await studio.openSample('view-processes')
  await page.getByRole('tab', { name: 'Milestones' }).click()
  await page.locator('.lp-snap-card', { hasText: 'v4' }).click()
  await expect(page).toHaveURL(/\/s\//)
  const diagram = page.getByLabel('Warnier diagram')
  const before = await diagram.locator('.wn-name').count()
  await diagram.getByRole('button', { name: '+ Process' }).first().click()
  await page.locator('.milestone-modal').getByRole('button', { name: 'Continue editing (decide later)' }).click()
  const input = diagram.locator('.wn-name-input')
  await expect(input).toBeFocused()
  await page.keyboard.type('Onboard a customer')
  await page.keyboard.press('Enter')
  await expect(input).toHaveCount(0)
  await expect(diagram.locator('.wn-name')).toHaveCount(before + 1)
  await expect(diagram.locator('.wn-name', { hasText: /^Onboard a customer$/ })).toHaveCount(1)
})

test('in a view of one process, what is added or moved stays in that process', async ({ page, studio }) => {
  const folder = await openFolder(page, studio, MODEL)
  // New view → Process: a view per element, one of Checkout.
  await page.getByRole('button', { name: 'New view' }).click()
  await page.getByRole('menu', { name: 'New view' }).getByRole('group', { name: 'Process' }).getByRole('menuitem', { name: /^Process(?! \()/ }).click()
  const diagram = page.getByLabel('Warnier diagram')
  const label = (id: string) => diagram.locator(`.wn-label[data-node-id="${id}"]`)
  const names = diagram.locator('.wn-item', { has: page.locator(':scope > .wn-node > .wn-label[data-node-id="checkout"]') })
    .locator(':scope > .wn-children > .wn-item > .wn-node > .wn-label .wn-name')
  await expect(diagram.locator('.wn-roots > .wn-item > .wn-node > .wn-label .wn-name')).toHaveText(['Checkout'])
  // Another process would not be drawn here: none is offered.
  await expect(diagram.getByRole('button', { name: '+ Process' })).toHaveCount(0)

  // Enter on Checkout adds its last step, its name open.
  await label('checkout').click()
  await page.keyboard.press('Enter')
  const input = diagram.getByRole('textbox', { name: 'Name' })
  await expect(input).toHaveValue('New step')
  await input.fill('Ship')
  await input.press('Enter')
  await expect(names).toHaveText(['Take the order', 'Reserve stock', 'Pay', 'Ship'])
  await expect.poll(async () => {
    const data = deserializeFromMdFolder(await folder.files()).data
    return data.nodes.filter((n) => n.type === 'process').map((n) => n.label)
  }).toEqual(['Checkout'])
  await expect.poll(async () => deserializeFromMdFolder(await folder.files()).data.nodes.find((n) => n.label === 'Ship')?.parentId).toBe('checkout')

  // Outdented, a step of Checkout would leave it, and the view: it stays.
  await label('take').click()
  await page.keyboard.press('Shift+Tab')
  await expect(diagram.getByRole('group', { name: 'Actions of Take the order' }).getByRole('button', { name: 'Outdent' })).toBeDisabled()
  await expect(names).toHaveText(['Take the order', 'Reserve stock', 'Pay', 'Ship'])
})

// Item 182: + Process in a Warnier view filtered to "inside Shop" added the
// process at the top of the model, which the view did not show.
test('+ Process in a view filtered to inside an element adds the process there', async ({ page, studio }) => {
  const model = { ...MODEL, views: [...MODEL.views!, { id: 'v-in', name: 'Shop processes', kind: 'warnier' as const, nodeIds: [], positions: {}, pipeline: { levels: [{ ways: [{ types: ['process', 'step'] }], filters: [{ kind: 'within' as const, nodeId: 'shop' }] }] } }] }
  await studio.seedDocument(JSON.stringify(model))
  await studio.open('v-in')
  const diagram = page.getByLabel('Warnier diagram')
  await diagram.getByRole('button', { name: '+ Process' }).first().click()
  const input = diagram.getByRole('textbox', { name: 'Name' })
  await input.fill('Restock')
  await input.press('Enter')
  await expect(diagram.locator('.wn-name', { hasText: /^Restock$/ })).toHaveCount(1)
  await expect.poll(async () => (await studio.storedDoc()).nodes.find((n) => n.label === 'Restock')?.parentId).toBe('shop')
})

// Item 183: a Warnier slide played with F5 from Designer could be edited,
// and Ctrl+Z after Exit then added the edit to the model.
test('a Warnier slide played from Designer cannot be edited', async ({ page, studio }) => {
  const model = {
    ...MODEL,
    views: [...MODEL.views!, { id: 'v-proc', name: 'Processes', kind: 'warnier' as const, nodeIds: [], positions: {}, pipeline: { levels: [{ ways: [{ types: ['process', 'step'] }] }] } }],
    presentations: [{ id: 'pres-1', name: 'Walk', slides: [{ id: 'sl-1', name: 'Processes', snapshotId: null, viewId: 'v-proc' }] }],
  }
  await studio.seedDocument(JSON.stringify(model))
  await studio.open('v-proc')
  const diagram = page.getByLabel('Warnier diagram')
  await expect(diagram.locator('.wn-add, .wn-actions').first()).toBeAttached()
  await page.keyboard.press('F5')
  await expect(page.locator('.pres-hud-btn.exit')).toBeVisible()
  await expect(diagram.locator('.wn-add, .wn-actions')).toHaveCount(0)
  await diagram.locator('.wn-label[data-node-id="take"]').click()
  await page.keyboard.press('Enter')
  await expect(diagram.getByRole('textbox', { name: 'Name' })).toHaveCount(0)
  await page.locator('.pres-hud-btn.exit').click()
  await page.keyboard.press('ControlOrMeta+z')
  await page.waitForTimeout(1000)
  expect((await studio.storedDoc()).nodes).toHaveLength(MODEL.nodes.length)
})
