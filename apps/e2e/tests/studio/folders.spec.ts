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
import { serializeAgentActivity } from '@radical/common/formats/agentActivity'
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
  await page.getByRole('button', { name: 'Actions for E2E' }).click()
  await page.getByRole('menuitem', { name: 'Move to a folder…' }).click()
  const models = page.getByRole('dialog', { name: 'Models' })
  await expect(models.locator('.docmgr-badge.md')).toBeVisible()
  await models.getByRole('button', { name: 'Close' }).click()
}

/** The properties card's name field of the selected element. */
function labelField(page: Page) {
  return page.locator('.right-panel.open').getByLabel('Name', { exact: true })
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

test('the table sums up elements by their descriptions at once, and after an outside edit', async ({ page, studio }) => {
  await saveAsFolder(page)
  await expect.poll(() => folder.paths()).toContain('nodes/customer.md')
  // Read from the files, as a model opened from disk is.
  await studio.open('v-table')
  await page.reload()
  await studio.ready()
  const summary = (id: string) => studio.row(id).locator('.tv-cell-summary')
  await expect(summary('customer')).toHaveText('Buys books online')
  await expect(summary('payments')).toHaveText('Card payments')

  // A tool rewrites one file: the reload brings every description along.
  const file = (await folder.files())['nodes/customer.md']
  await folder.write('nodes/customer.md', file.replace('Buys books online', 'Reads books on the go'))
  await expect(summary('customer')).toHaveText('Reads books on the go', { timeout: 10_000 })
  await expect(summary('payments')).toHaveText('Card payments')

  // Quick Search finds an element by a word of its description.
  await page.locator('.quick-search-bar').getByPlaceholder(/^Search/).click()
  await page.keyboard.type('checkout UI')
  await expect(page.locator('.quick-search-item', { hasText: 'Web App' })).toBeVisible()
})

test('moving files keeps the elements\' descriptions', async ({ page, studio }) => {
  await saveAsFolder(page)
  // Read back from the files.
  await page.reload()
  await studio.ready()

  // Renaming the system moves its children's files; a second save must not
  // lose their descriptions. (Click Bookstore by its header.)
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

test('an edit made while an agent writes the folder survives a reload', async ({ page, studio }) => {
  await saveAsFolder(page)
  await expect.poll(() => folder.paths()).toContain('nodes/payment-provider/_index.md')
  // The agent's mark: Studio holds its saves for 15 s.
  await folder.write('.radical/agent-activity.json', serializeAgentActivity('claude-code'))
  await studio.node('payments').click()
  await rename(page, 'Payment Provider', 'Card Gateway')
  await expect(page.getByText(/An agent is editing this model/)).toBeVisible()
  expect(await folder.paths()).not.toContain('nodes/card-gateway/_index.md')

  await page.reload()
  await studio.ready()
  await expect(studio.node('payments')).toContainText('Card Gateway')
  await expect.poll(() => folder.paths(), { timeout: 20_000 }).toContain('nodes/card-gateway/_index.md')
})

test('an agent mark far ahead of Studio\'s clock holds the saves for one period, not as long as it says', async ({ page, studio }) => {
  // A server whose clock ran an hour ahead held Studio's saves for the hour:
  // each check cut the mark to 15 s from then, so the hold renewed itself
  // (item 237).
  await saveAsFolder(page)
  await expect.poll(() => folder.paths()).toContain('nodes/payment-provider/_index.md')
  await folder.write('.radical/agent-activity.json', serializeAgentActivity('claude-code', Date.now() + 3_600_000))
  await studio.node('payments').click()
  await rename(page, 'Payment Provider', 'Card Gateway')
  await expect(page.getByText(/An agent is editing this model/)).toBeVisible()
  await expect.poll(() => folder.paths(), { timeout: 25_000 }).toContain('nodes/card-gateway/_index.md')
})

test('Undo after an outside edit takes back the user\'s edit and keeps the outside one', async ({ page, studio }) => {
  await saveAsFolder(page)
  await studio.node('payments').click()
  await rename(page, 'Payment Provider', 'Card Gateway')
  await expect.poll(() => folder.paths()).toContain('nodes/card-gateway/_index.md')

  const file = (await folder.files())['nodes/customer.md']
  await folder.write('nodes/customer.md', file.replace('label: "Customer"', 'label: "Book Lover"'))
  await expect(studio.node('customer')).toContainText('Book Lover', { timeout: 10_000 })

  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(studio.node('payments')).toContainText('Payment Provider')
  await expect(studio.node('customer')).toContainText('Book Lover')
  await expect.poll(() => folder.paths()).toContain('nodes/payment-provider/_index.md')
  expect(Object.values(await folder.files()).some((c) => c.includes('label: "Book Lover"'))).toBe(true)
})

test('an agent\'s write leaves the sequence card open', async ({ page, studio }) => {
  await saveAsFolder(page)
  await expect.poll(() => folder.paths()).toContain('nodes/customer.md')
  await page.locator('[class*=header]', { hasText: /^SEQUENCES/i }).first().click()
  await page.locator('.lp-view-card', { hasText: 'Place Order' }).last().click()
  await expect(page.locator('.right-panel .seq-step')).toHaveCount(4)
  const file = (await folder.files())['nodes/customer.md']
  await folder.write('nodes/customer.md', file.replace('label: "Customer"', 'label: "Book Lover"'))
  await expect(studio.node('customer')).toContainText('Book Lover', { timeout: 10_000 })
  await expect(page.locator('.right-panel .seq-step')).toHaveCount(4)
})

test('Move to a folder keeps the model\'s name, and a rename reaches radical.md at once', async ({ page }) => {
  // The model was renamed after the folder, and a rename waited for the
  // next save to reach radical.md.
  await saveAsFolder(page)
  await expect.poll(async () => (await folder.files())['radical.md']).toContain('name: "E2E"')
  await openModels(page)
  const models = page.getByRole('dialog', { name: 'Models' })
  await expect(models.getByRole('button', { name: 'Actions for E2E' })).toBeVisible()
  await models.getByRole('button', { name: 'Actions for E2E' }).click()
  await page.getByRole('menuitem', { name: 'Rename' }).click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Bookshop')
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await folder.files())['radical.md']).toContain('name: "Bookshop"')
})

test('a folder opened is named as its radical.md says, and opening a view leaves radical.md alone', async ({ page, studio }) => {
  const files = serializeToMdFolder(JSON.parse(fixture('bookstore')), 'Bookstore')
  for (const [path, content] of Object.entries(files)) await folder.write(path, content)
  await page.goto('/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  await openModels(page)
  await expect(page.getByRole('dialog', { name: 'Models' }).getByRole('button', { name: 'Actions for Bookstore' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Models' }).getByRole('button', { name: 'Close' }).click()
  await page.locator('.lp-view-card', { hasText: 'System Context' }).click()
  await studio.settle()
  await page.waitForTimeout(2500)
  expect((await folder.files())['radical.md']).toBe(files['radical.md'])
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
  await studio.properties.getByRole('button', { name: /^Delete element/ }).click()
  await expect.poll(() => folder.paths()).not.toContain('nodes/payment-provider/_index.md')

  const files = await folder.files()
  expect(files['package.json']).toBe('{"name":"shop"}')
  expect(files['nodes/README.md']).toBe('# Notes\n')
})

test('declining the prompt leaves a non-model folder untouched', async ({ page }) => {
  await folder.write('nodes/README.md', '# Notes\n')
  page.once('dialog', (d) => d.dismiss())
  await openModels(page)
  await page.getByRole('button', { name: 'Actions for E2E' }).click()
  await page.getByRole('menuitem', { name: 'Move to a folder…' }).click()
  const models = page.getByRole('dialog', { name: 'Models' })
  await expect(models.locator('.docmgr-badge.ls')).toBeVisible()
  await expect(models.locator('.docmgr-badge.md')).toHaveCount(0)
  expect(await folder.paths()).toEqual(['nodes/README.md'])
})

test('Move to a folder… into another model\'s folder asks before replacing it, and a yes leaves one entry for the folder', async ({ page, studio }) => {
  // Orders moved into the folder E2E was kept in replaced E2E without a
  // question, and both list entries opened Orders (item 235).
  await saveAsFolder(page)
  await expect.poll(async () => (await folder.files())['radical.md']).toContain('name: "E2E"')
  await page.evaluate((data) => {
    const idx = JSON.parse(localStorage.getItem('radical-docs-index')!)
    idx.docs.push({ id: 'e2e-orders', name: 'Orders', source: 'ls', lastModified: 1 })
    localStorage.setItem('radical-docs-index', JSON.stringify(idx))
    localStorage.setItem('radical-doc:e2e-orders', data)
  }, fixture('order-machine'))
  await studio.open('v-order', 'designer', 'e2e-orders')
  const moveOrders = async (): Promise<void> => {
    await openModels(page)
    await page.getByRole('button', { name: 'Actions for Orders' }).click()
    await page.getByRole('menuitem', { name: 'Move to a folder…' }).click()
  }
  const models = page.getByRole('dialog', { name: 'Models' })
  const question = (answer: 'accept' | 'dismiss') => page.waitForEvent('dialog').then(async (d) => {
    expect(d.message()).toContain('holds the model "E2E"')
    await d[answer]()
  })

  // No: nothing is written, and Orders stays in the browser.
  let asked = question('dismiss')
  await moveOrders()
  await asked
  await expect(models.locator('.docmgr-badge.ls')).toHaveCount(1)
  await page.waitForTimeout(500)
  expect((await folder.files())['radical.md']).toContain('name: "E2E"')
  await models.getByRole('button', { name: 'Close' }).click()

  // Yes: Orders replaces it, and the entry of E2E, whose folder it was, goes.
  asked = question('accept')
  await moveOrders()
  await asked
  await expect(models.locator('.docmgr-badge.md')).toHaveCount(1)
  await expect(models.locator('.docmgr-badge.ls')).toHaveCount(0)
  await expect(models.getByRole('button', { name: 'Actions for E2E' })).toHaveCount(0)
  await expect.poll(async () => (await folder.files())['radical.md']).toContain('name: "Orders"')
})

test('Open → Folder… on the welcome screen opens a model folder', async ({ page, studio }) => {
  const files = serializeToMdFolder(JSON.parse(fixture('bookstore')), 'Bookstore')
  for (const [path, content] of Object.entries(files)) await folder.write(path, content)
  await page.goto('/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  // It opens on its first view (decided 2026-10-21; it landed on All elements).
  await expect(page).toHaveURL(/\/v\/v-context$/)
  await expect(studio.node('customer')).toBeVisible()
  await openModels(page)
  await expect(page.getByRole('dialog', { name: 'Models' }).locator('.docmgr-badge.md')).toBeVisible()
})

test('New model on the welcome screen can keep the model in a folder', async ({ page, studio }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New model' }).click()
  await page.getByRole('radio', { name: /In a folder/ }).check()
  await page.getByRole('button', { name: 'Choose folder and create' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  await expect(studio.nodes).toHaveCount(0)
  await expect.poll(() => folder.paths()).toContain('metamodel.json')
  await openModels(page)
  await expect(page.getByRole('dialog', { name: 'Models' }).locator('.docmgr-badge.md')).toBeVisible()
  // A folder that holds a model already is not replaced without a question
  // (item 235); a no writes nothing.
  const files = serializeToMdFolder(JSON.parse(fixture('bookstore')), 'Bookstore')
  for (const [path, content] of Object.entries(files)) await folder.write(path, content)
  await page.goto('/')
  await page.getByRole('button', { name: 'New model' }).click()
  await page.getByRole('radio', { name: /In a folder/ }).check()
  const asked = page.waitForEvent('dialog').then(async (d) => {
    expect(d.message()).toContain('holds the model "Bookstore"')
    await d.dismiss()
  })
  await page.getByRole('button', { name: 'Choose folder and create' }).click()
  await asked
  await page.waitForTimeout(500)
  expect((await folder.files())['radical.md']).toBe(files['radical.md'])
  expect(Object.keys(await folder.files()).filter((p) => p.startsWith('nodes/')).sort()).toEqual(Object.keys(files).filter((p) => p.startsWith('nodes/')).sort())
  // The choice is remembered for the next new model.
  await page.goto('/')
  await page.getByRole('button', { name: 'New model' }).click()
  await expect(page.getByRole('radio', { name: /In a folder/ })).toBeChecked()
})

test('an agent\'s Forge run on the folder makes the Forge button pulse and opens read only', async ({ page }) => {
  await saveAsFolder(page)
  const stages = ['requirements', 'domain', 'fitness', 'scenarios', 'states', 'processes', 'mockups', 'c4', 'review']
  const write = (state: string, statuses: Record<string, string>, asking?: string): Promise<void> => folder.write('.radical/forge-run.json', JSON.stringify({
    version: 1,
    client: 'claude-code',
    need: { id: 'n1', label: 'Click & collect' },
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state,
    // The domain model refined two elements of the requirements.
    stages: stages.map((id) => ({
      id, status: statuses[id] ?? 'pending',
      ...(statuses[id] === 'done' ? { summary: `${id} summary`, added: { nodes: 2, relations: 1 }, ...(id === 'domain' ? { refined: 2 } : {}) } : {}),
      ...(id === asking ? { asking: true } : {}),
    })),
  }))
  const button = page.locator('.qs-forge-toggle')
  await expect(button).not.toHaveAttribute('data-agent-phase')

  // Requirements done: the agent asks how to arrange them and whether to go
  // on, so the run is still at stage 1 of 9.
  await write('active', { requirements: 'done' })
  await expect(button).toHaveAttribute('data-agent-phase', 'waiting', { timeout: 10_000 })
  await expect(button.locator('.qs-forge-badge')).toHaveText('1/9')

  // Working on the domain model: blue pulse, stage 2 of 9.
  await write('active', { requirements: 'done', domain: 'generating' })
  await expect(button).toHaveAttribute('data-agent-phase', 'working', { timeout: 10_000 })
  await expect(button.locator('.qs-forge-badge')).toHaveText('2/9')

  await button.click()
  const panel = page.getByRole('dialog', { name: 'Radical Forge — agent run' })
  await expect(panel).toContainText('Radical Forge — run by Claude Code')
  await expect(panel).toContainText('Click & collect')
  // The nine stages and nothing else, as the badge counts them.
  await expect(panel.locator('.forge-step')).toHaveCount(9)
  await expect(panel.locator('.forge-step[data-status="done"]')).toHaveAttribute('title', /requirements summary/)
  await expect(panel.locator('.forge-step.active')).toHaveText('Domain')
  await expect(panel.locator('.forge-agent-line')).toHaveText('Claude Code is generating the Domain model stage…')
  // Nothing acts on the run: Close, and following it on the canvas.
  await expect(panel.getByRole('button')).toHaveCount(2)
  const follow = panel.getByRole('button', { name: 'Follow on the canvas' })
  await expect(follow).toHaveAttribute('aria-pressed', 'false')
  // Following hands the screen to the canvas, and the Forge button says so.
  await follow.click()
  await expect(panel).toHaveCount(0)
  await expect(button).toHaveAttribute('data-following', 'true')
  await expect(button).toHaveAttribute('title', /Following it on the canvas\./)
  await button.click()
  await expect(panel.getByRole('button', { name: 'Stop following' })).toHaveAttribute('aria-pressed', 'true')

  // The domain model proposes a refinement of the requirements: amber, waiting for the answer.
  await write('active', { requirements: 'done', domain: 'generating' }, 'domain')
  await expect(button).toHaveAttribute('data-agent-phase', 'waiting', { timeout: 10_000 })
  await expect(panel.locator('.forge-agent-line')).toHaveText('Claude Code proposes a refinement of an earlier stage in the Domain model stage; answer there.')
  await expect(panel.locator('.forge-step', { hasText: 'Domain' }).getByTestId('forge-step-refined')).toHaveClass(/pending/)

  // Done and waiting for the user's choice: still at the Domain model.
  await write('active', { requirements: 'done', domain: 'done' })
  await expect(panel.locator('.forge-agent-line')).toHaveText('Waiting for you in Claude Code: how to arrange the Domain model stage, and whether to go on.', { timeout: 10_000 })
  await expect(panel.locator('.forge-step', { hasText: 'Domain' }).getByTestId('forge-step-refined')).toHaveText('✎2')
  await expect(panel.locator('.forge-step', { hasText: 'Domain' })).toHaveAttribute('title', /2 refinements of earlier stages/)
  await expect(button.locator('.qs-forge-badge')).toHaveText('2/9')

  // Asking the user: amber, and the view follows the file.
  await write('active', { requirements: 'done', domain: 'done', fitness: 'clarifying' })
  await expect(button).toHaveAttribute('data-agent-phase', 'waiting', { timeout: 10_000 })
  await expect(panel.locator('.forge-agent-line')).toHaveText('Claude Code is asking you about the Fitness functions stage; answer there.')

  // The client closed early: no pulse, shown as stopped.
  await write('closed', { requirements: 'done', domain: 'done' })
  await expect(button).toHaveAttribute('data-agent-phase', 'paused', { timeout: 10_000 })
  await expect(panel.locator('.forge-agent-line')).toHaveText('Stopped: Claude Code closed before the run finished.')
  // Nothing more to follow; Studio's own Forge can be started again.
  await expect(panel.getByRole('button')).toHaveCount(2)
  await expect(panel.getByRole('button', { name: 'Start a new run' })).toBeVisible()
  await expect(button).not.toHaveAttribute('data-following')
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
})

// Item 189: an agent's write closed the card of a selected relation while it
// was typed in (the focus went, the next keys were lost); an element's card
// stayed open. The reload took the document opened at boot for another, and
// dropped the selection.
test('an outside write keeps the selected relation\'s card open, and what is typed in it', async ({ page, studio }) => {
  await page.locator('.lp-view-card', { hasText: 'Containers' }).click()
  await expect(studio.node('api')).toBeVisible()
  await saveAsFolder(page)
  await expect.poll(() => folder.paths()).toContain('nodes/customer.md')
  await page.locator('[data-testid="rf__edge-r3"] .react-flow__edge-interaction').dispatchEvent('click')
  const technology = page.locator('.right-panel.open').getByLabel('Technology', { exact: true })
  await technology.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' v2')
  const file = (await folder.files())['nodes/customer.md']
  await folder.write('nodes/customer.md', file.replace('label: "Customer"', 'label: "Book Lover"'))
  await expect(studio.node('customer')).toContainText('Book Lover', { timeout: 10_000 })
  await expect(technology).toBeFocused()
  await page.keyboard.type('.1')
  await expect(technology).toHaveValue('SQL v2.1')
})
