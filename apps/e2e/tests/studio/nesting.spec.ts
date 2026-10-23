import { test, expect, fixture } from '../../support/fixtures'

// Nesting by the special key, as relations are made: "inside" where an
// element may be placed, "holds" on its container, out on the empty canvas.
test('the special key nests an element, and takes it out on the empty canvas', async ({ page, studio }) => {
  // Customer in a group, beside the Bookstore: a person may stand in a group or at the top.
  const doc = JSON.parse(fixture('bookstore'))
  doc.nodes.push({ id: 'shoppers', type: 'group', label: 'Shoppers', x: -400, y: -40, width: 300, height: 260, collapsed: false })
  doc.nodes.find((n: { id: string }) => n.id === 'customer').parentId = 'shoppers'
  doc.views.find((v: { id: string }) => v.id === 'v-containers').nodeIds.push('shoppers')
  await studio.seedDocument(JSON.stringify(doc))
  await studio.open('v-containers')
  await studio.settle()
  await studio.node('customer').click()
  await studio.settle()
  await page.keyboard.down('Alt')
  await expect(page.locator('.react-flow__node.connect-target[data-id="shoppers"]')).toHaveAttribute('style', /--connect-label: "holds"/)
  const parentOf = async () => ((await studio.storedDoc()).nodes as Array<{ id: string; parentId?: string }>).find((n) => n.id === 'customer')?.parentId
  // Out: a drop on the empty canvas.
  const customer = (await studio.node('customer').boundingBox())!
  const pane = (await studio.pane.boundingBox())!
  await page.mouse.move(customer.x + customer.width / 2, customer.y + customer.height / 2)
  await page.mouse.down()
  await page.mouse.move(pane.x + pane.width - 60, pane.y + 60, { steps: 8 })
  await page.mouse.up()
  await expect.poll(parentOf).toBeUndefined()
  // In again: inside is the group's only offer, so the drop anywhere on it nests.
  await studio.settle()
  const again = (await studio.node('customer').boundingBox())!
  const group = (await studio.node('shoppers').boundingBox())!
  await page.mouse.move(again.x + again.width / 2, again.y + again.height / 2)
  await page.mouse.down()
  await page.mouse.move(group.x + group.width / 2, group.y + group.height / 2, { steps: 8 })
  await expect(page.locator('.react-flow__node.connect-target[data-id="shoppers"]')).toHaveAttribute('style', /--connect-label: "inside"/)
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await expect.poll(parentOf).toBe('shoppers')
})

test('several selected elements are related or nested at once', async ({ page, studio }) => {
  const doc = JSON.parse(fixture('bookstore'))
  doc.nodes.push({ id: 'shoppers', type: 'group', label: 'Shoppers', x: -400, y: -40, width: 300, height: 260, collapsed: false })
  doc.nodes.push({ id: 'clerk', type: 'person', label: 'Clerk', x: -400, y: 400, width: 150, height: 170, collapsed: false })
  doc.views.find((v: { id: string }) => v.id === 'v-containers').nodeIds.push('shoppers', 'clerk')
  await studio.seedDocument(JSON.stringify(doc))
  await studio.open('v-containers')
  await studio.settle()
  const drag = async (from: string, to: string) => {
    const a = (await studio.node(from).boundingBox())!
    const b = (await studio.node(to).boundingBox())!
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await page.mouse.down()
    await page.mouse.move(b.x + b.width / 2, b.y + 20, { steps: 8 })
    await page.mouse.up()
  }
  const saved = async () => studio.storedDoc() as unknown as Promise<{ nodes: Array<{ id: string; parentId?: string }>; relations: Array<{ sourceId: string; targetId: string }> }>

  // The Web App and Payment Provider, both related to the Orders DB (the API is already).
  await studio.node('web').click()
  await studio.node('payments').click({ modifiers: ['Alt'] })
  await expect(page.locator('.sel-bar-badge')).toHaveText('2')
  await page.keyboard.down('Alt')
  await drag('payments', 'db')
  await page.keyboard.up('Alt')
  await expect.poll(async () => (await saved()).relations.filter((r) => r.targetId === 'db').map((r) => r.sourceId).sort()).toEqual(['api', 'payments', 'web'])

  // Customer and the Clerk, both into the group at once.
  await studio.settle()
  await studio.node('customer').click()
  await studio.node('clerk').click({ modifiers: ['Alt'] })
  await page.keyboard.down('Alt')
  await expect(page.locator('.react-flow__node.connect-target[data-id="shoppers"]')).toHaveAttribute('style', /--connect-label: "inside"/)
  await drag('clerk', 'shoppers')
  await page.keyboard.up('Alt')
  await expect.poll(async () => (await saved()).nodes.filter((n) => n.parentId === 'shoppers').map((n) => n.id).sort()).toEqual(['clerk', 'customer'])
})

test('containers dropped into a system fill a grid, the first centred', async ({ page, studio }) => {
  await studio.seedDocument(JSON.stringify({
    nodes: [{ id: 's', type: 'system', label: 'Shop', x: 0, y: 0, width: 280, height: 180, collapsed: false }],
    relations: [],
    views: [{ id: 'v', name: 'Shop', nodeIds: ['s'], positions: {} }],
  }))
  await studio.open('v')
  await studio.settle()
  const shop = page.locator('.react-flow__node[data-id="s"]')
  const drop = async () => {
    const box = (await shop.boundingBox())!
    await page.locator('.palette-item', { hasText: 'Container' }).first().dragTo(shop, { targetPosition: { x: 20, y: box.height - 20 }, force: true })
    await studio.settle()
  }
  const kids = async () => ((await studio.storedDoc()).nodes as unknown as Array<{ id: string; parentId?: string; x: number; y: number; width: number; height: number }>).filter((n) => n.parentId === 's')
  const parent = async () => ((await studio.storedDoc()).nodes as unknown as Array<{ id: string; width: number; height: number }>).find((n) => n.id === 's')!

  // The first, wherever it is dropped, centred across the system below its header.
  await drop()
  await expect.poll(async () => (await kids()).length).toBe(1)
  const [first] = await kids()
  const shopNow = await parent()
  expect(first.x).toBe(shopNow.width - first.x - first.width)
  expect(first.y).toBeGreaterThanOrEqual(120)
  // The second, in the next cell: beside the first, in its row.
  await drop()
  await expect.poll(async () => (await kids()).length).toBe(2)
  const second = (await kids()).find((k) => k.id !== first.id)!
  expect(second.y).toBe(first.y)
  expect(second.x).toBe(first.x + first.width + 20)
})

test('nesting an element removes its relations with its new container, with a warning', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  await studio.settle()
  // The API charges cards at Payment Provider (r4); it goes into it.
  await studio.node('api').click()
  await studio.settle()
  await page.keyboard.down('Alt')
  const api = (await studio.node('api').boundingBox())!
  const pay = (await studio.node('payments').boundingBox())!
  await page.mouse.move(api.x + api.width / 2, api.y + api.height / 2)
  await page.mouse.down()
  await page.mouse.move(pay.x + pay.width / 2, pay.y + pay.height / 2, { steps: 8 })
  const inside = page.getByRole('group', { name: 'Drop on Payment Provider' }).locator('.connect-pill', { hasText: 'inside' })
  const box = (await inside.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 })
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await expect(page.getByText(/Removed the relation API uses Payment Provider: containment already joins them/)).toBeVisible()
  await expect.poll(async () => {
    const doc = await studio.storedDoc()
    return [(doc.nodes as Array<{ id: string; parentId?: string }>).find((n) => n.id === 'api')?.parentId, doc.relations.some((r) => r.id === 'r4')]
  }).toEqual(['payments', false])
})
