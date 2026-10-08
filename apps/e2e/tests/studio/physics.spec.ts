import type { Locator, Page } from '@playwright/test'
import { test, expect, fixture, type Studio } from '../../support/fixtures'

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
  // The hand zoom cancels the fit, not the Smart fit setting.
  await expect(page.locator('.autofit-active')).toHaveCount(1)
})

/** A 15 × 15 grid of linked systems, laid out near rest (or squeezed so
 *  they overlap, far from it). */
function gridDocument(spacing = { x: 420, y: 300 }): string {
  const nodes = [], relations = []
  for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) {
    nodes.push({ id: `n${r}_${c}`, type: 'container', label: `N ${r},${c}`, description: '', x: c * spacing.x, y: r * spacing.y, width: 240, height: 110, collapsed: false })
    if (c > 0) relations.push({ id: `h${r}_${c}`, sourceId: `n${r}_${c - 1}`, targetId: `n${r}_${c}` })
    if (r > 0) relations.push({ id: `v${r}_${c}`, sourceId: `n${r - 1}_${c}`, targetId: `n${r}_${c}` })
  }
  return JSON.stringify({ nodes, relations, views: [] })
}

/** Wait until no node moves for a second. */
async function untilStill(page: Page, studio: Studio): Promise<Record<string, string>> {
  let previous = await studio.positions()
  await expect.poll(async () => {
    await page.waitForTimeout(1000)
    const current = await studio.positions()
    const still = JSON.stringify(current) === JSON.stringify(previous)
    previous = current
    return still
  }, { timeout: 30_000, intervals: [0] }).toBe(true)
  return previous
}

/** Drag a node by (dx, dy) screen px, holding `modifier` from the start. */
async function dragBy(page: Page, target: Locator, dx: number, dy: number, modifier?: 'Meta'): Promise<void> {
  const box = (await target.boundingBox())!
  if (modifier) await page.keyboard.down(modifier)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(box.x + box.width / 2 + (dx * i) / 20, box.y + box.height / 2 + (dy * i) / 20)
    await page.waitForTimeout(40)
  }
  await page.mouse.up()
  if (modifier) await page.keyboard.up(modifier)
}

test('a drag moves only the dragged node, and the drop pins it', async ({ page, studio }) => {
  await studio.seedDocument(gridDocument())
  await studio.open('canvas')
  const previous = await untilStill(page, studio)
  // The whole grid is in view, zoomed out: a short way, into no neighbour.
  await dragBy(page, studio.node('n7_7'), 16, 8)
  await page.waitForTimeout(1500)
  const after = await studio.positions()
  expect(Object.keys(after).filter((id) => after[id] !== previous[id])).toEqual(['n7_7'])
  await expect.poll(async () => (await studio.storedDoc() as { defaultLayoutConstraints?: Array<{ type: string; nodeIds: string[] }> })
    .defaultLayoutConstraints?.find((c) => c.type === 'pin')?.nodeIds).toEqual(['n7_7'])
  // Selected, it offers to unpin.
  await studio.node('n7_7').click()
  await page.getByTestId('unpin-node').click()
  await expect.poll(async () => (await studio.storedDoc() as { defaultLayoutConstraints?: unknown[] }).defaultLayoutConstraints ?? []).toEqual([])
})

test('a drop onto a node pushes that node clear and nothing else', async ({ page, studio }) => {
  await studio.seedDocument(gridDocument())
  await studio.open('canvas')
  const previous = await untilStill(page, studio)
  // Onto its right-hand neighbour, slightly offset.
  const from = (await studio.node('n7_7').boundingBox())!
  const onto = (await studio.node('n7_8').boundingBox())!
  await dragBy(page, studio.node('n7_7'), onto.x - from.x - 10, onto.y - from.y + 10)
  await page.waitForTimeout(1500)
  const after = await studio.positions()
  expect(Object.keys(after).filter((id) => after[id] !== previous[id]).sort()).toEqual(['n7_7', 'n7_8'])
  expect(await studio.layoutViolations()).toEqual([])
})

test('a drag with Cmd held lets the physics move the surroundings', async ({ page, studio }) => {
  await studio.seedDocument(gridDocument())
  await studio.open('canvas')
  const previous = await untilStill(page, studio)
  await dragBy(page, studio.node('n7_7'), 80, 40, 'Meta')
  await page.waitForTimeout(1500)
  const after = await studio.positions()
  const moved = Object.keys(after).filter((id) => after[id] !== previous[id])
  // 225 nodes; the drag may move its 40 nearest, the rest stays put.
  expect(moved.length).toBeGreaterThan(1)
  expect(moved.length).toBeLessThanOrEqual(40)
})

test('a large diagram keeps its positions on open and suggests Smart Layout when it is not laid out', async ({ page, studio }) => {
  await studio.seedDocument(gridDocument({ x: 120, y: 60 }))
  // The hint is a toast that dismisses itself: watch for it while opening.
  await Promise.all([
    expect(page.getByText(/This large diagram is not laid out yet/)).toBeVisible({ timeout: 15_000 }),
    studio.open('canvas'),
  ])
  const before = await studio.positions()
  await page.waitForTimeout(2000)
  expect(await studio.positions()).toEqual(before)
})

test('adding an element to a large diagram moves only its surroundings', async ({ page, studio }) => {
  await studio.seedDocument(gridDocument())
  await studio.open('canvas')
  const before = await studio.positions()
  await studio.addFromPalette('Software System', { x: 400, y: 400 })
  await expect(studio.nodes).toHaveCount(226)
  await page.waitForTimeout(3000)
  const after = await studio.positions()
  const moved = Object.keys(before).filter((id) => after[id] !== before[id])
  expect(moved.length).toBeLessThanOrEqual(40)
})

test('Smart fit brings the diagram back when it has left the screen', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  await expect(page.locator('.autofit-active')).toHaveCount(1)
  const onScreen = () => page.evaluate(() => {
    const pane = document.querySelector('.react-flow')!.getBoundingClientRect()
    return Array.from(document.querySelectorAll('.react-flow__node')).filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.right > pane.left && r.left < pane.right && r.bottom > pane.top && r.top < pane.bottom
    }).length
  })
  expect(await onScreen()).toBeGreaterThan(0)
  // Not a gesture: the camera ends up away from the diagram, as when the
  // physics carries the diagram off after an expand.
  // Read back one frame later in the same call: Smart fit starts pulling the
  // camera back right away, often before a separate read under load.
  const cameraX = await page.evaluate(async () => {
    ;(window as unknown as { __rfSetViewport: (vp: object) => void }).__rfSetViewport({ x: 60000, y: 60000, zoom: 1 })
    await new Promise(requestAnimationFrame)
    return new DOMMatrix(getComputedStyle(document.querySelector('.react-flow__viewport')!).transform).e
  })
  expect(cameraX).toBeGreaterThan(50000)
  await expect.poll(onScreen, { timeout: 5000 }).toBeGreaterThan(0)
})

test('opening a view with Smart fit frames it at once, without a camera flight', async ({ page, studio }) => {
  // Views keep their own coordinates: the camera used to fly over from the
  // previous view's (the diagram gone, then sliding in from an edge), then
  // Smart fit eased it to the fit. A saved camera that no longer frames the
  // view (as in the sample) must not stick either.
  const doc = JSON.parse(fixture('bookstore'))
  doc.views.find((v: { id: string }) => v.id === 'v-containers').viewport = { x: 3000, y: 3000, zoom: 0.8 }
  await studio.seedDocument(JSON.stringify(doc))
  await studio.open('v-context')
  await expect(page.locator('.autofit-active')).toHaveCount(1)
  const frames = await page.evaluate(async () => {
    const pane = document.querySelector('.react-flow')!.getBoundingClientRect()
    const frame = () => {
      const m = new DOMMatrix(getComputedStyle(document.querySelector('.react-flow__viewport')!).transform)
      const onScreen = Array.from(document.querySelectorAll('.react-flow__node')).filter((el) => {
        const r = el.getBoundingClientRect()
        return r.right > pane.left && r.left < pane.right && r.bottom > pane.top && r.top < pane.bottom
      }).length
      return { camera: `${m.e.toFixed(1)} ${m.f.toFixed(1)} ${m.a.toFixed(4)}`, onScreen }
    }
    location.hash = location.hash.replace(/\/v\/[^/]+$/, '/v/v-containers')
    // From the first frame that draws the view's nodes, for 1.5 s.
    const end = performance.now() + 4000
    while (document.querySelectorAll('.react-flow__node').length !== 6 && performance.now() < end) {
      await new Promise(requestAnimationFrame)
    }
    const seen = []
    for (const until = performance.now() + 1500; performance.now() < until;) {
      seen.push(frame())
      await new Promise(requestAnimationFrame)
    }
    return seen
  })
  expect(frames.length).toBeGreaterThan(10)
  const last = frames[frames.length - 1]
  expect(last.onScreen).toBe(6)
  // The saved camera for at most the frames React Flow takes to draw the
  // nodes, then the fit at once (no easing in from off screen); after that
  // the camera only follows the view while it settles.
  expect(frames.slice(3).every((f) => f.onScreen === 6)).toBe(true)
})

test('an expanded element grows around the centre of its collapsed box', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  const toggle = studio.node('bookstore').locator('.c4-node-collapse-btn').first()
  await toggle.evaluate((b) => (b as HTMLElement).click())
  await expect(toggle).toHaveAttribute('title', 'Expand')
  await page.waitForTimeout(2500)
  // The box from the frame before the click to the first frame drawn at the
  // expanded size: from the collapsed box's top-left corner, the group used
  // to run right and down by half its size.
  const [before, after] = await page.evaluate(async () => {
    const box = () => {
      const el = document.querySelector('[data-id="bookstore"]') as HTMLElement
      const t = new DOMMatrix(getComputedStyle(el).transform)
      return { x: t.e, y: t.f, w: el.offsetWidth, h: el.offsetHeight }
    }
    const first = box()
    ;(document.querySelector('[data-id="bookstore"] .c4-node-collapse-btn') as HTMLElement).click()
    for (let i = 0; i < 120; i++) {
      await new Promise(requestAnimationFrame)
      const b = box()
      if (b.w !== first.w || b.h !== first.h) return [first, b]
    }
    return [first, box()]
  })
  expect(after.w).toBeGreaterThan(before.w * 1.5)
  expect(after.x + after.w / 2).toBeCloseTo(before.x + before.w / 2, -2)
  expect(after.y + after.h / 2).toBeCloseTo(before.y + before.h / 2, -2)
})
