import { test, expect } from '../../support/fixtures'

test.describe('About Radical Studio', () => {
  test('shows the version, commit and day of the build and the folder format, and copies them', async ({ page, context, studio }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await studio.seed()
    await studio.open('v-context')
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
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

  test('the folder at the top of the activity rail opens Models, the model open is named at the toolbar\'s left, and About is under Settings', async ({ page, studio }) => {
    await studio.seed()
    await studio.open('v-context')
    // The rail runs from the window's top, as VS Code's activity bar, the
    // toolbar beside it; the folder (the Models menu) at its top, in the
    // toolbar's row, above the panel's sections.
    const rail = (await page.locator('.activity-rail').boundingBox())!
    const toolbar = (await page.locator('.toolbar').boundingBox())!
    expect(rail.y).toBe(0)
    expect(toolbar.x).toBeGreaterThanOrEqual(rail.x + rail.width - 1)
    const models = page.locator('.activity-rail').getByRole('button', { name: 'Models', exact: true })
    const folder = (await models.boundingBox())!
    expect(folder.y + folder.height).toBeLessThanOrEqual(toolbar.y + toolbar.height)
    expect(folder.y + folder.height).toBeLessThanOrEqual((await page.getByRole('tab', { name: 'Views' }).boundingBox())!.y)
    // The model open, and where it is kept (the seeded model is in the browser).
    await expect(page.locator('.toolbar .app-brand-doc')).toHaveText('E2ELOCAL')
    await expect(page.locator('.toolbar .app-brand-doc')).toHaveAttribute('title', 'E2E: kept in this browser (local storage)')
    await models.click()
    await expect(page.getByRole('menu', { name: 'Models' }).getByText('Manage models…')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('menuitem', { name: 'About Radical Studio' }).click()
    await expect(page.getByRole('dialog', { name: 'About Radical Studio' })).toBeVisible()
  })

  test('the Settings menu fits a low window, so About is reached', async ({ page, studio }) => {
    await studio.seed()
    await studio.open('v-context')
    await page.setViewportSize({ width: 1280, height: 650 })
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
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
