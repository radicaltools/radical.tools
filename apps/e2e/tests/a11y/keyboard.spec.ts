// Main journey by keyboard (Accessibility pack, fitness function and
// scenario "Main journey by keyboard"): the main journey of each front end
// walked with Tab, typing and Enter only. Every step's control must be
// reached within MAX_TABS presses, show a focus indicator, and not be hidden
// under something else; each journey must end where it should. A step the
// keyboard cannot reach today is tracked to a deadline in
// apps/e2e/a11y-known.json (rule "keyboard", state "<journey> journey:
// <role> \"<name>\""), as axe's violations are.
//
// Run by radical sense playwright, it writes a11y.keyboard.unreachable (the
// steps not reached and not tracked), a11y.keyboard.tracked,
// a11y.focus.invisible and a11y.focus.obscured (labelled front=) into
// RADICAL_METRICS_DIR.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { HUB, SITE, STUDIO, frontContext, type Front } from './pages'
import { MAX_TABS, shows, walk, type Step, type Walk } from './keyboard'
import { isTracked, readKnown } from './known'

interface Journey { front: Front; name: string; url: string; steps: Step[] }

const JOURNEYS: Journey[] = [
  {
    // Open the sample, go to one of its views, switch to Designer, and find
    // an element with Quick Search.
    front: 'apps/studio', name: 'Studio', url: `${STUDIO}/`,
    steps: [
      { role: 'button', name: 'Try the sample model', key: 'Enter', then: async (page) => { await expect(page).toHaveURL(/\/v\/view-ctx$/) } },
      { role: 'button', name: /^Payments Domain/, key: 'Enter', then: async (page) => { await expect(page).not.toHaveURL(/\/v\/view-ctx$/) } },
      { role: 'button', name: 'Designer', key: 'Enter', then: shows((page) => page.locator('.toolbar-mode-btn.active', { hasText: 'Designer' })) },
      { role: 'textbox', name: /^Search/, type: 'Payments Service', then: shows((page) => page.locator('.quick-search-item', { hasText: 'Payments Service' })) },
    ],
  },
  {
    // From the landing page to a pack's page.
    front: 'apps/hub', name: 'Hub', url: `${HUB}/`,
    steps: [
      { role: 'button', name: 'Browse the catalogue', key: 'Enter', then: async (page) => { await expect(page).toHaveURL(/#\/browse/) } },
      { role: 'searchbox', name: 'Search concepts…', type: 'authentication', then: shows((page) => page.getByText('Authentication', { exact: true })) },
      { role: 'link', name: 'Authentication', key: 'Enter', then: async (page) => { await expect(page).toHaveURL(/#\/c\/concern-authentication/) } },
    ],
  },
  {
    // From the home page to the manual.
    front: 'apps/web', name: 'Site', url: `${SITE}/`,
    steps: [
      { role: 'link', name: 'Docs', key: 'Enter', then: async (page) => { await expect(page).toHaveURL(/manual\.html/) } },
    ],
  },
]

type Measurement = { metric: string; value: number; unit?: string; labels?: Record<string, string> }
/** Writes what the test measured where radical sense playwright reads it; a plain run writes nothing. */
function writeMetrics(file: string, measurements: Measurement[]): void {
  const dir = process.env.RADICAL_METRICS_DIR
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), JSON.stringify({ format: 'radical-metrics', version: 1, source: file, at: new Date().toISOString(), measurements }, null, 1))
}

function judge(found: Walk): void {
  expect.soft(found.unreachable, `not reached within ${MAX_TABS} presses of Tab: no such control, a missing tabindex, or focus caught in a trap`).toEqual([])
  expect.soft(found.invisible, 'focused without a visible indicator').toEqual([])
  expect.soft(found.obscured, 'focused under something drawn over all of it').toEqual([])
}

test.describe('Main journey by keyboard', () => {
  for (const journey of JOURNEYS) {
    test(`${journey.name}: the main journey completes with the keyboard alone`, async ({ browser }, info) => {
      const context = await frontContext(browser, info, journey.front)
      const page = await context.newPage()
      await page.goto(journey.url)
      await page.evaluate(() => document.fonts.ready)
      const walked = await walk(page, journey.steps)
      const known = readKnown()
      const tracked = walked.unreachable.filter((step) => isTracked(known, 'keyboard', `${journey.name} journey: ${step}`))
      for (const step of tracked) info.annotations.push({ type: 'tracked: not reached by keyboard', description: `${journey.name} journey: ${step}` })
      const found = { ...walked, unreachable: walked.unreachable.filter((step) => !tracked.includes(step)) }
      const labels = { front: journey.front }
      writeMetrics(`keyboard-${journey.name.toLowerCase()}.json`, [
        { metric: 'a11y.keyboard.unreachable', value: found.unreachable.length, labels },
        { metric: 'a11y.keyboard.tracked', value: tracked.length, labels },
        { metric: 'a11y.focus.invisible', value: found.invisible.length, labels },
        { metric: 'a11y.focus.obscured', value: found.obscured.length, labels },
      ])
      judge(found)
      await context.close()
    })
  }

  // The check catches what it is for, on a page made for it.
  test('a control the keyboard cannot reach, or focused without an indicator, is caught', async ({ page }) => {
    await page.setContent(`<main>
      <button>First</button>
      <button style="outline: none; box-shadow: none">No ring</button>
      <div role="button" onclick="this.textContent = 'Done'">Only a mouse</div>
    </main>`)
    const found = await walk(page, [
      { role: 'button', name: 'First' },
      { role: 'button', name: 'No ring' },
      { role: 'button', name: 'Only a mouse', key: 'Enter' },
    ])
    expect(found).toEqual({ unreachable: ['button "Only a mouse"'], invisible: ['button "No ring"'], obscured: [] })
  })

  test('a focused control under a sticky header is caught', async ({ page }) => {
    await page.setContent(`<header style="position: fixed; top: 0; left: 0; right: 0; height: 80px; background: #fff; z-index: 1">Header</header>
      <main style="padding-top: 20px"><button style="height: 30px">Hidden</button></main>`)
    expect(await walk(page, [{ role: 'button', name: 'Hidden' }])).toEqual({ unreachable: [], invisible: [], obscured: ['button "Hidden"'] })
  })
})
