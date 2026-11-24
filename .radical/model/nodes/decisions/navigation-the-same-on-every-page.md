---
id: "a5f1e099-e069-4eaf-8243-fe4bf80f49a9"
type: "fitness-fn"
label: "Navigation the same on every page"
cadence: "triggered"
characteristic: "interaction-capability"
invocation: "automated"
scope: "holistic"
trigger: "pull-request"
---

A Playwright test opens each page of the main journeys and reads, in order, the links and buttons of the banner landmark, of the navigation named "Main" and of the contentinfo landmark: element, name and target path. The current page's mark (aria-current) is not part of it, and neither is anything inside an element marked data-ux-varies, for what changes on purpose (a basket count, the signed-in name). It writes ux.nav.variants{nav=global}, the number of different sets seen (1 when every page shows the same), and fails above 1, listing the pages of each set. Bind it with radical sense playwright tests/ux/navigation.spec.ts and the condition ux.nav.variants <= 1.

Threshold: ux.nav.variants{nav=global} = 1: every page of the main journeys shows one and the same header, navigation and footer: the same links and buttons in the same order under the same names

Tool: Playwright (@playwright/test), measured by radical sense playwright

```ts
// tests/ux/navigation.spec.ts: a plain Playwright test (1.50 or later), or measured with
//   radical sense playwright tests/ux/navigation.spec.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Locator } from '@playwright/test'
import { PAGES } from './journeys'   // [{ path: '/orders' }, …]

const MAIN_NAV = 'Main'          // the aria-label of the shared navigation

type Measurement = { metric: string; value: number; labels?: Record<string, string> }
/** Writes what the test measured where radical sense playwright reads it; a plain run writes nothing. */
function writeMetrics(file: string, measurements: Measurement[]): void {
  const dir = process.env.RADICAL_METRICS_DIR
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), JSON.stringify({ format: 'radical-metrics', version: 1, source: file, at: new Date().toISOString(), measurements }, null, 1))
}

/** The links and buttons of a part, in order, by element, name and target path. */
async function itemsOf(part: Locator): Promise<string> {
  if (!(await part.count())) return '(none)'
  return part.first().evaluate((el) => [...el.querySelectorAll<HTMLElement>('a[href], button')]
    .filter((x) => x.checkVisibility() && !x.closest('[data-ux-varies]'))
    .map((x) => [x.tagName, (x.getAttribute('aria-label') ?? x.textContent ?? '').replace(/\s+/g, ' ').trim(), x instanceof HTMLAnchorElement ? new URL(x.href).pathname : ''].join(' '))
    .join('\n'))
}

/** Adds a page to the set it shows. */
const add = (sets: Map<string, string[]>, items: string, path: string) => sets.set(items, [...(sets.get(items) ?? []), path])

test('every page shows the same navigation', async ({ page }) => {
  const global = new Map<string, string[]>()
  for (const { path } of PAGES) {
    await page.goto(path)
    const parts = [page.getByRole('banner'), page.getByRole('navigation', { name: MAIN_NAV, exact: true }), page.getByRole('contentinfo')]
    add(global, (await Promise.all(parts.map(itemsOf))).join('\n|\n'), path)
  }
  writeMetrics('navigation.json', [
    { metric: 'ux.nav.variants', value: global.size, labels: { nav: 'global' } },
  ])
  expect.soft(global.size, `pages per navigation: ${JSON.stringify([...global.values()])}`).toBe(1)
})
```
