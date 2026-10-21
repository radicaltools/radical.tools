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

// D20 and D6 (runs 45 to 64): a Structurizr workspace's views came in as
// nothing (the import landed on All elements), and what it could not read
// went without a word.
test('Open → Structurizr DSL… brings the views, opens the first, and says what it left out', async ({ page, studio }) => {
  const dsl = `workspace "Shop" {
    !include people.dsl
    model {
        customer = person "Customer"
        shop = softwareSystem "Shop" {
            web = container "Web App"
            api = container "API"
        }
        customer -> web "Browses"
        web -> api "Calls"
        deploymentEnvironment "Live" {
            deploymentNode "Server" {
            }
        }
    }
    views {
        systemContext shop "Context" {
            include *
        }
        container shop "Containers" {
            include *
        }
    }
}`
  await page.goto('/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Structurizr DSL…' }).click()
  await (await chooser).setFiles({ name: 'shop.dsl', mimeType: 'text/plain', buffer: Buffer.from(dsl) })
  await studio.ready()
  // The first view, with what it shows: Customer and Shop, folded, laid out.
  await expect(page).toHaveURL(/\/v\/view-1/)
  await expect(studio.nodes).toHaveCount(2)
  await expect(page.locator('.toast-message').filter({ hasText: 'Structurizr import left out' }))
    .toContainText(/!include people\.dsl.*Deployment environment "Live"/)
  const doc = JSON.parse(await studio.storedJson(studio.activeDocId())) as { views: { name: string }[] }
  expect(doc.views.map((v) => v.name)).toEqual(['Context', 'Containers'])
  await studio.settle()
  await expect.poll(() => studio.layoutViolations(studio.activeDocId())).toEqual([])
  // The other view, the system with its containers, is laid out when it
  // is first opened.
  await page.locator('.left-panel').getByText('Containers', { exact: true }).click()
  await expect(studio.nodes).toHaveCount(4)
  await studio.settle()
  await expect.poll(() => studio.layoutViolations(studio.activeDocId())).toEqual([])
})

test('Move to browser keeps a file model in this browser and leaves the file as it is', async ({ page, studio }) => {
  // Decided 2026-10-21: there was no way back from a file or folder.
  await page.goto('/')
  await file.write(fixture('bookstore'))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'File…' }).click()
  await studio.ready()
  await openModels(page)
  const models = page.getByRole('dialog', { name: 'Models' })
  await models.getByRole('button', { name: /^Actions for / }).first().click()
  page.once('dialog', (d) => void d.accept())
  await models.getByRole('menuitem', { name: 'Move to browser' }).click()
  await expect(models.locator('.docmgr-item.active .docmgr-badge.ls')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(models).toBeHidden()
  const onDisk = await file.read()
  await studio.designer()
  await studio.node('customer').click()
  await labelField(page).fill('Shopper')
  await labelField(page).press('Tab')
  await expect.poll(async () => JSON.stringify(await studio.storedDoc(studio.activeDocId()))).toContain('"Shopper"')
  expect(await file.read()).toBe(onDisk)
})
