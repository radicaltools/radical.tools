// Usability pack, "Link names say where they go" (LINK_TEXT=context,
// WCAG 2.4.4 Link Purpose (In Context)): on no page of the main journeys do
// two links with the same name in the same list item, table row, paragraph
// or card lead to different targets.
//
//   radical sense playwright tests/ux/link-texts.spec.ts --cwd apps/e2e --project ux
//
// writes ux.links.ambiguous{by=name,app}, ux.links.ambiguous{by=context,app}
// and ux.links.vague{app}; the condition is on by=context only (the other
// two are written for information, as the pack's test writes them).
//
// Adapted to radical.tools: SVG links (the site's diagrams) are read too.
import { expect, test, type Page } from '@playwright/test'
import { FIXTURE, HUB_PAGES, SITE_PAGES, STUDIO_PLACES, studioPage, webContext, writeMetrics, type App, type Place } from './journeys'

const VAGUE = /^(click here|here|read more|more|learn more|find out more|details|link|this page|continue reading)$/

/** The decision: no name ambiguous in its context. */
const LIMIT = 0

/**
 * Names ambiguous in their context today, per front end, held as the limit
 * (no worse than today). The product owner decided to change nothing in the
 * UI, so this is reported, not fixed:
 *
 * - site, manual.html: 1. Its Contents list has "Viewpoints" twice, one to
 *   the guide's section (#viewpoints), one to the reference's
 *   (reference.html#viewpoints); only the group labels "Start" and
 *   "Reference" (plain text, not headings) tell them apart.
 */
const TODAY: Record<App, number> = { site: 1, hub: 0, studio: 0 }

type Found = { name: string[]; context: string[]; vague: string[] }

/** The links of the page whose name is ambiguous by name alone, and in its context, and the vague ones. */
async function linkNames(page: Page, label: string): Promise<Found> {
  const links = await page.locator('body').evaluate((body) => {
    const clean = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
    // The accessible name, simplified: aria-labelledby, aria-label, else the text with image alternatives.
    const nameOf = (a: Element): string => {
      const ids = a.getAttribute('aria-labelledby')
      if (ids) return ids.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ')
      const label = a.getAttribute('aria-label')
      if (label) return label
      const copy = a.cloneNode(true) as Element
      copy.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove())
      copy.querySelectorAll('img').forEach((img) => img.replaceWith(img.alt))
      return copy.textContent ?? ''
    }
    return [...body.querySelectorAll<HTMLAnchorElement | SVGAElement>('a[href]')].filter((a) => a.checkVisibility()).map((a) => {
      // An SVG link's href is an SVGAnimatedString (the site's diagrams link their boxes).
      const url = new URL(a instanceof SVGAElement ? a.href.baseVal : a.href, document.baseURI)
      // The context: the table row the link is in, else the nearest list
      // item, paragraph, cell, definition or card. (closest() alone would
      // stop at the cell, and two "View" links in one row would not meet.)
      const context = a.closest('tr, [role="row"]') ?? a.closest('li, td, p, dd, article, [role="listitem"]')
      return { name: clean(nameOf(a)), target: url.origin + url.pathname.replace(/\/(index\.html)?$/, '') + url.search, context: clean(context?.textContent ?? '').slice(0, 200) }
    })
  })
  /** The keys that lead to more than one target. */
  const ambiguousBy = (key: (l: (typeof links)[number]) => string): string[] => {
    const targets = new Map<string, Set<string>>()
    for (const l of links) targets.set(key(l), (targets.get(key(l)) ?? new Set<string>()).add(l.target))
    return [...targets].filter(([, t]) => t.size > 1).map(([k, t]) => `${label}: "${k}" leads to ${[...t].join(', ')}`)
  }
  return {
    name: ambiguousBy((l) => l.name),
    context: ambiguousBy((l) => `${l.name} in "${l.context}"`),
    vague: links.filter((l) => !l.name || VAGUE.test(l.name)).map((l) => `${label}: "${l.name}" to ${l.target}`),
  }
}

async function measure(page: Page, places: Place[]): Promise<Found> {
  const all: Found = { name: [], context: [], vague: [] }
  for (const place of places) {
    await place.open(page)
    const found = await linkNames(page, place.name)
    all.name.push(...found.name)
    all.context.push(...found.context)
    all.vague.push(...found.vague)
  }
  if (process.env.UX_DEBUG) console.log(JSON.stringify(all, null, 1))
  return all
}

function check(app: App, found: Found): void {
  writeMetrics(`link-texts-${app}.json`, [
    { metric: 'ux.links.ambiguous', value: found.name.length, labels: { by: 'name', app } },
    { metric: 'ux.links.ambiguous', value: found.context.length, labels: { by: 'context', app } },
    { metric: 'ux.links.vague', value: found.vague.length, labels: { app } },
  ])
  expect(found.context.length, `one link name, several targets in the same context: ${JSON.stringify(found.context, null, 1)}`).toBeLessThanOrEqual(Math.max(LIMIT, TODAY[app]))
}

test.describe('Link names say where they go', () => {
  test("the site's link names are clear in their context", async ({ browser }, info) => {
    const context = await webContext(browser, info)
    check('site', await measure(await context.newPage(), SITE_PAGES))
    await context.close()
  })

  test("the Hub's link names are clear in their context", async ({ browser }, info) => {
    const context = await webContext(browser, info)
    check('hub', await measure(await context.newPage(), HUB_PAGES))
    await context.close()
  })

  test("Studio's link names are clear in their context", async ({ playwright }, info) => {
    const { page, close } = await studioPage(playwright, info)
    check('studio', await measure(page, STUDIO_PLACES))
    await close()
  })

  test('the same name for two targets in one table row is caught', async ({ browser }, info) => {
    const context = await webContext(browser, info, {
      '/orders': `<!doctype html><html lang="en"><title>Orders</title><body><main><table>
        <tr><th>Order</th><th>Customer</th></tr>
        <tr><td>#1001 <a href="/orders/1001">View</a></td><td>Ada <a href="/customers/7">View</a></td></tr>
        <tr><td>#1002 <a href="/orders/1002">Order #1002</a></td><td>Bob <a href="/customers/8">Bob's account</a></td></tr>
      </table></main></body></html>`,
    })
    const page = await context.newPage()
    await page.goto(`${FIXTURE}/orders`)
    const found = await linkNames(page, '/orders')
    // In the first row "View" leads to the order and to the customer: one
    // name ambiguous in its context, which fails the check.
    expect(found.context).toEqual([`/orders: "view in "#1001 viewada view"" leads to ${FIXTURE}/orders/1001, ${FIXTURE}/customers/7`])
    expect(found.context.length).toBeGreaterThan(LIMIT)
    await context.close()
  })
})
