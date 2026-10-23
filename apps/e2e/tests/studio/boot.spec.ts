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

  test('New model asks for the metamodel, its views and storage, Open for the source', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'New model' }).click()
    await expect(page.getByRole('combobox', { name: 'Metamodel' })).toHaveValue('c4-ddd-governance-builtin')
    await expect(page.getByRole('radio', { name: /Views of the metamodel/ })).toBeChecked()
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
    // It opens on All elements, the table of the whole model: empty, with a + row.
    await expect(page.locator('.lp-view-card.active')).toContainText('All elements')
    await expect(page.locator('.tv-empty')).toHaveText('No nodes.')
    await expect(page.getByRole('button', { name: 'Add at the top' })).toBeVisible()
  })

  test("a new model starts with the metamodel's views in their folders, or with none", async ({ page, studio }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'New model' }).click()
    await page.getByRole('button', { name: /Customise…/ }).click()
    const list = page.locator('.msteps-viewpoint-list')
    await expect(list.getByRole('group')).toHaveText([/^Conceptual/, /^Logical/, /^Governance/])
    const radical = await list.getByRole('checkbox').count()
    // The list follows the metamodel: C4 has its four C4 viewpoints, and
    // the two whole-model ones a view per element stands in for.
    const metamodel = page.getByRole('combobox', { name: 'Metamodel' })
    await metamodel.selectOption('c4-builtin')
    await expect(list.getByRole('group')).toHaveText([/^Logical/])
    await expect(list.getByRole('checkbox')).toHaveCount(6)
    await metamodel.selectOption('c4-ddd-governance-builtin')
    await expect(list.getByRole('checkbox')).toHaveCount(radical)
    await list.getByRole('checkbox', { name: 'Decision log' }).uncheck()
    await page.getByRole('button', { name: 'Create model' }).click()
    await studio.ready()
    // Still All elements first: the model has no element yet.
    await expect(page.locator('.lp-view-card.active')).toContainText('All elements')
    await expect(page.locator('.tv-empty')).toHaveText('No nodes.')
    // Under the All elements table, All elements as a structure, first.
    const cards = page.locator('.lp-view-card')
    await expect(cards.nth(1)).toContainText('All elements')
    await expect(cards.nth(1)).toContainText(/structure/i)
    await expect(page.locator('.lp-folder-name')).toHaveText(['Conceptual', 'Logical', 'Governance'])
    // Domain entities, State machine, Process, System containers and
    // Container components: groups of views per element.
    await expect(page.locator('.lp-view-group')).toHaveCount(5)
    await expect(page.locator('.lp-view-card', { hasText: 'Decision log' })).toHaveCount(0)

    await page.goto('/')
    await page.getByRole('button', { name: 'New model' }).click()
    await page.getByRole('radio', { name: /Empty/ }).check()
    await page.getByRole('button', { name: 'Create model' }).click()
    await studio.ready()
    await expect(page.locator('.lp-view-card.active')).toContainText('All elements')
    await expect(page.locator('.lp-folder-name')).toHaveCount(0)
    await expect(page.locator('.lp-view-card')).toHaveCount(1)
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
    // On its first view, not All elements (decided 2026-10-21).
    await expect(page).toHaveURL(/\/v\/v-context$/)
    await expect(studio.nodes.first()).toBeVisible()
  })
})

test.describe('Models dialog', () => {
  test('lists every model, filters them, and creates one with the welcome steps', async ({ page, studio }) => {
    await studio.seed()
    await studio.open('v-context')
    await page.getByRole('button', { name: 'Models', exact: true }).click()
    await page.getByRole('menuitem', { name: /Manage models/ }).click()
    const models = page.getByRole('dialog', { name: 'Models' })
    await expect(models.locator('.docmgr-item')).toHaveCount(1)
    await expect(models.locator('.docmgr-item')).toContainText('This browser')

    await models.getByRole('button', { name: '+ New model' }).click()
    await expect(models.getByRole('combobox', { name: 'Metamodel' })).toHaveValue('c4-ddd-governance-builtin')
    await models.getByRole('button', { name: 'Create model' }).click()
    await expect(models).toBeHidden()
    await expect(studio.nodes).toHaveCount(0)

    await page.getByRole('button', { name: 'Models', exact: true }).click()
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

  test('a model picked in the list opens on its first view, and the dialog closes', async ({ page, studio }) => {
    await studio.seed()
    await studio.open('v-context')
    const models = page.getByRole('dialog', { name: 'Models' })
    const open = async (): Promise<void> => {
      await page.getByRole('button', { name: 'Models', exact: true }).click()
      await page.getByRole('menuitem', { name: /Manage models/ }).click()
      await expect(models).toBeVisible()
    }
    await open()
    await models.getByRole('button', { name: '+ New model' }).click()
    await models.getByRole('button', { name: 'Create model' }).click()
    await expect(models).toBeHidden()
    await open()
    await models.locator('.docmgr-item', { hasText: 'E2E' }).locator('.docmgr-item-main').click()
    await expect(models).toBeHidden()
    await expect(page).toHaveURL(/\/v\/v-context$/)
    await expect(studio.nodes).toHaveCount(3)
  })
})
