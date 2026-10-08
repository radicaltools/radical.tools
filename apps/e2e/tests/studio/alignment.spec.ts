import { test, expect, type Studio } from '../../support/fixtures'

// Alignments: elements the user keeps in a row or a column on one canvas,
// held by the live physics, Smart Layout and across a reload.

/** Largest spread of the drawn centres of `ids` on one axis, in screen px. */
async function spread(studio: Studio, ids: string[], axis: 'x' | 'y'): Promise<number> {
  const boxes = await studio.boxes()
  const centres = ids.map((id) => axis === 'y' ? boxes[id].y + boxes[id].height / 2 : boxes[id].x + boxes[id].width / 2)
  return Math.max(...centres) - Math.min(...centres)
}

async function select(studio: Studio, ids: string[]): Promise<void> {
  await studio.node(ids[0]).click()
  for (const id of ids.slice(1)) await studio.node(id).click({ modifiers: ['Shift'] })
  await expect(studio.page.locator('.sel-bar-badge')).toHaveText(String(ids.length))
}

test('a row on All elements holds through a drag, Smart Layout and a reload', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('canvas')
  // A person, a container inside a system, and another system.
  const row = ['customer', 'api', 'payments']
  await select(studio, row)
  await page.getByRole('button', { name: /^Align/ }).click()
  await page.getByRole('menuitem', { name: /Keep in a row/ }).click()
  await expect.poll(() => spread(studio, row, 'y')).toBeLessThanOrEqual(1.5)
  await expect(page.getByTestId('alignment-guides').locator('line').first()).toBeAttached()

  // Drag one member down: the others follow it onto its new line.
  const box = (await studio.node('payments').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + 12)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + 160, { steps: 12 })
  await page.mouse.up()
  await expect.poll(() => spread(studio, row, 'y'), { timeout: 10_000 }).toBeLessThanOrEqual(1.5)

  await studio.smartLayout()
  await expect.poll(() => spread(studio, row, 'y'), { timeout: 10_000 }).toBeLessThanOrEqual(1.5)

  // The row, and the pin on the dropped element.
  await expect.poll(async () => (await studio.storedDoc() as { defaultLayoutConstraints?: Array<{ type: string }> }).defaultLayoutConstraints?.map((c) => c.type)).toEqual(['align', 'pin'])
  await studio.open('canvas')
  await expect.poll(() => spread(studio, row, 'y'), { timeout: 10_000 }).toBeLessThanOrEqual(1.5)
})

test('a column in a view stays in that view and can be removed from the canvas', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  const column = ['web', 'db']
  await select(studio, column)
  await page.getByRole('button', { name: /^Align/ }).click()
  await page.getByRole('menuitem', { name: /Keep in a column/ }).click()
  await expect.poll(() => spread(studio, column, 'x')).toBeLessThanOrEqual(1.5)
  await expect.poll(async () => {
    const doc = await studio.storedDoc() as { views: Array<{ id: string; layoutConstraints?: unknown[] }>; defaultLayoutConstraints?: unknown[] }
    return [doc.views.find((v) => v.id === 'v-containers')?.layoutConstraints?.length, doc.defaultLayoutConstraints?.length ?? 0]
  }, { timeout: 10_000 }).toEqual([1, 0])

  // With a member selected, the guide offers to remove the alignment.
  await studio.node('web').click()
  await page.getByRole('button', { name: 'Remove column alignment' }).click()
  await expect(page.getByTestId('alignment-guides')).toHaveCount(0)
})

test('a row keeps the selection order through a drag past a neighbour and Smart Layout', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('canvas')
  // Selected right to left: Payment Provider is drawn right of Customer.
  const row = ['payments', 'customer']
  await select(studio, row)
  await page.getByRole('button', { name: /^Align/ }).click()
  // "Keep their order" is on unless the user turned it off.
  await expect(page.getByRole('menuitemcheckbox', { name: /Keep their order/ })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('menuitem', { name: /Keep in a row/ }).click()
  await expect.poll(() => spread(studio, row, 'y')).toBeLessThanOrEqual(1.5)
  const centreX = async (id: string): Promise<number> => {
    const b = (await studio.boxes())[id]
    return b.x + b.width / 2
  }
  const [left, right] = row
  await expect.poll(async () => (await centreX(right)) - (await centreX(left)), { timeout: 10_000 }).toBeGreaterThan(0)

  // Drag the left one well past the right one: the right one is pushed ahead.
  const box = (await studio.node(left).boundingBox())!
  const target = (await studio.node(right).boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + 12)
  await page.mouse.down()
  await page.mouse.move(target.x + target.width + 150, box.y + 12, { steps: 20 })
  await page.mouse.up()
  await expect.poll(async () => (await centreX(right)) - (await centreX(left)), { timeout: 10_000 }).toBeGreaterThan(0)

  await studio.smartLayout()
  await expect.poll(async () => (await centreX(right)) - (await centreX(left)), { timeout: 10_000 }).toBeGreaterThan(0)
  await expect.poll(() => spread(studio, row, 'y'), { timeout: 10_000 }).toBeLessThanOrEqual(1.5)

  // The guide switches order-keeping off.
  await studio.node(left).click()
  await page.getByRole('button', { name: 'Stop keeping row order' }).click()
  await expect(page.getByRole('button', { name: 'Keep row order' })).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(async () => (await studio.storedDoc() as { defaultLayoutConstraints?: Array<{ ordered?: boolean }> }).defaultLayoutConstraints?.[0]?.ordered, { timeout: 10_000 }).toBeUndefined()
})

test('a grid fills in selection order and takes another column from the canvas', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  // Three containers inside Bookstore and the external Payment Provider.
  const cells = ['db', 'web', 'payments', 'api']
  await select(studio, cells)
  await page.getByRole('button', { name: /^Align/ }).click()
  await page.getByRole('menuitem', { name: /Keep in a grid/ }).click()
  const centre = async (id: string): Promise<{ x: number; y: number }> => {
    const b = (await studio.boxes())[id]
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  }
  // db web / payments api
  await expect.poll(() => spread(studio, ['db', 'web'], 'y'), { timeout: 10_000 }).toBeLessThanOrEqual(1.5)
  await expect.poll(() => spread(studio, ['payments', 'api'], 'y'), { timeout: 10_000 }).toBeLessThanOrEqual(1.5)
  await expect.poll(() => spread(studio, ['db', 'payments'], 'x'), { timeout: 10_000 }).toBeLessThanOrEqual(1.5)
  await expect.poll(() => spread(studio, ['web', 'api'], 'x'), { timeout: 10_000 }).toBeLessThanOrEqual(1.5)
  expect((await centre('db')).x).toBeLessThan((await centre('web')).x)
  expect((await centre('db')).y).toBeLessThan((await centre('payments')).y)

  // Three columns: db web payments / api.
  await studio.node('db').click()
  await page.getByRole('button', { name: 'More grid columns' }).click()
  await expect.poll(() => spread(studio, ['db', 'web', 'payments'], 'y'), { timeout: 10_000 }).toBeLessThanOrEqual(1.5)
  await expect.poll(() => spread(studio, ['db', 'api'], 'x'), { timeout: 10_000 }).toBeLessThanOrEqual(1.5)
  await expect.poll(async () => {
    const doc = await studio.storedDoc() as { views: Array<{ id: string; layoutConstraints?: Array<{ type: string; columns?: number }> }> }
    return doc.views.find((v) => v.id === 'v-containers')?.layoutConstraints?.[0]
  }, { timeout: 10_000 }).toMatchObject({ type: 'grid', columns: 3 })
})

test('a selected container aligns its children, in the order they stand', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  const children = ['web', 'api', 'db']
  const centreX = async (id: string): Promise<number> => {
    const b = (await studio.boxes())[id]
    return b.x + b.width / 2
  }
  const xs = await Promise.all(children.map(centreX))
  const leftToRight = [...children].sort((a, b) => xs[children.indexOf(a)] - xs[children.indexOf(b)])

  await studio.node('bookstore').click({ position: { x: 24, y: 12 } })
  await page.getByRole('button', { name: /^Align children/ }).click()
  await page.getByRole('menuitem', { name: /Keep in a row/ }).click()
  await expect.poll(() => spread(studio, children, 'y'), { timeout: 10_000 }).toBeLessThanOrEqual(1.5)
  await expect.poll(async () => {
    const doc = await studio.storedDoc() as { views: Array<{ id: string; layoutConstraints?: Array<{ nodeIds: string[] }> }> }
    return doc.views.find((v) => v.id === 'v-containers')?.layoutConstraints?.[0]?.nodeIds
  }, { timeout: 10_000 }).toEqual(leftToRight)
  // With the container still selected, its children's guide offers its buttons.
  await expect(page.getByRole('button', { name: 'Remove row alignment' })).toBeVisible()
})

test('a collapsed container aligns its children, which line up when it is expanded', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  const toggle = studio.node('bookstore').locator('.c4-node-collapse-btn').first()
  await toggle.click({ force: true })
  await expect(studio.node('web')).toBeHidden()
  await studio.node('bookstore').click({ force: true })
  await page.getByRole('button', { name: /^Align children/ }).click()
  await expect(page.getByText(/its children line up when you expand it/)).toBeVisible()
  await page.getByRole('menuitem', { name: /Keep in a row/ }).click()
  await expect.poll(async () => {
    const doc = await studio.storedDoc() as { views: Array<{ id: string; layoutConstraints?: Array<{ nodeIds: string[] }> }> }
    return doc.views.find((v) => v.id === 'v-containers')?.layoutConstraints?.[0]?.nodeIds.length
  }, { timeout: 10_000 }).toBe(3)

  await toggle.click({ force: true })
  await expect(studio.node('web')).toBeVisible()
  await expect.poll(() => spread(studio, ['web', 'api', 'db'], 'y'), { timeout: 10_000 }).toBeLessThanOrEqual(1.5)
})
