import { expect, Studio } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import type { Page } from '@playwright/test'
import type { Discussions } from '@radical/common/discussions'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'

let folder: ModelFolder
test.beforeEach(async ({ page, studio }) => {
  folder = new ModelFolder(page)
  await folder.install()
  await studio.seed()
  await studio.open('v-context')
  await expect(studio.nodes).toHaveCount(3)
})

async function moveToFolder(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await page.getByRole('menuitem', { name: /Manage models/ }).click()
  await page.getByRole('button', { name: 'Actions for E2E' }).click()
  await page.getByRole('menuitem', { name: 'Move to a folder…' }).click()
  const models = page.getByRole('dialog', { name: 'Models' })
  await expect(models.locator('.docmgr-badge.md')).toBeVisible()
  await models.getByRole('button', { name: 'Close' }).click()
}
async function discuss(page: Page, nodeId = 'customer', label = 'Customer') {
  await page.getByTestId(`rf__node-${nodeId}`).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Discuss', exact: true }).click()
  return page.getByRole('dialog', { name: label, exact: true })
}
const modelFiles = (files: Record<string, string>) => Object.fromEntries(Object.entries(files).filter(([name]) => name !== 'discussions.json' && !name.startsWith('.discussions.') && !name.startsWith('.radical/')))

test('node discussion corner icons open the right panel, persist after resolution and refresh while closed', async ({ page, studio }) => {
  await moveToFolder(page)
  const before = modelFiles(await folder.files())
  const marker = (nodeId: string) => page.locator(`button[data-discussion-node="${nodeId}"]`)
  await expect(page.locator('.node-discussion-badge')).toHaveCount(0)
  const panel = await discuss(page)
  await panel.getByLabel('Comment (Markdown supported)').fill('A marked discussion')
  await panel.getByRole('button', { name: 'Post comment' }).click()
  await expect(panel.getByRole('status')).toHaveText('Posted.')
  await panel.getByRole('button', { name: 'Close discussions' }).click()
  await expect(marker('customer')).toBeVisible()
  await expect(marker('customer')).toHaveAttribute('title', '1 discussion thread, 1 open')
  await expect(marker('bookstore')).toHaveCount(0)
  const node = (await studio.node('customer').boundingBox())!
  const icon = (await marker('customer').boundingBox())!
  expect(Math.abs(icon.x + icon.width / 2 - (node.x + node.width + 8))).toBeLessThan(2)
  expect(Math.abs(icon.y + icon.height / 2 - (node.y - 8))).toBeLessThan(2)
  // The marker belongs to the UI, outside the diagram's export viewport.
  await expect(page.locator('.react-flow__viewport .node-discussion-badge')).toHaveCount(0)
  await marker('customer').click()
  await expect(panel.locator('.discussion-comment')).toContainText('A marked discussion')
  await panel.getByRole('button', { name: 'Resolve thread' }).click()
  await panel.getByRole('button', { name: 'Close discussions' }).click()
  await expect(marker('customer')).toHaveAttribute('title', '1 discussion thread, all resolved')
  const saved = JSON.parse((await folder.files())['discussions.json']) as Discussions
  saved.threads.push({ id: randomUUID(), nodeId: 'bookstore', nodeLabelAtCreation: 'Bookstore', resolved: false, comments: [{ id: randomUUID(), parentCommentId: null, body: 'External discussion', createdAt: new Date().toISOString() }] })
  await folder.write('discussions.json', JSON.stringify(saved, null, 2))
  await expect(marker('bookstore')).toBeVisible()
  await marker('bookstore').focus()
  await page.keyboard.press('Enter')
  const other = page.getByRole('dialog', { name: 'Bookstore', exact: true })
  await expect(other.locator('.discussion-comment')).toContainText('External discussion')
  await other.getByRole('button', { name: 'Close discussions' }).click()
  await page.reload()
  await studio.ready()
  await expect(marker('customer')).toHaveAttribute('title', '1 discussion thread, all resolved')
  await expect(marker('bookstore')).toBeVisible()
  expect(modelFiles(await folder.files())).toEqual(before)
  await folder.write('discussions.json', '{"threads": []}')
  await expect(page.locator('.node-discussion-badge')).toHaveCount(0)
})

test('browser folder discussions persist nested replies, attribution and resolution without changing the model', async ({ page, studio }) => {
  // Browser-storage models still have no folder in which to keep discussions.
  await studio.node('customer').click({ button: 'right' })
  await expect(page.getByRole('menuitem', { name: 'Discuss', exact: true })).toHaveCount(0)
  await moveToFolder(page)
  const before = modelFiles(await folder.files())
  const panel = await discuss(page)
  const body = panel.getByLabel('Comment (Markdown supported)')
  await expect(body).toBeFocused()
  await body.fill('**Question:** should we notify the customer?')
  await panel.getByRole('button', { name: 'Post comment' }).click()
  await expect(panel.getByRole('status')).toHaveText('Posted.')
  await expect(panel.locator('.discussion-attribution strong')).toHaveText('Anonymous')
  await panel.getByRole('button', { name: 'Reply', exact: true }).click()
  await body.fill('After the transaction commits.')
  await panel.getByLabel('Email (optional)').fill('web-reviewer@example.com')
  await panel.getByRole('button', { name: 'Post comment' }).click()
  await expect(panel.locator('.discussion-comment')).toHaveCount(2)
  await panel.getByRole('button', { name: 'Reply', exact: true }).last().click()
  await body.fill('Agreed; keep the event idempotent.')
  await panel.getByLabel('Email (optional)').fill('')
  await panel.getByRole('button', { name: 'Post comment' }).click()
  await expect(panel.locator('.discussion-attribution strong')).toHaveText(['Anonymous', 'web-reviewer@example.com', 'Anonymous'])
  await panel.getByRole('button', { name: 'Resolve thread' }).click()
  await expect(panel.getByRole('button', { name: 'Reply', exact: true })).toHaveCount(0)
  await panel.getByRole('button', { name: 'Reopen thread' }).click()
  await expect(panel.getByRole('button', { name: 'Reply', exact: true })).toHaveCount(3)
  const saved = JSON.parse((await folder.files())['discussions.json']) as Discussions
  expect(saved.threads[0].comments[2].parentCommentId).toBe(saved.threads[0].comments[1].id)
  expect(modelFiles(await folder.files())).toEqual(before)
  await page.reload()
  await studio.ready()
  await discuss(page)
  await expect(panel.locator('.discussion-comment')).toHaveCount(3)
  await panel.getByRole('button', { name: 'Close discussions' }).click()
  const other = await discuss(page, 'bookstore', 'Bookstore')
  await expect(other.locator('.discussion-comment')).toHaveCount(0)
  await other.getByLabel('Comment (Markdown supported)').fill('Separate node draft')
  await other.getByRole('button', { name: 'Close discussions' }).click()
  await discuss(page)
  await expect(panel.locator('.discussion-comment')).toHaveCount(3)
})

test('two browser tabs keep concurrent replies and independently refresh resolved and unreadable files', async ({ page }) => {
  await moveToFolder(page)
  const panel = await discuss(page)
  await panel.getByLabel('Comment (Markdown supported)').fill('Shared root')
  await panel.getByRole('button', { name: 'Post comment' }).click()
  await expect(panel.locator('.discussion-comment')).toHaveCount(1)
  const other = await page.context().newPage()
  try {
    await other.goto(page.url())
    await new Studio(other).ready()
    const otherPanel = await discuss(other)
    await expect(otherPanel.locator('.discussion-comment')).toHaveCount(1)
    await panel.getByRole('button', { name: 'Reply', exact: true }).click()
    await otherPanel.getByRole('button', { name: 'Reply', exact: true }).click()
    await panel.getByLabel('Comment (Markdown supported)').fill('Reply from the first tab')
    await otherPanel.getByLabel('Comment (Markdown supported)').fill('Reply from the second tab')
    await Promise.all([
      panel.getByRole('button', { name: 'Post comment' }).click(),
      otherPanel.getByRole('button', { name: 'Post comment' }).click(),
    ])
    await expect(panel.locator('.discussion-comment')).toHaveCount(3)
    await expect(otherPanel.locator('.discussion-comment')).toHaveCount(3)
    const saved = JSON.parse((await folder.files())['discussions.json']) as Discussions
    expect(saved.threads[0].comments.map((comment) => comment.body)).toEqual(expect.arrayContaining(['Reply from the first tab', 'Reply from the second tab']))
    await panel.getByRole('button', { name: 'Reply', exact: true }).first().click()
    await panel.getByLabel('Comment (Markdown supported)').fill('Keep this stale draft')
    await otherPanel.getByRole('button', { name: 'Resolve thread' }).click()
    await expect(otherPanel.getByRole('button', { name: 'Reopen thread' })).toBeVisible()
    await panel.getByRole('button', { name: 'Post comment' }).click()
    await expect(panel.getByRole('button', { name: 'Post comment' })).toBeDisabled()
    await expect(panel.getByLabel('Comment (Markdown supported)')).toHaveValue('Keep this stale draft')
    const valid = (await folder.files())['discussions.json']
    await folder.write('discussions.json', '<<<<<<< HEAD\n=======\n>>>>>>> branch')
    await expect(panel.getByRole('alert')).toBeVisible()
    await expect(panel.locator('.discussion-comment')).toHaveCount(3)
    await folder.write('discussions.json', valid)
    await panel.getByRole('button', { name: 'Refresh discussions' }).click()
    await expect(panel.getByRole('alert')).toHaveCount(0)
    await folder.remove('discussions.json')
    await expect(panel.getByRole('alert')).toContainText('disappeared')
    await expect(panel.getByLabel('Comment (Markdown supported)')).toHaveValue('Keep this stale draft')
  } finally { await other.close() }
})

test('a browser write failure keeps the draft, creates no empty discussion file and allows a manual retry', async ({ page }) => {
  await moveToFolder(page)
  const panel = await discuss(page)
  await panel.getByLabel('Comment (Markdown supported)').fill('Keep this question')
  await page.evaluate(() => {
    const original = FileSystemFileHandle.prototype.createWritable
    ;(window as unknown as Record<string, unknown>).__discussionCreateWritable = original
    FileSystemFileHandle.prototype.createWritable = function (options) {
      if (this.name === 'discussions.json') return Promise.reject(new DOMException('Writing denied', 'NotAllowedError'))
      return original.call(this, options)
    }
  })
  await panel.getByRole('button', { name: 'Post comment' }).click()
  await expect(panel.getByRole('status')).toContainText('not found')
  await expect(panel.getByLabel('Comment (Markdown supported)')).toHaveValue('Keep this question')
  expect((await folder.files())['discussions.json']).toBeUndefined()
  expect((await folder.paths()).filter((path) => path.startsWith('.discussions.'))).toEqual([])
  await page.evaluate(() => {
    FileSystemFileHandle.prototype.createWritable = (window as unknown as { __discussionCreateWritable: typeof FileSystemFileHandle.prototype.createWritable }).__discussionCreateWritable
  })
  await panel.getByRole('button', { name: 'Post comment' }).click()
  await expect(panel.getByRole('status')).toHaveText('Posted.')
  expect((JSON.parse((await folder.files())['discussions.json']) as Discussions).threads).toHaveLength(1)
})

// The icons are there to open discussions, not part of the diagram: an
// export showed them beside the elements (F-0067).
test('an export of the view leaves out the discussion icons', async ({ page }) => {
  await moveToFolder(page)
  const panel = await discuss(page)
  await panel.getByLabel('Comment (Markdown supported)').fill('Is the customer a person or a company?')
  await panel.getByRole('button', { name: 'Post comment' }).click()
  await expect(panel.getByRole('status')).toHaveText('Posted.')
  await panel.getByRole('button', { name: 'Close discussions' }).click()
  await expect(page.locator('button[data-discussion-node="customer"]')).toBeVisible()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByText('Export as SVG…', { exact: true }).click()
  const svg = await readFile(await (await download).path(), 'utf8')
  expect(svg).toContain('Customer')
  expect(svg).not.toContain('node-discussion-badge')
  expect(svg).not.toContain('data-discussion-node')
})

// The panel keeps its keys from the canvas, and kept F5 and Cmd/Ctrl+P from
// Studio as well: the browser reloaded the page, and the draft was lost, or
// opened its print dialog (F-0068).
test('F5 and Cmd/Ctrl+P pressed in the comment field are taken as in any dialog of Studio', async ({ page }) => {
  await moveToFolder(page)
  const panel = await discuss(page)
  const body = panel.getByLabel('Comment (Markdown supported)')
  await body.fill('A long draft')
  await page.evaluate(() => {
    const w = window as unknown as { __keys: string[] }
    w.__keys = []
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F5' || e.key === 'p') setTimeout(() => w.__keys.push(`${e.key} prevented: ${e.defaultPrevented}`))
    }, true)
  })
  await page.keyboard.press('F5')
  await page.keyboard.press('ControlOrMeta+p')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __keys?: string[] }).__keys)).toEqual(['F5 prevented: true', 'p prevented: true'])
  await expect(body).toHaveValue('A long draft')
  await expect(body).toBeFocused()
})

// Post comment and Resolve thread are disabled while they save, and Start a
// new thread instead goes away: the focus fell to the page, and Escape no
// longer closed the panel (F-0069).
test('the focus stays in the discussion panel after Post comment, Resolve thread and Start a new thread instead', async ({ page }) => {
  await moveToFolder(page)
  const panel = await discuss(page)
  const body = panel.getByLabel('Comment (Markdown supported)')
  await body.fill('Is the customer a person or a company?')
  await panel.getByRole('button', { name: 'Post comment' }).click()
  await expect(panel.getByRole('status')).toHaveText('Posted.')
  await expect(body).toBeFocused()
  await panel.getByRole('button', { name: 'Resolve thread' }).click()
  await expect(panel.getByRole('button', { name: 'Reopen thread' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await discuss(page)
  await panel.getByRole('button', { name: 'Reopen thread' }).click()
  await expect(panel.getByRole('button', { name: 'Resolve thread' })).toBeFocused()
  await panel.getByRole('button', { name: 'Reply', exact: true }).click()
  await panel.getByRole('button', { name: 'Start a new thread instead' }).click()
  await expect(body).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
})
