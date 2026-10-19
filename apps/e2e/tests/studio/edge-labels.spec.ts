import { test, expect, fixture } from '../../support/fixtures'

// Zoomed out, relation labels are too small to read and only cover the
// diagram: the canvas hides them, keeps those of the selected node's
// relations, and shows them all again once zoomed in.

test('relation labels follow the zoom', async ({ page, studio }) => {
  await studio.openSampleWhole()
  const visibleLabels = page.locator('.relation-label:visible')

  // The whole sample fits only far zoomed out.
  await expect(studio.canvas).toHaveAttribute('data-edge-labels', 'none')
  await expect(page.locator('.relation-label').first()).toBeAttached()
  await expect(visibleLabels).toHaveCount(0)

  // A selected node shows the labels of its relations.
  await studio.nodeByLabel('Accounts Service').first().click()
  await expect.poll(() => visibleLabels.count()).toBeGreaterThan(0)
  const ofSelection = await visibleLabels.count()
  expect(ofSelection).toBeLessThan(await page.locator('.relation-label').count())

  // Zooming in brings back the names, then the technology too.
  const zoomIn = page.getByTitle('Zoom in (⌘+)')
  for (let i = 0; i < 15 && (await studio.canvas.getAttribute('data-edge-labels')) !== 'full'; i++) {
    await zoomIn.click()
    await page.waitForTimeout(350)
  }
  await expect(studio.canvas).toHaveAttribute('data-edge-labels', 'full')
  await expect.poll(() => visibleLabels.count()).toBeGreaterThan(ofSelection)
  await expect(page.locator('.relation-label-tech:visible').first()).toBeVisible()
})

// A long name takes at most two lines and the technology one, cut with an
// ellipsis, so labels stay smaller than the elements they join; the whole
// text shows while the relation, or an element at its end, is selected.
test('a long relation name is cut after two lines, and shown whole while the relation is selected', async ({ page, studio }) => {
  const LONG = 'reads and writes the orders, the stock levels, the reservations and every payment the shop has taken, then keeps an audit trail of each change'
  const doc = JSON.parse(fixture('bookstore'))
  doc.relations = doc.relations.map((r: { id: string }) => (r.id === 'r3' ? { ...r, label: LONG, technology: 'PostgreSQL wire protocol over TLS with pooled connections' } : r))
  await studio.seedDocument(JSON.stringify(doc))
  await studio.open('v-containers')
  const label = page.locator('.relation-label', { hasText: 'reads and writes the orders' })
  const name = label.locator('.relation-label-name')
  await expect(name).toBeVisible()
  // In CSS pixels, as the line height is: the canvas zoom scales the box on screen.
  const lines = async () => name.evaluate((el) => Math.round((el as HTMLElement).offsetHeight / parseFloat(getComputedStyle(el).lineHeight)))
  const cut = async () => name.evaluate((el) => el.scrollHeight > el.clientHeight + 1)
  await expect.poll(lines).toBe(2)
  expect(await cut()).toBe(true)
  expect(await label.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBe(12)

  // Selected at one of its ends: the whole name.
  await studio.node('db').click()
  await expect.poll(lines).toBeGreaterThan(2)
  expect(await cut()).toBe(false)
})
