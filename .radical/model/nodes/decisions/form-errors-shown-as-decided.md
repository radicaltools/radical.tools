---
id: "da430403-1690-4a8a-97da-65af664af006"
type: "fitness-fn"
label: "Form errors shown as decided"
cadence: "triggered"
characteristic: "interaction-capability"
invocation: "automated"
scope: "holistic"
trigger: "pull-request"
---

A Playwright test submits each form of the main journeys empty (FORMS in tests/ux/journeys.ts) and reads what the page shows: ux.forms.unmarked counts forms where no field was marked aria-invalid="true"; ux.forms.unexplained counts fields so marked without a message tied to them by aria-describedby or aria-errormessage; ux.forms.focus.missed counts forms where focus did not move to the first field in error. Bind it with radical sense playwright tests/ux/form-errors.spec.ts and the conditions ux.forms.unmarked <= 0, ux.forms.unexplained <= 0, ux.forms.focus.missed <= 0.

Threshold: ux.forms.unmarked = 0, ux.forms.unexplained = 0, ux.forms.focus.missed = 0 over the forms of the main journeys

Tool: Playwright (@playwright/test), measured by radical sense playwright

```ts
// tests/ux/form-errors.spec.ts: a plain Playwright test (1.50 or later), or measured with
//   radical sense playwright tests/ux/form-errors.spec.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { FORMS } from './journeys'   // [{ path: '/register', submit: 'Continue', field: 'Email address' }, …]

type Measurement = { metric: string; value: number; labels?: Record<string, string> }
/** Writes what the test measured where radical sense playwright reads it; a plain run writes nothing. */
function writeMetrics(file: string, measurements: Measurement[]): void {
  const dir = process.env.RADICAL_METRICS_DIR
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), JSON.stringify({ format: 'radical-metrics', version: 1, source: file, at: new Date().toISOString(), measurements }, null, 1))
}

/** What the page shows after a submit that failed. */
const shown = (page: Page) => page.evaluate(() => {
  const invalid = [...document.querySelectorAll<HTMLElement>('[aria-invalid="true"]')]
  const explained = (f: HTMLElement) => `${f.getAttribute('aria-describedby') ?? ''} ${f.getAttribute('aria-errormessage') ?? ''}`
    .split(/\s+/).some((id) => id && document.getElementById(id)?.textContent?.trim())
  // the summary: the nearest element around the focus that links to every field in error, and holds none of them
  let box: Element | null = document.activeElement
  while (box && box !== document.body && !invalid.every((f) => box!.querySelector(`a[href="#${CSS.escape(f.id)}"]`))) box = box.parentElement
  return {
    invalid: invalid.length,
    unexplained: invalid.filter((f) => !explained(f)).length,
    summarised: Boolean(invalid.length && box && box !== document.body && !box.contains(invalid[0]) && document.title.startsWith('Error: ')),
    firstFocused: Boolean(invalid.length) && invalid[0] === document.activeElement,
  }
})

test('failed submits say what is wrong and where', async ({ page }) => {
  const unmarked: string[] = [], missed: string[] = []
  let unexplained = 0
  for (const form of FORMS) {
    await page.goto(form.path)
    await page.getByRole('button', { name: form.submit, exact: true }).click()
    await page.locator('[aria-invalid="true"]').first().waitFor({ state: 'attached', timeout: 5_000 }).catch(() => undefined)
    const after = await shown(page)
    if (!after.invalid) unmarked.push(form.path)
    unexplained += after.unexplained
    if (after.invalid && !after.firstFocused) missed.push(form.path)
  }
  writeMetrics('form-errors.json', [
    { metric: 'ux.forms.unmarked', value: unmarked.length },
    { metric: 'ux.forms.unexplained', value: unexplained },
    { metric: 'ux.forms.focus.missed', value: missed.length },
  ])
  expect.soft(unmarked, 'forms that accepted an empty submit or marked no field').toEqual([])
  expect.soft(unexplained, 'fields marked invalid without a message tied to them').toBe(0)
  expect.soft(missed, 'forms where focus did not move to the first field in error').toEqual([])
})
```
