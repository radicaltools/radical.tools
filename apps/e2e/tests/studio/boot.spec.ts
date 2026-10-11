import { test, expect } from '../../support/fixtures'

test.describe('first visit', () => {
  test('shows the welcome screen', async ({ page, studio }) => {
    await studio.freezeTime()
    await page.goto('/')
    await studio.settle()
    // Two choices first; the details come one step later.
    await expect(page.getByRole('button', { name: 'New model' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try the sample model' })).toBeVisible()
    // The URL stays clean until the user picks a model.
    expect(new URL(page.url()).hash).toBe('')
    await expect(page).toHaveScreenshot('welcome.png')
  })

  test('New model asks for the metamodel and storage, Open for the source', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'New model' }).click()
    await expect(page.getByLabel('Metamodel')).toHaveValue('c4-ddd-governance-builtin')
    await expect(page.getByRole('radio', { name: /In this browser/ })).toBeChecked()
    // Forge needs an AI provider, and none is set up on a first visit.
    await expect(page.getByRole('button', { name: 'Create with Radical Forge' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Open', exact: true }).click()
    await expect(page.getByRole('button', { name: /In this browser/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'File…' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Folder…' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Sample model/ })).toBeVisible()
  })

  test('offers Radical Forge once an AI provider is set up', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('radical-ai-settings', JSON.stringify({
        enabled: true,
        active: 'anthropic',
        providers: { anthropic: { apiKey: 'e2e', baseUrl: '', model: '' } },
      }))
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New model' }).click()
    await page.getByRole('button', { name: 'Create with Radical Forge' }).click()
    await expect(page.locator('.welcome-overlay')).toBeHidden()
    await expect(page.getByRole('dialog', { name: /Radical Forge/ })).toBeVisible()
  })

  test('Try the sample model opens it on its System Context view', async ({ page, studio }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Try the sample model' }).click()
    await expect(page).toHaveURL(/\/v\/view-ctx$/)
    await studio.ready()
    await expect(page.getByText('Structure: System Context')).toBeVisible()
  })

  test('the sample opens on its System Context view', async ({ page, studio }) => {
    await studio.freezeTime()
    await studio.openSample()
    await expect(page.getByText('Structure: System Context')).toBeVisible()
    await expect(studio.nodes).toHaveCount(8)
    await expect(studio.edges).toHaveCount(7)
    await expect(studio.nodeByLabel('Core Banking Platform')).toBeVisible()
    await expect(page).toHaveScreenshot('sample-context.png')
  })

  test('a new model starts empty', async ({ page, studio }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'New model' }).click()
    await page.getByRole('button', { name: 'Create model' }).click()
    await studio.ready()
    await expect(studio.nodes).toHaveCount(0)
    await expect(page.getByPlaceholder(/Search 0 nodes/)).toBeVisible()
  })
})

test.describe('returning visit', () => {
  test('Open → In this browser lists the models kept in the browser', async ({ page, studio }) => {
    await studio.seed()
    await page.goto('/')
    await page.getByRole('button', { name: 'Open', exact: true }).click()
    await page.getByRole('button', { name: /In this browser/ }).click()
    await expect(page.locator('.welcome-right .msteps-row')).toHaveText([/E2E/])
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'File…' })).toBeVisible()
  })

  test('Open lists recent models, the last one first and focused', async ({ page, studio }) => {
    await studio.seed()
    await page.goto('/')
    await page.getByRole('button', { name: 'Open', exact: true }).click()
    const last = page.locator('.msteps-row').first()
    await expect(last).toContainText('E2E')
    await expect(last).toBeFocused()
    await page.keyboard.press('Enter')
    await studio.ready()
    await expect(studio.nodes.first()).toBeVisible()
  })
})

test.describe('Models dialog', () => {
  test('lists every model, filters them, and creates one with the welcome steps', async ({ page, studio }) => {
    await studio.seed()
    await studio.open('v-context')
    await page.getByTitle('Menu', { exact: true }).click()
    await page.getByRole('menuitem', { name: /Manage models/ }).click()
    const models = page.getByRole('dialog', { name: 'Models' })
    await expect(models.locator('.docmgr-item')).toHaveCount(1)
    await expect(models.locator('.docmgr-item')).toContainText('This browser')

    await models.getByRole('button', { name: '+ New model' }).click()
    await expect(models.getByLabel('Metamodel')).toHaveValue('c4-ddd-governance-builtin')
    await models.getByRole('button', { name: 'Create model' }).click()
    await expect(models).toBeHidden()
    await expect(studio.nodes).toHaveCount(0)

    await page.getByTitle('Menu', { exact: true }).click()
    await page.getByRole('menuitem', { name: /Manage models/ }).click()
    await expect(models.locator('.docmgr-item')).toHaveCount(2)
    await models.getByRole('searchbox', { name: 'Search models' }).fill('e2e')
    await expect(models.locator('.docmgr-item')).toHaveCount(1)
    await models.getByRole('button', { name: 'Actions for E2E' }).click()
    await models.getByRole('menuitem', { name: 'Rename' }).click()
    await models.locator('.docmgr-rename-input').fill('Bookstore')
    await models.locator('.docmgr-rename-input').press('Enter')
    await expect(models.locator('.docmgr-item')).toHaveCount(0) // the filter says e2e
    await models.getByRole('searchbox', { name: 'Search models' }).fill('')
    await expect(models.locator('.docmgr-name', { hasText: 'Bookstore' })).toBeVisible()
  })
})
