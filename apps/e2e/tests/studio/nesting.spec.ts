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
  expect(second.x).toBe(first.x + first.width + 60)
})

test('nesting an element removes its relations with its new container, with a warning', async ({ page, studio }) => {
  // Payment Provider made one of the model's own: an external one holds nothing.
  const doc = JSON.parse(fixture('bookstore'))
  doc.nodes.find((n: { id: string }) => n.id === 'payments').external = false
  await studio.seedDocument(JSON.stringify(doc))
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

// Alt-drag from the centre of `from` to `to` (a point, or the centre of an element).
async function altDrag(page: import('@playwright/test').Page, from: import('@playwright/test').Locator, to: import('@playwright/test').Locator | { x: number; y: number }) {
  const a = (await from.boundingBox())!
  const b = 'x' in to ? to : await (async () => { const r = (await to.boundingBox())!; return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 8 })
  await page.mouse.up()
}

test.describe('the special key', () => {
  // A person in a group, a clerk and an empty group at the top of the model.
  const shoppers = () => {
    const doc = JSON.parse(fixture('bookstore'))
    doc.nodes.push({ id: 'shoppers', type: 'group', label: 'Shoppers', x: -400, y: -40, width: 300, height: 260, collapsed: false })
    doc.nodes.push({ id: 'staff', type: 'group', label: 'Staff', x: -400, y: 700, width: 300, height: 260, collapsed: false })
    doc.nodes.push({ id: 'clerk', type: 'person', label: 'Clerk', x: -400, y: 400, width: 150, height: 170, collapsed: false })
    doc.nodes.find((n: { id: string }) => n.id === 'customer').parentId = 'shoppers'
    doc.views.find((v: { id: string }) => v.id === 'v-containers').nodeIds.push('shoppers', 'staff', 'clerk')
    return JSON.stringify(doc)
  }
  const parents = async (studio: { storedDoc: () => Promise<{ nodes: Array<{ id: string; parentId?: string }> }> }, ...ids: string[]) => {
    const nodes = (await studio.storedDoc()).nodes
    return ids.map((id) => nodes.find((n) => n.id === id)?.parentId ?? null)
  }

  test('a take-out the metamodel refuses says why, naming the allowed parents and the elements refused', async ({ page, studio }) => {
    await studio.seedDocument(shoppers())
    await studio.open('v-containers')
    await studio.settle()
    const pane = (await studio.pane.boundingBox())!
    const empty = { x: pane.x + pane.width - 60, y: pane.y + 60 }
    // The API alone: a container stands only in a system or a group.
    await studio.node('api').click()
    await page.keyboard.down('Alt')
    await altDrag(page, studio.node('api'), empty)
    await page.keyboard.up('Alt')
    await expect(page.getByText('Cannot place Container "API" inside the canvas root. Allowed parents: Software System, Group.')).toBeVisible()
    expect(await parents(studio, 'api')).toEqual(['bookstore'])
    // With the Customer and the Orders DB: the Customer goes, the other two are named.
    await studio.settle()
    await studio.node('customer').click()
    await studio.node('api').click({ modifiers: ['Alt'] })
    await studio.node('db').click({ modifiers: ['Alt'] })
    await page.keyboard.down('Alt')
    await altDrag(page, studio.node('customer'), empty)
    await page.keyboard.up('Alt')
    await expect.poll(() => parents(studio, 'customer', 'api', 'db')).toEqual([null, 'bookstore', 'bookstore'])
    await expect(page.getByText('Moved 1 node into the canvas root.')).toBeVisible()
    await expect(page.getByText(/^Cannot place Container "API" inside the canvas root\. Allowed parents: [^.]+\. Cannot place Database "Orders DB" inside the canvas root\. Allowed parents: [^.]+\.$/)).toBeVisible()
  })

  test('one gesture on several selected elements is one undo step, relations and nests alike', async ({ page, studio }) => {
    await studio.seedDocument(shoppers())
    await studio.open('v-containers')
    await studio.settle()
    const relations = async () => (await studio.storedDoc()).relations.length
    // The Web App and Payment Provider, both related to the Orders DB.
    await studio.node('web').click()
    await studio.node('payments').click({ modifiers: ['Alt'] })
    await page.keyboard.down('Alt')
    await altDrag(page, studio.node('payments'), studio.node('db'))
    await page.keyboard.up('Alt')
    await expect.poll(relations).toBe(6)
    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(relations).toBe(4)
    // The Customer (in Shoppers) and the Clerk (at the top), both into Staff: one notice, one Undo.
    await studio.settle()
    await studio.node('customer').click()
    await studio.node('clerk').click({ modifiers: ['Alt'] })
    // The camera frames the two selected; Staff may lie outside that.
    await page.getByRole('button', { name: 'Fit All' }).click()
    await studio.settle()
    await page.keyboard.down('Alt')
    await altDrag(page, studio.node('clerk'), studio.node('staff'))
    await page.keyboard.up('Alt')
    await expect.poll(() => parents(studio, 'customer', 'clerk')).toEqual(['staff', 'staff'])
    await expect(page.getByText('Moved 2 nodes into Group.')).toBeVisible()
    await expect(page.getByText('Moved 1 node into Group.')).toHaveCount(0)
    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(() => parents(studio, 'customer', 'clerk')).toEqual(['shoppers', null])
  })

  for (const mode of ['viewer', 'presenter'] as const) {
    test(`in ${mode === 'viewer' ? 'Viewer' : 'Presenter'} it only selects: no pills, no line, no relation, no nesting`, async ({ page, studio }) => {
      await studio.seed()
      await studio.open('v-containers', mode)
      await studio.settle()
      const edges = await page.locator('.react-flow__edge').count()
      await studio.node('web').click()
      await page.keyboard.down('Alt')
      // A click with the key still adds to the selection.
      await studio.node('api').click()
      if (mode === 'viewer') await expect(page.locator('.react-flow__node.selected')).toHaveCount(2)
      await expect(page.locator('.connect-pills, .react-flow__node.connect-target')).toHaveCount(0)
      const web = (await studio.node('web').boundingBox())!
      const pay = (await studio.node('payments').boundingBox())!
      await page.mouse.move(web.x + web.width / 2, web.y + web.height / 2)
      await page.mouse.down()
      await page.mouse.move(pay.x + pay.width / 2, pay.y + pay.height / 2, { steps: 8 })
      await expect(page.getByText(/Connecting from/)).toHaveCount(0)
      await expect(page.locator('.connect-pills, .react-flow__node.connect-target')).toHaveCount(0)
      await page.mouse.up()
      await page.keyboard.up('Alt')
      await studio.settle()
      await expect(page.locator('.react-flow__edge')).toHaveCount(edges)
      await expect(page.getByText(/^Moved \d+ nodes? into/)).toHaveCount(0)
    })
  }

  test('offers "inside" only where the card\'s Parent field would let the elements go', async ({ page, studio }) => {
    // A group of the Bookstore's holding the Web App, and a group at the top of the model.
    const doc = JSON.parse(fixture('bookstore'))
    doc.nodes.push({ id: 'zone', type: 'group', label: 'Zone', x: 960, y: -60, width: 320, height: 220, collapsed: false })
    doc.nodes.push({ id: 'front', type: 'group', label: 'Front', parentId: 'bookstore', x: 10, y: 60, width: 250, height: 230, collapsed: false })
    Object.assign(doc.nodes.find((n: { id: string }) => n.id === 'web'), { parentId: 'front', x: 20, y: 60 })
    doc.views.find((v: { id: string }) => v.id === 'v-containers').nodeIds.push('zone', 'front')
    await studio.seedDocument(JSON.stringify(doc))
    await studio.open('v-containers')
    await studio.settle()
    const label = (id: string) => page.locator(`.react-flow__node.connect-target[data-id="${id}"]`)
    // The API: a relation to the external Payment Provider, not a place in it.
    await studio.node('api').click()
    await page.keyboard.down('Alt')
    await expect(label('payments')).toHaveAttribute('style', /--connect-label: "[^"]+"/)
    expect(await label('payments').getAttribute('style')).not.toMatch(/inside/)
    await page.keyboard.up('Alt')
    // The group Front: its Web App would have no place in Zone.
    await studio.settle()
    const front = (await studio.node('front').boundingBox())!
    await page.mouse.click(front.x + 30, front.y + front.height - 12)
    await expect(page.locator('.react-flow__node.selected[data-id="front"]')).toHaveCount(1)
    await page.keyboard.down('Alt')
    await expect(label('bookstore')).toHaveAttribute('style', /--connect-label: "holds"/)
    await expect(page.locator('.react-flow__node[data-id="zone"]')).not.toHaveClass(/connect-target/)
    await page.keyboard.up('Alt')
  })
})

// F-0071: the pills were drawn in their element, under the lines raised
// above it: on a folded container joined to the selected element by a
// rolled-up line, the line lay over its "inside" pill and took the drop,
// which then did nothing and said nothing.
test('the pills lie over the lines: a drop on the inside pill of a folded container nests, with a line ending at it', async ({ page, studio }) => {
  await studio.openSample('view-core')
  await studio.node('dom-risk').locator('.c4-node-collapse-btn').first().click()
  await studio.settle()
  await studio.node('ctn-evtbus').click()
  await studio.settle()
  const parentOf = async () => ((await studio.storedDoc(studio.activeDocId())).nodes as Array<{ id: string; parentId?: string }>).find((n) => n.id === 'ctn-evtbus')?.parentId
  expect(await parentOf()).toBe('dom-banking')
  const bus = (await studio.node('ctn-evtbus').boundingBox())!
  const risk = (await studio.node('dom-risk').boundingBox())!
  await page.keyboard.down('Alt')
  await page.mouse.move(bus.x + 12, bus.y + 8)
  await page.mouse.down()
  await page.mouse.move(risk.x + risk.width / 2, risk.y + risk.height / 2, { steps: 8 })
  const inside = page.getByRole('group', { name: 'Drop on Risk & Data' }).locator('.connect-pill', { hasText: 'inside' })
  const pill = (await inside.boundingBox())!
  const at = { x: pill.x + pill.width / 2, y: pill.y + pill.height / 2 }
  await page.mouse.move(at.x, at.y, { steps: 3 })
  expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.connect-pill'), [at.x, at.y])).toBe(true)
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await expect(page.getByText('Moved 1 node into Group.')).toBeVisible()
  await expect.poll(parentOf).toBe('dom-risk')
})

test('a drop on the holds pill says the element is there already', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  await studio.settle()
  await studio.node('api').click()
  await studio.settle()
  const api = (await studio.node('api').boundingBox())!
  const bookstore = (await studio.node('bookstore').boundingBox())!
  await page.keyboard.down('Alt')
  await page.mouse.move(api.x + api.width / 2, api.y + api.height / 2)
  await page.mouse.down()
  await page.mouse.move(bookstore.x + 20, bookstore.y + 10, { steps: 8 })
  const holds = page.getByRole('group', { name: 'Drop on Bookstore' }).locator('.connect-pill', { hasText: 'holds' })
  const pill = (await holds.boundingBox())!
  await page.mouse.move(pill.x + pill.width / 2, pill.y + pill.height / 2, { steps: 3 })
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await expect(page.getByText('"API" is already in "Bookstore": nothing to move.')).toBeVisible()
})

// F-0092: the pills keep their size on screen, so zoomed out those of an
// element stand over the element above it. On the sample's Authorization
// view at Fit All, a drop on "Leavers lose access" where the pill of
// "Unpermitted calls refused" lay over it made the relation to that one,
// and a click with the special key there did nothing.
test('zoomed out, a drop or a click with the special key on an element goes to that element, not to another element\'s pill over it', async ({ page, studio }) => {
  const SRC = 'dfd072e9-a9f7-45bf-8adb-c4a9b287af20' // Break-glass use alerts
  const TGT = 'c8fdf808-27c6-4a35-b117-6b3c2cf45786' // Leavers lose access
  await studio.openSample('view-authorization')
  const focus = page.getByRole('toolbar', { name: 'Canvas' }).getByRole('button', { name: 'Focus' })
  if ((await focus.getAttribute('aria-pressed')) !== 'false') await focus.click()
  await page.getByRole('button', { name: 'Fit All' }).click()
  await studio.settle()
  const docId = studio.activeDocId()
  const before = (await studio.storedDoc(docId)).relations.length
  const s = (await studio.node(SRC).boundingBox())!
  await page.mouse.click(s.x + s.width / 2, s.y + s.height - 3)
  await studio.settle()
  await page.keyboard.down('Alt')
  // A point of it another element's pill lies over.
  const covered = () => page.evaluate((id) => {
    const t = document.querySelector(`.react-flow__node[data-id="${id}"]`)!.getBoundingClientRect()
    for (const pill of document.querySelectorAll<HTMLElement>('.connect-pills:not([data-connect-over="' + id + '"]) .connect-pill')) {
      const p = pill.getBoundingClientRect()
      const x0 = Math.max(t.left, p.left), x1 = Math.min(t.right, p.right), y0 = Math.max(t.top, p.top), y1 = Math.min(t.bottom, p.bottom)
      if (x1 - x0 > 2 && y1 - y0 > 2) {
        const at = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }
        if (document.elementFromPoint(at.x, at.y)?.closest('.connect-pill') === pill) return at
      }
    }
    return null
  }, TGT)
  await expect.poll(covered).not.toBeNull()
  const point = (await covered())!
  await page.mouse.move(s.x + s.width / 2, s.y + s.height - 3)
  await page.mouse.down()
  await page.mouse.move(point.x, point.y, { steps: 10 })
  await page.mouse.up()
  await expect.poll(async () => (await studio.storedDoc(docId)).relations.length).toBe(before + 1)
  const made = (await studio.storedDoc(docId)).relations.slice(-1)[0] as { sourceId: string; targetId: string }
  expect([made.sourceId, made.targetId]).toEqual([SRC, TGT])
  // A click there adds it to the selection.
  await page.mouse.click(point.x, point.y)
  await page.keyboard.up('Alt')
  await expect.poll(() => page.locator('.react-flow__node.selected').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')).sort())).toEqual([SRC, TGT].sort())
})

// F-0094: after a box drawn with the special key, React Flow lays a
// rectangle over the elements it selected: a press with the key there found
// no element, so the gesture did not start and React Flow dragged the
// selection (Web App and API 690 px right, the Bookstore grown round them).
test('after a box selection, a drag with the special key from one of the selected relates each of them, and moves nothing', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  await studio.settle()
  const doc = await studio.storedDoc()
  const relations = doc.relations.length
  const places = await studio.positions()
  const held = await Promise.all(['web', 'api'].map(async (id) => (await studio.node(id).boundingBox())!))
  const frame = (await studio.node('bookstore').boundingBox())!
  // From the empty canvas above and left of the Bookstore.
  const from = { x: frame.x - 15, y: frame.y - 15 }
  const to = { x: Math.max(...held.map((b) => b.x + b.width)) + 8, y: Math.max(...held.map((b) => b.y + b.height)) + 8 }
  await page.keyboard.down('Alt')
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 10 })
  await page.mouse.up()
  await expect.poll(() => page.locator('.react-flow__node.selected').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')).sort())).toEqual(['api', 'web'])
  await altDrag(page, studio.node('api'), studio.node('payments'))
  await page.keyboard.up('Alt')
  await expect.poll(async () => (await studio.storedDoc()).relations.length).toBe(relations + 2)
  const added = (await studio.storedDoc()).relations.slice(relations) as Array<{ sourceId: string; targetId: string }>
  expect(added.map((r) => `${r.sourceId}>${r.targetId}`).sort()).toEqual(['api>payments', 'web>payments'])
  await studio.settle()
  expect(await studio.positions()).toEqual(places)
})
