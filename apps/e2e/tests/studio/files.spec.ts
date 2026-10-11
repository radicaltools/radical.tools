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

/** The properties-panel Label field of the selected element. */
function labelField(page: Page) {
  return page.locator('.props-field').filter({ has: page.getByText('Label', { exact: true }) }).locator('input')
}

test('Open → File… keeps the model in the file and saves changes to it', async ({ page, studio }) => {
  await page.goto('/')
  await file.write(fixture('bookstore'))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'File…' }).click()
  await studio.ready()
  await studio.node('customer').click()
  await expect(labelField(page)).toHaveValue('Customer')
  await labelField(page).fill('Shopper')
  await labelField(page).press('Tab')
  await expect.poll(async () => (await file.read()).includes('"Shopper"')).toBe(true)

  // After a reload it opens from Recent, still from the file.
  await page.goto('/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.locator('.msteps-row').first().click()
  await studio.ready()
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
