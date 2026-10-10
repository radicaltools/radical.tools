import { test, expect } from '../../support/fixtures'

test.describe('first visit', () => {
  test('shows the welcome screen', async ({ page, studio }) => {
    await studio.freezeTime()
    await page.goto('/')
    await studio.settle()
    await expect(page.getByRole('button', { name: /Explore the sample/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New model' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open file…' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open folder…' })).toBeVisible()
    // Forge needs an AI provider, and none is set up on a first visit.
    await expect(page.getByRole('button', { name: 'Start with Radical Forge' })).toHaveCount(0)
    // The URL stays clean until the user picks a model.
    expect(new URL(page.url()).hash).toBe('')
    await expect(page).toHaveScreenshot('welcome.png')
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
    await page.getByRole('button', { name: 'Start with Radical Forge' }).click()
    await expect(page.locator('.welcome-overlay')).toBeHidden()
    await expect(page.getByRole('dialog', { name: /Radical Forge/ })).toBeVisible()
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
    await studio.ready()
    await expect(studio.nodes).toHaveCount(0)
    await expect(page.getByPlaceholder(/Search 0 nodes/)).toBeVisible()
  })
})

test.describe('returning visit', () => {
  test('lists recent models, the last one first and focused', async ({ page, studio }) => {
    await studio.seed()
    await page.goto('/')
    const last = page.locator('.welcome-recent-item').first()
    await expect(last).toContainText('E2E')
    await expect(last).toBeFocused()
    await page.keyboard.press('Enter')
    await studio.ready()
    await expect(studio.nodes.first()).toBeVisible()
  })
})
