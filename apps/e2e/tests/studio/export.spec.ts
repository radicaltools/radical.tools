import { readFile } from 'node:fs/promises'
import { test, expect } from '../../support/fixtures'

test.beforeEach(async ({ studio }) => {
  await studio.seed()
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
