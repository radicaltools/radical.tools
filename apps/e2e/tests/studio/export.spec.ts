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
  await page.getByRole('button', { name: 'Radical', exact: true }).click()
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
