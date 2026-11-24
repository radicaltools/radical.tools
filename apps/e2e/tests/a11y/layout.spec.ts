// Pages reflow, targets large enough (Mobile and perceived performance pack,
// TOUCH = 24; scenarios "No sideways scrolling" and "Small icon button
// caught"): the main pages of Studio, the Hub and the site in a 320 CSS px
// window (a 1280 px window at 400% zoom), on iPhone 15 and Pixel 7 as
// Playwright emulates them, and on a 1280 px desktop. It measures how far
// each scrolls sideways and its pointer targets under 24 × 24 CSS px that no
// exception of WCAG 2.5.8 excuses (tests/a11y/layout.ts).
//
// The product owner decided on 2026-11-24 to fix every page: all targets
// 24 px and reflow everywhere. What is still known is held in
// tests/a11y/layout-today.json: a page that does not scroll sideways must
// not, one listed there may not scroll more (beyond OVERFLOW_MARGIN for the
// system fonts), and no small target it does not list may appear. A page
// that is not listed is held to none. Take entries out as pages are fixed;
// never add or raise them.
//
// Run by radical sense playwright, it writes, labelled front=,
// ux.mobile.overflow_px.max (px, the worst page and viewport),
// ux.mobile.small_targets (a count over every page and viewport),
// ux.mobile.small_targets.new and ux.mobile.overflow.new (what is worse than
// layout-today.json) into RADICAL_METRICS_DIR.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { measureLayout, VIEWPORTS, worse, type Today } from './layout'
import { HUB_STATES, SITE_STATES, STUDIO_STATES, frontContext, openState, type State } from './pages'

const TODAY: Today = JSON.parse(readFileSync(fileURLToPath(new URL('./layout-today.json', import.meta.url)), 'utf8'))

/** The main pages: every state that opens in each viewport (Studio's
 *  selected element, Quick Search and wiki are reached only on a desktop). */
const NOT_ON_PHONES = new Set(['Studio: element selected', 'Studio: Quick Search open', 'Studio: wiki'])
const FRONTS: Array<[string, State[]]> = [
  ['Studio', STUDIO_STATES.filter((s) => !NOT_ON_PHONES.has(s.name))],
  ['Hub', HUB_STATES],
  ['Site', SITE_STATES],
]

type Measurement = { metric: string; value: number; unit?: string; labels?: Record<string, string> }
/** Writes what the test measured where radical sense playwright reads it; a plain run writes nothing. */
function writeMetrics(file: string, measurements: Measurement[]): void {
  const dir = process.env.RADICAL_METRICS_DIR
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), JSON.stringify({ format: 'radical-metrics', version: 1, source: file, at: new Date().toISOString(), measurements }, null, 1))
}

test.describe('Pages reflow, targets large enough', () => {
  for (const [name, states] of FRONTS) {
    test(`${name}: no page scrolls sideways or has small targets beyond today's`, async ({ browser }, info) => {
      test.setTimeout(states.length * Object.keys(VIEWPORTS).length * 20_000)
      let overflow = 0
      let small = 0
      const problems: string[] = []
      for (const [viewport, options] of Object.entries(VIEWPORTS)) {
        for (const state of states) {
          const context = await frontContext(browser, info, state.front, options, state.firstStart)
          const page = await openState(context, state)
          const found = await measureLayout(page)
          overflow = Math.max(overflow, found.sideways)
          small += found.small.length
          if (found.sideways) info.annotations.push({ type: 'scrolls sideways', description: `${state.name} (${viewport}): ${found.sideways} px` })
          for (const f of found.small) info.annotations.push({ type: 'small target', description: `${state.name} (${viewport}): ${f}` })
          problems.push(...worse(state.name, viewport, found, TODAY))
          await context.close()
        }
      }
      const labels = { front: states[0].front }
      writeMetrics(`mobile-layout-${name.toLowerCase()}.json`, [
        { metric: 'ux.mobile.overflow_px.max', value: overflow, unit: 'px', labels },
        { metric: 'ux.mobile.small_targets', value: small, labels },
        { metric: 'ux.mobile.overflow.new', value: problems.filter((p) => p.includes('sideways')).length, labels },
        { metric: 'ux.mobile.small_targets.new', value: problems.filter((p) => p.includes('small target')).length, labels },
      ])
      expect(problems, 'worse than tests/a11y/layout-today.json').toEqual([])
    })
  }

  // The check catches what it is for, on pages made for it.
  const NOTHING: Today = { overflow: {}, smallTargets: {} }

  test('No sideways scrolling: a page wider than a 320 px window is caught', async ({ browser }) => {
    const context = await browser.newContext(VIEWPORTS['320 px'])
    const page = await context.newPage()
    await page.setContent(`<!doctype html><html lang="en"><body style="margin: 0">
      <h1>Orders</h1><div style="width: 600px">A row of filters that does not wrap</div>
    </body></html>`)
    const found = await measureLayout(page)
    expect(found.sideways).toBe(280)
    expect(worse('Fixture', '320 px', found, NOTHING)).toEqual(['Fixture (320 px): scrolls 280 px sideways, limit 0 px'])

    // A wide table in a scroll container of its own does not count.
    await page.setContent(`<!doctype html><html lang="en"><body style="margin: 0">
      <h1>Orders</h1><div style="overflow-x: auto"><table style="width: 600px"><tr><td>1</td><td>2</td></tr></table></div>
    </body></html>`)
    expect(worse('Fixture', '320 px', await measureLayout(page), NOTHING)).toEqual([])
    await context.close()
  })

  test('Small icon button caught: a 16 × 16 icon button beside another button is counted', async ({ page }) => {
    await page.setContent(`<!doctype html><html lang="en"><body>
      <div><button style="width: 80px; height: 32px">Save</button><button class="icon" aria-label="Close" style="width: 16px; height: 16px; padding: 0; margin-left: 2px">×</button></div>
      <p style="margin-top: 80px">Read the <a href="#terms">terms</a> before you order.</p>
      <button aria-label="Help" style="width: 16px; height: 16px; padding: 0; margin: 80px">?</button>
    </body></html>`)
    const found = await measureLayout(page)
    // The link in a sentence and the small button with room around it are excused.
    expect(found.small).toEqual(['button.icon "Close" 16×16'])
    expect(worse('Fixture', 'desktop', found, NOTHING)).toEqual(['Fixture (desktop): small target button.icon "Close" 16×16'])
    // Held as today's, it passes; a page that did not have it fails.
    expect(worse('Fixture', 'desktop', found, { overflow: {}, smallTargets: { Fixture: ['button.icon'] } })).toEqual([])
  })
})
