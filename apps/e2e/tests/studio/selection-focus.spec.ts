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

test('the Focus switch on the canvas turns the dimming off and on, and is remembered', async ({ page, studio }) => {
  await studio.openSampleWhole()
  const dimmedNodes = page.locator('.react-flow__node.focus-dim')
  const focus = page.getByRole('toolbar', { name: 'Canvas' }).getByRole('button', { name: 'Focus' })
  await expect(focus).toHaveAttribute('aria-pressed', 'true')
  await focus.click()
  await expect(focus).toHaveAttribute('aria-pressed', 'false')

  const accounts = () => studio.nodeByLabel('Accounts Service').first()
  await accounts().click()
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(1)
  await expect(dimmedNodes).toHaveCount(0)
  await expect(page.locator('.react-flow__edge g.focus-dim')).toHaveCount(0)

  // Off in this browser, also after a reload.
  await page.reload()
  await studio.ready()
  await expect(focus).toHaveAttribute('aria-pressed', 'false')
  await focus.click()
  await expect(focus).toHaveAttribute('aria-pressed', 'true')
  await studio.canvas.click({ position: { x: 8, y: 8 } })
  await accounts().click()
  await expect.poll(() => dimmedNodes.count()).toBeGreaterThan(0)
})

// F-0039: the Settings menu read the settings once and wrote them all back
// with its own change, turning Focus and Smart fit on again.
test('a Settings switch keeps Focus and Smart fit as the user left them', async ({ page, studio }) => {
  await studio.openSample()
  await studio.designer()
  const focus = page.getByRole('toolbar', { name: 'Canvas' }).getByRole('button', { name: 'Focus' })
  await focus.click()
  await expect(focus).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: /Smart fit/ }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('menuitemcheckbox', { name: /Smart fit/ })).toContainText('(off)')
  const wizard = page.locator('label.app-menu-row', { hasText: 'Wizard on create' }).locator('input')
  await wizard.uncheck()
  await expect(wizard).not.toBeChecked()
  await page.keyboard.press('Escape')

  await page.reload()
  await studio.ready()
  await expect(focus).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('menuitemcheckbox', { name: /Smart fit/ })).toContainText('(off)')
  await expect(wizard).not.toBeChecked()
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

// F-0040: with Focus off a click on an element moved the camera all the
// same, back to the one from before an earlier framing.
test('with Focus off a click on an element leaves the camera where it is', async ({ page, studio }) => {
  await studio.openSampleWhole()
  const transform = () => page.locator('.react-flow__viewport').getAttribute('style')
  const before = await transform()
  await studio.nodeByLabel('Accounts Service').first().click()
  await studio.settle()
  const framed = await transform()
  expect(framed).not.toBe(before)

  const focus = page.getByRole('toolbar', { name: 'Canvas' }).getByRole('button', { name: 'Focus' })
  await focus.click()
  await expect(focus).toHaveAttribute('aria-pressed', 'false')
  // Another element in sight, where nothing covers it.
  const other = await page.evaluate(() => {
    for (const n of Array.from(document.querySelectorAll('.react-flow__node:not(.selected)'))) {
      const r = n.getBoundingClientRect()
      const x = r.x + r.width / 2
      const y = r.y + r.height / 2
      if (x < 360 || y < 80 || x > innerWidth - 40 || y > innerHeight - 80) continue
      if (document.elementFromPoint(x, y)?.closest('.react-flow__node') === n) return { x, y, id: n.getAttribute('data-id') }
    }
    return null
  })
  expect(other).not.toBeNull()
  await page.mouse.click(other!.x, other!.y)
  await expect(page.locator(`.react-flow__node.selected[data-id="${other!.id}"]`)).toHaveCount(1)
  await studio.settle()
  expect(await transform()).toBe(framed)
  // Nor does a click on the empty canvas move it.
  await studio.canvas.click({ position: { x: 8, y: 8 } })
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(0)
  await studio.settle()
  expect(await transform()).toBe(framed)
})

// F-0041: a click on the empty canvas while the framing still flew stopped
// the camera half-way, and it stayed there.
test('a click on the empty canvas during the framing flight brings back the camera from before', async ({ page, studio }) => {
  await studio.openSampleWhole()
  const viewport = page.locator('.react-flow__viewport')
  const before = await viewport.getAttribute('style')
  const box = (await studio.nodeByLabel('Accounts Service').first().boundingBox())!
  const pane = (await studio.canvas.boundingBox())!
  await page.mouse.click(box.x + 5, box.y + 5)
  // Mid-flight: the camera has left, and not arrived.
  await expect.poll(async () => (await viewport.getAttribute('style')) !== before, { intervals: [10] }).toBe(true)
  await page.mouse.click(pane.x + 8, pane.y + 8)
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(0)
  await studio.settle()
  await expect.poll(() => viewport.getAttribute('style')).toBe(before)
})

// F-0061: a click only selects (the card opens on a double-click), but the
// framing kept room on the right for the card all the same: the framed
// elements sat off to the left, and at 1280 px, the room left under half the
// canvas, the framing took the whole canvas and one lay under the palette.
for (const [width, height] of [[1280, 720], [1600, 900]]) {
  test(`a click at ${width} px frames the selection in what the palette leaves free, with no room for a card that is closed`, async ({ page, studio }) => {
    await page.setViewportSize({ width, height })
    await studio.openSample()
    await studio.designer()
    await studio.node('sys-core').click({ position: { x: 10, y: 10 } })
    await expect(page.locator('.react-flow__node.selected[data-id="sys-core"]')).toHaveCount(1)
    await expect.poll(() => page.locator('.react-flow__node.focus-dim').count()).toBeGreaterThan(0)
    await studio.settle()
    await expect(page.locator('.right-panel.open')).toHaveCount(0)
    const geo = await page.evaluate(() => {
      const palette = document.querySelector('.canvas-column .element-palette')!.getBoundingClientRect()
      const canvas = document.querySelector('.react-flow')!.getBoundingClientRect()
      const boxes = Array.from(document.querySelectorAll('.react-flow__node:not(.focus-dim)')).map((n) => n.getBoundingClientRect())
      const left = Math.min(...boxes.map((b) => b.left))
      const right = Math.max(...boxes.map((b) => b.right))
      return { left: left - palette.right, right: canvas.right - right }
    })
    expect(geo.left).toBeGreaterThanOrEqual(0)
    expect(geo.right).toBeGreaterThanOrEqual(0)
    expect(Math.abs(geo.left - geo.right)).toBeLessThan(100)
  })
}

// F-0084: the model is saved only after an edit, and with it the view's
// camera: with Smart fit off a camera moved on its own (a wheel, the framing
// of a click) was lost on reload, the view opened at the camera of its last
// edit. It is kept by this viewer, outside the model.
test('a camera moved on its own survives a reload, and the model is not saved for it', async ({ page, studio }) => {
  await studio.openSample()
  await studio.designer()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: /Smart fit/ }).click()
  await page.keyboard.press('Escape')
  await page.reload()
  await studio.ready()
  const docId = studio.activeDocId()
  const saved = await studio.storedJson(docId)
  const transform = () => page.locator('.react-flow__viewport').getAttribute('style')
  const before = await transform()

  const pane = (await studio.canvas.boundingBox())!
  await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2)
  await page.mouse.wheel(0, -300)
  await studio.settle()
  const zoomed = await transform()
  expect(zoomed).not.toBe(before)
  await page.reload()
  await studio.ready()
  expect(await transform()).toBe(zoomed)

  // The framing of a click too.
  await studio.node('sys-core').click({ position: { x: 10, y: 10 } })
  await studio.settle()
  const framed = await transform()
  expect(framed).not.toBe(zoomed)
  await page.reload()
  await studio.ready()
  expect(await transform()).toBe(framed)
  expect(await studio.storedJson(docId)).toBe(saved)
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
