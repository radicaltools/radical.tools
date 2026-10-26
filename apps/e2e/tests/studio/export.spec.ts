import { readFile } from 'node:fs/promises'
import { test, expect, fixture } from '../../support/fixtures'

/** The bookstore, with a process of two steps, a wiki view and a Warnier
 *  view of the process. */
function bookstoreWithProcess(): string {
  const doc = JSON.parse(fixture('bookstore'))
  const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}) =>
    ({ id, type, label, x: 40, y: 900, width: 220, height: 80, collapsed: false, ...props })
  doc.nodes.push(
    node('checkout', 'process', 'Checkout', { width: 900, height: 360 }),
    node('take', 'step', 'Take the order', { parentId: 'checkout', order: 1 }),
    node('pay', 'step', 'Pay', { parentId: 'checkout', order: 2 }),
  )
  doc.views.push(
    { id: 'v-wiki', name: 'Wiki', kind: 'wiki', nodeIds: [], positions: {} },
    { id: 'v-steps', name: 'Steps', kind: 'warnier', nodeIds: ['checkout', 'take', 'pay'], positions: {} },
  )
  return JSON.stringify(doc)
}

test.beforeEach(async ({ studio }) => {
  await studio.seedDocument(bookstoreWithProcess())
  await studio.open('v-context')
})

async function exportAs(page: import('@playwright/test').Page, item: string): Promise<{ name: string; data: Buffer }> {
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByText(item, { exact: true }).click()
  const file = await download
  return { name: file.suggestedFilename(), data: await readFile(await file.path()) }
}

test('export as PNG', async ({ page }) => {
  const { name, data } = await exportAs(page, 'Export as PNG…')
  expect(name).toMatch(/\.png$/)
  expect(data.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  // Width and height from the IHDR chunk: a real picture, not an empty canvas.
  expect(data.readUInt32BE(16)).toBeGreaterThan(200)
  expect(data.readUInt32BE(20)).toBeGreaterThan(200)
})

test('export as SVG', async ({ page }) => {
  const { name, data } = await exportAs(page, 'Export as SVG…')
  expect(name).toMatch(/\.svg$/)
  const svg = data.toString('utf8')
  expect(svg).toMatch(/^<svg[\s>]/)
  for (const label of ['Customer', 'Bookstore', 'Payment Provider', 'browses and orders']) {
    expect(svg).toContain(label)
  }
})

test('an export zoomed out keeps the relation labels the canvas hides', async ({ page, studio }) => {
  const zoomOut = page.getByTitle('Zoom out (⌘−)')
  for (let i = 0; i < 15 && (await studio.canvas.getAttribute('data-edge-labels')) !== 'none'; i++) {
    await zoomOut.click()
    await page.waitForTimeout(350)
  }
  await expect(studio.canvas).toHaveAttribute('data-edge-labels', 'none')
  const svg = (await exportAs(page, 'Export as SVG…')).data.toString('utf8')
  const labels = svg.match(/<div[^>]*class="[^"]*relation-label[^"]*"[^>]*>/g) ?? []
  expect(labels.length).toBeGreaterThan(0)
  expect(labels.filter((label) => /display:\s*none/.test(label)).length, 'hidden labels in the export').toBe(0)
  // The canvas hides them again afterwards.
  await expect(studio.canvas).toHaveAttribute('data-edge-labels', 'none')
})

// An exploration's bar, and the + and − of its elements, are there to grow
// it, not part of the diagram: an export showed them (F-0067).
test('an exploration is exported without its bar and its + and −', async ({ page, studio }) => {
  await studio.open('v-containers')
  await studio.node('api').dblclick()
  await studio.properties.getByRole('button', { name: 'Explore', exact: true }).click()
  await expect(page.locator('.explore-bar')).toContainText('Explore: API')
  await page.keyboard.press('Escape')
  await expect(page.locator('.explore-more').first()).toBeVisible()
  const svg = (await exportAs(page, 'Export as SVG…')).data.toString('utf8')
  expect(svg).toContain('API')
  for (const control of ['explore-bar', 'explore-more', 'explore-menu']) expect(svg, control).not.toContain(control)
})

// An export is a picture of the diagram, not of the editor: the Unpin pin of
// a pinned element and the guide of a row with its buttons were drawn in it,
// with the selection's outline and its focus dimming the rest (F-0088).
test('an export leaves out the pin, the alignment guides, the −/+ and the selection', async ({ page, studio }) => {
  await studio.open('v-containers')
  // Dropped after a drag, Payment Provider is pinned; selected, it shows its pin.
  const box = (await studio.node('payments').boundingBox())!
  await page.mouse.move(box.x + 40, box.y + 15)
  await page.mouse.down()
  await page.mouse.move(box.x + 80, box.y + 60, { steps: 8 })
  await page.mouse.up()
  await studio.settle()
  await studio.node('payments').click()
  await expect(page.getByTestId('unpin-node')).toBeVisible()
  // Kept in a row with Customer: the guide and its buttons show while one is selected.
  await studio.node('customer').click()
  await studio.node('payments').click({ modifiers: ['Alt'] })
  await page.getByRole('button', { name: /^Align/ }).click()
  await page.getByRole('menuitem', { name: /Keep in a row/ }).click()
  await studio.settle()
  await studio.node('payments').click()
  await expect(page.getByTestId('alignment-guides')).toBeAttached()
  await expect(page.getByRole('button', { name: 'Remove row alignment' })).toBeVisible()
  await expect(page.locator('.react-flow__node.focus-dim').first()).toBeAttached()
  await expect(page.locator('.c4-node-collapse-btn').first()).toBeAttached()
  const svg = (await exportAs(page, 'Export as SVG…')).data.toString('utf8')
  expect(svg).toContain('Payment Provider')
  for (const control of ['alignment-guide', 'Unpin', 'Remove row alignment', 'c4-node-collapse-btn', 'data-editing-control', '<button', 'focus-dim']) {
    expect(svg, control).not.toContain(control)
  }
  expect(svg, 'a selected element').not.toMatch(/class="[^"]*react-flow__node[^"]*\bselected\b/)
  // The canvas keeps the selection and its focus.
  await expect(studio.node('payments')).toHaveClass(/\bselected\b/)
  await expect(page.locator('.react-flow__node.focus-dim').first()).toBeAttached()
})

test.describe('views without a canvas', () => {
  // Export looked for the canvas only: on a table, wiki, matrix or
  // hierarchy view the menu items did nothing, with no file and no notice.
  test('a table view is exported too', async ({ page, studio }) => {
    await studio.open('v-table')
    await expect(page.locator('tbody tr').first()).toBeVisible()
    const png = await exportAs(page, 'Export as PNG…')
    expect(png.name).toMatch(/Element Table\.png$/)
    expect(png.data.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    expect(png.data.readUInt32BE(16)).toBeGreaterThan(200)
    const svg = (await exportAs(page, 'Export as SVG…')).data.toString('utf8')
    expect(svg).toMatch(/^<svg[\s>]/)
    expect(svg).toContain('Payment Provider')
  })

  // Runs 25 to 34: on a Warnier view Export said "There is nothing on
  // screen to export".
  test('a Warnier view is exported, without its step buttons', async ({ page, studio }) => {
    await studio.open('v-steps')
    await expect(page.locator('.warnier-view')).toContainText('Take the order')
    const png = await exportAs(page, 'Export as PNG…')
    expect(png.name).toMatch(/Steps\.png$/)
    expect(png.data.readUInt32BE(16)).toBeGreaterThan(200)
    const svg = (await exportAs(page, 'Export as SVG…')).data.toString('utf8')
    expect(svg).toContain('Take the order')
    expect(svg).not.toContain('+ Step')
    expect(svg).not.toContain('+ Process')
  })

  // Runs 45 to 64: a wiki's export showed its editing controls.
  test('a wiki is exported without its editing controls', async ({ page, studio }) => {
    await studio.open('v-wiki/f/bookstore')
    await expect(page.locator('.wiki-page-mode-toggle')).toBeVisible()
    const svg = (await exportAs(page, 'Export as SVG…')).data.toString('utf8')
    expect(svg).toContain('Bookstore')
    for (const control of ['Single page', 'Multi page', 'wiki-tool', 'wiki-write', 'wiki-nav-search']) expect(svg, control).not.toContain(control)
  })
})
