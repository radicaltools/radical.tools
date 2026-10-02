import { expect } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import type { Page } from '@playwright/test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'

// Models persisted as a folder of Markdown files (web build: File System
// Access API over an OPFS directory, see support/folder.ts). Systems and
// containers get a directory with an _index.md, other elements a file: the
// bookstore fixture becomes nodes/customer.md, nodes/payment-provider/_index.md
// and nodes/bookstore/_index.md with api/_index.md, web-app.md, orders-db.md.

let folder: ModelFolder

test.beforeEach(async ({ page, studio }) => {
  folder = new ModelFolder(page)
  await folder.install()
  await studio.seed()
  await studio.open('v-context')
  await expect(studio.nodes).toHaveCount(3)
})

async function openModels(page: Page): Promise<void> {
  await page.getByTitle('Menu', { exact: true }).click()
  await page.getByRole('menuitem', { name: /Manage models/ }).click()
  await expect(page.getByRole('dialog', { name: 'Models' })).toBeVisible()
}

/** Convert the seeded document to a folder through the Models dialog. */
async function saveAsFolder(page: Page): Promise<void> {
  await openModels(page)
  await page.getByRole('button', { name: 'Save as folder…' }).click()
  const models = page.getByRole('dialog', { name: 'Models' })
  await expect(models.getByRole('tab', { name: /Folders/ })).toHaveAttribute('aria-selected', 'true')
  await expect(models.locator('.docmgr-badge.md')).toBeVisible()
  await models.getByRole('button', { name: 'Close' }).click()
}

/** The properties-panel Label field of the selected element. */
function labelField(page: Page) {
  return page.locator('.props-field').filter({ has: page.getByText('Label', { exact: true }) }).locator('input')
}

async function rename(page: Page, from: string, to: string): Promise<void> {
  await expect(labelField(page)).toHaveValue(from)
  await labelField(page).fill(to)
  await labelField(page).press('Tab')
}

test('save as folder writes one Markdown file per element', async ({ page }) => {
  await saveAsFolder(page)
  await expect.poll(() => folder.paths()).toEqual(expect.arrayContaining([
    'radical.md',
    'nodes/customer.md',
    'nodes/bookstore/_index.md',
    'nodes/bookstore/api/_index.md',
    'nodes/bookstore/web-app.md',
    'nodes/bookstore/orders-db.md',
    'nodes/payment-provider/_index.md',
    'relations.json',
    '_layout.json',
  ]))
  const files = await folder.files()
  expect(files['radical.md']).toContain('radicalFormat: "md-folder"')
  expect(files['nodes/customer.md']).toContain('label: "Customer"')
  expect(files['nodes/customer.md']).toContain('Buys books online')
})

test('a folder-backed model survives a reload', async ({ page, studio }) => {
  await saveAsFolder(page)
  await studio.node('payments').click()
  await rename(page, 'Payment Provider', 'Card Gateway')
  await expect.poll(() => folder.paths()).toContain('nodes/card-gateway/_index.md')

  await page.reload()
  await studio.ready()
  await expect(studio.node('payments')).toContainText('Card Gateway')
  await openModels(page)
  await expect(page.getByRole('dialog', { name: 'Models' }).locator('.docmgr-badge.md')).toBeVisible()
})

test('moving files keeps the descriptions of elements never opened', async ({ page, studio }) => {
  await saveAsFolder(page)
  // After a reload, descriptions are read from the files only on demand.
  await page.reload()
  await studio.ready()

  // Renaming the system moves its children's files, whose bodies were
  // never loaded; a second save must not lose them. (The reload lands on the
  // full canvas, where Bookstore is expanded: click its header.)
  await studio.node('bookstore').click({ position: { x: 24, y: 12 } })
  await rename(page, 'Bookstore', 'Online Shop')
  await expect.poll(() => folder.paths()).toContain('nodes/online-shop/api/_index.md')
  await studio.node('customer').click()
  await rename(page, 'Customer', 'Reader')
  await expect.poll(() => folder.paths()).toContain('nodes/reader.md')

  const files = await folder.files()
  expect(files['nodes/online-shop/api/_index.md']).toContain('Orders and catalogue API')
  expect(files['nodes/online-shop/web-app.md']).toContain('Catalogue and checkout UI')
  expect(files['nodes/online-shop/orders-db.md']).toContain('Orders and stock')
  expect(Object.keys(files).some((p) => p.startsWith('nodes/bookstore/'))).toBe(false)
})

test('an edit made outside the app shows up on the canvas', async ({ page, studio }) => {
  await saveAsFolder(page)
  await expect.poll(() => folder.paths()).toContain('nodes/customer.md')

  const file = (await folder.files())['nodes/customer.md']
  await folder.write('nodes/customer.md', file.replace('label: "Customer"', 'label: "Book Lover"'))

  // The folder is polled every couple of seconds.
  await expect(studio.node('customer')).toContainText('Book Lover', { timeout: 10_000 })
  // Reloading an outside edit must not immediately queue an autosave.
  await page.waitForTimeout(3000)
  const files = await folder.files()
  expect(files['nodes/customer.md']).toContain('label: "Book Lover"')
  expect(Object.values(files).some((c) => c.includes('label: "Customer"'))).toBe(false)
})

test('an MCP model edit appears in the open browser canvas', async ({ page, studio }) => {
  await saveAsFolder(page)
  const disk = await mkdtemp(join(tmpdir(), 'radical-mcp-browser-'))
  try {
    // The native directory picker cannot be driven by Playwright. Mirror the
    // real model bytes from its OPFS handle into a temporary OS directory,
    // mutate them through the MCP model service, then deliver those bytes to
    // the handle that Studio polls.
    const before = await folder.files()
    for (const [path, content] of Object.entries(before)) {
      await mkdir(dirname(join(disk, path)), { recursive: true })
      await writeFile(join(disk, path), content)
    }
    const client = new Client({ name: 'radical-browser-test', version: '1.0.0' })
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [fileURLToPath(new URL('../../../mcp/dist/index.js', import.meta.url)), '--folder', disk],
    })
    try {
      await client.connect(transport)
      const change = await client.callTool({ name: 'update_node', arguments: { id: 'customer', label: 'MCP Customer' } })
      expect(change.isError, JSON.stringify(change.content)).not.toBe(true)
    } finally {
      await client.close()
    }
    const after = await new MdFolderSession(diskFolderStorage(disk)).readAll()
    for (const [path, content] of Object.entries(after)) {
      if (content !== before[path]) await folder.write(path, content)
    }
    for (const path of Object.keys(before)) if (!(path in after)) await folder.remove(path)
    await expect(studio.node('customer')).toContainText('MCP Customer', { timeout: 10_000 })
    await page.waitForTimeout(3000)
    expect((await folder.files())['nodes/mcp-customer.md']).toContain('label: "MCP Customer"')
  } finally {
    await rm(disk, { recursive: true, force: true })
  }
})

test('files the model does not own are left alone', async ({ page, studio }) => {
  await folder.write('package.json', '{"name":"shop"}')
  await folder.write('nodes/README.md', '# Notes\n')

  // The folder holds files but no model, so the app asks first.
  const asked = page.waitForEvent('dialog').then(async (d) => {
    expect(d.message()).toContain('is not a Radical model folder')
    await d.accept()
  })
  await saveAsFolder(page)
  await asked
  await expect.poll(() => folder.paths()).toContain('nodes/payment-provider/_index.md')

  await studio.node('payments').click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect.poll(() => folder.paths()).not.toContain('nodes/payment-provider/_index.md')

  const files = await folder.files()
  expect(files['package.json']).toBe('{"name":"shop"}')
  expect(files['nodes/README.md']).toBe('# Notes\n')
})

test('declining the prompt leaves a non-model folder untouched', async ({ page }) => {
  await folder.write('nodes/README.md', '# Notes\n')
  page.once('dialog', (d) => d.dismiss())
  await openModels(page)
  await page.getByRole('button', { name: 'Save as folder…' }).click()
  const models = page.getByRole('dialog', { name: 'Models' })
  await expect(models.locator('.docmgr-badge.ls')).toBeVisible()
  await expect(models.locator('.docmgr-badge.md')).toHaveCount(0)
  expect(await folder.paths()).toEqual(['nodes/README.md'])
})
