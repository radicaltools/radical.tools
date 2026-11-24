// Usability pack, "Navigation the same on every page" (NAVIGATION=shared):
// every page of a front end's main journeys shows the same header,
// navigation and footer: the same links and buttons, in the same order,
// under the same names (WCAG 3.2.3 Consistent Navigation).
//
//   radical sense playwright tests/ux/navigation.spec.ts --cwd apps/e2e --project ux
//
// writes ux.nav.variants{nav=global,app=<site|hub|studio>}: the number of
// different navigation sets seen on the front end's pages (1 when all match).
//
// Adapted to radical.tools: the site and the Hub share one header (banner),
// whose navigation has no name, so the parts read are the banner and the
// contentinfo (footer); Studio has no banner, so its parts are the activity
// rail (navigation "Activity bar") and the toolbar.
import { expect, test, type Locator, type Page } from '@playwright/test'
import { FIXTURE, HUB_PAGES, SITE_PAGES, STUDIO_PLACES, studioPage, webContext, writeMetrics, type App, type Place } from './journeys'

/** What a front end's navigation is made of. */
const PARTS: Record<App, (page: Page) => Locator[]> = {
  site: (page) => [page.getByRole('banner'), page.getByRole('contentinfo')],
  hub: (page) => [page.getByRole('banner'), page.getByRole('contentinfo')],
  studio: (page) => [page.getByRole('navigation', { name: 'Activity bar', exact: true }), page.locator('.toolbar')],
}

/**
 * The most navigation sets a front end may show today. The product owner
 * decided to change nothing in the UI, so where today's pages differ, today's
 * count is the limit (no worse than today) and the finding is reported:
 *
 * - site: 3 sets. The header is the same on every page; the footers differ.
 *   index.html, usecases.html and blog/ list Studio, Hub, Use cases, Blog,
 *   Guide, Reference, GitHub; manual.html lists Home, Use cases, Blog,
 *   Reference, Studio, Hub, GitHub (no Guide, another order); reference.html
 *   Home, Use cases, Blog, Guide, Studio, Hub, GitHub (no Reference).
 * - hub: 2 sets. The landing page has a footer (hub-landing-footer); the
 *   catalogue, a group and a pack have none.
 */
const TODAY: Record<App, number> = { site: 3, hub: 2, studio: 1 }

/** The links and buttons of a part, in order, by element, name and target path. */
async function itemsOf(part: Locator): Promise<string> {
  if (!(await part.count())) return '(none)'
  return part.first().evaluate((el) => [...el.querySelectorAll<HTMLElement>('a[href], button')]
    .filter((x) => x.checkVisibility() && !x.closest('[data-ux-varies]'))
    // What follows a comma in a name is the item's state, not the item
    // (Studio's rail: "Views, 36", "Inspector, 2 errors"): the same item in
    // another state is the same item.
    .map((x) => [x.tagName, (x.getAttribute('aria-label') ?? x.textContent ?? '').replace(/\s+/g, ' ').trim().replace(/,.*$/, ''), x instanceof HTMLAnchorElement ? new URL(x.href).pathname.replace(/\/index\.html$/, '/') : ''].join(' '))
    .join('\n'))
}

/** The navigation sets seen on `places`, each with the pages that show it. */
async function navigationSets(page: Page, app: App, places: Place[]): Promise<Map<string, string[]>> {
  const sets = new Map<string, string[]>()
  for (const place of places) {
    await place.open(page)
    const items = (await Promise.all(PARTS[app](page).map(itemsOf))).join('\n|\n')
    sets.set(items, [...(sets.get(items) ?? []), place.name])
  }
  return sets
}

/** Measures one front end, writes its metric and holds it to the limit. */
function check(app: App, sets: Map<string, string[]>): void {
  if (process.env.UX_DEBUG) console.log(app, JSON.stringify([...sets], null, 1))
  writeMetrics(`navigation-${app}.json`, [{ metric: 'ux.nav.variants', value: sets.size, labels: { nav: 'global', app } }])
  expect(sets.size, `${app}: pages per navigation set: ${JSON.stringify([...sets.values()])}`).toBeLessThanOrEqual(TODAY[app])
}

test.describe('Navigation the same on every page', () => {
  test("the site's pages keep one navigation", async ({ browser }, info) => {
    const context = await webContext(browser, info)
    check('site', await navigationSets(await context.newPage(), 'site', SITE_PAGES))
    await context.close()
  })

  test("the Hub's routes keep one navigation", async ({ browser }, info) => {
    const context = await webContext(browser, info)
    check('hub', await navigationSets(await context.newPage(), 'hub', HUB_PAGES))
    await context.close()
  })

  test("Studio's places keep one navigation", async ({ playwright }, info) => {
    const { page, close } = await studioPage(playwright, info)
    check('studio', await navigationSets(page, 'studio', STUDIO_PLACES))
    await close()
  })

  test('a page whose navigation differs is caught and named', async ({ browser }, info) => {
    const header = '<header><nav><a href="/">Home</a> <a href="/docs">Docs</a> <a href="/blog">Blog</a></nav></header>'
    const footer = (links: string) => `<footer>${links}</footer>`
    const page = (body: string) => `<!doctype html><html lang="en"><title>Page</title><body>${header}<main><p>Text.</p></main>${body}</body></html>`
    const context = await webContext(browser, info, {
      '/a': page(footer('<a href="/docs">Docs</a> <a href="/blog">Blog</a>')),
      '/b': page(footer('<a href="/docs">Docs</a> <a href="/blog">Blog</a>')),
      '/c': page(footer('<a href="/blog">Blog</a> <a href="/docs">Guide</a>')),   // another order, another name
    })
    const places: Place[] = ['/a', '/b', '/c'].map((path) => ({ app: 'site', name: path, open: async (p) => { await p.goto(`${FIXTURE}${path}`) } }))
    const sets = await navigationSets(await context.newPage(), 'site', places)
    expect(sets.size).toBe(2)
    expect([...sets.values()]).toContainEqual(['/c'])
    await context.close()
  })
})
