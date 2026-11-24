// The main journeys the Usability pack's checks walk (tests/ux/*.spec.ts):
// the pages of the site (radical.tools), the Hub's main routes and Studio's
// main places, each front end in a browser context of its own.
//
// Studio and the Hub are the production builds playwright.config.ts serves
// (vite preview); the site is apps/web answered from disk, as the deploy
// copies it to S3, and fixture pages (the scenarios' bad examples) are
// answered from memory. Requests beyond the app are blocked, as in
// support/fixtures.ts, and the Hub's catalogue is read from this build.
//
// Each check also writes what it measured as a radical-metrics/1 file into
// RADICAL_METRICS_DIR when that is set (radical sense playwright), labelled
// by front end (`app`: site, hub, studio) and page.
import { mkdirSync, writeFileSync } from 'node:fs'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Browser, type BrowserContext, type Locator, type Page, type PlaywrightWorkerArgs, type TestInfo } from '@playwright/test'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeTestResults } from '@radical/common/check'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { ModelFolder } from '../../support/folder'

/** The ports of playwright.config.ts (STUDIO_PORT, HUB_PORT). */
export const STUDIO = 'http://localhost:4310'
export const HUB = 'http://localhost:4311'
/** The site's own origin, answered from apps/web (no request leaves the
 *  machine): its absolute links (https://radical.tools/manual.html) and its
 *  relative ones (manual.html) lead to the same page, as they do live. */
export const SITE = 'https://radical.tools'
/** Not a server: requests to it are answered with a scenario's fixture page. */
export const FIXTURE = 'http://localhost:4318'
const WEB = fileURLToPath(new URL('../../../web/', import.meta.url))

export type App = 'site' | 'hub' | 'studio'

/** One page or place of a main journey. */
export interface Place {
  app: App
  /** The page's path (site), route (Hub) or place (Studio): the `page` label. */
  name: string
  /** Brings the page up in `page`, ready to be read. */
  open: (page: Page) => Promise<void>
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.ico': 'image/x-icon',
}

/** Answers requests to the site and to fixture pages, blocks the rest of
 *  the internet and reads the Hub's catalogue from this build. Routes
 *  registered last are tried first. */
async function routes(context: BrowserContext, fixtures: Record<string, string> = {}): Promise<void> {
  await context.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort())
  await context.route('https://hub.radical.tools/hub/**', async (route) => {
    const response = await route.fetch({ url: new URL(new URL(route.request().url()).pathname.slice(1), `${HUB}/`).href })
    await route.fulfill({ response, headers: { ...response.headers(), 'content-type': 'application/json' } })
  })
  await context.route(`${SITE}/**`, async (route) => {
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
  await context.route(`${FIXTURE}/**`, (route) => {
    const html = fixtures[new URL(route.request().url()).pathname]
    return html === undefined ? route.fulfill({ status: 404, body: 'not found' }) : route.fulfill({ body: html, contentType: TYPES['.html'] })
  })
}

/** Marks Studio set up, so the Setup wizard does not open (support/fixtures.ts skipSetup). */
async function setUp(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    if (!localStorage.getItem('radical-studio-settings')) localStorage.setItem('radical-studio-settings', JSON.stringify({ setupDone: true }))
  })
}

/** A browser context for the site, the Hub, fixture pages or (set up,
 *  without a model folder) Studio, set up like the e2e suite's. */
export async function webContext(browser: Browser, info: TestInfo, fixtures: Record<string, string> = {}, { studioSetUp = false } = {}): Promise<BrowserContext> {
  const { viewport, deviceScaleFactor, locale, timezoneId, colorScheme, userAgent } = info.project.use
  const context = await browser.newContext({ viewport, deviceScaleFactor, locale, timezoneId, colorScheme, userAgent })
  await routes(context, fixtures)
  if (studioSetUp) await setUp(context)
  return context
}

/**
 * A page for Studio in a persistent (on-disk) profile, as support/folder.ts
 * gives: Studio's Inspector needs a model folder, and Chromium takes an
 * off-the-record browser down when the app reads a stored folder handle back.
 */
export async function studioPage(playwright: PlaywrightWorkerArgs['playwright'], info: TestInfo): Promise<{ page: Page; close: () => Promise<void> }> {
  const { viewport, deviceScaleFactor, locale, timezoneId, colorScheme, userAgent, headless } = info.project.use
  const profile = await mkdtemp(join(tmpdir(), 'radical-ux-'))
  const context = await playwright.chromium.launchPersistentContext(profile, {
    headless: headless ?? true, viewport, deviceScaleFactor, locale, timezoneId, colorScheme, userAgent,
  })
  await routes(context)
  await setUp(context)
  const page = context.pages()[0] ?? await context.newPage()
  return { page, close: async () => { await context.close(); await rm(profile, { recursive: true, force: true }) } }
}

// ─── The site ────────────────────────────────────────────────────────────────

/** The site's main pages, as the deploy publishes apps/web. */
export const SITE_PAGES: Place[] = ['/', '/manual.html', '/reference.html', '/usecases.html', '/blog/'].map((path) => ({
  app: 'site', name: path,
  open: async (page) => {
    await page.goto(`${SITE}${path}`)
    await expect(page.locator('main')).toBeVisible()
  },
}))

// ─── The Hub ─────────────────────────────────────────────────────────────────

/** The Hub's main routes: the landing page, the catalogue, a group, a pack. */
export const HUB_PAGES: Place[] = [
  { app: 'hub', name: '/', open: async (page) => {
    await page.goto(`${HUB}/`)
    await expect(page.getByRole('button', { name: 'Browse the catalogue' })).toBeVisible()
  } },
  { app: 'hub', name: '/#/browse', open: async (page) => {
    await page.goto(`${HUB}/#/browse`)
    await expect(page.getByText('Authentication', { exact: true })).toBeVisible()
  } },
  { app: 'hub', name: '/#/cat/security', open: async (page) => {
    await page.goto(`${HUB}/#/cat/security`)
    await expect(page.getByText('Authentication', { exact: true })).toBeVisible()
  } },
  { app: 'hub', name: '/#/c/concern-authentication', open: async (page) => {
    await page.goto(`${HUB}/#/c/concern-authentication`)
    await expect(page.getByText('Callers are who they claim').first()).toBeVisible()
  } },
]

// ─── Studio ──────────────────────────────────────────────────────────────────

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

/** A small model kept in a folder (the Inspector reads folders only). */
const MODEL: DiagramData = {
  metamodel: builtInGovernanceMetamodel(),
  nodes: [
    node('shop', 'system', 'Shop', { x: 40, y: 40, width: 520, height: 300 }),
    node('api', 'container', 'Checkout API', { parentId: 'shop', x: 40, y: 60 }),
    node('need', 'need', 'Pay online', { x: 700, y: 40 }),
    node('req', 'requirement', 'Take card payments', { x: 700, y: 220, ears_type: 'ubiquitous', action: 'take card payments' }),
  ],
  relations: [
    { id: 'r1', relationType: 'derives', sourceId: 'req', targetId: 'need' },
    { id: 'r2', relationType: 'satisfies', sourceId: 'api', targetId: 'req' },
  ],
  views: [
    { id: 'v-arch', name: 'Architecture', nodeIds: ['shop', 'api'], positions: {} },
    { id: 'v-spec', name: 'Specification', nodeIds: ['need', 'req'], positions: {} },
  ],
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

/** Studio's activity rail. */
const rail = (page: Page): Locator => page.getByRole('navigation', { name: 'Activity bar' })

/**
 * Studio's main places, in the order a user walks them: the welcome screen,
 * a view of a model kept in a folder, the Inspector, the Models dialog. They
 * are walked in one page (studioPage), each from where the last one left.
 */
export const STUDIO_PLACES: Place[] = [
  { app: 'studio', name: 'welcome', open: async (page) => {
    await new ModelFolder(page).install()
    await page.goto(`${STUDIO}/`)
    await expect(page.getByRole('button', { name: 'New model' })).toBeVisible()
  } },
  { app: 'studio', name: 'view', open: async (page) => {
    const folder = new ModelFolder(page)
    for (const [path, content] of Object.entries(serializeToMdFolder(MODEL, 'Shop'))) await folder.write(path, content)
    // Test results beside the model: the Inspector opens once it has a report to show.
    await folder.write('.state/test-results.json', serializeTestResults([{ file: '/repo/tests/pay.test.ts', title: ['pays by card'], status: 'passed' }], ['reports/unit.json']))
    await page.getByRole('button', { name: 'Open', exact: true }).click()
    await page.getByRole('button', { name: 'Folder…' }).click()
    await expect(page.locator('.welcome-overlay')).toBeHidden()
    await expect(page.locator('.app-layout')).toBeVisible()
    await expect(page.locator('.react-flow__node').first()).toBeVisible()
    await settle(page)
  } },
  { app: 'studio', name: 'Inspector', open: async (page) => {
    const button = rail(page).getByRole('button', { name: /^Inspector(,|$)/ })
    await expect(button).toBeEnabled({ timeout: 10_000 })
    await button.click()
    await expect(page.getByRole('region', { name: 'Inspector' })).toBeVisible()
  } },
  { app: 'studio', name: 'Models dialog', open: async (page) => {
    await rail(page).getByRole('button', { name: 'Models', exact: true }).click()
    await page.getByRole('menuitem', { name: /Manage models/ }).click()
    await expect(page.getByRole('dialog', { name: 'Models' })).toBeVisible()
  } },
]

// ─── Measurements ────────────────────────────────────────────────────────────

export type Measurement = { metric: string; value: number; labels?: Record<string, string> }

/** Writes what a test measured where radical sense playwright reads it; a plain run writes nothing. */
export function writeMetrics(file: string, measurements: Measurement[]): void {
  const dir = process.env.RADICAL_METRICS_DIR
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), JSON.stringify({ format: 'radical-metrics', version: 1, source: file, at: new Date().toISOString(), measurements }, null, 1))
}
