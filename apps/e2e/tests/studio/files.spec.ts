import { expect, fixture } from '../../support/fixtures'
import { ModelFile, test } from '../../support/folder'
import type { Page } from '@playwright/test'

// Models kept in a single .radical file (web build: File System Access API
// over an OPFS file, see support/folder.ts). Every change is saved back to
// the file; the file handle survives a reload.

let file: ModelFile

test.beforeEach(async ({ page }) => {
  file = new ModelFile(page)
  await file.install()
})

async function openModels(page: Page): Promise<void> {
  await page.getByTitle('Menu', { exact: true }).click()
  await page.getByRole('menuitem', { name: /Manage models/ }).click()
  await expect(page.getByRole('dialog', { name: 'Models' })).toBeVisible()
}

/** The properties card's name field of the selected element. */
function labelField(page: Page) {
  return page.locator('.right-panel.open').getByLabel('Name', { exact: true })
}

test('Open → File… keeps the model in the file and saves changes to it', async ({ page, studio }) => {
  await page.goto('/')
  await file.write(fixture('bookstore'))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'File…' }).click()
  await studio.ready()
  await studio.designer()
  // It opens on its first view (decided 2026-10-21; it landed on All elements).
  await expect(page).toHaveURL(/\/v\/v-context$/)
  await page.locator('.lp-view-card', { hasText: 'All elements' }).click()
  await studio.row('customer').click()
  await expect(labelField(page)).toHaveValue('Customer')
  await labelField(page).fill('Shopper')
  await labelField(page).press('Tab')
  await expect.poll(async () => (await file.read()).includes('"Shopper"')).toBe(true)

  // After a reload it opens from Recent, still from the file.
  await page.goto('/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.locator('.msteps-row').first().click()
  await studio.ready()
  await expect(page).toHaveURL(/\/v\/v-context$/)
  await expect(studio.node('customer')).toContainText('Shopper')
  await openModels(page)
  await expect(page.getByRole('dialog', { name: 'Models' }).locator('.docmgr-badge.fs')).toBeVisible()
})

test('New model can keep the model in a file', async ({ page, studio }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New model' }).click()
  await page.getByRole('radio', { name: /In a file/ }).check()
  await page.getByRole('button', { name: 'Choose file and create' }).click()
  await studio.ready()
  await expect(studio.nodes).toHaveCount(0)
  await expect.poll(async () => {
    const text = await file.read()
    return text ? Object.keys(JSON.parse(text)) : []
  }).toEqual(expect.arrayContaining(['nodes', 'relations', 'metamodel']))
  // The choice is remembered for the next new model.
  await page.goto('/')
  await page.getByRole('button', { name: 'New model' }).click()
  await expect(page.getByRole('radio', { name: /In a file/ })).toBeChecked()
})

test('a model file that does not parse, or is gone, is named and left as it is', async ({ page, studio }) => {
  // A trailing comma added by hand: after a reload the model opened with no
  // elements and no word, and the file was rewritten empty. A file deleted
  // outside Studio was made again, empty, the same way.
  await page.goto('/')
  await file.write(fixture('bookstore'))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'File…' }).click()
  await studio.ready()
  const saved = await file.read()
  const broken = saved.replace(/\}\s*\]\s*,\s*"sequences"/, '},\n  ],\n  "sequences"')
  expect(broken).not.toBe(saved)
  await file.write(broken)

  await page.reload()
  const toasts = page.getByRole('region', { name: 'Notifications' })
  await expect(toasts).toContainText('model.radical cannot be read (malformed JSON)')
  await page.waitForTimeout(1500)
  expect(await file.read()).toBe(broken)

  // Fixed by hand and opened again from Recent: the model is back, and saved.
  await file.write(saved)
  await page.goto('/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.locator('.msteps-row').first().click()
  await studio.ready()
  // On its first view (decided 2026-10-21).
  await expect(studio.node('customer')).toBeVisible()

  // Deleted outside Studio once its saves are done, then opened again.
  await page.waitForTimeout(1500)
  await file.remove()
  await page.reload()
  await expect(toasts).toContainText('model.radical cannot be read (it is not there')
  await page.waitForTimeout(1500)
  expect(await file.exists()).toBe(false)
})
