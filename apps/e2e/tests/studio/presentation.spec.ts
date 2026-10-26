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
  const capture = card.getByTitle(/^Capture canvas state/)
  // The hidden Capture button sat where the card's middle is.
  const button = (await capture.boundingBox())!
  await page.mouse.click(button.x + button.width / 2, box.y + box.height / 2)
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
  await studio.designer()
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
