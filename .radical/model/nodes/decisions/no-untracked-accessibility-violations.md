---
id: "6f184a44-80e3-485b-a003-b7c5eebcc904"
type: "fitness-fn"
label: "No untracked accessibility violations"
cadence: "triggered"
characteristic: "interaction-capability"
invocation: "automated"
scope: "holistic"
trigger: "pull-request"
---

A Playwright test opens each page of the main journeys in each state that matters (STATES in apps/e2e/tests/a11y/pages.ts: open dialogs and menus, a form showing its errors, an empty list) and runs axe-core on it with the rules of WCAG 2.2 level AA. It writes a11y.violations{impact=critical|serious|moderate|minor}, the elements found per impact, a11y.violations.untracked, the serious and critical violations (rule and state) not listed in apps/e2e/a11y-known.json, and a11y.states, the states checked (a run that checked none measured nothing), and fails on an untracked serious or critical violation, naming the state, rule and elements. The target-size rule is switched off: target size is decided and measured in the Mobile and perceived performance pack. Automated rules find only part of the failures; the keyboard walk and, where decided, the screen-reader pass cover more. Bind it with radical sense playwright tests/a11y/axe.spec.ts and the condition a11y.violations.untracked <= 0.

Threshold: a11y.violations.untracked = 0: every serious or critical violation of the axe rules tagged wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa on the pages and states of the main journeys is listed in apps/e2e/a11y-known.json with an issue and a due date

Tool: axe-core with Playwright (@axe-core/playwright 4.x, @playwright/test), measured by radical sense playwright

```ts
// tests/a11y/axe.spec.ts: a plain Playwright test (1.50 or later), or measured with
//   radical sense playwright tests/a11y/axe.spec.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { STATES } from './pages'   // [{ name: 'checkout, address error', path: '/checkout', open: async (page) => { … } }, …]

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']   // WCAG 2.2 level AA
const KNOWN = 'apps/e2e/a11y-known.json'   // [{ rule, state, issue, found, due }]: the violations tracked to a deadline

type Measurement = { metric: string; value: number; unit?: string; labels?: Record<string, string> }
/** Writes what the test measured where radical sense playwright reads it; a plain run writes nothing. */
function writeMetrics(file: string, measurements: Measurement[]): void {
  const dir = process.env.RADICAL_METRICS_DIR
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), JSON.stringify({ format: 'radical-metrics', version: 1, source: file, at: new Date().toISOString(), measurements }, null, 1))
}

test('the main journeys meet WCAG 2.2 level AA', async ({ page }) => {
  const known: Array<{ rule: string; state: string }> = existsSync(KNOWN) ? JSON.parse(readFileSync(KNOWN, 'utf8')) : []
  const byImpact: Record<string, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 }
  const failing: string[] = []
  for (const state of STATES) {
    await page.goto(state.path)
    await state.open?.(page)
    const { violations } = await new AxeBuilder({ page })
      .withTags(TAGS)
      .disableRules(['target-size'])   // decided and measured in the Mobile and perceived performance pack
      .analyze()
    for (const v of violations) {
      byImpact[v.impact ?? 'minor'] += v.nodes.length
      if (v.impact !== 'serious' && v.impact !== 'critical') continue
      if (known.some((k) => k.rule === v.id && k.state === state.name)) continue
      failing.push(`${state.name}: ${v.id} (${v.impact}) at ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
    }
  }
  writeMetrics('axe.json', [
    ...Object.entries(byImpact).map(([impact, value]) => ({ metric: 'a11y.violations', value, labels: { impact } })),
    { metric: 'a11y.violations.untracked', value: failing.length },
    { metric: 'a11y.states', value: STATES.length },
  ])
  expect(failing, 'serious and critical violations not in apps/e2e/a11y-known.json').toEqual([])
})
```
