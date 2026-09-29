import { test, expect } from '../../support/fixtures'

// Bugs this suite found that are not fixed yet. Each test states the correct
// behaviour and is marked `test.fail`, so the suite stays green while the
// bug is there and turns red ("expected to fail, but passed") once it is
// fixed: then delete the `test.fail` line and the test becomes a guard.

test('an idle canvas with nested elements stays still', async ({ page, studio }) => {
  test.fail(true, 'Live WebCoLa layout never converges when a view shows nested elements, so nodes keep drifting (packages/ui/src/layout/liveColaLayout.ts)')
  await studio.seed()
  await studio.open('v-containers')
  const before = await studio.positions()
  await page.waitForTimeout(2000)
  expect(await studio.positions()).toEqual(before)
})

test('edits on a view with nested elements are saved without a reload', async ({ studio }) => {
  test.fail(true, 'The endless live-layout updates keep restarting the 400 ms autosave debounce, so edits only reach storage on pagehide (apps/studio/src/renderer/src/persistence/autosave.ts)')
  await studio.seed()
  await studio.open('v-containers')
  await studio.addFromPalette('Software System', { x: 150, y: 780 })
  await expect(studio.nodes).toHaveCount(7)
  await expect.poll(async () => (await studio.storedDoc()).nodes.length, { timeout: 5000 }).toBe(7)
})

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
