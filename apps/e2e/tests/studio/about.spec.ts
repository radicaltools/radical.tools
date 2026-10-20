import { test, expect } from '../../support/fixtures'

test.describe('About Radical Studio', () => {
  test('shows the version, commit and day of the build and the folder format, and copies them', async ({ page, context, studio }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await studio.seed()
    await studio.open('v-context')
    await page.getByTitle('Menu', { exact: true }).click()
    await page.getByRole('menuitem', { name: 'About Radical Studio' }).click()

    const about = page.getByRole('dialog', { name: 'About Radical Studio' })
    await expect(about).toBeVisible()
    const value = (label: string) => about.locator('dt', { hasText: new RegExp(`^${label}$`) }).locator('xpath=following-sibling::dd[1]')
    // A build from a commit not tagged v<version> shows the commit with the version.
    const commit = (await value('Commit').textContent())!.trim()
    expect(commit).toMatch(/^[0-9a-f]{7,}$/)
    await expect(value('Version')).toHaveText(new RegExp(`^\\d+\\.\\d+\\.\\d+(-[0-9A-Za-z.]+)?(\\+${commit})?$`))
    await expect(value('Commit').getByRole('link')).toHaveAttribute('href', `https://github.com/radicaltools/radical.tools/commit/${commit}`)
    await expect(value('Built')).toHaveText(/^\d{4}-\d{2}-\d{2}$/)
    await expect(value('Runs as')).toHaveText('Browser')
    await expect(value('Model folder format')).toHaveText('1')
    await expect(about.getByRole('link', { name: "What's new" })).toHaveAttribute('href', /CHANGELOG\.md$/)

    await about.getByRole('button', { name: 'Copy' }).click()
    await expect(about.getByRole('button', { name: 'Copied' })).toBeVisible()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toMatch(new RegExp(`^Radical Studio\\nVersion: \\S+\\nCommit: ${commit}\\nBuilt: \\S+\\nRuns as: Browser\\nModel folder format: 1$`))

    await page.keyboard.press('Escape')
    await expect(about).toBeHidden()
  })

  test('the Radical menu scrolls in a window lower than it is tall, so About is reached', async ({ page, studio }) => {
    await studio.seed()
    await studio.open('v-context')
    await page.setViewportSize({ width: 1280, height: 650 })
    await page.getByTitle('Menu', { exact: true }).click()
    const menu = page.locator('.app-menu-popover')
    await expect(menu).toBeVisible()
    const box = (await menu.boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(650)
    const about = page.getByRole('menuitem', { name: 'About Radical Studio' })
    await about.scrollIntoViewIfNeeded()
    const item = (await about.boundingBox())!
    expect(item.y + item.height).toBeLessThanOrEqual(650)
    await about.click()
    await expect(page.getByRole('dialog', { name: 'About Radical Studio' })).toBeVisible()
  })
})
