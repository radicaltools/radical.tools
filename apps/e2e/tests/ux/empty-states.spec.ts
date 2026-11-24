// Usability pack, "Empty views explain themselves" (EMPTY=plain): every view
// that starts empty for a new account says so in at least three words
// besides its headings and table headers.
//
//   radical sense playwright tests/ux/empty-states.spec.ts --cwd apps/e2e --project ux
//
// writes ux.empty.silent{app} (views that say nothing) and, for
// information, ux.empty.dead_ends{app} (views without a link or button).
//
// Adapted to radical.tools: there are no accounts. A "new account" is a
// model just made with New model (Studio keeps models in the browser), and
// a fresh visit to the Hub; the site has nothing that starts empty. Studio
// and the Hub have no main landmark, so each view names the region it draws
// in. Words are the visible ones (React Flow's hidden keyboard help is not
// read) with at least one letter (a "+" is not a word), and a canvas view's
// caption ("Structure: All elements") is its heading.
import { expect, test, type Locator, type Page } from '@playwright/test'
import { FIXTURE, HUB, STUDIO, settle, webContext, writeMetrics, type App } from './journeys'

interface EmptyView {
  app: App
  name: string
  /** Opens the view, empty, and returns the region its content is drawn in. */
  open: (page: Page) => Promise<Locator>
}

/** A model just made: New model, with the metamodel's views (the default). */
async function newModel(page: Page): Promise<void> {
  await page.goto(`${STUDIO}/`)
  await page.getByRole('button', { name: 'New model' }).click()
  await page.getByRole('button', { name: 'Create model' }).click()
  await expect(page.locator('.app-layout')).toBeVisible()
  await settle(page)
}

/** Opens one of the new model's views by its card in the Views panel. */
async function view(page: Page, name: string, kind: string): Promise<void> {
  await page.locator('.lp-view-card').filter({ hasText: new RegExp(`^${name}0 nodes${kind}`) }).first().click()
  await settle(page)
}

export const EMPTY_VIEWS: EmptyView[] = [
  { app: 'studio', name: 'All elements (table)', open: async (page) => {
    await newModel(page)   // a new model opens on it
    await expect(page.locator('.tv-empty')).toBeVisible()
    return page.locator('.tv-wrap')
  } },
  { app: 'studio', name: 'All elements (structure)', open: async (page) => {
    await newModel(page)
    await view(page, 'All elements', 'structure')
    await expect(page.locator('.canvas-view-caption')).toContainText('All elements')
    return page.locator('.canvas-area')
  } },
  { app: 'studio', name: 'Specification (wiki)', open: async (page) => {
    await newModel(page)
    await view(page, 'Specification', 'wiki')
    const article = page.getByRole('article').first()   // the wiki: one article per page
    await expect(article.getByRole('heading', { name: 'Overview' })).toBeVisible()
    return article
  } },
  { app: 'studio', name: 'Presentations', open: async (page) => {
    await newModel(page)
    await page.getByRole('navigation', { name: 'Activity bar' }).getByRole('button', { name: /^Presentations(,|$)/ }).click()
    await expect(page.locator('.pres-place')).toBeVisible()
    return page.locator('.pres-place')
  } },
  { app: 'hub', name: 'search without a result', open: async (page) => {
    await page.goto(`${HUB}/#/browse`)
    await expect(page.getByText('Authentication', { exact: true })).toBeVisible()   // the catalogue has loaded
    await page.getByPlaceholder('Search concepts…').fill('zzzzqx')
    await expect(page.getByText('Authentication', { exact: true })).toHaveCount(0)
    await expect(page.locator('.hub-list-msg')).toBeVisible()
    return page.locator('.hub-list')
  } },
]

/**
 * Silent views today, held as the limit (no worse than today). The product
 * owner decided to change nothing in the UI, so these are reported, not
 * fixed:
 *
 * - Studio, All elements (structure) of a new model: an empty canvas under
 *   its caption "Structure: All elements", no word at all, and no button
 *   in it (the palette beside it is how to add one). The other structure
 *   views of a new model look the same.
 *
 * (The All elements table of a new model passes on a thin margin: "No
 * nodes." is 2 words, its "+ Add element" button makes 4.)
 */
const TODAY: Record<App, number> = { site: 0, hub: 0, studio: 1 }

type Found = { silent: string[]; deadEnds: string[] }

/** The words a region shows besides its headings, and its links and buttons. */
const read = (region: Locator) => region.first().evaluate((main) => {
  const skip = 'h1, h2, h3, h4, h5, h6, [role="heading"], th, [role="columnheader"], nav, script, style, [aria-hidden="true"], .canvas-view-caption'
  const words: string[] = []
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const parent = text.parentElement
    if (!parent || parent.closest(skip) || !parent.checkVisibility()) continue
    words.push(...(text.textContent ?? '').split(/\s+/).filter((w) => /\p{L}/u.test(w)))
  }
  const actions = [...main.querySelectorAll<HTMLElement>('a[href], button')].filter((x) => !x.closest('nav') && x.checkVisibility())
  return { words, actions: actions.length }
})

/** Opens each empty view in a page of its own and counts the silent ones. */
async function measure(newPage: () => Promise<Page>, views: EmptyView[]): Promise<Found> {
  const found: Found = { silent: [], deadEnds: [] }
  for (const v of views) {
    const page = await newPage()
    const shown = await read(await v.open(page))
    if (process.env.UX_DEBUG) console.log(v.name, JSON.stringify(shown))
    if (shown.words.length < 3) found.silent.push(v.name)
    if (!shown.actions) found.deadEnds.push(v.name)
    await page.close()
  }
  return found
}

test.describe('Empty views explain themselves', () => {
  for (const app of ['studio', 'hub'] as const) {
    test(`${app === 'studio' ? 'Studio' : 'the Hub'}: views that start empty say so`, async ({ browser }, info) => {
      const context = await webContext(browser, info, {}, { studioSetUp: app === 'studio' })
      const found = await measure(() => context.newPage(), EMPTY_VIEWS.filter((v) => v.app === app))
      writeMetrics(`empty-states-${app}.json`, [
        { metric: 'ux.empty.silent', value: found.silent.length, labels: { app } },
        { metric: 'ux.empty.dead_ends', value: found.deadEnds.length, labels: { app } },
      ])
      expect(found.silent.length, `empty views that say nothing: ${found.silent.join(', ')}`).toBeLessThanOrEqual(TODAY[app])
      await context.close()
    })
  }

  test('a new account sees a message, and a view that says nothing is caught', async ({ browser }, info) => {
    const page = (list: string) => `<!doctype html><html lang="en"><title>Orders</title><body><main>
      <h1>Orders</h1><table><tr><th>Order</th><th>Date</th></tr></table>${list}
    </main></body></html>`
    const context = await webContext(browser, info, {
      '/orders': page('<p>You have no orders yet.</p>'),
      '/silent': page('<p>None</p>'),
    })
    const fixture = (path: string): EmptyView => ({ app: 'site', name: path, open: async (p) => {
      await p.goto(`${FIXTURE}${path}`)
      return p.getByRole('main')
    } })
    expect(await measure(() => context.newPage(), [fixture('/orders'), fixture('/silent')])).toEqual({ silent: ['/silent'], deadEnds: ['/orders', '/silent'] })
    await context.close()
  })
})
