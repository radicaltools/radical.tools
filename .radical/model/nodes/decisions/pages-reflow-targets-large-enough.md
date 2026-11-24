---
id: "89100b5b-964b-42b7-ac74-f20a84cee6cc"
type: "fitness-fn"
label: "Pages reflow, targets large enough"
cadence: "triggered"
characteristic: "interaction-capability"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

A Playwright test opens each main page in four viewports (320 CSS px wide, the width of a 1280 px window at 400% zoom; iPhone 15 and Pixel 7 as Playwright emulates them, with touch; Desktop Chrome) and measures how far the page scrolls sideways and which pointer targets are smaller than 24 × 24 CSS px, applying the exceptions of WCAG 2.5.8: a link inside a sentence, an input with a label of the size (its equivalent), and the spacing rule. It judges nothing: it lists what it found in the test report and, when radical sense playwright runs it, writes ux.mobile.overflow_px.max (px, the worst page and viewport) and ux.mobile.small_targets (a count over every page and viewport) as radical-metrics/1 into RADICAL_METRICS_DIR, so the model's conditions decide. Run it in a Chromium project (Firefox does not emulate isMobile). Content hidden with overflow-x: hidden does not scroll and is not seen here; a two-dimensional part (a map, a wide table) belongs in its own scroll container, which the page's width does not count.

Threshold: On every main page, in a 320 CSS px window, on iPhone 15, on Pixel 7 and on a 1280 px desktop: 0 px of horizontal scrolling, and 0 pointer targets under 24 × 24 CSS px that are not inside a sentence, labelled by a large enough label, or spaced so that a 24 px circle around them touches no other target. Once the measure line "playwright tests/mobile-layout.spec.ts --project chromium" is added to this fitness function (a pack cannot know the project's tests), its conditions are: ux.mobile.overflow_px.max <= 0 px, and ux.mobile.small_targets <= 0

Tool: Playwright (@playwright/test 1.5x or later)

```ts
// tests/mobile-layout.spec.ts: measures; the model's conditions judge
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { devices, test, type BrowserContextOptions } from '@playwright/test'

const PAGES = ['/', '/search', '/checkout']   // the main pages
const MIN = 24                                 // the target size decided, in CSS px
const VIEWPORTS: Record<string, BrowserContextOptions> = {
  '320 px (400% zoom)': { viewport: { width: 320, height: 640 } },
  'iPhone 15': devices['iPhone 15'],
  'Pixel 7': devices['Pixel 7'],
  'desktop': devices['Desktop Chrome'],
}
const TARGETS = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=checkbox], [role=radio], [role=switch], [role=tab], [role=menuitem], [tabindex]:not([tabindex="-1"])'

test('main pages reflow and their targets are large enough', async ({ browser }, testInfo) => {
  let overflow = 0
  let small = 0
  for (const [name, options] of Object.entries(VIEWPORTS)) {
    const context = await browser.newContext({ ...options, baseURL: testInfo.project.use.baseURL })
    const page = await context.newPage()
    for (const path of PAGES) {
      await page.goto(path)
      await page.evaluate(() => document.fonts.ready)
      const width = page.viewportSize()!.width
      const found = await page.evaluate(({ min, width, selector }) => {
        const sideways = Math.max(0, document.documentElement.scrollWidth - width)
        const targets = [...document.querySelectorAll<HTMLElement>(selector)].filter((el) => el.checkVisibility() && !el.closest('[inert]'))
        const boxes = targets.map((el) => el.getBoundingClientRect())
        const under = (r: DOMRect) => r.width < min || r.height < min
        const centre = (r: DOMRect) => [r.x + r.width / 2, r.y + r.height / 2]
        // WCAG 2.5.8 exceptions: inline in a sentence; an input whose label is large enough
        const exempt = (el: HTMLElement) =>
          (getComputedStyle(el).display === 'inline' && (el.parentElement?.textContent ?? '').trim().length > (el.textContent ?? '').trim().length)
          || [...((el as HTMLInputElement).labels ?? [])].some((l) => !under(l.getBoundingClientRect()))
        const fails = targets.flatMap((el, i) => {
          const r = boxes[i]
          if (!under(r) || exempt(el)) return []
          // spacing: a circle of diameter MIN on its centre touches no other target and no other small target's circle
          const [x, y] = centre(r)
          const crowded = boxes.some((o, j) => j !== i && !targets[j].contains(el) && !el.contains(targets[j])
            && (Math.hypot(Math.max(o.left - x, 0, x - o.right), Math.max(o.top - y, 0, y - o.bottom)) < min / 2
              || (under(o) && Math.hypot(centre(o)[0] - x, centre(o)[1] - y) < min)))
          const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)
          return crowded ? [el.tagName.toLowerCase() + ' "' + name + '" ' + Math.round(r.width) + '×' + Math.round(r.height)] : []
        })
        return { sideways, fails }
      }, { min: MIN, width, selector: TARGETS })
      overflow = Math.max(overflow, found.sideways)
      small += found.fails.length
      if (found.sideways) testInfo.annotations.push({ type: 'scrolls sideways', description: name + ' ' + path + ': ' + found.sideways + ' px' })
      for (const f of found.fails) testInfo.annotations.push({ type: 'small target', description: name + ' ' + path + ': ' + f })
    }
    await context.close()
  }
  const dir = process.env.RADICAL_METRICS_DIR   // set by radical sense playwright
  if (dir) writeFileSync(join(dir, 'mobile-layout.json'), JSON.stringify({
    format: 'radical-metrics', version: 1, source: 'mobile-layout.spec.ts', at: new Date().toISOString(),
    measurements: [
      { metric: 'ux.mobile.overflow_px.max', value: overflow, unit: 'px' },
      { metric: 'ux.mobile.small_targets', value: small },
    ],
  }))
})
```
