import { test, expect } from '../../support/fixtures'

// Zoomed out, relation labels are too small to read and only cover the
// diagram: the canvas hides them, keeps those of the selected node's
// relations, and shows them all again once zoomed in.

test('relation labels follow the zoom', async ({ page, studio }) => {
  await studio.openSample('canvas')
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
