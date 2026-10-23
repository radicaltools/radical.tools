import { test, expect, fixture } from '../../support/fixtures'

// The relationship matrix: a cell per pair, filled where a relation is.

test.describe('the bookstore matrix', () => {
  test.beforeEach(async ({ studio }) => {
    const doc = JSON.parse(fixture('bookstore'))
    doc.views.push({ id: 'v-matrix', name: 'Matrix', kind: 'matrix', nodeIds: [], positions: {} })
    await studio.seedDocument(JSON.stringify(doc))
  })

  test('one click on a cell selects its relation, even when it was selected on another view', async ({ page, studio }) => {
    // The matrix removed a relation on a click when it was the one selected,
    // also when it had been selected on a canvas before the matrix opened.
    await studio.open('v-containers')
    await page.getByTestId('rf__edge-r2').locator('path').first().dblclick({ force: true })
    await expect(studio.properties.locator('.pp-type')).toHaveText(/relation/i)
    await page.locator('.lp-view-card', { hasText: 'Matrix' }).click()
    const cell = page.locator('.mx-cell.mx-has-rel[title*="calls"]')
    await cell.click()
    await page.waitForTimeout(800)
    expect((await studio.storedDoc()).relations.map((r) => r.id)).toContain('r2')
    // A second click on the same cell removes it, as the hint says.
    await cell.click()
    await expect.poll(async () => (await studio.storedDoc()).relations.map((r) => r.id)).not.toContain('r2')
  })

  // Open point of runs 45 to 64: the popup of a cell with several relations
  // stayed under the cell, off the window near its bottom edge, and stayed
  // where it was while the matrix scrolled.
  test('the popup of a cell with several relations stays in the window, and goes when the matrix scrolls', async ({ page, studio }) => {
    await page.addInitScript(() => {
      const key = 'radical-doc:e2e-doc'
      const doc = JSON.parse(localStorage.getItem(key)!)
      if (doc.relations.some((r: { id: string }) => r.id === 'r3b')) return
      doc.relations.push({ id: 'r3b', sourceId: 'api', targetId: 'db', label: 'archives' })
      localStorage.setItem(key, JSON.stringify(doc))
    })
    await page.setViewportSize({ width: 1000, height: 420 })
    await studio.open('v-matrix')
    // API → Orders DB, two relations, near the bottom edge of the window.
    const cell = page.locator('.mx-cell.mx-has-rel', { hasText: '2' })
    const scroller = page.locator('.mx-scroll')
    await cell.click()
    const popup = page.locator('.mx-popup')
    await expect(popup).toBeVisible()
    await expect.poll(async () => {
      const box = (await popup.boundingBox())!
      return box.y >= 0 && box.y + box.height <= 420 && box.x >= 0 && box.x + box.width <= 1000
    }).toBe(true)
    await scroller.evaluate((el) => { el.scrollTop += 40; el.scrollLeft += 40; el.dispatchEvent(new Event('scroll')) })
    await expect(popup).toHaveCount(0)
  })
})

// Item 241's sweep: an empty cell where several relation types fit the pair
// added a relation with no type, which Validation flags. It asks which, as
// a relation drawn on the canvas does.
test('an empty cell where several relation types fit asks which', async ({ page, studio }) => {
  const n = (id: string, type: string, label: string, x: number) =>
    ({ id, type, label, description: '', technology: '', x, y: 0, width: 320, height: 200, collapsed: false, external: false })
  await studio.seedDocument(JSON.stringify({
    metamodel: { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} },
    nodes: [n('d1', 'domain', 'Ordering', 0), n('d2', 'domain', 'Billing', 400)],
    relations: [],
    views: [{ id: 'v-matrix', name: 'Matrix', kind: 'matrix', nodeIds: [], positions: {} }],
  }))
  await studio.open('v-matrix')
  await page.locator('.mx-cell[title="Create relation: Ordering → Billing"]').click()
  const popup = page.locator('.mx-popup')
  await expect(popup.getByRole('button')).toHaveText(['Depends on', 'Partners with'])
  await page.waitForTimeout(300)
  expect((await studio.storedDoc()).relations).toEqual([])
  await popup.getByRole('button', { name: 'Partners with' }).click()
  await expect.poll(async () => ((await studio.storedDoc()).relations as Array<{ sourceId: string; targetId: string; relationType?: string }>).map((r) => [r.sourceId, r.targetId, r.relationType]))
    .toEqual([['d1', 'd2', 'partnership']])
})
