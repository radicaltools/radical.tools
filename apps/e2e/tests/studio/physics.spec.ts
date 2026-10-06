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

test('zooming with the wheel wins over a fit still animating', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  const scale = () => page.locator('.react-flow__viewport').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a)
  const pane = (await studio.pane.boundingBox())!
  await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2)
  const fitted = await scale()
  await page.mouse.wheel(0, -600)
  await expect.poll(scale).toBeGreaterThan(fitted * 1.5)
  // Fit All animates the camera back over several frames; zoom in again
  // while it runs: the hand-picked zoom must stick.
  await page.getByRole('button', { name: /Fit All/ }).click()
  await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2)
  await page.mouse.wheel(0, -300)
  await page.waitForTimeout(1500)
  const settled = await scale()
  await page.waitForTimeout(1000)
  expect(await scale()).toBeCloseTo(settled, 3)
  expect(settled).toBeGreaterThan(fitted * 1.3)
})

/** A 15 × 15 grid of linked containers, laid out near rest. */
function gridDocument(): string {
  const nodes = [], relations = []
  for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) {
    nodes.push({ id: `n${r}_${c}`, type: 'container', label: `N ${r},${c}`, description: '', x: c * 420, y: r * 300, width: 240, height: 110, collapsed: false })
    if (c > 0) relations.push({ id: `h${r}_${c}`, sourceId: `n${r}_${c - 1}`, targetId: `n${r}_${c}` })
    if (r > 0) relations.push({ id: `v${r}_${c}`, sourceId: `n${r - 1}_${c}`, targetId: `n${r}_${c}` })
  }
  return JSON.stringify({ nodes, relations, views: [] })
}

test('on a large diagram a drag moves only the dragged node\'s surroundings', async ({ page, studio }) => {
  await studio.seedDocument(gridDocument())
  await studio.open('canvas')
  // Wait for rest, then count the nodes whose position changes while dragging.
  let previous = await studio.positions()
  await expect.poll(async () => {
    await page.waitForTimeout(1000)
    const current = await studio.positions()
    const still = JSON.stringify(current) === JSON.stringify(previous)
    previous = current
    return still
  }, { timeout: 30_000, intervals: [0] }).toBe(true)
  const box = (await studio.node('n7_7').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(box.x + box.width / 2 + i * 4, box.y + box.height / 2 + i * 2)
    await page.waitForTimeout(40)
  }
  await page.mouse.up()
  await page.waitForTimeout(1500)
  const after = await studio.positions()
  const moved = Object.keys(after).filter((id) => after[id] !== previous[id])
  // 225 nodes; the drag may move its 40 nearest, the rest stays put.
  expect(moved.length).toBeGreaterThan(1)
  expect(moved.length).toBeLessThanOrEqual(40)
})
