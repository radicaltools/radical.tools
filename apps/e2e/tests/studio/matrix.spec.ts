import { test, expect, fixture } from '../../support/fixtures'

// The relationship matrix: a cell per pair, filled where a relation is.

test.beforeEach(async ({ studio }) => {
  const doc = JSON.parse(fixture('bookstore'))
  doc.views.push({ id: 'v-matrix', name: 'Matrix', kind: 'matrix', nodeIds: [], positions: {} })
  await studio.seedDocument(JSON.stringify(doc))
})

test('one click on a cell selects its relation, even when it was selected on another view', async ({ page, studio }) => {
  // The matrix removed a relation on a click when it was the one selected,
  // also when it had been selected on a canvas before the matrix opened.
  await studio.open('v-containers')
  await page.getByTestId('rf__edge-r2').locator('path').first().click({ force: true })
  await expect(page.locator('.props-type-badge')).toHaveText(/relation/i)
  await page.locator('.lp-view-card', { hasText: 'Matrix' }).click()
  const cell = page.locator('.mx-cell.mx-has-rel[title*="calls"]')
  await cell.click()
  await page.waitForTimeout(800)
  expect((await studio.storedDoc()).relations.map((r) => r.id)).toContain('r2')
  // A second click on the same cell removes it, as the hint says.
  await cell.click()
  await expect.poll(async () => (await studio.storedDoc()).relations.map((r) => r.id)).not.toContain('r2')
})
