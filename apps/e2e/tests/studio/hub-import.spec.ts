import { test, expect, fixture, DOC_ID, withWhole, WHOLE } from '../../support/fixtures'
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

test('a blueprint leaves no {{KEY}} placeholder in the model', async ({ page, studio }) => {
  // The template form asked only for the parameters the selected elements
  // listed themselves, and the flows' step notes were not filled in.
  const doc = JSON.parse(fixture('bookstore'))
  doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} }
  await studio.seedDocument(withWhole(JSON.stringify(doc)))
  await studio.open(WHOLE)
  await page.getByTitle('Menu', { exact: true }).click()
  await page.getByText(/Import from Hub/).first().click()
  const dialog = page.locator('[aria-label="Import from Hub"]')
  await dialog.getByPlaceholder('Search concepts…').pressSequentially('Fintech')
  const card = dialog.locator('div', { has: page.getByRole('heading', { name: /Fintech/ }) })
    .filter({ has: page.getByRole('button', { name: 'Add to Model' }) }).last()
  await card.getByRole('button', { name: 'Add to Model' }).click()
  // The picker: leave the referenced concepts out, import the elements.
  for (const box of await dialog.locator('input[type=checkbox]:checked').all()) {
    const label = (await box.locator('xpath=..').innerText()).trim()
    if (/hub|concept/i.test(label)) await box.uncheck().catch(() => {})
  }
  await dialog.getByRole('button', { name: /^Import \(/ }).click()
  await dialog.getByRole('button', { name: 'Import', exact: true }).click()
  await expect.poll(async () => (await studio.storedDoc()).nodes.length).toBeGreaterThan(20)
  await page.waitForTimeout(1000)
  // The template record keeps the Hub's text with its tokens, to apply new
  // values later; the model itself has none.
  const saved = JSON.parse(await studio.storedJson()) as { nodes: unknown[]; relations: unknown[]; sequences?: unknown[] }
  expect(JSON.stringify([saved.nodes, saved.relations, saved.sequences ?? []])).not.toMatch(/\{\{[A-Z0-9_]+\}\}/)
})

test('a concept imported into a selected container lands beside what it holds', async ({ page, studio }) => {
  // It kept the concept's own coordinates inside the container: on its
  // children, and a second import on the first.
  const doc = JSON.parse(fixture('bookstore'))
  doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} }
  await studio.seedDocument(JSON.stringify(doc))
  await studio.open('v-containers')
  for (let i = 0; i < 2; i++) {
    const bookstore = studio.node('bookstore')
    if (!/selected/.test((await bookstore.getAttribute('class')) ?? '')) await bookstore.click({ position: { x: 30, y: 12 } })
    await page.getByTitle('Menu', { exact: true }).click()
    await page.getByText(/Import from Hub/).first().click()
    const dialog = page.locator('[aria-label="Import from Hub"]')
    await dialog.getByPlaceholder('Search concepts…').pressSequentially('API Versioning')
    const card = dialog.locator('div', { has: page.getByRole('heading', { name: /API Versioning/ }) })
      .filter({ has: page.getByRole('button', { name: 'Add to Model' }) }).last()
    await card.getByRole('button', { name: 'Add to Model' }).click()
    await page.waitForTimeout(800)
    const skip = dialog.getByRole('button', { name: 'Skip', exact: true })
    if (await skip.count()) await skip.click()
    await page.waitForTimeout(300)
    const importButton = dialog.getByRole('button', { name: 'Import', exact: true })
    if (await importButton.count()) await importButton.click()
    await expect.poll(async () => (await studio.storedDoc()).nodes.length).toBe(7 + i)
    if (await dialog.isVisible().catch(() => false)) await page.keyboard.press('Escape')
  }
  await studio.settle()
  const inside = (await studio.storedDoc()).nodes.filter((n) => n.parentId === 'bookstore').map((n) => n.id)
  expect(overlaps(await studio.boxes(), inside)).toEqual([])
  // The container grew; its neighbour made room, as after a drop.
  expect(overlaps(await studio.boxes(), ['bookstore', 'payments', 'customer'])).toEqual([])
})
