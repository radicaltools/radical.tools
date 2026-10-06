import { test, expect } from '../../support/fixtures'

// The live WebCoLa layout (packages/ui/src/layout/liveColaLayout.ts) on a
// real clock. Its own convergence test never passes once groups are
// projected, so it stops itself when nodes stop moving.

test('a canvas with nested elements comes to rest and stays there', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  // The physics relaxes the saved positions for a few seconds, then stops
  // (WebCoLa alone took about 15 s to give up on this view).
  let previous = await studio.positions()
  await expect.poll(async () => {
    await page.waitForTimeout(1000)
    const current = await studio.positions()
    const still = JSON.stringify(current) === JSON.stringify(previous)
    previous = current
    return still
  }, { timeout: 10_000, intervals: [0] }).toBe(true)
  await page.waitForTimeout(2000)
  expect(await studio.positions()).toEqual(previous)
})

test('edits on a view with nested elements are saved without a reload', async ({ studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  await studio.addFromPalette('Software System', { x: 150, y: 780 })
  await expect(studio.nodes).toHaveCount(7)
  // Endless live-layout updates used to restart the 400 ms autosave debounce.
  await expect.poll(async () => (await studio.storedDoc()).nodes.length, { timeout: 5000 }).toBe(7)
})
