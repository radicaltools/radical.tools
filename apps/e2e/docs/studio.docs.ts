import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'
import { fixture } from '../support/fixtures'
import { expect, test } from './shots'

// Every Studio screenshot of the manual, on the Fintech sample unless it says
// otherwise. One test per figure; its name is the file name.

const SAMPLE = readFileSync(fileURLToPath(new URL('../../studio/src/renderer/src/store/fintechSampleData.json', import.meta.url)), 'utf8')
const ARCHITECTURE = fileURLToPath(new URL('../../../architecture/', import.meta.url))

/** A few models kept in this browser, so Recent and the Models dialog have rows. */
async function seedModels(page: Page): Promise<void> {
  await page.addInitScript(([sample, bookstore, order]) => {
    if (localStorage.getItem('radical-docs-index')) return
    const docs = [
      { id: 'docs-sample', name: 'Fintech Banking Platform', source: 'ls', lastModified: Date.now() - 60_000, data: sample },
      { id: 'docs-bookstore', name: 'Bookstore', source: 'ls', lastModified: Date.now() - 3_600_000, data: bookstore },
      { id: 'docs-order', name: 'Order lifecycle', source: 'ls', lastModified: Date.now() - 86_400_000, data: order },
    ]
    localStorage.setItem('radical-docs-index', JSON.stringify({
      docs: docs.map(({ data: _data, ...meta }) => meta),
      activeId: 'docs-sample',
    }))
    for (const d of docs) localStorage.setItem(`radical-doc:${d.id}`, d.data)
  }, [SAMPLE, fixture('bookstore'), fixture('order-machine')] as const)
}

/** Open a view of the seeded sample (`docs-sample`). */
async function open(page: Page, view: string, mode = 'designer', extra = ''): Promise<void> {
  await page.goto(`/#/d/${encodeURIComponent('ls:docs-sample')}/m/${mode}/v/${view}${extra}`)
  await expect(page.locator('.app-layout')).toBeVisible()
  await settle(page)
}

/** Camera still, toasts gone. */
async function settle(page: Page): Promise<void> {
  const viewport = page.locator('.react-flow__viewport').first()
  let prev = ''
  for (let i = 0, stable = 0; i < 60 && stable < 3; i++) {
    const cur = (await viewport.count()) ? (await viewport.getAttribute('style')) ?? '' : ''
    stable = cur === prev ? stable + 1 : 0
    prev = cur
    await page.waitForTimeout(100)
  }
  await dismissToasts(page)
}

async function dismissToasts(page: Page): Promise<void> {
  const close = page.getByRole('button', { name: 'Dismiss notification' })
  while (await close.count()) await close.first().click().catch(() => {})
  await expect(page.locator('.toast')).toHaveCount(0)
}

async function menu(page: Page, item: RegExp | string): Promise<void> {
  await page.getByTitle('Menu', { exact: true }).click()
  await page.getByRole('menu').getByRole('menuitem').or(page.getByRole('menu').getByRole('menuitemcheckbox')).filter({ hasText: item }).click()
}

test.beforeEach(async ({ page }) => {
  await seedModels(page)
})

test('welcome', async ({ page, shot }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'New model' })).toBeVisible()
  await shot('welcome')
})

test('documents', async ({ page, shot }) => {
  await open(page, 'view-ctx')
  await menu(page, /Manage models/)
  await expect(page.getByRole('dialog', { name: 'Models' }).locator('.docmgr-item')).toHaveCount(3)
  await shot('documents')
})

test('designer', async ({ page, shot }) => {
  await open(page, 'view-ctx')
  await shot('designer')
})

test('properties', async ({ page, studio, shot }) => {
  await open(page, 'view-core')
  await studio.node('ctn-payments').locator('.c4-node-label').first().click()
  await settle(page)
  await shot('properties')
})

test('mockups', async ({ page, studio, shot }) => {
  await open(page, 'view-screens')
  await studio.nodeByLabel('Review & FX Quote').first().click()
  await settle(page)
  await shot('mockups')
})

test('views', async ({ page, shot }) => {
  await open(page, 'view-payments')
  await shot('views')
})

test('flow', async ({ page, shot }) => {
  await open(page, 'view-payflow')
  await shot('flow')
})

test('hierarchy', async ({ page, shot }) => {
  await open(page, 'view-treemap')
  await page.getByLabel('Levels:').selectOption('all')
  await page.waitForTimeout(500)
  await shot('hierarchy')
})

test('table', async ({ page, shot }) => {
  await open(page, 'view-register')
  await expect(page.locator('.tv-chain-row.depth-0')).toHaveCount(3)
  await shot('table')
})

/** The Requirements Register's chain, open in its properties beside the table it gives. */
test('view-filter', async ({ page, shot }) => {
  await open(page, 'view-register')
  const card = page.locator('.lp-view-card', { hasText: 'Requirements Register' })
  await card.hover()
  await card.getByTitle('View properties').click()
  await expect(page.locator('.rp-pipeline .rp-level')).toHaveCount(3)
  await page.locator('.rp-pipeline').scrollIntoViewIfNeeded()
  await page.mouse.move(1300, 860)
  await shot('view-filter')
})

test('matrix', async ({ page, shot }) => {
  await open(page, 'view-matrix')
  await shot('matrix')
})

test('wiki', async ({ page, shot }) => {
  await open(page, 'view-wiki', 'designer', '/f/ctn-payments')
  await shot('wiki')
})

test('search', async ({ page, shot }) => {
  await open(page, 'view-ctx')
  await page.keyboard.press('ControlOrMeta+p')
  await page.keyboard.type('Payment')
  await page.waitForTimeout(500)
  await shot('search')
})

test('milestones', async ({ page, shot }) => {
  await open(page, 'view-payments', 'designer', '/s/snap-v2')
  await page.locator('.lp-section-header', { hasText: 'Milestones' }).click()
  await settle(page)
  await shot('milestones')
})

test('viewer', async ({ page, shot }) => {
  await open(page, 'view-core', 'viewer')
  await shot('viewer')
})

test('presenter', async ({ page, shot }) => {
  await open(page, 'view-ctx', 'presenter')
  await shot('presenter')
})

test('metamodel', async ({ page, shot }) => {
  await open(page, 'view-ctx')
  await menu(page, 'Metamodel editor…')
  await expect(page.getByRole('dialog', { name: 'Metamodel editor' })).toBeVisible()
  await shot('metamodel')
})

test('metamodel-diagram', async ({ page, shot }) => {
  await open(page, 'view-ctx')
  await menu(page, 'Metamodel editor…')
  const editor = page.getByRole('dialog', { name: 'Metamodel editor' })
  await editor.getByRole('tab', { name: 'Diagram' }).click()
  await editor.locator('.mmd-canvas').getByTestId('rf__node-requirement').click()
  await settle(page)
  await shot('metamodel-diagram')
})

test('hub-import', async ({ page, shot }) => {
  await open(page, 'view-ctx')
  await menu(page, 'Import from Hub…')
  const dialog = page.locator('[aria-label="Import from Hub"]')
  await expect(dialog.getByRole('button', { name: 'Add to Model' }).first()).toBeVisible({ timeout: 15_000 })
  await shot('hub-import')
})

test('ai-settings', async ({ page, shot }) => {
  await open(page, 'view-ctx')
  await menu(page, 'AI providers…')
  await page.waitForTimeout(300)
  await shot('ai-settings')
})

/** The repository's own architecture model, with the test results `radical check` left beside it. */
test('inspector', async ({ page, shot }) => {
  const files: Record<string, string> = {}
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (name === '.DS_Store') continue
      if (statSync(path).isDirectory()) walk(path)
      else files[relative(ARCHITECTURE, path)] = readFileSync(path, 'utf8')
    }
  }
  walk(ARCHITECTURE)
  test.skip(!files['.radical/test-results.json'], 'run npm run check:architecture first')
  delete files['.radical/selection.json']

  await page.addInitScript(() => {
    ;(window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> })
      .showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('architecture', { create: true })
  })
  await page.goto('/')
  await page.evaluate(async (all) => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('architecture', { create: true })
    for (const [rel, text] of Object.entries(all)) {
      let dir = root
      const parts = rel.split('/')
      for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true })
      const w = await (await dir.getFileHandle(parts[parts.length - 1], { create: true })).createWritable()
      await w.write(text)
      await w.close()
    }
  }, files)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  const inspector = page.getByRole('button', { name: /^Inspector/ })
  await expect(inspector).toBeEnabled({ timeout: 20_000 })
  await inspector.click()
  await expect(page.locator('.insp-verdict')).toBeVisible()
  await settle(page)
  await shot('inspector')
})
