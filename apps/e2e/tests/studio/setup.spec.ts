import type { Page } from '@playwright/test'
import { test, expect } from '../../support/fixtures'

const wizardOf = (page: Page) => page.getByRole('dialog', { name: 'Set up Radical Studio' })

const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('radical-studio-settings') ?? '{}') as Record<string, unknown>)

test.describe('first start', () => {
  test.use({ firstStart: true })

  test('opens the setup wizard over the welcome screen', async ({ page }) => {
    await page.goto('/')
    const wizard = wizardOf(page)
    await expect(wizard).toBeVisible()
    await expect(wizard.getByRole('heading', { name: 'How should Studio look?' })).toBeVisible()
    await expect(wizard.getByRole('radio', { name: /System/ })).toHaveAttribute('aria-checked', 'true')
    // The Welcome screen waits under it, and the URL stays clean.
    await expect(page.locator('.welcome-overlay')).toBeVisible()
    expect(new URL(page.url()).hash).toBe('')
  })

  test('the choices apply at once and stay after a reload', async ({ page }) => {
    await page.goto('/')
    const wizard = wizardOf(page)
    await wizard.getByRole('radio', { name: /Light/ }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await wizard.getByRole('button', { name: 'Next' }).click()
    await wizard.getByRole('radio', { name: /Shift/ }).click()
    await wizard.getByRole('button', { name: 'Next' }).click()
    await wizard.getByRole('checkbox', { name: /^Focus/ }).uncheck()
    await wizard.getByRole('button', { name: 'Next' }).click()
    await wizard.getByRole('button', { name: 'Finish' }).click()
    await expect(wizard).toBeHidden()
    await expect(page.getByRole('button', { name: 'New model' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('button', { name: 'New model' })).toBeVisible()
    await expect(wizardOf(page)).toHaveCount(0)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    expect(await stored(page)).toMatchObject({ setupDone: true, specialKey: 'shift', selectionFocus: false })
  })

  test('Skip setup closes it for good', async ({ page }) => {
    await page.goto('/')
    await wizardOf(page).getByRole('button', { name: 'Skip setup' }).click()
    await expect(wizardOf(page)).toBeHidden()
    await expect(page.getByRole('button', { name: 'New model' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'New model' })).toBeVisible()
    await expect(wizardOf(page)).toHaveCount(0)
    expect(await stored(page)).toMatchObject({ setupDone: true, specialKey: 'alt', selectionFocus: true })
  })

  test('an AI provider set up in it offers Radical Forge', async ({ page }) => {
    await page.goto('/')
    const wizard = wizardOf(page)
    await wizard.getByRole('button', { name: 'AI provider' }).click()
    await wizard.getByRole('radio', { name: /Claude/ }).click()
    await wizard.getByLabel('API key').fill('e2e')
    await wizard.getByRole('button', { name: 'Finish' }).click()
    await page.getByRole('button', { name: 'New model' }).click()
    await expect(page.getByRole('button', { name: 'Create with Radical Forge' })).toBeVisible()
  })
})

test('Settings → Setup… opens it with the settings in use', async ({ page, studio }) => {
  await page.addInitScript(() => {
    localStorage.setItem('radical-theme', 'light')
    localStorage.setItem('radical-studio-settings', JSON.stringify({ setupDone: true, specialKey: 'ctrl' }))
  })
  await studio.seed()
  await studio.open('v-context')
  await expect(page.getByRole('combobox', { name: 'Special key' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Special key' })).toHaveValue('ctrl')
  await page.getByRole('menuitem', { name: 'Setup…' }).click()
  const wizard = wizardOf(page)
  await expect(wizard.getByRole('radio', { name: /Light/ })).toHaveAttribute('aria-checked', 'true')
  await wizard.getByRole('button', { name: 'Special key' }).click()
  await expect(wizard.getByRole('radio', { name: /Ctrl/ })).toHaveAttribute('aria-checked', 'true')
})

test('the System theme follows the operating system', async ({ page, studio }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await studio.seed()
  await studio.open('v-context')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Theme' })).toHaveValue('system')
})
