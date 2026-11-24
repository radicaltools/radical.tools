---
id: "4dabc3ca-84ee-4081-8ded-6aea912acc88"
type: "fitness-fn"
label: "No link target repeated"
cadence: "triggered"
characteristic: "interaction-capability"
invocation: "automated"
scope: "holistic"
trigger: "pull-request"
---

A Playwright test opens each page of the main journeys (PAGES in tests/ux/journeys.ts) and counts, inside the main landmark, the visible links to each target (origin, path and query; in-page links such as skip links and an error summary's left out, and so are links inside a nav: breadcrumbs, a table of contents). It writes the largest count of each page as ux.links.repeated{page=…} and the largest of all as ux.links.repeated.max, and fails on a page over the limit, naming the target. The header, navigation and footer are left out on purpose: the same link in the navigation and once in the text is expected. Bind it with the sensor radical sense playwright tests/ux/links-repeated.spec.ts and the condition ux.links.repeated.max <= 2.

Threshold: ux.links.repeated.max <= 2: on every page of the main journeys, no link target appears more than 2 times in the main content outside its navigation (the same link 5 times on a page measures 5 and fails)

Tool: Playwright (@playwright/test), measured by radical sense playwright

```ts
// tests/ux/links-repeated.spec.ts: a plain Playwright test (1.50 or later), or measured with
//   radical sense playwright tests/ux/links-repeated.spec.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { PAGES } from './journeys'   // [{ path: '/' }, { path: '/pricing' }, …]: the main journeys' pages

const LIMIT = 2   // the decision: how often one target may be linked in a page's main content

type Measurement = { metric: string; value: number; labels?: Record<string, string> }
/** Writes what the test measured where radical sense playwright reads it; a plain run writes nothing. */
function writeMetrics(file: string, measurements: Measurement[]): void {
  const dir = process.env.RADICAL_METRICS_DIR
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), JSON.stringify({ format: 'radical-metrics', version: 1, source: file, at: new Date().toISOString(), measurements }, null, 1))
}

test('no link target repeats in the main content', async ({ page }) => {
  const found: Array<{ path: string; href: string; times: number }> = []
  for (const { path } of PAGES) {
    await page.goto(path)
    const counts = await page.locator('main').first().evaluate((main) => {
      const times: Record<string, number> = {}
      for (const a of main.querySelectorAll<HTMLAnchorElement>('a[href]')) {
        if (a.closest('nav, [role="navigation"]') || !a.checkVisibility()) continue   // breadcrumbs, tables of contents, hidden links
        const url = new URL(a.href)
        if (url.origin + url.pathname === location.origin + location.pathname && url.hash) continue   // skip links, error summaries
        const target = url.origin + url.pathname.replace(/\/$/, '') + url.search
        times[target] = (times[target] ?? 0) + 1
      }
      return times
    })
    const [href, times] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? ['', 0]
    found.push({ path, href, times })
  }
  writeMetrics('links-repeated.json', [
    ...found.map((p) => ({ metric: 'ux.links.repeated', value: p.times, labels: { page: p.path } })),
    { metric: 'ux.links.repeated.max', value: Math.max(0, ...found.map((p) => p.times)) },
  ])
  for (const p of found) expect.soft(p.times, `${p.path} links to ${p.href} ${p.times} times`).toBeLessThanOrEqual(LIMIT)
})
```
