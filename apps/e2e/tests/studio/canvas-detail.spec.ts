import { test, expect, fixture, withWhole, WHOLE } from '../../support/fixtures'

// Zoomed out, the canvas draws each element as a block of its type's colour
// with its name (store/canvasDetail.ts, withDetail): a card's text would be a
// fraction of a pixel, and the browser spent most of a large view's opening
// on building and measuring full cards. Zoomed in, the cards come back.

function systems(): string {
  const nodes: object[] = []
  for (let s = 0; s < 6; s++) {
    nodes.push({ id: `s${s}`, type: 'system', label: `System ${s}`, description: 'A system with containers', x: s * 900, y: 0, width: 800, height: 600, collapsed: false })
    for (let c = 0; c < 4; c++) nodes.push({ id: `s${s}c${c}`, type: 'container', label: `Container ${s}.${c}`, description: 'Does a part of the work', technology: 'TypeScript', parentId: `s${s}`, x: 40 + (c % 2) * 380, y: 80 + Math.floor(c / 2) * 250, width: 320, height: 180, collapsed: false })
  }
  return JSON.stringify({ nodes, relations: [], views: [] })
}

type Page = import('@playwright/test').Page
const zoom = (page: Page) => page.evaluate(() => (window as any).__rfCurrentViewport?.zoom as number)
/** Wheels over the canvas, as a user zooms, until the zoom is past `to`. */
async function wheelTo(page: Page, to: number): Promise<void> {
  const box = (await page.locator('.react-flow__pane').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  const zoomIn = to > await zoom(page)
  for (let i = 0; i < 30 && (zoomIn ? await zoom(page) < to : await zoom(page) > to); i++) {
    await page.mouse.wheel(0, zoomIn ? -200 : 200)
    await page.waitForTimeout(80)
  }
}

test('zoomed out the canvas draws blocks with names, zoomed in cards, and a block still folds', async ({ page, studio }) => {
  await studio.seedDocument(withWhole(systems()))
  await studio.open(WHOLE)
  const block = page.locator('.c4-node-simple')

  // The whole model fits on screen far below the threshold.
  await expect.poll(() => zoom(page)).toBeLessThan(0.27)
  await expect(block).toHaveCount(30)
  await expect(page.locator('.c4-node-label')).toHaveCount(0)
  await expect(studio.node('s0c1')).toContainText('Container 0.1')
  // Two handles to measure per element, not eight.
  await expect(studio.node('s0c1').locator('.react-flow__handle')).toHaveCount(2)
  // A system with containers is a frame; it folds from its block.
  await expect(studio.node('s0').locator('.c4-node-simple.frame')).toHaveCount(1)
  await studio.node('s0').locator('.c4-node-collapse-btn').dispatchEvent('click')
  await expect(studio.node('s0c1')).toHaveCount(0)
  await studio.node('s0').locator('.c4-node-collapse-btn').dispatchEvent('click')
  await expect(studio.node('s0c1')).toHaveCount(1)

  await wheelTo(page, 0.5)
  await expect(block).toHaveCount(0)
  await expect(studio.node('s0c1').locator('.c4-node-label')).toHaveText('Container 0.1')
  await expect(studio.node('s0c1').locator('.react-flow__handle')).toHaveCount(8)
})

// A card lower than its text keeps its name and technology whole and shows
// only the lines of its description that fit, the last cut with an ellipsis.
test('a low card keeps its name whole and cuts its description at the last line that fits', async ({ page, studio }) => {
  const doc = JSON.parse(fixture('bookstore'))
  const long = 'Takes the orders and the catalogue requests of the web app, checks the stock, reserves the books, charges the card through the payment provider and keeps an audit trail of every change it makes.'
    .repeat(3)
  doc.nodes = doc.nodes.map((n: { id: string }) => (n.id === 'api' ? { ...n, height: 120, label: 'Orders and catalogue API', technology: 'Node.js, TypeScript, Fastify, Prisma', description: long } : n))
  for (const v of doc.views) if (v.positions?.api) v.positions.api.height = 120
  await studio.seedDocument(JSON.stringify(doc))
  await studio.open('v-containers')
  const card = studio.node('api')
  await expect(card.locator('.c4-node-desc')).toBeVisible()
  // Measured in CSS pixels, as the card's styles are.
  const box = (selector: string) => card.locator(selector).evaluate((el) => {
    const e = el as HTMLElement
    return { height: e.offsetHeight, scroll: e.scrollHeight, line: parseFloat(getComputedStyle(e).lineHeight), padding: parseFloat(getComputedStyle(e).paddingTop) + parseFloat(getComputedStyle(e).paddingBottom), clamp: getComputedStyle(e).getPropertyValue('-webkit-line-clamp') }
  })
  const label = await box('.c4-node-label')
  expect(label.scroll).toBeLessThanOrEqual(label.height + 1)
  const tech = await box('.c4-node-tech')
  expect(tech.height).toBeGreaterThan(0)
  await expect.poll(async () => {
    const desc = await box('.c4-node-desc')
    return Number(desc.clamp) * desc.line <= desc.height - desc.padding + 1 && desc.scroll > desc.height
  }).toBe(true)
})

// Edges between elements of different containers are drawn above the
// containers, and one could run over a container's −/+: zoomed out, across
// the dashed frame's corner, it hid it. A copy of each button is drawn
// above the relations, where the button is.
test('zoomed out a relation never covers a container\'s −/+', async ({ page, studio }) => {
  const model = JSON.parse(systems())
  // From far above and right of System 0 down into its right-hand
  // container: the line runs over System 0's top-right corner.
  model.nodes.push({ id: 'far', type: 'system', label: 'Far', x: 2400, y: -1400, width: 300, height: 180, collapsed: false })
  model.relations.push({ id: 'r-far', sourceId: 'far', targetId: 's0c1', label: 'calls' })
  await studio.seedDocument(withWhole(JSON.stringify(model)))
  await studio.open(WHOLE)
  await expect.poll(() => zoom(page)).toBeLessThan(0.27)
  const button = studio.node('s0').locator('.c4-node-collapse-btn')
  await expect(button).toHaveCount(1)
  await studio.settle()
  const box = (await button.boundingBox())!
  const mirror = page.locator('.c4-collapse-mirror')
  // One copy per button, at the button's place, in a layer above the
  // relations, and the pointer passes through it to the button.
  await expect.poll(() => mirror.evaluateAll((els, b) => els.filter((e) => {
    const r = e.getBoundingClientRect()
    return Math.abs(r.x - b.x) < 2 && Math.abs(r.y - b.y) < 2 && Math.abs(r.width - b.width) < 2
  }).length, box)).toBe(1)
  const above = await page.evaluate(() => {
    const layer = document.querySelector('.c4-collapse-mirror-layer') as HTMLElement
    const renderer = document.querySelector('.react-flow__renderer') as HTMLElement
    return Number(getComputedStyle(layer).zIndex) > Number(getComputedStyle(renderer).zIndex) && getComputedStyle(layer).pointerEvents === 'none'
  })
  expect(above).toBe(true)
  await expect(mirror.first()).toHaveText('−')
  await button.dispatchEvent('click')
  await expect(studio.node('s0c1')).toHaveCount(0)
  await expect(page.locator('.c4-collapse-mirror', { hasText: '+' })).toHaveCount(1)
})
