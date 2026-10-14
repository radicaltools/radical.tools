import type { Locator, Page } from '@playwright/test'
import { test, expect, fixture, type Studio, type StoredDoc } from '../../support/fixtures'

// The live WebCoLa layout (packages/ui/src/layout/liveColaLayout.ts) on a
// real clock. Its own convergence test never passes once groups are
// projected, so it stops itself when nodes stop moving.

test('a diagram keeps the layout it is opened with', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  // The physics used to relax every small diagram for a few seconds after
  // opening it. It leaves one that has a layout as it is.
  const doc = JSON.parse(fixture('bookstore')) as StoredDoc
  const saved = doc.views!.find((v) => v.id === 'v-containers')!.positions
  const parentOf = Object.fromEntries(doc.nodes.map((n) => [n.id, n.parentId]))
  // The canvas draws at absolute positions; the document keeps them
  // relative to the parent.
  const shown = async (): Promise<Record<string, { x: number; y: number }>> => {
    const drawn = Object.fromEntries(Object.entries(await studio.positions()).map(([id, at]) => {
      const [, x, y] = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(at)!
      return [id, { x: Number(x), y: Number(y) }]
    }))
    return Object.fromEntries(Object.entries(drawn).map(([id, at]) => {
      const parent = parentOf[id] ? drawn[parentOf[id]!] : { x: 0, y: 0 }
      return [id, { x: at.x - parent.x, y: at.y - parent.y }]
    }))
  }
  const asSaved = Object.fromEntries(Object.entries(saved).map(([id, p]) => [id, { x: p.x, y: p.y }]))
  expect(await shown()).toEqual(asSaved)
  await page.waitForTimeout(3000)
  expect(await shown()).toEqual(asSaved)
})

test('the layout Smart Layout gives is the one that stays and is saved', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  await studio.smartLayout()
  const laidOut = await studio.positions()
  await page.waitForTimeout(3000)
  expect(await studio.positions()).toEqual(laidOut)
  await page.reload()
  await studio.ready()
  expect(await studio.positions()).toEqual(laidOut)
})

test('what the physics places inside a container is what a reload shows', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  // An element added into Bookstore lets the physics settle its children,
  // nearer to Bookstore's top than a layout puts them. The canvas used to
  // draw them lower again after a reload, and the file kept the other place.
  const pane = (await studio.pane.boundingBox())!
  const bookstore = (await studio.node('bookstore').boundingBox())!
  await studio.addFromPalette('Container', {
    x: bookstore.x - pane.x + bookstore.width / 2,
    y: bookstore.y - pane.y + bookstore.height - 30,
  })
  await expect(studio.nodes).toHaveCount(7)
  let settled = await studio.positions()
  await expect.poll(async () => {
    await page.waitForTimeout(1000)
    const current = await studio.positions()
    const still = JSON.stringify(current) === JSON.stringify(settled)
    settled = current
    return still
  }, { timeout: 15_000, intervals: [0] }).toBe(true)
  // The autosave has the settled positions.
  await page.waitForTimeout(1000)
  await page.reload()
  await studio.ready()
  expect(await studio.positions()).toEqual(settled)
})

test('a layout started on one canvas does not land on another', async ({ page, studio }) => {
  // Smart Layout takes about three seconds on the sample's All elements.
  // Opening another view meanwhile used to put All elements' positions on
  // that view's elements and save them there.
  await studio.openSample('view-core')
  const docId = studio.activeDocId()
  const core = await studio.positions()
  await studio.open('canvas', 'designer', docId)
  await page.waitForTimeout(800)
  const saved = (await studio.storedDoc(docId)).views!.find((v) => v.id === 'view-core')!.positions

  await page.getByText('Views', { exact: true }).first().click()
  const card = page.locator('.lp-view-card').filter({ hasText: 'Core Banking' }).first()
  await expect(card).toBeVisible()
  await page.getByRole('button', { name: 'Smart Layout', exact: true }).click()
  await page.waitForTimeout(400)
  await card.click()
  await expect(page).toHaveURL(/\/v\/view-core$/)
  await expect(page.getByText(/The layout was not applied/)).toBeVisible({ timeout: 30_000 })

  await studio.settle()
  expect(await studio.positions()).toEqual(core)
  await page.waitForTimeout(800)
  expect((await studio.storedDoc(docId)).views!.find((v) => v.id === 'view-core')!.positions).toEqual(saved)
})

test('a drag is undone and redone as one step of its own', async ({ page, studio }) => {
  // A drag had no undo step: Undo did nothing after one, and after "add an
  // element, then drag another" it took back both.
  await studio.seed()
  await studio.open('v-context')
  await studio.addFromPalette('Software System', { x: 150, y: 750 })
  await expect(studio.nodes).toHaveCount(4)
  await studio.settle()
  const before = await studio.positions()

  await dragBy(page, studio.node('customer'), 220, -90)
  await page.waitForTimeout(600)
  const dragged = await studio.positions()
  expect(dragged.customer).not.toBe(before.customer)
  const pins = async (): Promise<string[]> => {
    const view = (await studio.storedDoc() as { views: { id: string; layoutConstraints?: { type: string; nodeIds: string[] }[] }[] }).views.find((v) => v.id === 'v-context')!
    return (view.layoutConstraints ?? []).filter((c) => c.type === 'pin').flatMap((c) => c.nodeIds)
  }
  await expect.poll(pins).toEqual(['customer'])

  // The drag goes back, the element added before it stays.
  await studio.pane.click({ position: { x: 20, y: 20 } })
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(() => studio.positions()).toEqual(before)
  await expect(studio.nodes).toHaveCount(4)
  await expect.poll(pins).toEqual([])

  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect.poll(() => studio.positions()).toEqual(dragged)
  await expect.poll(pins).toEqual(['customer'])

  await page.keyboard.press('ControlOrMeta+z')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(studio.nodes).toHaveCount(3)
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
    expect(page.getByText(/This diagram is not laid out yet/)).toBeVisible({ timeout: 15_000 }),
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
  // Past the window in which opening a view refits the camera every frame
  // (the diagram is at rest from the start now, so the test gets here
  // inside it).
  await page.waitForTimeout(2000)
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

test('Viewer fits a view with a saved camera when it opens', async ({ page, studio }) => {
  // The saved camera reached the canvas as a revoked draft: placing it threw,
  // and the view stayed under the previous view's camera.
  const doc = JSON.parse(fixture('bookstore'))
  doc.views.find((v: { id: string }) => v.id === 'v-containers').viewport = { x: 3000, y: 3000, zoom: 0.8 }
  await studio.seedDocument(JSON.stringify(doc))
  await studio.open('v-context', 'viewer')
  await page.locator('.lp-view-card').filter({ hasText: 'Containers' }).click()
  await expect(studio.nodes).toHaveCount(6)
  await studio.settle()
  const off = await page.evaluate(() => {
    const pane = document.querySelector('.react-flow')!.getBoundingClientRect()
    const boxes = Array.from(document.querySelectorAll('.react-flow__node')).map((el) => el.getBoundingClientRect())
    const left = Math.min(...boxes.map((b) => b.left))
    const right = Math.max(...boxes.map((b) => b.right))
    const top = Math.min(...boxes.map((b) => b.top))
    const bottom = Math.max(...boxes.map((b) => b.bottom))
    return {
      x: (left + right) / 2 - (pane.left + pane.right) / 2,
      y: (top + bottom) / 2 - (pane.top + pane.bottom) / 2,
      inside: left >= pane.left && right <= pane.right && top >= pane.top && bottom <= pane.bottom,
    }
  })
  expect(off.inside).toBe(true)
  expect(Math.abs(off.x)).toBeLessThan(5)
  expect(Math.abs(off.y)).toBeLessThan(5)
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

test.describe('All elements keeps its own layout', () => {
  test('a reload while a view is shown does not give All elements that view\'s layout', async ({ page, studio }) => {
    // A document is saved with its nodes where the shown canvas has them.
    // After a reload the view in the address was opened again, and what
    // the nodes held (that view's layout) was stored as All elements'.
    await studio.seed()
    await studio.open('canvas')
    const all = await studio.positions()
    await studio.open('v-context')
    await page.waitForTimeout(1000) // the autosave
    await page.reload()
    await studio.ready()
    await expect(page.getByText('Structure: System Context')).toBeVisible()
    await studio.open('canvas')
    expect(await studio.positions()).toEqual(all)
    expect(await studio.layoutViolations()).toEqual([])
  })

  test('nor does a reload while a milestone is shown in a view', async ({ page, studio }) => {
    await studio.seed()
    await studio.open('canvas')
    const all = await studio.positions()
    await studio.open('v-context')
    await page.locator('.lp-section-header', { hasText: 'Milestones' }).click()
    await page.getByRole('button', { name: 'New milestone' }).click()
    await page.getByPlaceholder('Milestone name…').fill('M1')
    await page.keyboard.press('Enter')
    const milestone = page.locator('.lp-snap-card', { hasText: 'M1' })
    await expect(milestone).toBeVisible()
    await page.waitForTimeout(1000) // the autosave
    await milestone.click()
    await expect(page).toHaveURL(/\/v\/v-context\/s\//)
    await page.waitForTimeout(1000)
    await page.reload()
    await studio.ready()
    await page.locator('.lp-section-header', { hasText: 'Milestones' }).click()
    await page.locator('.lp-snap-current').click()
    await studio.open('canvas')
    expect(await studio.positions()).toEqual(all)
    expect(await studio.layoutViolations()).toEqual([])
  })
})

test('an element grabbed right after a view opens stays under the pointer', async ({ page, studio }) => {
  // Smart fit refits the camera every frame for a moment after a view
  // opens, and a drag counted as "the layout moves": the camera zoomed out
  // under the pointer, which carried the element further (60×120 px of
  // mouse travel moved an element some 2 000 px). A drag takes the camera.
  await studio.seed()
  await page.goto(`/#/d/${encodeURIComponent('ls:e2e-doc')}/m/designer/v/v-containers`)
  const node = studio.node('payments')
  await expect(node).toBeVisible()
  await expect(page.locator('.autofit-active')).toHaveCount(1)
  // Inside the window in which the view is still being fitted.
  await page.waitForTimeout(250)
  const before = (await node.boundingBox())!
  const from = { x: before.x + before.width / 2, y: before.y + before.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(from.x + 5 * i, from.y + 10 * i)
    await page.waitForTimeout(25)
  }
  await page.mouse.up()
  await page.waitForTimeout(800)
  const after = (await node.boundingBox())!
  // Where the pointer let go of it, give or take the snap of a drop.
  expect(Math.abs(after.x + after.width / 2 - (from.x + 60))).toBeLessThan(40)
  expect(Math.abs(after.y + after.height / 2 - (from.y + 120))).toBeLessThan(40)
  expect(after.width).toBeGreaterThan(before.width * 0.8)
})

test.describe('Quick Search shows what it finds', () => {
  const search = async (page: Page, studio: Studio, text: string): Promise<void> => {
    await page.getByPlaceholder(/^Search/).click()
    await page.keyboard.type(text)
    await page.waitForTimeout(500)
    await page.keyboard.press('Enter')
    await studio.settle()
  }

  test('a container collapsed on All elements and open in the view stays open', async ({ page, studio }) => {
    // It looked at the element's own "collapsed", and collapse is per view:
    // the toggle meant to open the container closed it in the view, hid the
    // element it had found, and saved that.
    await studio.seed()
    await studio.open('canvas')
    await studio.node('bookstore').locator('.c4-node-collapse-btn').first().click()
    await expect(studio.node('db')).toHaveCount(0)
    await studio.open('v-containers')
    await studio.node('bookstore').locator('.c4-node-collapse-btn').first().click()
    await expect(studio.node('db')).toBeVisible()
    await page.waitForTimeout(1000) // the autosave

    await search(page, studio, 'Orders DB')
    await expect(studio.node('db')).toBeVisible()
    await page.waitForTimeout(1000)
    const view = (JSON.parse(await studio.storedJson()) as { views: Array<{ id: string; collapsedNodeIds?: string[] }> })
      .views.find((v) => v.id === 'v-containers')!
    expect(view.collapsedNodeIds ?? []).toEqual([])
  })

  test('a container collapsed in the view is opened', async ({ page, studio }) => {
    await studio.seed()
    await studio.open('v-containers')
    await studio.node('bookstore').locator('.c4-node-collapse-btn').first().click()
    await expect(studio.node('db')).toHaveCount(0)
    await search(page, studio, 'Orders DB')
    await expect(studio.node('db')).toBeVisible()
  })
})

test('a milestone picked in Viewer is not the one Designer edits', async ({ page, studio }) => {
  // Leaving Designer set aside the nodes but not which milestone is shown:
  // back in Designer the live model was on the canvas under the milestone's
  // name, and a drag followed by "Propagate" copied it over every milestone.
  await studio.seed()
  await studio.open('canvas')
  await page.locator('.lp-section-header', { hasText: 'Milestones' }).click()
  await page.getByRole('button', { name: 'New milestone' }).click()
  await page.getByPlaceholder('Milestone name…').fill('Before')
  await page.keyboard.press('Enter')
  await expect(page.locator('.lp-snap-card', { hasText: 'Before' })).toBeVisible()
  // The live model moves on (the panel is an accordion: back to the palette).
  await page.locator('.lp-section-header', { hasText: 'Elements' }).click()
  await studio.addFromPalette('Software System', { x: 150, y: 750 })
  await expect.poll(async () => (await studio.storedDoc()).nodes.length).toBe(7)
  const milestoneSize = async (): Promise<number> =>
    (JSON.parse(await studio.storedJson()) as { snapshots: Array<{ nodes: Record<string, unknown> }> }).snapshots.map((s) => Object.keys(s.nodes).length)[0]
  expect(await milestoneSize()).toBe(6)

  await page.getByRole('button', { name: 'Viewer', exact: true }).click()
  await studio.settle()
  await page.locator('.lp-section-header', { hasText: 'Milestones' }).click()
  await page.locator('.lp-snap-card', { hasText: 'Before' }).click()
  await expect(studio.nodes).toHaveCount(6)

  await page.getByRole('button', { name: 'Designer', exact: true }).click()
  await studio.settle()
  await expect(studio.nodes).toHaveCount(7)
  await expect(page).not.toHaveURL(/\/s\//)
  // An edit of the live model asks nothing about a milestone.
  await dragBy(page, studio.node('customer'), 40, 20)
  await page.waitForTimeout(1200)
  await expect(page.locator('.milestone-modal')).toHaveCount(0)
  expect((await studio.storedDoc()).nodes.length).toBe(7)
  expect(await milestoneSize()).toBe(6)
})
