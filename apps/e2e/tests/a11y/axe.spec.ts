// No untracked accessibility violations (Accessibility pack: WCAG 2.2 AA,
// failures tracked to a deadline; scenario "Page passes accessibility
// checks"): axe-core over the main pages and states of Studio, the Hub and
// the site (tests/a11y/pages.ts). A serious or critical violation fails
// unless apps/e2e/a11y-known.json lists its rule for that state.
//
// Run by radical sense playwright, it writes a11y.violations{impact=…},
// a11y.violations.untracked and a11y.states, each labelled front=, into
// RADICAL_METRICS_DIR.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { checkState } from './axe'
import { readKnown, type Tracked } from './known'
import { HUB_STATES, SITE_STATES, STUDIO_STATES, frontContext, openState, type State } from './pages'

type Measurement = { metric: string; value: number; unit?: string; labels?: Record<string, string> }
/** Writes what the test measured where radical sense playwright reads it; a plain run writes nothing. */
function writeMetrics(file: string, measurements: Measurement[]): void {
  const dir = process.env.RADICAL_METRICS_DIR
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), JSON.stringify({ format: 'radical-metrics', version: 1, source: file, at: new Date().toISOString(), measurements }, null, 1))
}

const FRONTS: Array<[string, State[]]> = [['Studio', STUDIO_STATES], ['Hub', HUB_STATES], ['Site', SITE_STATES]]

test.describe('No untracked accessibility violations', () => {
  for (const [name, states] of FRONTS) {
    test(`${name}: every page and state meets WCAG 2.2 AA, tracked violations aside`, async ({ browser }, info) => {
      test.setTimeout(states.length * 30_000)
      const known = readKnown()
      const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 }
      const untracked: string[] = []
      for (const state of states) {
        const context = await frontContext(browser, info, state.front, {}, state.firstStart)
        const page = await openState(context, state)
        const found = await checkState(page, state.name, known)
        for (const [impact, n] of Object.entries(found.byImpact)) byImpact[impact as keyof typeof byImpact] += n
        untracked.push(...found.untracked)
        // A tracked violation no longer found is fixed: take it off the list.
        const gone = known.filter((k) => k.state === state.name && k.rule !== 'keyboard' && !found.tracked.includes(k.rule))
        for (const k of gone) info.annotations.push({ type: 'tracked violation no longer found', description: `${k.state}: ${k.rule} (${k.issue})` })
        await context.close()
      }
      const labels = { front: states[0].front }
      writeMetrics(`axe-${name.toLowerCase()}.json`, [
        ...Object.entries(byImpact).map(([impact, value]) => ({ metric: 'a11y.violations', value, labels: { ...labels, impact } })),
        { metric: 'a11y.violations.untracked', value: untracked.length, labels },
        { metric: 'a11y.states', value: states.length, labels },
      ])
      expect(untracked, 'serious and critical violations not in apps/e2e/a11y-known.json').toEqual([])
    })
  }

  // The check catches what it is for, on a page made for it.
  test('a serious violation fails unless it is tracked for its state', async ({ page }) => {
    await page.setContent(`<!doctype html><html lang="en"><head><title>Fixture</title></head><body><main>
      <h1>Order</h1>
      <button><svg width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="6" /></svg></button>
    </main></body></html>`)
    const none: Tracked[] = []
    const untracked = await checkState(page, 'Fixture: icon button', none)
    expect(untracked.untracked).toEqual([expect.stringMatching(/^Fixture: icon button: button-name \(critical, /)])

    const listed: Tracked[] = [{ front: 'apps/web', state: 'Fixture: icon button', rule: 'button-name', issue: '#1', found: '2026-11-24', due: '2026-12-24' }]
    expect(await checkState(page, 'Fixture: icon button', listed)).toMatchObject({ untracked: [], tracked: ['button-name'] })
    // Tracked for another state only: still fails here.
    expect((await checkState(page, 'Fixture: another state', listed)).untracked).toHaveLength(1)
  })

  test('a page without violations passes', async ({ page }) => {
    await page.setContent(`<!doctype html><html lang="en"><head><title>Fixture</title></head><body><main>
      <h1>Order</h1><button>Place order</button>
    </main></body></html>`)
    expect(await checkState(page, 'Fixture: clean', [])).toMatchObject({ untracked: [], tracked: [], byImpact: { critical: 0, serious: 0 } })
  })
})
