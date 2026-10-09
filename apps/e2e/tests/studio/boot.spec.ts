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
    // The URL stays clean until the user picks a model.
    expect(new URL(page.url()).hash).toBe('')
    await expect(page).toHaveScreenshot('welcome.png')
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
