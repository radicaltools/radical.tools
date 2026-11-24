---
id: "27dce77e-5ca2-4a3e-9ddb-f1d297b5b667"
type: "fitness-fn"
label: "Main journey by keyboard"
cadence: "triggered"
characteristic: "interaction-capability"
invocation: "automated"
scope: "holistic"
trigger: "pull-request"
---

A Playwright test walks the main journey without the mouse: for each step it presses Tab until the control (found by its role and accessible name) has focus, checks that the focused control shows an outline or a box shadow and that something of it can be seen (at its centre or one of its corners nothing else is drawn on top), then types and presses Enter or Space as the step says. A control not reached within 200 presses (a missing tabindex, or focus caught in a trap) ends the walk. It writes a11y.keyboard.unreachable, a11y.focus.invisible and a11y.focus.obscured and fails on any. A control that shows its focus on another element (a custom checkbox styled through its label) needs its own check in focusState. Bind it with radical sense playwright tests/a11y/keyboard.spec.ts and the conditions a11y.keyboard.unreachable <= 0, a11y.focus.invisible <= 0 and a11y.focus.obscured <= 0.

Threshold: a11y.keyboard.unreachable = 0, a11y.focus.invisible = 0 and a11y.focus.obscured = 0: the main journey completes with the keyboard alone, every step is reached with Tab within 200 presses, and every focused control shows a focus indicator and is not entirely hidden

Tool: Playwright (@playwright/test), measured by radical sense playwright

```ts
// tests/a11y/keyboard.spec.ts: a plain Playwright test (1.50 or later), or measured with
//   radical sense playwright tests/a11y/keyboard.spec.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'

/** A step of the journey: the control by its role and accessible name, what to type, and the key that activates it. */
type Step = { role: Parameters<Page['getByRole']>[0]; name: string; type?: string; key?: 'Enter' | 'Space' }
const JOURNEY: Step[] = [
  { role: 'searchbox', name: 'Search', type: 'trail shoes', key: 'Enter' },
  { role: 'link', name: 'Trail runner 2', key: 'Enter' },
  { role: 'button', name: 'Add to basket', key: 'Enter' },
  { role: 'link', name: 'Checkout', key: 'Enter' },
  { role: 'checkbox', name: 'I accept the terms', key: 'Space' },
  { role: 'button', name: 'Place order', key: 'Enter' },
]
const DONE = 'Order placed'   // the heading the journey ends on
const MAX_TABS = 200

type Measurement = { metric: string; value: number; unit?: string; labels?: Record<string, string> }
/** Writes what the test measured where radical sense playwright reads it; a plain run writes nothing. */
function writeMetrics(file: string, measurements: Measurement[]): void {
  const dir = process.env.RADICAL_METRICS_DIR
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), JSON.stringify({ format: 'radical-metrics', version: 1, source: file, at: new Date().toISOString(), measurements }, null, 1))
}

/** Presses Tab until the control has focus; false when it is not reached within MAX_TABS presses. */
async function tabTo(page: Page, target: Locator): Promise<boolean> {
  for (let i = 0; i <= MAX_TABS; i++) {
    if (await target.evaluateAll((els) => els.some((el) => el === document.activeElement))) return true
    await page.keyboard.press('Tab')
  }
  return false
}

/** Whether the focused control shows a focus indicator, and whether it is entirely hidden by something drawn over it. */
const focusState = (page: Page) => page.evaluate(() => {
  const el = document.activeElement as HTMLElement
  const style = getComputedStyle(el)
  const indicated = (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none'
  const r = el.getBoundingClientRect()
  const hits = [[0.5, 0.5], [0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]].map(([x, y]) => document.elementFromPoint(r.left + r.width * x, r.top + r.height * y))
  return { indicated, hidden: hits.every((hit) => !hit || !(hit === el || el.contains(hit))) }
})

test('the main journey completes with the keyboard alone', async ({ page }) => {
  const unreachable: string[] = [], invisible: string[] = [], obscured: string[] = []
  await page.goto('/')
  for (const step of JOURNEY) {
    if (!(await tabTo(page, page.getByRole(step.role, { name: step.name, exact: true })))) { unreachable.push(step.name); break }
    const focus = await focusState(page)
    if (!focus.indicated) invisible.push(step.name)
    if (focus.hidden) obscured.push(step.name)
    if (step.type) await page.keyboard.type(step.type)
    if (step.key) await page.keyboard.press(step.key)
  }
  writeMetrics('keyboard.json', [
    { metric: 'a11y.keyboard.unreachable', value: unreachable.length },
    { metric: 'a11y.focus.invisible', value: invisible.length },
    { metric: 'a11y.focus.obscured', value: obscured.length },
  ])
  expect.soft(unreachable, 'not reached with Tab: a missing tabindex, or focus caught in a trap').toEqual([])
  expect.soft(invisible, 'focused without a visible indicator').toEqual([])
  expect.soft(obscured, 'focused under a sticky header, footer or dialog').toEqual([])
  if (!unreachable.length) await expect(page.getByRole('heading', { name: DONE })).toBeVisible()
})
```
