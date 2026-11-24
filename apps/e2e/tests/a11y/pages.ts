// The pages and states the accessibility, reflow and target-size checks open
// (Accessibility and Mobile and perceived performance packs): Studio, the Hub
// and the site (radical.tools), each in a browser context of its own.
//
// Studio and the Hub are the production builds playwright.config.ts serves
// (vite preview); the site is apps/web served from disk, as the deploy copies
// it to S3. Requests beyond the app are blocked, as in support/fixtures.ts,
// and the Hub's catalogue is read from this build.
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Browser, type BrowserContext, type BrowserContextOptions, type Page, type TestInfo } from '@playwright/test'

/** The ports of playwright.config.ts (STUDIO_PORT, HUB_PORT). */
export const STUDIO = 'http://localhost:4310'
export const HUB = 'http://localhost:4311'
/** Not a server: requests to it are answered from apps/web. */
export const SITE = 'http://localhost:4319'
const WEB = fileURLToPath(new URL('../../../web/', import.meta.url))

/** The three web front ends, by the folder each is built from (the paths of
 *  .radical/radical.json): what a tracked violation names as its `front`. */
export type Front = 'apps/studio' | 'apps/hub' | 'apps/web'

export interface State {
  front: Front
  /** Unique over all states; a tracked violation names it. */
  name: string
  url: string
  /** Studio opens on its first start: the Setup wizard, not skipped. */
  firstStart?: boolean
  /** Brings the page into the state once it has loaded. */
  open?: (page: Page) => Promise<void>
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.ico': 'image/x-icon',
}

/** A browser context for `front`, set up like the e2e suite's. */
export async function frontContext(browser: Browser, info: TestInfo, front: Front, options: BrowserContextOptions = {}, firstStart = false): Promise<BrowserContext> {
  const { viewport, deviceScaleFactor, locale, timezoneId, colorScheme, userAgent } = info.project.use
  const context = await browser.newContext({ viewport, deviceScaleFactor, locale, timezoneId, colorScheme, userAgent, ...options })
  // The routes registered last are tried first: everything beyond the app is
  // aborted, but the Hub's catalogue and the site are answered.
  await context.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort())
  if (front === 'apps/hub') {
    await context.route('https://hub.radical.tools/hub/**', async (route) => {
      const response = await route.fetch({ url: new URL(new URL(route.request().url()).pathname.slice(1), `${HUB}/`).href })
      await route.fulfill({ response, headers: { ...response.headers(), 'content-type': 'application/json' } })
    })
  }
  if (front === 'apps/web') {
    // The site links its pages by their address on radical.tools, too.
    await context.route(/^(http:\/\/localhost:4319|https:\/\/radical\.tools)\//, async (route) => {
      let path = decodeURIComponent(new URL(route.request().url()).pathname)
      if (path.endsWith('/')) path += 'index.html'
      const file = normalize(join(WEB, path))
      if (!file.startsWith(WEB)) return route.fulfill({ status: 403 })
      try {
        await route.fulfill({ body: await readFile(file), contentType: TYPES[extname(file)] ?? 'application/octet-stream' })
      } catch {
        await route.fulfill({ status: 404, body: 'not found' })
      }
    })
  }
  if (front === 'apps/studio' && !firstStart) {
    // Set up already, as support/fixtures.ts skipSetup does.
    await context.addInitScript(() => {
      if (!localStorage.getItem('radical-studio-settings')) localStorage.setItem('radical-studio-settings', JSON.stringify({ setupDone: true }))
    })
  }
  return context
}

/** Opens `state` in a page of `context` and waits until it shows. */
export async function openState(context: BrowserContext, state: State): Promise<Page> {
  const page = await context.newPage()
  await page.goto(state.url)
  await state.open?.(page)
  await settle(page)
  await page.evaluate(() => document.fonts.ready)
  // Let transitions end (a dialog fading in is checked at its full colours).
  await page.waitForTimeout(400)
  return page
}

/** Studio with the bundled Fintech sample open, on its first view, as
 *  "Try the sample model" opens it (in Viewer). */
async function sample(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Try the sample model' }).click()
  await expect(page).toHaveURL(/\/v\/view-ctx$/)
  await expect(page.locator('.app-layout')).toBeVisible()
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
}

/** Waits until the canvas camera stops moving (as support/fixtures.ts settle). */
export async function settle(page: Page): Promise<void> {
  const viewport = page.locator('.react-flow__viewport')
  if (!(await viewport.count())) return
  let prev = ''
  for (let i = 0, stable = 0; i < 60 && stable < 3; i++) {
    const cur = (await viewport.first().getAttribute('style')) ?? ''
    stable = cur === prev ? stable + 1 : 0
    prev = cur
    await page.waitForTimeout(100)
  }
}

async function designer(page: Page): Promise<void> {
  await sample(page)
  // By its link: on a phone the toolbar's mode switch is out of sight.
  await page.goto(page.url().replace('/m/viewer/', '/m/designer/'))
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Designer/)
}

async function view(page: Page, name: string): Promise<void> {
  await page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: new RegExp(`^${name}$`) }) }).first().click()
}

export const STUDIO_STATES: State[] = [
  { front: 'apps/studio', name: 'Studio: Setup wizard', url: `${STUDIO}/`, firstStart: true,
    open: async (page) => { await expect(page.getByRole('dialog', { name: 'Set up Radical Studio' })).toBeVisible() } },
  { front: 'apps/studio', name: 'Studio: welcome', url: `${STUDIO}/`,
    open: async (page) => { await expect(page.getByRole('button', { name: 'New model' })).toBeVisible() } },
  { front: 'apps/studio', name: 'Studio: New model dialog', url: `${STUDIO}/`,
    open: async (page) => {
      await page.getByRole('button', { name: 'New model' }).click()
      await expect(page.getByRole('combobox', { name: 'Metamodel' })).toBeVisible()
    } },
  { front: 'apps/studio', name: 'Studio: Open dialog', url: `${STUDIO}/`,
    open: async (page) => {
      await page.getByRole('button', { name: 'Open', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Folder…' })).toBeVisible()
    } },
  { front: 'apps/studio', name: 'Studio: sample in Viewer', url: `${STUDIO}/`, open: sample },
  { front: 'apps/studio', name: 'Studio: sample in Designer', url: `${STUDIO}/`, open: designer },
  { front: 'apps/studio', name: 'Studio: element selected', url: `${STUDIO}/`,
    open: async (page) => {
      await designer(page)
      await settle(page)
      await page.locator('.react-flow__node').first().dblclick()
      await expect(page.locator('.right-panel.open')).toBeVisible()
    } },
  { front: 'apps/studio', name: 'Studio: All elements table', url: `${STUDIO}/`,
    open: async (page) => {
      await designer(page)
      await view(page, 'All elements')
      await expect(page.locator('.tv-wrap')).toBeVisible()
    } },
  { front: 'apps/studio', name: 'Studio: wiki', url: `${STUDIO}/`,
    open: async (page) => {
      await sample(page)
      await page.goto(page.url().replace(/\/v\/view-ctx$/, '/v/view-wiki'))
      await expect(page.locator('.wiki-title').first()).toBeVisible()
    } },
  { front: 'apps/studio', name: 'Studio: Quick Search open', url: `${STUDIO}/`,
    open: async (page) => {
      await designer(page)
      await page.locator('.quick-search-bar').getByPlaceholder(/^Search/).click()
      await page.keyboard.type('Pay')
      await expect(page.locator('.quick-search-item').first()).toBeVisible()
    } },
  { front: 'apps/studio', name: 'Studio: Settings menu open', url: `${STUDIO}/`,
    open: async (page) => {
      await designer(page)
      await page.getByRole('button', { name: 'Settings', exact: true }).click()
      await expect(page.getByRole('menuitem', { name: 'Setup…' })).toBeVisible()
    } },
  { front: 'apps/studio', name: 'Studio: metamodel editor', url: `${STUDIO}/`,
    open: async (page) => {
      await sample(page)
      await page.goto(page.url().replace('/m/viewer/', '/m/metamodel/'))
      await expect(page.locator('.app-layout')).toBeVisible()
    } },
]

export const HUB_STATES: State[] = [
  { front: 'apps/hub', name: 'Hub: landing', url: `${HUB}/`,
    open: async (page) => { await expect(page.getByRole('button', { name: 'Browse the catalogue' })).toBeVisible() } },
  { front: 'apps/hub', name: 'Hub: catalogue', url: `${HUB}/#/browse`,
    open: async (page) => { await expect(page.getByText('Authentication', { exact: true })).toBeVisible() } },
  { front: 'apps/hub', name: 'Hub: search', url: `${HUB}/#/browse`,
    open: async (page) => {
      await page.getByPlaceholder('Search concepts…').fill('backup')
      await expect(page.getByText('Backup and recovery', { exact: true })).toBeVisible()
    } },
  { front: 'apps/hub', name: 'Hub: pack wiki', url: `${HUB}/#/c/concern-authentication/v/wiki`,
    open: async (page) => { await expect(page.getByText('Authentication', { exact: true }).first()).toBeVisible() } },
  { front: 'apps/hub', name: 'Hub: pack canvas', url: `${HUB}/#/c/concern-authentication/v/canvas`,
    open: async (page) => { await expect(page.locator('.react-flow__node').first()).toBeVisible() } },
]

/** The site's pages, as the deploy publishes apps/web. */
export const SITE_PAGES = ['/', '/usecases.html', '/manual.html', '/reference.html', '/blog/', '/blog/the-context-your-agent-needs-has-a-name.html']

export const SITE_STATES: State[] = SITE_PAGES.map((path) => ({
  front: 'apps/web', name: `Site: ${path}`, url: `${SITE}${path}`,
  open: async (page) => { await expect(page.locator('body')).toBeVisible() },
}))

export const STATES: State[] = [...STUDIO_STATES, ...HUB_STATES, ...SITE_STATES]
