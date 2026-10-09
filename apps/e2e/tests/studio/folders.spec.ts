import { expect, fixture } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import type { Page } from '@playwright/test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'

// Models persisted as a folder of Markdown files (web build: File System
// Access API over an OPFS directory, see support/folder.ts). Systems,
// containers and web apps get a directory with an _index.md, other elements a
// file: the bookstore fixture becomes nodes/customer.md,
// nodes/payment-provider/_index.md and nodes/bookstore/_index.md with
// api/_index.md, web-app/_index.md, orders-db.md.

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
    'nodes/bookstore/web-app/_index.md',
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

test('a deep link into a folder-backed model survives a reload', async ({ page, studio }) => {
  await saveAsFolder(page)
  // The folder loads after the first paint; the link must wait for it.
  await page.reload()
  await studio.ready()
  await expect(page).toHaveURL(/\/v\/v-context$/)
  await expect(studio.nodes).toHaveCount(3)

  await page.goto('/#/d/ls%3Ae2e-doc/m/presenter/v/v-containers/p/pres-main/play/1/sl/1')
  await page.reload()
  await studio.ready()
  await expect(page.getByText('2 / 2')).toBeVisible()
  await expect(page).toHaveURL(/\/p\/pres-main\/play\/1\/sl\/1$/)
})

test('moving files keeps the descriptions of elements never opened', async ({ page, studio }) => {
  await saveAsFolder(page)
  // After a reload, descriptions are read from the files only on demand.
  await page.reload()
  await studio.ready()

  // Renaming the system moves its children's files, whose bodies were
  // never loaded; a second save must not lose them. (Click Bookstore by its
  // header.)
  await studio.node('bookstore').click({ position: { x: 24, y: 12 } })
  await rename(page, 'Bookstore', 'Online Shop')
  await expect.poll(() => folder.paths()).toContain('nodes/online-shop/api/_index.md')
  await studio.node('customer').click()
  await rename(page, 'Customer', 'Reader')
  await expect.poll(() => folder.paths()).toContain('nodes/reader.md')

  const files = await folder.files()
  expect(files['nodes/online-shop/api/_index.md']).toContain('Orders and catalogue API')
  expect(files['nodes/online-shop/web-app/_index.md']).toContain('Catalogue and checkout UI')
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
    // What changed is highlighted for a few seconds, then the badge goes.
    await expect(studio.node('customer')).toContainText('CHANGED')
    await expect(studio.node('bookstore')).not.toContainText('CHANGED')
    await expect(studio.node('customer')).not.toContainText('CHANGED', { timeout: 8_000 })
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

test('Open folder… on the welcome screen opens a model folder', async ({ page, studio }) => {
  const files = serializeToMdFolder(JSON.parse(fixture('bookstore')), 'Bookstore')
  for (const [path, content] of Object.entries(files)) await folder.write(path, content)
  await page.goto('/')
  await page.getByRole('button', { name: 'Open folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  await expect(studio.node('customer')).toBeVisible()
  await openModels(page)
  await expect(page.getByRole('dialog', { name: 'Models' }).locator('.docmgr-badge.md')).toBeVisible()
})

test('an agent\'s Forge run on the folder makes the Forge button pulse and opens read only', async ({ page }) => {
  await saveAsFolder(page)
  const stages = ['requirements', 'domain', 'fitness', 'scenarios', 'states', 'mockups', 'c4']
  const write = (state: string, statuses: Record<string, string>): Promise<void> => folder.write('.radical/forge-run.json', JSON.stringify({
    version: 1,
    client: 'claude-code',
    need: { id: 'n1', label: 'Click & collect' },
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state,
    stages: stages.map((id) => ({ id, status: statuses[id] ?? 'pending', ...(statuses[id] === 'done' ? { summary: `${id} summary`, added: { nodes: 2, relations: 1 } } : {}) })),
  }))
  const button = page.locator('.qs-forge-toggle')
  await expect(button).not.toHaveAttribute('data-agent-phase')

  // Requirements done: the agent asks how to arrange them and whether to go
  // on, so the run is still at stage 1 of 7.
  await write('active', { requirements: 'done' })
  await expect(button).toHaveAttribute('data-agent-phase', 'waiting', { timeout: 10_000 })
  await expect(button.locator('.qs-forge-badge')).toHaveText('1/7')

  // Working on the domain model: blue pulse, stage 2 of 7.
  await write('active', { requirements: 'done', domain: 'generating' })
  await expect(button).toHaveAttribute('data-agent-phase', 'working', { timeout: 10_000 })
  await expect(button.locator('.qs-forge-badge')).toHaveText('2/7')

  await button.click()
  const panel = page.getByRole('dialog', { name: 'Radical Forge — agent run' })
  await expect(panel).toContainText('Radical Forge — run by Claude Code')
  await expect(panel).toContainText('Click & collect')
  // The seven stages and nothing else, as the badge counts them.
  await expect(panel.locator('.forge-step')).toHaveCount(7)
  await expect(panel.locator('.forge-step[data-status="done"]')).toHaveAttribute('title', /requirements summary/)
  await expect(panel.locator('.forge-step.active')).toHaveText('Domain')
  await expect(panel.locator('.forge-agent-line')).toHaveText('Claude Code is generating the Domain model stage…')
  // Read only: nothing to press but Close.
  await expect(panel.getByRole('button')).toHaveCount(1)

  // Done and waiting for the user's choice: still at the Domain model.
  await write('active', { requirements: 'done', domain: 'done' })
  await expect(panel.locator('.forge-agent-line')).toHaveText('Waiting for you in Claude Code: how to arrange the Domain model stage, and whether to go on.', { timeout: 10_000 })
  await expect(button.locator('.qs-forge-badge')).toHaveText('2/7')

  // Asking the user: amber, and the view follows the file.
  await write('active', { requirements: 'done', domain: 'done', fitness: 'clarifying' })
  await expect(button).toHaveAttribute('data-agent-phase', 'waiting', { timeout: 10_000 })
  await expect(panel.locator('.forge-agent-line')).toHaveText('Claude Code is asking you about the Fitness functions stage; answer there.')

  // The client closed early: no pulse, shown as stopped.
  await write('closed', { requirements: 'done', domain: 'done' })
  await expect(button).toHaveAttribute('data-agent-phase', 'paused', { timeout: 10_000 })
  await expect(panel.locator('.forge-agent-line')).toHaveText('Stopped: Claude Code closed before the run finished.')
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
})
