import { test, expect } from '../../support/fixtures'

// Bugs this suite found that are not fixed yet. Each test states the correct
// behaviour and is marked `test.fail`, so the suite stays green while the
// bug is there and turns red ("expected to fail, but passed") once it is
// fixed: then delete the `test.fail` line and the test becomes a guard.

test('double-click on the empty canvas adds a system', async ({ page, studio }) => {
  test.fail(true, 'React Flow zooms on double-click (zoomOnDoubleClick defaults to true) and swallows the event before Canvas.onCanvasDoubleClick sees it')
  await studio.seed()
  await studio.open('v-context')
  const pane = (await studio.pane.boundingBox())!
  await page.mouse.dblclick(pane.x + 150, pane.y + 780)
  await expect(studio.nodes).toHaveCount(4, { timeout: 3000 })
})

test('Undo and Redo in the toolbar can be clicked at 1440px', async ({ page, studio }) => {
  test.fail(true, 'The centred Quick Search bar covers the Undo/Redo buttons on canvas views at this width')
  await studio.seed()
  await studio.open('v-context')
  await studio.addFromPalette('Software System', { x: 150, y: 750 })
  await page.getByRole('button', { name: 'Undo', exact: true }).click({ timeout: 3000 })
  await expect(studio.nodes).toHaveCount(3)
})
