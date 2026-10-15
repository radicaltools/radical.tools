import { test as base, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Studio } from '../support/fixtures'

export interface DocsOptions {
  theme: 'light' | 'dark'
}

/** Where the manual's screenshots live. */
export const SHOTS_DIR = fileURLToPath(new URL('../../web/screenshots/', import.meta.url))

/**
 * A page in the project's theme (Studio and Hub both read `radical-theme`),
 * with `shot(name)` writing `<name>-<theme>.png` for the manual.
 */
export const test = base.extend<DocsOptions & { studio: Studio; shot: (name: string) => Promise<void> }>({
  theme: ['light', { option: true }],

  // A persistent profile, as in support/folder.ts: opening a model folder
  // takes an off-the-record Chromium down.
  page: async ({ playwright, theme }, use, testInfo) => {
    const { viewport, deviceScaleFactor, locale, timezoneId, colorScheme, baseURL, userAgent } = testInfo.project.use
    const profile = await mkdtemp(join(tmpdir(), 'radical-docs-'))
    const context = await playwright.chromium.launchPersistentContext(profile, {
      headless: true, viewport, deviceScaleFactor, locale, timezoneId, colorScheme, baseURL, userAgent,
    })
    const page = context.pages()[0] ?? await context.newPage()
    await page.addInitScript((t) => {
      if (!localStorage.getItem('radical-theme')) localStorage.setItem('radical-theme', t)
    }, theme)
    await use(page)
    await context.close()
    await rm(profile, { recursive: true, force: true })
  },

  studio: async ({ page }, use) => {
    await use(new Studio(page))
  },

  shot: async ({ page, theme }, use) => {
    mkdirSync(SHOTS_DIR, { recursive: true })
    await use(async (name) => {
      await calm(page)
      await page.screenshot({ path: `${SHOTS_DIR}${name}-${theme}.png`, animations: 'disabled', caret: 'hide' })
    })
  },
})

/** Fonts in, pointer out of the way, no tooltip or hover state left over. */
export async function calm(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
}

export { expect } from '@playwright/test'
