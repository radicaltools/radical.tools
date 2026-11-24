// Usability pack, "No link target repeated" (LINK_REPEAT=limit,
// MAX_LINK_REPEATS=2): on every page of the main journeys no link target
// appears more than twice in the main content outside its navigation.
//
//   radical sense playwright tests/ux/links-repeated.spec.ts --cwd apps/e2e --project ux
//
// writes ux.links.repeated{app,page} (the most times one target is linked on
// the page) and ux.links.repeated.max{app} and ux.links.repeated.max (the
// largest of all).
//
// Adapted to radical.tools: the main content is the page's main landmark
// where it has one (the site); the Hub and Studio have none, so there it is
// the whole page without its banner, navigation and contentinfo.
import { expect, test, type Page } from '@playwright/test'
import { FIXTURE, HUB_PAGES, SITE_PAGES, STUDIO_PLACES, studioPage, webContext, writeMetrics, type App, type Measurement, type Place } from './journeys'

/** The decision: how often one target may be linked in a page's main content. */
const LIMIT = 2

/**
 * Pages over the limit today, each held to its count today (no worse than
 * today). The product owner decided to change nothing in the UI, so these
 * are reported, not fixed. All four are links into the documentation: a
 * target is the page without its #fragment (as the pack counts it), so
 * links to different sections of the manual count as one target. Counted
 * with the fragment, index.html, reference.html and usecases.html still link
 * one section 3 times (manual.html#cli, #federation, #mcp), manual.html none
 * more than twice.
 */
const TODAY: Record<string, number> = {
  'site /': 10,                  // manual.html (its sections)
  'site /manual.html': 13,       // reference.html (its sections)
  'site /reference.html': 6,     // manual.html (its sections)
  'site /usecases.html': 26,     // manual.html (its sections, from every use case)
}

type Found = { app: App; page: string; href: string; times: number }

/** The target linked most often in the page's main content, and how often. */
async function mostRepeated(page: Page): Promise<{ href: string; times: number }> {
  const counts = await page.evaluate(() => {
    const main = document.querySelector('main') ?? document.body
    const times: Record<string, number> = {}
    for (const a of main.querySelectorAll<HTMLAnchorElement | SVGAElement>('a[href]')) {
      // breadcrumbs, tables of contents, the shared header and footer, hidden links
      if (a.closest('nav, [role="navigation"], header, footer, [role="banner"], [role="contentinfo"]') || !a.checkVisibility()) continue
      // An SVG link's href is an SVGAnimatedString (the site's diagrams link their boxes).
      const url = new URL(a instanceof SVGAElement ? a.href.baseVal : a.href, document.baseURI)
      if (url.origin + url.pathname === location.origin + location.pathname && url.hash) continue   // skip links, in-page links
      const target = url.origin + url.pathname.replace(/\/(index\.html)?$/, '') + url.search   // a folder and its index.html are one page
      times[target] = (times[target] ?? 0) + 1
    }
    return times
  })
  const [href, times] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? ['', 0]
  return { href, times }
}

async function measure(page: Page, places: Place[]): Promise<Found[]> {
  const found: Found[] = []
  for (const place of places) {
    await place.open(page)
    found.push({ app: place.app, page: place.name, ...(await mostRepeated(page)) })
  }
  if (process.env.UX_DEBUG) console.log(JSON.stringify(found, null, 1))
  return found
}

/** Writes the front end's measurements and holds each page to the limit (or to today's count). */
function check(app: App, found: Found[]): void {
  const measurements: Measurement[] = [
    ...found.map((p) => ({ metric: 'ux.links.repeated', value: p.times, labels: { app, page: p.page } })),
    { metric: 'ux.links.repeated.max', value: Math.max(0, ...found.map((p) => p.times)), labels: { app } },
  ]
  writeMetrics(`links-repeated-${app}.json`, measurements)
  for (const p of found) {
    expect.soft(p.times, `${app} ${p.page} links to ${p.href} ${p.times} times`).toBeLessThanOrEqual(TODAY[`${app} ${p.page}`] ?? LIMIT)
  }
}

test.describe('No link target repeated', () => {
  test("the site's pages stay within the link repeat limit", async ({ browser }, info) => {
    const context = await webContext(browser, info)
    check('site', await measure(await context.newPage(), SITE_PAGES))
    await context.close()
  })

  test("the Hub's routes stay within the link repeat limit", async ({ browser }, info) => {
    const context = await webContext(browser, info)
    check('hub', await measure(await context.newPage(), HUB_PAGES))
    await context.close()
  })

  test("Studio's places stay within the link repeat limit", async ({ playwright }, info) => {
    const { page, close } = await studioPage(playwright, info)
    check('studio', await measure(page, STUDIO_PLACES))
    await close()
  })

  test('the same link five times on a page is caught', async ({ browser }, info) => {
    const link = '<a href="/pricing">see the prices</a>'
    const context = await webContext(browser, info, {
      '/five': `<!doctype html><html lang="en"><title>Five</title><body>
        <header><nav><a href="/pricing">Pricing</a></nav></header>
        <main>
          <nav aria-label="Breadcrumb"><a href="/pricing">Pricing</a></nav>
          <a href="#content">Skip to content</a>
          <p>Plans differ: ${link}.</p><p>Teams: ${link}.</p><ul><li>${link}</li><li>${link}</li></ul><p>Or ${link}.</p>
          <p><a href="/about">About us</a></p>
        </main>
        <footer><a href="/pricing">Pricing</a></footer>
      </body></html>`,
    })
    const page = await context.newPage()
    const found = await measure(page, [{ app: 'site', name: '/five', open: async (p) => { await p.goto(`${FIXTURE}/five`) } }])
    // 5 in the text; the header, the breadcrumb and the footer are not counted.
    expect(found).toEqual([{ app: 'site', page: '/five', href: `${FIXTURE}/pricing`, times: 5 }])
    expect(found[0].times).toBeGreaterThan(LIMIT)
    await context.close()
  })
})
