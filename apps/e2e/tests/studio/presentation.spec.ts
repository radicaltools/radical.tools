import type { Page } from '@playwright/test'
import { test, expect, DOC_ID, type Studio } from '../../support/fixtures'

// The bookstore fixture has one presentation, "Main", with two slides:
// Context (v-context) and Containers (v-containers).

test.beforeEach(async ({ studio }) => {
  await studio.freezeTime()
  await studio.seed()
  await studio.open('v-containers', 'presenter')
})

test('play through the slides', async ({ page, studio }) => {
  await page.getByRole('button', { name: 'Present', exact: true }).click()
  await studio.settle()
  await expect(page).toHaveURL(/\/v\/v-context\/p\/pres-main\/play\/1\/sl\/0$/)
  await expect(studio.nodes).toHaveCount(3)
  await expect(page.getByText('1 / 2')).toBeVisible()
  await expect(page).toHaveScreenshot('slide-1.png')

  await page.keyboard.press('ArrowRight')
  await studio.settle()
  await expect(page).toHaveURL(/\/v\/v-containers\/p\/pres-main\/play\/1\/sl\/1$/)
  await expect(studio.nodes).toHaveCount(6)
  await expect(page.getByText('2 / 2')).toBeVisible()
  await expect(page).toHaveScreenshot('slide-2.png')

  await page.keyboard.press('ArrowLeft')
  await studio.settle()
  await expect(page).toHaveURL(/\/sl\/0$/)

  await page.keyboard.press('Escape')
  await studio.settle()
  await expect(page).toHaveURL(/\/m\/presenter\/v\/[^/]+$/)
  await expect(page.getByRole('button', { name: 'Present', exact: true })).toBeVisible()
})

test('presentations are a place of the activity rail, not a perspective', async ({ page, studio }) => {
  // ADR Presentations are a place of the rail: opened over Designer, the
  // slides in the left panel one under another, the slide picked on the
  // canvas; a section's tab goes back to Designer.
  await studio.open('v-containers', 'designer')
  const toolbar = page.locator('.toolbar')
  await expect(toolbar.locator('.toolbar-mode-btn')).toHaveText([/Designer/, /Viewer/])
  const rail = page.getByRole('button', { name: 'Presentations', exact: true })
  const inspector = page.getByRole('button', { name: 'Inspector', exact: true })
  // The sections Views and Sequences, a line, Milestones; Presentations
  // under them after a line; the Inspector, a line and Settings at the foot.
  const labels = await page.getByRole('tablist', { name: 'Panel sections' }).getByRole('tab').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))
  expect(labels).toEqual(['Views', 'Sequences', 'Milestones'])
  await expect(page.locator('.lp-rail > .activity-rail-divider')).toHaveCount(1)
  const milestones = page.getByRole('tab', { name: 'Milestones' })
  const [railBox, milestonesBox, inspectorBox] = [await rail.boundingBox(), await milestones.boundingBox(), await inspector.boundingBox()]
  expect(railBox!.y, 'under the sections').toBeGreaterThan(milestonesBox!.y + milestonesBox!.height)
  expect(railBox!.y - (milestonesBox!.y + milestonesBox!.height), 'right under them').toBeLessThan(30)
  expect(inspectorBox!.y, 'the Inspector at the foot').toBeGreaterThan(railBox!.y + 100)
  await expect(page.locator('.activity-rail-places')).toHaveCSS('border-top-style', 'solid')
  await expect(page.locator('.activity-rail-actions .activity-rail-divider')).toBeVisible()
  await expect(rail.locator('.lp-rail-count')).toHaveText('2')

  await rail.click()
  await studio.settle()
  await expect(rail).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/\/m\/presenter\/v\/v-containers$/)
  await expect(toolbar.locator('.toolbar-mode-btn.active')).toHaveText(/Designer/)
  const place = page.locator('.lp-place .pres-place')
  await expect(place.locator('.lp-section-title')).toHaveText('Presentations')
  await expect(place.getByRole('button', { name: 'Present', exact: true })).toBeVisible()
  const cards = place.locator('.pres-slide-card')
  await expect(cards).toHaveCount(2)
  const [first, second] = [await cards.nth(0).boundingBox(), await cards.nth(1).boundingBox()]
  expect(second!.y, 'one under another').toBeGreaterThan(first!.y + first!.height - 1)
  await expect(page.locator('.pres-dock')).toHaveCount(0)

  await cards.nth(1).click()
  await studio.settle()
  await expect(cards.nth(1)).toHaveClass(/active/)
  await place.getByRole('button', { name: 'Add slide' }).click()
  await expect(cards).toHaveCount(3)

  // Lit, it folds the left panel and opens it again on the slides.
  await rail.click()
  await expect(page.locator('.app-layout')).toHaveClass(/lp-collapsed/)
  await rail.click()
  await expect(page.locator('.app-layout')).not.toHaveClass(/lp-collapsed/)
  await expect(cards).toHaveCount(3)

  // A section's tab goes back to Designer, with its palette.
  await page.getByRole('tab', { name: 'Views' }).click()
  await studio.settle()
  await expect(page).toHaveURL(/\/m\/designer\//)
  await expect(rail).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.lp-place')).toHaveCount(0)
  await expect.poll(async () => (JSON.parse(await studio.storedJson()) as { presentations?: Array<{ slides: unknown[] }> }).presentations?.[0]?.slides.length).toBe(3)
})

test('over Viewer presentations are only looked through and played; they are made over Designer', async ({ page, studio }) => {
  // Presentations edited in Designer only (the author, 2026-11-16).
  await studio.open('v-containers', 'viewer')
  const rail = page.getByRole('button', { name: 'Presentations', exact: true })
  await rail.click()
  const place = page.locator('.lp-place .pres-place')
  const cards = place.locator('.pres-slide-card')
  await expect(cards).toHaveCount(2)
  await expect(place.getByRole('button', { name: 'Present', exact: true })).toBeVisible()
  await expect(place.getByRole('button', { name: 'Add slide' })).toHaveCount(0)
  for (const title of ['Rename presentation', 'New presentation', 'Delete presentation', /^Capture canvas state/, 'Link milestone', 'Link view', 'Delete slide']) {
    await expect(place.getByTitle(title)).toHaveCount(0)
  }
  await cards.nth(1).click()
  await expect(cards.nth(1)).toHaveClass(/active/)
  await cards.nth(1).locator('.pres-slide-name').dblclick()
  await expect(place.locator('.pres-slide-name-input')).toHaveCount(0)
  await place.getByRole('button', { name: 'Present', exact: true }).click()
  await studio.settle()
  await expect(page.getByText('2 / 2')).toBeVisible()
  await page.keyboard.press('Escape')
  await studio.settle()

  // Designer in the switch keeps the place open, now over Designer, where they are made.
  await studio.designer()
  await expect(page).toHaveURL(/\/m\/presenter\//)
  await expect(rail).toHaveAttribute('aria-pressed', 'true')
  await expect(place.getByRole('button', { name: 'Add slide' })).toBeVisible()
  await expect(place.getByTitle('New presentation')).toBeVisible()
  await expect(cards.nth(1).getByTitle(/^Capture canvas state/)).toBeVisible()
})

test('a slide deep link opens the running presentation', async ({ page, studio }) => {
  await page.goto('/#/d/ls%3Ae2e-doc/m/presenter/v/v-containers/p/pres-main/play/1/sl/1')
  await studio.ready()
  await expect(page.getByText('2 / 2')).toBeVisible()
  await expect(studio.nodes).toHaveCount(6)
})

/** Rewrites the seeded document (`edit` on its JSON) and opens `view` in
 *  Presenter on it. */
async function reseed(page: Page, studio: Studio, edit: (doc: any) => void, view = 'v-containers'): Promise<void> {
  const key = `radical-doc:${DOC_ID}`
  const doc = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), key))!)
  edit(doc)
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, JSON.stringify(doc)] as const)
  await page.reload()
  await studio.ready()
  await studio.open(view, 'presenter')
}

/** The canvas camera's zoom. */
async function zoom(page: Page): Promise<number> {
  const style = await page.locator('.react-flow__viewport').first().getAttribute('style')
  return Number(/scale\(([\d.]+)\)/.exec(style ?? '')?.[1])
}

test('a slide made with focus zooms onto its elements after a table slide, from a deep link and after a reload', async ({ page, studio }) => {
  const none = { x: 0, y: 0, zoom: 0 }
  await reseed(page, studio, (doc) => {
    doc.presentations = [{ id: 'p-focus', name: 'Focus deck', slides: [
      { id: 's-table', name: 'Table', snapshotId: null, viewId: 'v-table', viewport: none },
      { id: 's-db', name: 'Orders DB', snapshotId: null, viewId: 'v-containers', viewport: none, focusNodeIds: ['db'] },
    ] }]
  })
  const card = (name: string) => page.locator('.pres-slide-card .pres-slide-name', { hasText: name })
  // Canvas to canvas it zoomed in: the whole view is about 0.7.
  await card('Orders DB').click()
  await studio.settle()
  expect(await zoom(page)).toBeGreaterThan(1.2)
  // After the table slide the canvas mounts again.
  await card('Table').click()
  await studio.settle()
  await card('Orders DB').click()
  await studio.settle()
  expect(await zoom(page)).toBeGreaterThan(1.2)
  // A deep link to the playing slide from the table, and a reload of it.
  await studio.open('v-table', 'presenter')
  await page.goto(`/#/d/${encodeURIComponent(`ls:${DOC_ID}`)}/m/presenter/v/v-containers/p/p-focus/play/1/sl/1`)
  await studio.ready()
  expect(await zoom(page)).toBeGreaterThan(1.2)
  await page.reload()
  await studio.ready()
  await expect(page.getByText('2 / 2')).toBeVisible()
  expect(await zoom(page)).toBeGreaterThan(1.2)
})

test('a slide card\'s Link view and Link milestone pickers show all their items above the dock', async ({ page }) => {
  const card = page.locator('.pres-slide-card', { hasText: 'Containers' })
  // The buttons are the current slide's.
  await card.locator('.pres-slide-name').click()
  await card.hover()
  await card.getByTitle('Link view').click()
  // The item farthest from the button: clipped by the dock, a click on it
  // reached the canvas.
  await page.locator('.pres-snap-item', { hasText: 'show all' }).click()
  await expect(card.locator('.pres-slide-view-tag')).toHaveCount(0)
  await card.hover()
  await card.getByTitle('Link view').click()
  await page.locator('.pres-snap-item', { hasText: 'Element Table' }).click()
  await expect(card.locator('.pres-slide-view-tag')).toHaveText('Element Table')
  await expect(page.locator('.pres-snap-picker')).toHaveCount(0)

  await card.hover()
  await card.getByTitle('Link milestone').click()
  await expect(page.locator('.pres-snap-picker-title')).toHaveText('Link milestone')
  await page.locator('.pres-snap-item', { hasText: 'current state' }).click()
  await expect(page.locator('.pres-snap-picker')).toHaveCount(0)
})

test('a slide added on a wiki page shows that page, on its card and played after a reload', async ({ page, studio }) => {
  await reseed(page, studio, (doc) => {
    doc.views.push({ id: 'v-wiki', name: 'Wiki', kind: 'wiki', nodeIds: [], positions: {}, hiddenRelationIds: [] })
  }, 'v-wiki/f/api')
  const title = page.locator('.wiki-page .wiki-title').first()
  await expect(title).toHaveText('API')
  await page.getByTitle('Add slide from current canvas state').click()
  const cards = page.locator('.pres-slide-card')
  await expect(cards).toHaveCount(3)
  await studio.settle()
  await expect.poll(async () => ((await studio.storedDoc()) as unknown as { presentations: Array<{ slides: unknown[] }> }).presentations[0].slides.length).toBe(3)
  // Another page read, another slide shown: the new slide's card shows its page.
  await page.getByRole('button', { name: 'Overview', exact: true }).click()
  await expect(title).toHaveText('Overview')
  await cards.first().locator('.pres-slide-name').click()
  await cards.last().locator('.pres-slide-name').click()
  await expect(title).toHaveText('API')
  await expect(page).toHaveURL(/\/v\/v-wiki\/f\/api$/)
  // Played from a fresh page, where the view is on its Overview.
  await page.goto(`/#/d/${encodeURIComponent(`ls:${DOC_ID}`)}/m/presenter/v/v-wiki/p/pres-main/play/1/sl/2`)
  await page.reload()
  await studio.ready()
  await expect(page.getByText('3 / 3')).toBeVisible()
  await expect(title).toHaveText('API')
})

test('a click in the middle of another slide\'s card shows that slide, it does not capture it', async ({ page, studio }) => {
  const card = page.locator('.pres-slide-card', { hasText: 'Containers' })
  await expect(card).not.toHaveClass(/active/)
  const box = (await card.boundingBox())!
  // The hidden Capture button sat where the card's middle is; in the left
  // panel another card has no buttons at all (display none).
  await expect(card.getByTitle(/^Capture canvas state/)).toBeHidden()
  await page.mouse.click(box.x + box.width - 60, box.y + box.height / 2)
  await expect(card).toHaveClass(/active/)
  await studio.settle()
  const slides = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).presentations[0].slides[1], `radical-doc:${DOC_ID}`)
  expect((await slides()).viewport).toEqual({ x: 0, y: 0, zoom: 1 })
  expect((await slides()).canvasState).toBeUndefined()
})

test('a playing hierarchy slide is drilled on its own: Esc ends it, Designer\'s view and the address keep nothing of it', async ({ page, studio }) => {
  await reseed(page, studio, (doc) => {
    doc.views.push({ id: 'v-tree', name: 'Tree', kind: 'treemap', nodeIds: [], positions: {} })
    doc.presentations[0].slides.push({ id: 'slide-tree', name: 'Tree', snapshotId: null, viewId: 'v-tree', viewport: { x: 0, y: 0, zoom: 0 } })
  }, 'v-tree')
  await page.locator('.pres-slide-card .pres-slide-name', { hasText: 'Tree' }).click()
  // A section's tab leaves the place (the perspective switch keeps it open).
  await page.getByRole('tab', { name: 'Views' }).click()
  await studio.settle()
  await expect(page).toHaveURL(/\/m\/designer\/v\/v-tree$/)
  await page.keyboard.press('F5')
  await studio.settle()
  await expect(page.getByText('3 / 3')).toBeVisible()
  await page.locator('rect[data-id="bookstore"]').dblclick({ position: { x: 60, y: 8 } })
  await studio.settle()
  await expect(page.locator('.tm-bc-item.active')).toHaveText('Bookstore')
  await expect(page).not.toHaveURL(/\/e\//)
  await page.keyboard.press('Escape')
  await studio.settle()
  await expect(page.getByText('3 / 3')).toHaveCount(0)
  await expect(page).toHaveURL(/\/m\/designer\/v\/v-tree$/)
  await expect(page.locator('.tm-bc-item.active')).toHaveText('All')
  await studio.settle()
  const tree = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).views.find((v: { id: string }) => v.id === 'v-tree'), `radical-doc:${DOC_ID}`)
  expect(tree.treemapFocusId ?? null).toBeNull()
})

test('F5 stops a presentation F5 started, and Esc ends a Warnier slide with an element selected', async ({ page, studio }) => {
  await reseed(page, studio, (doc) => {
    doc.views.push({ id: 'v-warnier', name: 'Outline', kind: 'warnier', nodeIds: [], positions: {} })
    doc.presentations[0].slides.push({ id: 'slide-w', name: 'Outline', snapshotId: null, viewId: 'v-warnier', viewport: { x: 0, y: 0, zoom: 0 } })
  }, 'v-warnier')
  await page.keyboard.press('F5')
  await studio.settle()
  await expect(page.getByText('1 / 3')).toBeVisible()
  await page.keyboard.press('F5')
  await studio.settle()
  await expect(page.getByText('1 / 3')).toHaveCount(0)
  await page.locator('.pres-slide-card .pres-slide-name', { hasText: 'Outline' }).click()
  await page.getByRole('button', { name: 'Present', exact: true }).click()
  await studio.settle()
  await expect(page.getByText('3 / 3')).toBeVisible()
  await page.locator('.warnier-view').getByText('API', { exact: true }).first().click()
  await studio.settle()
  await page.keyboard.press('Escape')
  await studio.settle()
  await expect(page.getByText('3 / 3')).toHaveCount(0)
})

// A slide on another view showed that view at the camera of the slide
// before, zoomed in, and then swept across it to its own; a slide that fits
// its view also jumped half-way. Each view has coordinates of its own: the
// camera is placed in one step, as a view switch places it. On the same
// view the camera still flies from slide to slide.
test('a slide on another view opens at its own camera in one step; on the same view it flies', async ({ page, studio }) => {
  await reseed(page, studio, (doc) => {
    const slides = doc.presentations[0].slides
    slides[0].viewport = { x: 300, y: 120, zoom: 1.6 }
    slides[1].viewport = { x: 0, y: 0, zoom: 0 }
    slides.push({ id: 'slide-3', name: 'Containers again', snapshotId: null, viewId: 'v-containers', viewport: { x: 200, y: 200, zoom: 1.2 } })
    slides.push({ id: 'slide-4', name: 'Table', snapshotId: null, viewId: 'v-table', viewport: { x: 0, y: 0, zoom: 0 } })
    slides.push({ id: 'slide-5', name: 'Containers after the table', snapshotId: null, viewId: 'v-containers', viewport: { x: -100, y: 40, zoom: 0.7 } })
  })
  await page.clock.resume()
  // Each frame: the camera, and whether the Containers view is drawn (only it has "web").
  const frames = async (act: () => Promise<void>): Promise<{ containers: boolean; camera: string }[]> => {
    await page.evaluate(() => {
      const out: { containers: boolean; camera: string }[] = []
      ;(window as any).__frames = out
      const until = performance.now() + 1200
      const frame = (): void => {
        const camera = (document.querySelector('.react-flow__viewport') as HTMLElement | null)?.style.transform ?? ''
        // Drawn: shown, not hidden while its camera waits for its elements.
        const shown = (document.querySelector('.react-flow__viewport') as HTMLElement | null)?.checkVisibility({ visibilityProperty: true }) ?? false
        const rect = document.querySelector('.react-flow')?.getBoundingClientRect()
        if (shown) out.push({ containers: !!document.querySelector('.react-flow__node[data-id="web"]'), camera, width: rect?.width ?? 0, height: rect?.height ?? 0 } as any)
        if (performance.now() < until) requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    })
    await act()
    await page.waitForTimeout(1400)
    return page.evaluate(() => (window as any).__frames)
  }
  const cameras = (list: { camera: string }[]) => new Set(list.map((f) => f.camera))
  const CONTEXT = 'translate(300px, 120px) scale(1.6)'
  // The Containers view, fitted, is drawn only at its own camera.
  const fittedInOneStep = (list: { containers: boolean; camera: string }[]) => {
    expect(cameras(list.filter((f) => f.containers)).size).toBe(1)
    expect(cameras(list.filter((f) => f.containers)).has(CONTEXT)).toBe(false)
  }

  await page.getByRole('button', { name: 'Present', exact: true }).click()
  await expect(page.getByText('1 / 5')).toBeVisible()
  await page.waitForTimeout(1000)
  // To the Containers view, fitted: drawn only at its own camera.
  let shown = await frames(() => page.keyboard.press('ArrowRight'))
  await expect(page.getByText('2 / 5')).toBeVisible()
  fittedInOneStep(shown)
  // On the same view the camera flies: the zoom and the point in the middle
  // of the canvas move together, each one way only, and arrive together
  // (React Flow's flight panned past the target and zoomed in after).
  shown = await frames(() => page.keyboard.press('ArrowRight'))
  await expect(page.getByText('3 / 5')).toBeVisible()
  expect(cameras(shown).size).toBeGreaterThan(5)
  const path = shown.map((f: any) => {
    const [x, y, zoom] = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/.exec(f.camera)!.slice(1).map(Number)
    return { zoom, cx: (f.width / 2 - x) / zoom, cy: (f.height / 2 - y) / zoom }
  })
  // How far each has come, 0 to 1, in every frame: the zoom on a log scale.
  const [first, last] = [path[0], path[path.length - 1]]
  const lag = Math.max(...path.map((p) => {
    const zoom = Math.log(p.zoom / first.zoom) / Math.log(last.zoom / first.zoom)
    const pan = Math.hypot(p.cx - first.cx, p.cy - first.cy) / Math.hypot(last.cx - first.cx, last.cy - first.cy)
    return Math.abs(zoom - pan)
  }))
  expect(lag).toBeLessThan(0.05)
  // After a slide with no canvas the canvas opens at the slide's camera: it
  // opened at 0,0 ×1, was fitted for a moment and then jumped.
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText('4 / 5')).toBeVisible()
  await page.waitForTimeout(800)
  shown = await frames(() => page.keyboard.press('ArrowRight'))
  await expect(page.getByText('5 / 5')).toBeVisible()
  expect(cameras(shown)).toEqual(new Set(['translate(-100px, 40px) scale(0.7)']))
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft')
  await expect(page.getByText('2 / 5')).toBeVisible()
  await page.waitForTimeout(800)
  // Back to the Context view, at its captured camera at once.
  shown = await frames(() => page.keyboard.press('ArrowLeft'))
  await expect(page.getByText('1 / 5')).toBeVisible()
  expect(cameras(shown.filter((f) => !f.containers))).toEqual(new Set([CONTEXT]))
  await page.keyboard.press('Escape')

  // A card picked in the place does the same (Esc went back to the
  // Containers view).
  const card = (name: string) => page.locator('.pres-slide-card .pres-slide-name', { hasText: new RegExp(`^${name}$`) })
  await expect(studio.nodes).toHaveCount(6)
  await page.waitForTimeout(500)
  shown = await frames(() => card('Context').click())
  expect(cameras(shown.filter((f) => !f.containers))).toEqual(new Set([CONTEXT]))
  shown = await frames(() => card('Containers').click())
  fittedInOneStep(shown)
})

// F-0096: a slide clicked in Presenter moved the camera, and the canvas kept
// that as the view's camera: after a reload in Presenter, Designer opened the
// view at the slide's camera. Only Designer's camera is kept as the view's.
test('a slide shown in Presenter leaves the view\'s camera Designer\'s, also after a reload', async ({ page, studio }) => {
  await studio.open('v-context', 'designer')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: /Smart fit/ }).click()
  await page.keyboard.press('Escape')
  const transform = () => page.locator('.react-flow__viewport').getAttribute('style')
  const pane = (await studio.canvas.boundingBox())!
  await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2)
  await page.mouse.wheel(0, -300)
  await studio.settle()
  const designer = await transform()

  await page.getByRole('button', { name: 'Presentations', exact: true }).click()
  await page.locator('.pres-slide-card .pres-slide-name', { hasText: 'Context' }).click()
  await studio.settle()
  expect(await transform()).not.toBe(designer)
  await page.reload()
  await studio.ready()
  // Back to Designer's view through a section's tab.
  await page.getByRole('tab', { name: 'Views' }).click()
  await studio.designer()
  await studio.settle()
  expect(await transform()).toBe(designer)
})

// The slide's name field kept every key from Studio, F5 and Cmd/Ctrl+P too:
// the browser took them, and its reload lost the name being typed, or its
// print dialog opened (F-0086).
test('F5 and Cmd/Ctrl+P in a slide\'s name field are Studio\'s: F5 saves the name and presents', async ({ page, studio }) => {
  await page.evaluate(() => {
    const w = window as unknown as { __keys: string[] }
    w.__keys = []
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F5' || e.key === 'p') setTimeout(() => w.__keys.push(`${e.key} prevented: ${e.defaultPrevented}`))
    }, true)
  })
  const keys = (): Promise<string[]> => page.evaluate(() => (window as unknown as { __keys: string[] }).__keys)
  const input = page.locator('.pres-slide-name-input')
  await page.locator('.pres-slide-card .pres-slide-name', { hasText: 'Context' }).dblclick()
  await input.fill('Opening slide')
  await page.keyboard.press('ControlOrMeta+p')
  await studio.settle()
  await expect.poll(keys).toEqual(['p prevented: true'])
  await page.keyboard.press('Escape')
  await page.locator('.pres-slide-card .pres-slide-name', { hasText: 'Opening slide' }).dblclick()
  await input.fill('First slide')
  await page.keyboard.press('F5')
  await studio.settle()
  await expect.poll(keys).toEqual(['p prevented: true', 'F5 prevented: true'])
  await expect(page.locator('.pres-hud')).toContainText('First slide')
  await expect(page.getByText('1 / 2')).toBeVisible()
  await page.keyboard.press('Escape')
  await studio.settle()
  await expect(page.locator('.pres-slide-card .pres-slide-name').first()).toHaveText('First slide')
})

// F5 pressed while a name is typed saves it, then presents, as the
// properties card does: the table's F2 field and a Warnier step's name went
// away with the view, unsaved (F-0109).
test('F5 while a name is typed in the table or in a Warnier step saves it, then presents', async ({ page, studio }) => {
  await reseed(page, studio, (doc) => {
    const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}) =>
      ({ id, type, label, x: 40, y: 900, width: 220, height: 80, collapsed: false, ...props })
    doc.nodes.push(
      node('checkout', 'process', 'Checkout', { width: 900, height: 360 }),
      node('take', 'step', 'Take the order', { parentId: 'checkout', order: 1 }),
    )
    doc.views.push({ id: 'v-steps', name: 'Steps', kind: 'warnier', nodeIds: ['checkout', 'take'], positions: {} })
  })
  const presentAndEnd = async (): Promise<void> => {
    await page.keyboard.press('F5')
    await studio.settle()
    await expect(page.getByText('1 / 2')).toBeVisible()
    await page.keyboard.press('Escape')
    await studio.settle()
    await expect(page.getByText('1 / 2')).toHaveCount(0)
  }
  const saved = async (id: string): Promise<string | undefined> => {
    await studio.advance(3000)
    return (await studio.storedDoc()).nodes.find((n) => n.id === id)?.label
  }

  await studio.open('v-table')
  await studio.row('db').click()
  await page.keyboard.press('F2')
  await page.locator('.tv-cell-input').fill('Order Store')
  await presentAndEnd()
  await expect(studio.row('db')).toContainText('Order Store')
  await expect.poll(() => saved('db')).toBe('Order Store')

  await studio.open('v-steps')
  const diagram = page.getByLabel('Warnier diagram')
  await diagram.locator('.wn-label', { hasText: 'Take the order' }).click()
  await page.keyboard.press('F2')
  await diagram.locator('.wn-name-input').fill('Take the payment')
  await presentAndEnd()
  await expect(diagram.locator('.wn-name', { hasText: 'Take the payment' })).toBeVisible()
  await expect.poll(() => saved('take')).toBe('Take the payment')
})
