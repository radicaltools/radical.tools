import type { Locator, Page } from '@playwright/test'
import { test, expect } from '../../support/fixtures'

// Explore from here: a temporary structure view grown from one element by
// the + of each element and by + 1 level. It is first in the list of views
// while it is open, never saved, kept as an ordinary view by Save as view,
// and gone without a question when closed.

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

/** The names of the views listed, in order. */
const viewNames = (page: Page): Promise<string[]> =>
  page.locator('.lp-view-list .lp-view-card .lp-card-title').allTextContents()

test('Explore from here grows by + and by a level', async ({ page, studio }) => {
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
  await expect(studio.node('bookstore')).toHaveCount(0)
  for (const id of ['web', 'db', 'payments', 'customer']) await expect(studio.node(id)).toHaveCount(0)

  // Its +: its three neighbours a layer below it, each with its relation to
  // API, no frame round any, and no + left on it.
  await page.getByRole('button', { name: 'Show 3 more related to API', exact: true }).click()
  for (const id of ['web', 'db', 'payments']) await expect(studio.node(id)).toBeVisible()
  await expect(studio.node('customer')).toHaveCount(0)
  await studio.settle()
  let box = await studio.boxes()
  await expect(studio.node('bookstore')).toHaveCount(0)
  for (const id of ['web', 'db', 'payments']) expect(box[id].y).toBeGreaterThanOrEqual(box.api.y + box.api.height)
  expect(await drawnEdges(page)).toEqual(['r2', 'r3', 'r4'])
  expect(await studio.layoutViolations()).toEqual([])
  // The camera shows what was added, with API, at a readable zoom.
  expect(await zoomOf(page)).toBeGreaterThanOrEqual(0.6)
  for (const id of ['api', 'web', 'db', 'payments']) expect(await inPane(page, studio.node(id))).toBe(true)
  await expect(studio.node('api').locator('.explore-more')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Show 1 more related to Web App', exact: true })).toBeVisible()

  // + 1 level: the customer, who uses the web app, a layer further.
  await page.getByRole('button', { name: '+ 1 level' }).click()
  await expect(studio.node('customer')).toBeVisible()
  await expect(page.locator('.explore-more')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '+ 1 level' })).toBeDisabled()
  await studio.settle()
  box = await studio.boxes()
  for (const id of ['web', 'db', 'payments']) {
    expect(box[id].y).toBeGreaterThanOrEqual(box.api.y + box.api.height)
    expect(box.customer.y).toBeGreaterThanOrEqual(box[id].y + box[id].height)
  }
  await expect(studio.node('bookstore')).toHaveCount(0)
  // Each relation drawn joins two layers next to each other.
  expect(await drawnEdges(page)).toEqual(['r1', 'r2', 'r3', 'r4'])
  for (const id of ['api', 'web', 'db', 'payments']) expect(apart(box[id], box.customer)).toBe(true)
  expect(await studio.layoutViolations()).toEqual([])

  // Nothing of it was saved, and it is no step to undo.
  await page.waitForTimeout(1000)
  expect(await studio.storedJson()).toBe(stored)
  await expect(page.getByTitle('Undo (⌘Z)')).toBeDisabled()
})

test('an exploration is saved as a view, and dropped when closed', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  await studio.node('api').click()
  await page.getByRole('button', { name: 'Explore from here' }).click()
  await page.getByRole('button', { name: 'Show 3 more related to API', exact: true }).click()
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
  await page.getByRole('button', { name: 'Show 1 more related to Orders DB', exact: true }).click()
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
  await page.getByRole('button', { name: 'Show 3 more related to API Gateway', exact: true }).click()
  for (const id of ['ctn-web', 'ctn-accounts', 'ctn-auth']) await expect(studio.node(id)).toBeVisible()

  // Current (live): the same elements, and the gateway's other neighbours there.
  await page.locator('.lp-snap-current').click()
  await expect(page.locator('.lp-explore-card')).toHaveClass(/active/)
  for (const id of ['ctn-apigw', 'ctn-web', 'ctn-accounts', 'ctn-auth']) await expect(studio.node(id)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show 3 more related to API Gateway', exact: true })).toBeVisible()
  const before = new Set(await drawnIds(page))
  await page.getByRole('button', { name: 'Show 3 more related to API Gateway', exact: true }).click()
  await expect(studio.node('ctn-payments')).toBeVisible()
  // The camera shows the three just added, with the gateway, readable.
  await studio.settle()
  const added = (await drawnIds(page)).filter((id) => !before.has(id) && !id.startsWith('sys-') && !id.startsWith('dom-'))
  expect(added.length).toBeGreaterThanOrEqual(3)
  expect(await zoomOf(page)).toBeGreaterThanOrEqual(0.6)
  for (const id of [...added, 'ctn-apigw']) expect(await inPane(page, studio.node(id)), id).toBe(true)

  // Nothing saved; Designer finds its model and its history as they were.
  await page.waitForTimeout(1000)
  expect(await studio.storedJson(docId)).toBe(stored)
  await studio.designer()
  await expect(page.locator('.lp-explore-card')).toHaveCount(0)
  await expect(page.getByTitle('Undo (⌘Z)')).toBeDisabled()
  await page.waitForTimeout(1000)
  expect(await studio.storedJson(docId)).toBe(stored)
})
