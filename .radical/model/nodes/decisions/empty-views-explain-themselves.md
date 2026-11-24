---
id: "b524d3b8-4e48-4e63-ba30-1b0c38d96bbf"
type: "fitness-fn"
label: "Empty views explain themselves"
cadence: "triggered"
characteristic: "interaction-capability"
invocation: "automated"
scope: "holistic"
trigger: "pull-request"
---

A Playwright test signs in as a freshly registered account with no data (a storageState the test setup writes) and opens each view that starts empty (EMPTY_VIEWS in tests/ux/journeys.ts: lists, tables, searches without a result, dashboards). It counts ux.empty.silent, views whose main content holds fewer than three words besides headings and table headers, and ux.empty.dead_ends, views without a visible link or button in the main content outside its navigation, and fails on a silent view. Bind it with radical sense playwright tests/ux/empty-states.spec.ts and the condition ux.empty.silent <= 0.

Threshold: ux.empty.silent = 0: every view that starts empty for a new account says so in at least three words besides its headings and table headers

Tool: Playwright (@playwright/test), measured by radical sense playwright

```ts
// tests/ux/empty-states.spec.ts: a plain Playwright test (1.50 or later), or measured with
//   radical sense playwright tests/ux/empty-states.spec.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { EMPTY_VIEWS } from './journeys'   // [{ path: '/orders' }, { path: '/search?q=zzzz' }, …]

test.use({ storageState: 'tests/ux/.auth/new-account.json' })   // a freshly registered account with no data

type Measurement = { metric: string; value: number; labels?: Record<string, string> }
/** Writes what the test measured where radical sense playwright reads it; a plain run writes nothing. */
function writeMetrics(file: string, measurements: Measurement[]): void {
  const dir = process.env.RADICAL_METRICS_DIR
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), JSON.stringify({ format: 'radical-metrics', version: 1, source: file, at: new Date().toISOString(), measurements }, null, 1))
}

test('empty views say why they are empty', async ({ page }) => {
  const silent: string[] = [], deadEnds: string[] = []
  for (const { path } of EMPTY_VIEWS) {
    await page.goto(path)
    const view = await page.getByRole('main').evaluate((main) => {
      const copy = main.cloneNode(true) as HTMLElement
      copy.querySelectorAll('h1, h2, h3, h4, h5, h6, th, nav, script, style, [aria-hidden="true"]').forEach((el) => el.remove())
      const actions = [...main.querySelectorAll<HTMLElement>('a[href], button')].filter((x) => !x.closest('nav') && x.checkVisibility())
      return { words: (copy.textContent ?? '').split(/\s+/).filter(Boolean).length, actions: actions.length }
    })
    if (view.words < 3) silent.push(path)
    if (!view.actions) deadEnds.push(path)
  }
  writeMetrics('empty-states.json', [
    { metric: 'ux.empty.silent', value: silent.length },
    { metric: 'ux.empty.dead_ends', value: deadEnds.length },
  ])
  expect.soft(silent, 'empty views that say nothing').toEqual([])
})
```
