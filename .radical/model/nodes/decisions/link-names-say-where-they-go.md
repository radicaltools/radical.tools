---
id: "4afeef62-f0ca-40f8-9d49-16d74a3ac1b4"
type: "fitness-fn"
label: "Link names say where they go"
cadence: "triggered"
characteristic: "interaction-capability"
invocation: "automated"
scope: "holistic"
trigger: "pull-request"
---

A Playwright test opens each page of the main journeys and reads every visible link: its accessible name (simplified: aria-labelledby, aria-label, else its text with image alternatives, aria-hidden parts left out), its target, and its context (the text of the list item, table row, cell, paragraph, definition or article around it). It writes ux.links.ambiguous{by=name} (names on a page that lead to more than one target), ux.links.ambiguous{by=context} (the same, counted by name and context together) and ux.links.vague (links whose whole name is a generic phrase, or empty), and fails on a name that is ambiguous within its context. Bind it with radical sense playwright tests/ux/link-texts.spec.ts and the condition ux.links.ambiguous{by=context} <= 0. Extend VAGUE with the generic phrases of your language.

Threshold: ux.links.ambiguous{by=context} = 0: on no page of the main journeys do two links with the same name in the same list item, table row, paragraph or card lead to different targets

Tool: Playwright (@playwright/test), measured by radical sense playwright

```ts
// tests/ux/link-texts.spec.ts: a plain Playwright test (1.50 or later), or measured with
//   radical sense playwright tests/ux/link-texts.spec.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { PAGES } from './journeys'   // the main journeys' pages

const VAGUE = /^(click here|here|read more|more|learn more|find out more|details|link|this page|continue reading)$/

type Measurement = { metric: string; value: number; labels?: Record<string, string> }
/** Writes what the test measured where radical sense playwright reads it; a plain run writes nothing. */
function writeMetrics(file: string, measurements: Measurement[]): void {
  const dir = process.env.RADICAL_METRICS_DIR
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), JSON.stringify({ format: 'radical-metrics', version: 1, source: file, at: new Date().toISOString(), measurements }, null, 1))
}

test('link names say where they go', async ({ page }) => {
  const ambiguous = { name: [] as string[], context: [] as string[] }
  const vague: string[] = []
  for (const { path } of PAGES) {
    await page.goto(path)
    const links = await page.locator('body').evaluate((body) => {
      const clean = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
      // The accessible name, simplified: aria-labelledby, aria-label, else the text with image alternatives.
      const nameOf = (a: HTMLAnchorElement): string => {
        const ids = a.getAttribute('aria-labelledby')
        if (ids) return ids.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ')
        const label = a.getAttribute('aria-label')
        if (label) return label
        const copy = a.cloneNode(true) as HTMLElement
        copy.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove())
        copy.querySelectorAll('img').forEach((img) => img.replaceWith(img.alt))
        return copy.textContent ?? ''
      }
      return [...body.querySelectorAll<HTMLAnchorElement>('a[href]')].filter((a) => a.checkVisibility()).map((a) => {
        const url = new URL(a.href)
        const context = a.closest('li, tr, td, p, dd, article, [role="listitem"], [role="row"]')
        return { name: clean(nameOf(a)), target: url.origin + url.pathname.replace(/\/$/, '') + url.search, context: clean(context?.textContent ?? '').slice(0, 200) }
      })
    })
    /** The keys that lead to more than one target. */
    const ambiguousBy = (key: (l: (typeof links)[number]) => string): string[] => {
      const targets = new Map<string, Set<string>>()
      for (const l of links) targets.set(key(l), (targets.get(key(l)) ?? new Set<string>()).add(l.target))
      return [...targets].filter(([, t]) => t.size > 1).map(([k, t]) => `${path}: "${k}" leads to ${[...t].join(', ')}`)
    }
    ambiguous.name.push(...ambiguousBy((l) => l.name))
    ambiguous.context.push(...ambiguousBy((l) => `${l.name} in "${l.context}"`))
    vague.push(...links.filter((l) => !l.name || VAGUE.test(l.name)).map((l) => `${path}: "${l.name}" to ${l.target}`))
  }
  writeMetrics('link-texts.json', [
    { metric: 'ux.links.ambiguous', value: ambiguous.name.length, labels: { by: 'name' } },
    { metric: 'ux.links.ambiguous', value: ambiguous.context.length, labels: { by: 'context' } },
    { metric: 'ux.links.vague', value: vague.length },
  ])
  expect.soft(ambiguous.context, 'one link name, several targets in the same context').toEqual([])
})
```
