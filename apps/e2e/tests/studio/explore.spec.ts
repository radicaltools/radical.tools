import type { Locator, Page } from '@playwright/test'
import { test, expect } from '../../support/fixtures'

// Explore from here: a temporary structure view grown from one element by
// the + of each element (All, or the relation types chosen), level by
// level, and folded back by its −. It is first in the list of views while
// it is open, never saved, kept as an ordinary view by Save as view, and
// gone without a question when closed.

/** Where `node` is on the canvas in flow coordinates (the camera taken out):
 *  Smart fit may move the camera after an element is added. */
async function flowBox(page: Page, node: Locator): Promise<{ x: number; y: number }> {
  const transform = await page.locator('.react-flow__viewport').getAttribute('style') ?? ''
  const m = transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\((-?[\d.]+)\)/)
  const [tx, ty, zoom] = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 1]
  const pane = (await page.locator('.react-flow__pane').boundingBox())!
  const box = (await node.boundingBox())!
  return { x: Math.round((box.x - pane.x - tx) / zoom), y: Math.round((box.y - pane.y - ty) / zoom) }
}

type Box = { x: number; y: number; width: number; height: number }

/** `a` and `b` do not overlap. */
const apart = (a: Box, b: Box): boolean =>
  a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y

/** Selects an element by its corner: a relation's line can run across
 *  its middle once the exploration is laid out in layers. */
const pick = (node: Locator): Promise<void> => node.click({ position: { x: 8, y: 8 } })

/** The canvas camera's zoom. */
async function zoomOf(page: Page): Promise<number> {
  const transform = await page.locator('.react-flow__viewport').getAttribute('style') ?? ''
  return Number(transform.match(/scale\((-?[\d.]+)\)/)?.[1] ?? 1)
}

/** `node` lies wholly inside the canvas's visible pane. */
async function inPane(page: Page, node: Locator): Promise<boolean> {
  const pane = (await page.locator('.react-flow__pane').boundingBox())!
  const b = (await node.boundingBox())!
  return b.x >= pane.x && b.y >= pane.y && b.x + b.width <= pane.x + pane.width && b.y + b.height <= pane.y + pane.height
}

/** The ids of the elements the canvas draws. */
const drawnIds = (page: Page): Promise<string[]> =>
  page.locator('.react-flow__node').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id!))

/** The ids of the relations the canvas draws. */
const drawnEdges = async (page: Page): Promise<string[]> =>
  (await page.locator('.react-flow__edge').evaluateAll((els) => els.map((e) => (e.getAttribute('data-testid') ?? '').replace(/^rf__edge-/, ''))))
    .filter((id) => id && !id.startsWith('virtual-')).sort()

/** The + of element `label`: its menu. */
async function plus(page: Page, label: string): Promise<Locator> {
  const menu = page.getByRole('menu', { name: `Add to ${label}` })
  // The start's menu opens with the exploration.
  const open = await menu.waitFor({ state: 'visible', timeout: 800 }).then(() => true, () => false)
  if (!open) await page.getByRole('button', { name: new RegExp(`^Show \\d+ more related to ${label}$`) }).click()
  await expect(menu).toBeVisible()
  return menu
}

/** The menu of element `id`'s + lies beside its + (within 16 px of it),
 *  inside the canvas, once the camera is still. */
async function besidePlus(studio: import('../../support/fixtures').Studio, id: string, menu: Locator): Promise<void> {
  await studio.settle()
  const pill = (await studio.page.locator(`[data-explore-more="${id}"]`).boundingBox())!
  const box = (await menu.boundingBox())!
  const pane = (await studio.page.locator('.react-flow__pane').boundingBox())!
  const dx = Math.max(0, box.x - (pill.x + pill.width), pill.x - (box.x + box.width))
  const dy = Math.max(0, box.y - (pill.y + pill.height), pill.y - (box.y + box.height))
  expect(Math.max(dx, dy), `menu ${JSON.stringify(box)} from + ${JSON.stringify(pill)}`).toBeLessThanOrEqual(16)
  expect(box.x >= pane.x && box.y >= pane.y && box.x + box.width <= pane.x + pane.width && box.y + box.height <= pane.y + pane.height).toBe(true)
}

/** The + of element `label`, All. */
async function all(page: Page, label: string): Promise<void> {
  await (await plus(page, label)).getByRole('menuitem', { name: /^Show all/ }).click()
}

/** A row of a + menu: `text` in the column of what goes out ('out') or
 *  comes in ('in'). */
const row = (menu: Locator, column: 'out' | 'in', text: string): Locator =>
  menu.getByRole('group', { name: column === 'out' ? /→ others$/ : /^others →/ }).locator('.explore-menu-row', { hasText: text })

/** No two of `ids` drawn on each other. */
async function noOverlaps(studio: import('../../support/fixtures').Studio, ids: string[]): Promise<void> {
  const box = await studio.boxes()
  for (const a of ids) for (const b of ids) if (a < b) expect(apart(box[a], box[b]), `${a} on ${b}`).toBe(true)
}

/** The names of the views listed, in order. */
const viewNames = (page: Page): Promise<string[]> =>
  page.locator('.lp-view-list .lp-view-card .lp-card-title').allTextContents()

test('Explore from here grows level by level from each +', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  const stored = await studio.storedJson()
  await studio.node('api').click()
  await page.getByRole('button', { name: 'Explore from here' }).click()

  // A view of API alone, no Bookstore frame, listed first, named after it.
  await expect(page.locator('.explore-bar')).toContainText('Explore: API')
  expect((await viewNames(page))[0]).toBe('Explore: API')
  await expect(page.locator('.lp-explore-card')).toHaveClass(/active/)
  await expect(studio.node('api')).toBeVisible()
  for (const id of ['bookstore', 'web', 'db', 'payments', 'customer']) await expect(studio.node(id)).toHaveCount(0)
  // Its + menu is open at once, on All; Esc closes it and leaves API alone.
  const first = page.getByRole('menu', { name: 'Add to API' })
  await expect(first).toBeVisible()
  await expect(first.getByRole('menuitem', { name: /^Show all/ })).toBeFocused()
  await besidePlus(studio, 'api', first)
  await page.keyboard.press('Escape')
  await expect(first).toHaveCount(0)
  await expect(studio.node('web')).toHaveCount(0)

  // API's +, All: what it is joined to, a level below it, each with its
  // line to API, flat (Bookstore drawn on its own, joined by a dashed
  // containment line); its + gives way to a −.
  await all(page, 'API')
  for (const id of ['web', 'db', 'payments', 'bookstore']) await expect(studio.node(id)).toBeVisible()
  await expect(studio.node('customer')).toHaveCount(0)
  await studio.settle()
  let box = await studio.boxes()
  for (const id of ['web', 'db', 'payments', 'bookstore']) expect(box[id].y).toBeGreaterThanOrEqual(box.api.y + box.api.height)
  await expect.poll(() => drawnEdges(page)).toEqual(['contains:bookstore:api', 'r2', 'r3', 'r4'])
  await expect(page.locator('.relation-label', { hasText: 'Contains' })).toBeVisible()
  await noOverlaps(studio, ['api', 'web', 'db', 'payments', 'bookstore'])
  await expect(page.getByRole('button', { name: /^Show \d+ more related to API$/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Fold back what API added', exact: true })).toBeVisible()
  // The camera shows what was added, with API, at a readable zoom.
  expect(await zoomOf(page)).toBeGreaterThanOrEqual(0.6)
  for (const id of ['api', 'web', 'db', 'payments']) expect(await inPane(page, studio.node(id))).toBe(true)

  // Web App's +: Customer, a level further, with its relation to Web App.
  await besidePlus(studio, 'web', await plus(page, 'Web App'))
  await all(page, 'Web App')
  await expect(studio.node('customer')).toBeVisible()
  await studio.settle()
  box = await studio.boxes()
  for (const id of ['web', 'db', 'payments']) expect(box.customer.y).toBeGreaterThanOrEqual(box[id].y + box[id].height)
  await expect.poll(() => drawnEdges(page)).toContain('r1')
  await noOverlaps(studio, ['api', 'web', 'db', 'payments', 'bookstore', 'customer'])

  // Undo twice: Customer goes, then the first level; Redo brings that
  // level back; all on the exploration.
  await page.locator('body').focus()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(studio.node('customer')).toHaveCount(0)
  await expect(studio.node('web')).toBeVisible()
  await page.keyboard.press('ControlOrMeta+z')
  for (const id of ['web', 'db', 'payments', 'bookstore']) await expect(studio.node(id)).toHaveCount(0)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  for (const id of ['web', 'db', 'payments', 'bookstore']) await expect(studio.node(id)).toBeVisible()
  await expect(studio.node('customer')).toHaveCount(0)
  await expect(page.locator('.lp-explore-card')).toHaveClass(/active/)

  // API's −: the level goes again, API's + comes back with its count.
  await page.getByRole('button', { name: 'Fold back what API added', exact: true }).click()
  for (const id of ['web', 'db', 'payments', 'bookstore', 'customer']) await expect(studio.node(id)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Show 4 more related to API', exact: true })).toBeVisible()

  // Nothing of it was saved.
  await page.waitForTimeout(1000)
  expect(await studio.storedJson()).toBe(stored)
})

test('the + of an element adds the relations of the types and direction chosen', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  const stored = await studio.storedJson()
  await studio.node('api').click()
  await page.getByRole('button', { name: 'Explore from here' }).click()

  // The menu: Show all, then what goes out from API and what comes in,
  // each kind with its count, its parent last.
  let menu = await plus(page, 'API')
  await expect(menu.getByRole('menuitem', { name: /^Show all/ })).toHaveText('Show all 4')
  await expect(menu.getByRole('menuitem', { name: /^Show all/ })).toBeFocused()
  await expect(menu.getByRole('group', { name: 'API → others' }).locator('.explore-menu-row')).toHaveText(['reads/writes1', 'charges card1'].sort((a, b) => a.localeCompare(b)))
  await expect(menu.getByRole('group', { name: 'others → API' }).locator('.explore-menu-row')).toHaveText(['calls1', 'Contained in (parent)1'])
  // Keyboard: arrows move (left and right between the columns), Esc closes.
  await page.keyboard.press('ArrowDown')
  await expect(row(menu, 'out', 'charges card').getByRole('menuitem')).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(row(menu, 'in', 'calls').getByRole('menuitem')).toBeFocused()
  await page.keyboard.press('Space')
  await expect(row(menu, 'in', 'calls').getByRole('checkbox')).toBeChecked()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)

  // A click on "contained in": Bookstore, a level below, with a dashed
  // contains arrow from it to API.
  menu = await plus(page, 'API')
  await row(menu, 'in', 'Contained in').getByRole('menuitem').click()
  await expect(studio.node('bookstore')).toBeVisible()
  for (const id of ['web', 'db', 'payments']) await expect(studio.node(id)).toHaveCount(0)
  await expect.poll(() => drawnEdges(page)).toEqual(['contains:bookstore:api'])
  await expect(page.locator('.relation-label', { hasText: 'Contains' })).toBeVisible()

  // reads/writes and calls checked, Show checked: Orders DB and Web App,
  // their relations drawn.
  menu = await plus(page, 'API')
  await row(menu, 'out', 'reads/writes').getByRole('checkbox').check()
  await row(menu, 'in', 'calls').getByRole('checkbox').check()
  await menu.getByRole('menuitem', { name: 'Show checked' }).click()
  for (const id of ['db', 'web']) await expect(studio.node(id)).toBeVisible()
  await expect(studio.node('payments')).toHaveCount(0)
  await expect.poll(() => drawnEdges(page)).toEqual(['contains:bookstore:api', 'r2', 'r3'])

  // Show all: the rest.
  await expect(page.getByRole('button', { name: 'Show 1 more related to API', exact: true })).toBeVisible()
  await all(page, 'API')
  await expect(studio.node('payments')).toBeVisible()

  // Another exploration: API's parent, then Bookstore's children.
  await pick(studio.node('api'))
  await page.getByRole('button', { name: 'Explore from here' }).click()
  await expect(studio.node('bookstore')).toHaveCount(0)
  menu = await plus(page, 'API')
  await row(menu, 'in', 'Contained in').getByRole('menuitem').click()
  await expect(studio.node('bookstore')).toBeVisible()
  menu = await plus(page, 'Bookstore')
  await expect(row(menu, 'out', 'Contains')).toHaveText('Contains (children)2')
  await row(menu, 'out', 'Contains').getByRole('menuitem').click()
  for (const id of ['web', 'db']) await expect(studio.node(id)).toBeVisible()
  await expect(studio.node('payments')).toHaveCount(0)
  await expect.poll(async () => (await drawnEdges(page)).filter((id) => id.startsWith('contains:'))).toEqual(['contains:bookstore:api', 'contains:bookstore:db', 'contains:bookstore:web'])

  // Nothing of it was saved.
  await page.waitForTimeout(1000)
  expect(await studio.storedJson()).toBe(stored)
})

test('an exploration is saved as a view, and dropped when closed', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  await studio.node('api').click()
  await page.getByRole('button', { name: 'Explore from here' }).click()
  // Its relations (not its parent).
  const menu = await plus(page, 'API')
  for (const [column, text] of [['out', 'reads/writes'], ['out', 'charges card'], ['in', 'calls']] as const) await row(menu, column, text).getByRole('checkbox').check()
  await menu.getByRole('menuitem', { name: 'Show checked' }).click()
  await expect(studio.node('payments')).toBeVisible()
  await studio.settle()
  const places = {
    api: await flowBox(page, studio.node('api')),
    payments: await flowBox(page, studio.node('payments')),
  }

  // Save as view…: a name and a folder.
  await page.getByRole('button', { name: 'Save as view…' }).click()
  const form = page.getByRole('form', { name: 'Save as view' })
  await form.getByLabel('Name').fill('API context')
  await form.getByLabel('Folder').fill('Explorations')
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.explore-bar')).toHaveCount(0)
  await expect(page.locator('.lp-explore-card')).toHaveCount(0)
  await expect(page.getByText('Structure: API context')).toBeVisible()
  await expect(page.locator('.lp-folder-name', { hasText: 'Explorations' })).toBeVisible()
  await expect(page.locator('.lp-view-card.active')).toContainText('API context')
  await studio.settle()
  expect(await flowBox(page, studio.node('api'))).toEqual(places.api)
  expect(await flowBox(page, studio.node('payments'))).toEqual(places.payments)
  await expect.poll(async () => (await studio.storedDoc()).views?.find((v) => (v as { name?: string }).name === 'API context')?.nodeIds.sort())
    .toEqual(['api', 'db', 'payments', 'web'])

  // One step: Undo takes the view away, Redo brings it back.
  await page.getByTitle('Undo (⌘Z)').click()
  await expect(page.locator('.lp-view-card', { hasText: 'API context' })).toHaveCount(0)
  await page.getByTitle(/^Redo/).click()
  await expect(page.locator('.lp-view-card', { hasText: 'API context' })).toHaveCount(1)

  // Another exploration, closed: gone without a question, the document as it was.
  await expect.poll(async () => (await studio.storedDoc()).views?.some((v) => (v as { name?: string }).name === 'API context')).toBe(true)
  await page.waitForTimeout(1000)
  const stored = await studio.storedJson()
  await pick(studio.node('db'))
  await page.getByRole('button', { name: 'Explore from here' }).click()
  await expect(page.locator('.explore-bar')).toContainText('Explore: Orders DB')
  await all(page, 'Orders DB')
  await page.locator('.explore-bar').getByRole('button', { name: 'Close the exploration' }).click()
  await expect(page.locator('.lp-explore-card')).toHaveCount(0)
  await expect(page.locator('.lp-view-card.active')).toContainText('API context')
  await expect(page.locator('[role="dialog"]')).toHaveCount(0)
  await page.waitForTimeout(1000)
  expect(await studio.storedJson()).toBe(stored)

  // Replaced by another exploration, and dropped with another model.
  await pick(studio.node('web'))
  await page.getByRole('button', { name: 'Explore from here' }).click()
  await pick(studio.node('web'))
  await page.getByRole('button', { name: 'Explore from here' }).click()
  await expect(page.locator('.lp-explore-card')).toHaveCount(1)
  await studio.openSample()
  await expect(page.locator('.lp-explore-card')).toHaveCount(0)
})

test('Explore from here in Viewer follows the milestone shown and saves nothing', async ({ page, studio }) => {
  await studio.openSample('view-core')
  const docId = studio.activeDocId()
  await page.locator('.toolbar-mode-btn', { hasText: 'Viewer' }).click()
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Viewer/)
  await page.waitForTimeout(1000)
  const stored = await studio.storedJson(docId)
  await page.locator('.lp-section-header', { hasText: 'Milestones' }).click()
  await page.locator('.lp-snap-card', { hasText: 'v1' }).first().click()
  await studio.settle()

  // In v1 the API gateway serves the web app, accounts and auth only.
  await studio.node('ctn-apigw').click()
  await page.getByRole('button', { name: 'Explore from here' }).click()
  await expect(page.locator('.explore-bar')).toContainText('Explore: API Gateway')
  await expect(page.locator('.explore-bar').getByRole('button', { name: 'Save as view…' })).toHaveCount(0)
  let menu = await plus(page, 'API Gateway')
  await menu.getByRole('menuitem', { name: /^Show all/ }).click()
  for (const id of ['ctn-web', 'ctn-accounts', 'ctn-auth']) await expect(studio.node(id)).toBeVisible()

  // Current (live): the same elements, and the gateway's other neighbours there.
  await page.locator('.lp-snap-current').click()
  await expect(page.locator('.lp-explore-card')).toHaveClass(/active/)
  for (const id of ['ctn-apigw', 'ctn-web', 'ctn-accounts', 'ctn-auth']) await expect(studio.node(id)).toBeVisible()
  const before = new Set(await drawnIds(page))
  menu = await plus(page, 'API Gateway')
  // Quick: it lays out what it adds at once.
  const started = Date.now()
  await menu.getByRole('menuitem', { name: /^Show all/ }).click()
  await expect(studio.node('ctn-payments')).toBeVisible()
  expect(Date.now() - started).toBeLessThan(3000)
  // The camera shows the three just added, with the gateway, readable.
  await studio.settle()
  const added = (await drawnIds(page)).filter((id) => !before.has(id))
  expect(added.length).toBeGreaterThanOrEqual(3)
  expect(await zoomOf(page)).toBeGreaterThanOrEqual(0.6)
  for (const id of [...added, 'ctn-apigw']) expect(await inPane(page, studio.node(id)), id).toBe(true)
  // Its − works here too.
  await page.getByRole('button', { name: 'Fold back what API Gateway added', exact: true }).click()
  for (const id of ['ctn-web', 'ctn-payments']) await expect(studio.node(id)).toHaveCount(0)

  // Nothing saved. In Designer the exploration stays, on the live model,
  // and its history has nothing from Viewer; back in Viewer it is still there.
  await page.waitForTimeout(1000)
  expect(await studio.storedJson(docId)).toBe(stored)
  await studio.designer()
  await expect(page.locator('.lp-explore-card')).toHaveClass(/active/)
  await expect(studio.node('ctn-apigw')).toBeVisible()
  await expect(page.getByTitle('Undo (⌘Z)')).toBeDisabled()
  await page.locator('.toolbar-mode-btn', { hasText: 'Viewer' }).click()
  await expect(page.locator('.lp-explore-card')).toHaveClass(/active/)
  await expect(studio.node('ctn-apigw')).toBeVisible()
  await page.waitForTimeout(1000)
  expect(await studio.storedJson(docId)).toBe(stored)
})
