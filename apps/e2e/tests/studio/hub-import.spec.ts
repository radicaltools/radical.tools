import { test, expect, fixture, DOC_ID } from '../../support/fixtures'
import { HUB_PORT } from '../../playwright.config'

// Import from the Hub into an existing model. Studio reads the catalogue
// from hub.radical.tools; served here from this build's Hub.

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/hub\.radical\.tools\/hub\//, async (route) => {
    const local = `http://localhost:${HUB_PORT}` + new URL(route.request().url()).pathname
    const response = await route.fetch({ url: local })
    await route.fulfill({ response, headers: { ...response.headers(), 'content-type': 'application/json' } })
  })
})

const overlaps = (boxes: Record<string, { x: number; y: number; width: number; height: number }>, ids: string[]): string[] => {
  const out: string[] = []
  for (const a of ids) for (const b of ids) {
    if (a >= b || !boxes[a] || !boxes[b]) continue
    const p = boxes[a], q = boxes[b]
    if (Math.min(p.x + p.width, q.x + q.width) - Math.max(p.x, q.x) > 1 && Math.min(p.y + p.height, q.y + q.height) - Math.max(p.y, q.y) > 1) out.push(`${a} / ${b}`)
  }
  return out
}

test('concepts added from a Hub link land where nothing is', async ({ page, studio }) => {
  // Each was centred on the camera: three requirements lay at one place, on
  // each other and on an element of the model.
  const doc = JSON.parse(fixture('bookstore'))
  doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} }
  await studio.seedDocument(JSON.stringify(doc))
  await page.goto(`/?hub=req-mfa,req-data-integrity,req-iac#/d/${encodeURIComponent(`ls:${DOC_ID}`)}/m/designer/v/canvas`)
  await studio.ready()
  const dialog = page.locator('[aria-label="Import from Hub"]')
  await expect(dialog.getByRole('button', { name: 'Add to Model' }).first()).toBeVisible()
  for (let i = 0; i < 3; i++) {
    await dialog.getByRole('button', { name: 'Add to Model' }).first().click()
    const skip = dialog.getByRole('button', { name: 'Skip', exact: true })
    const importButton = dialog.getByRole('button', { name: 'Import', exact: true })
    // The related-concepts picker, the template form, or straight in.
    await expect.poll(async () => (await skip.count()) + (await importButton.count()) > 0
      || (await studio.storedDoc()).nodes.length === 7 + i).toBe(true)
    if (await skip.count()) await skip.click()
    if (await importButton.count()) await importButton.click()
    await expect.poll(async () => (await studio.storedDoc()).nodes.length).toBe(7 + i)
  }
  await dialog.getByRole('button', { name: 'Close' }).first().click()
  await studio.settle()
  const roots = (await studio.storedDoc()).nodes.filter((n) => !n.parentId).map((n) => n.id)
  expect(overlaps(await studio.boxes(), roots)).toEqual([])
})

test('a concept added with its related concepts is one undo step', async ({ page, studio }) => {
  // Each related concept came in with its own step: one Undo took back the
  // main concept only.
  await studio.seed('order-machine')
  await studio.open('v-order')
  const before = (await studio.storedDoc()).nodes.length
  await page.getByTitle('Menu', { exact: true }).click()
  await page.getByText(/Import from Hub/).first().click()
  const dialog = page.locator('[aria-label="Import from Hub"]')
  await dialog.getByPlaceholder('Search concepts…').pressSequentially('API Response Time')
  const card = dialog.locator('div', { has: page.getByRole('heading', { name: /API Response Time$/ }) })
    .filter({ has: page.getByRole('button', { name: 'Add to Model' }) }).last()
  await card.getByRole('button', { name: 'Add to Model' }).click()
  await dialog.getByRole('button', { name: /^Import \(\d+\)$/ }).click()
  await dialog.getByRole('button', { name: 'Import', exact: true }).click()
  await expect.poll(async () => (await studio.storedDoc()).nodes.length).toBe(before + 3)
  await studio.pane.click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(async () => (await studio.storedDoc()).nodes.length).toBe(before)
})
