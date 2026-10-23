import { test, expect } from '../../support/fixtures'

// A node selected on the canvas brings its relations forward: the node, its
// relations and the elements at their other ends stay as they are, and the
// rest of the canvas is dimmed, as in the metamodel diagram.

test('a selected node brings its relations forward and dims the rest', async ({ page, studio }) => {
  await studio.openSampleWhole()
  const dimmedNodes = page.locator('.react-flow__node.focus-dim')
  const dimmedEdges = page.locator('.react-flow__edge g.focus-dim')
  await expect(page.locator('.react-flow__edge').first()).toBeAttached()
  await expect(dimmedNodes).toHaveCount(0)

  const accounts = studio.nodeByLabel('Accounts Service').first()
  await accounts.click()
  await expect.poll(() => dimmedNodes.count()).toBeGreaterThan(0)
  await expect(page.locator('.react-flow__node.selected')).not.toHaveClass(/focus-dim/)
  // Its own relations stay; the others are dimmed.
  const edges = await page.locator('.react-flow__edge').count()
  const dimmed = await dimmedEdges.count()
  expect(dimmed).toBeGreaterThan(0)
  expect(dimmed).toBeLessThan(edges)
  if (process.env.FOCUS_SHOT) await page.screenshot({ path: process.env.FOCUS_SHOT })

  // A click on the empty canvas ends the focus.
  await studio.canvas.click({ position: { x: 8, y: 8 } })
  await expect(dimmedNodes).toHaveCount(0)
  await expect(dimmedEdges).toHaveCount(0)
})

test('a selected relation brings forward itself and its two ends', async ({ page, studio }) => {
  await studio.openSampleWhole()
  await studio.nodeByLabel('Accounts Service').first().click()
  const undimmedEdges = page.locator('.react-flow__edge').filter({ hasNot: page.locator('g.focus-dim') })
  await expect.poll(() => undimmedEdges.count()).toBeGreaterThan(1)
  // Zoomed out, a line is too thin to aim at: click it where React Flow listens.
  await undimmedEdges.first().dispatchEvent('click')
  await expect(undimmedEdges).toHaveCount(1)
  await expect(page.locator('.react-flow__node:not(.focus-dim)').filter({ hasText: 'Accounts Service' }).first()).toBeVisible()
})

test('leaving a view clears its selection', async ({ page, studio }) => {
  await studio.openSampleWhole()
  const selected = page.locator('.react-flow__node.selected')
  await studio.nodeByLabel('Accounts Service').first().dblclick()
  await expect(selected).toHaveCount(1)
  await expect(studio.properties).toBeVisible()

  // Core Banking shows Accounts Service too, but nothing is selected there.
  await studio.open('view-core', 'designer', studio.activeDocId())
  await expect(selected).toHaveCount(0)
  await expect(page.locator('.react-flow__node.focus-dim')).toHaveCount(0)
  await expect(studio.properties).toHaveCount(0)

  // Back on the whole model, nothing is selected either: it went when the user left.
  await studio.open('v-whole', 'designer', studio.activeDocId())
  await expect(selected).toHaveCount(0)
  await expect(page.locator('.react-flow__node.focus-dim')).toHaveCount(0)
})

test('the camera frames a selection and goes back when it is cleared', async ({ page, studio }) => {
  await studio.openSampleWhole()
  const transform = () => page.locator('.react-flow__viewport').getAttribute('style')
  const before = await transform()

  // Far zoomed out, a click on Accounts Service zooms onto it and its neighbours.
  await studio.nodeByLabel('Accounts Service').first().click()
  await studio.settle()
  const framed = await transform()
  expect(framed).not.toBe(before)
  const zoom = (style: string | null) => Number(/scale\(([\d.]+)\)/.exec(style ?? '')?.[1])
  expect(zoom(framed)).toBeGreaterThan(zoom(before))
  expect(zoom(framed)).toBeLessThanOrEqual(1)

  // A click on the empty canvas brings back the camera from before.
  await studio.canvas.click({ position: { x: 8, y: 8 } })
  await studio.settle()
  await expect.poll(transform).toBe(before)

  // A camera the user moves after the framing stays when the selection goes.
  await studio.nodeByLabel('Accounts Service').first().click()
  await studio.settle()
  await page.getByTitle('Zoom in (⌘+)').click()
  await studio.settle()
  const chosen = await transform()
  await studio.canvas.click({ position: { x: 8, y: 8 } })
  await studio.settle()
  expect(await transform()).toBe(chosen)
})

// Item 224: on a hierarchy view the properties card covered Size, Levels and
// ↑ Up: a click on Levels reached the card, and Levels stayed 2.
test('the hierarchy\'s Size, Levels and Up stay clear of the properties card', async ({ page, studio }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await studio.openSample('view-treemap')
  // Mobile App has no children: a double-click opens its card (on one with
  // children it drills in).
  const at = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('.treemap-wrap svg text'))
      .find((el) => (el as SVGTextElement).style.display !== 'none' && el.textContent === 'Mobile App')
    const r = t!.getBoundingClientRect()
    return { x: r.x + Math.min(10, r.width / 2), y: r.y + r.height / 2 }
  })
  await page.mouse.dblclick(at.x, at.y)
  await expect(studio.properties).toBeVisible()
  await expect(studio.attribute('Name')).toHaveValue('Mobile App')
  await expect.poll(async () => {
    const card = (await studio.properties.boundingBox())!
    const levels = (await page.locator('.tm-bc-sizeby', { hasText: 'Levels' }).boundingBox())!
    return levels.x + levels.width <= card.x
  }).toBe(true)
  await page.locator('.tm-bc-sizeby', { hasText: 'Levels' }).locator('select').selectOption('3')
  await expect(page.locator('.tm-bc-sizeby', { hasText: 'Levels' }).locator('select')).toHaveValue('3')
})
