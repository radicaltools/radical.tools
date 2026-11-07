// ─── Radical Assay: the running application ──────────────────────────────────
//
// What the Explore stage saw (ADR Assay explores the running application):
// screens of a web application running on this machine, as the server read
// them, and the paths an agent took through them, step by step. The MCP
// server drives the browser and records them; this module holds what they
// are and turns a path into a Playwright test for the application's
// repository, each control found as the recording found it.

import type { Evidence } from './facts'

/** A control of a screen: what the agent can act on. */
export interface Control {
  /** The reference the agent names it by, for this screen only (e1, e2, …). */
  ref: string
  role: string
  name: string
  /** How Playwright finds it, checked when it was acted on: a locator expression on `page`. */
  locator?: string
}

/** A screen of the application as the server read it. */
export interface ScreenFact {
  id: string
  url: string
  /** The address without the origin: the mockup's route. */
  route: string
  title: string
  headings: string[]
  /** The page's visible text, its first few hundred characters: what a mockup's description can say. */
  text?: string
  controls: Control[]
  /** form: read from a desktop application's form file, not seen running (its route is the form's name). */
  source?: 'form'
  /** A form's size and its controls at their positions, in twips: what its wireframe is drawn from. */
  form?: { width: number; height: number; controls: Array<{ kind: string; name: string; caption?: string; left: number; top: number; width: number; height: number }> }
  /** The forms its code opens, by their names, each from the handler of a control or menu item (via) or on loading. */
  opens?: Array<{ form: string; via?: string; key?: boolean; line: number }>
  /** Its screenshot, from the explore folder of the central repository; a form's file. */
  evidence: Evidence
}

/** One action of a path. */
export interface Step {
  /** expect: a text the screen shows, which the path's test asserts (the outcome a scenario names). */
  action: 'goto' | 'click' | 'fill' | 'select' | 'check' | 'press' | 'expect'
  /** The control acted on (none for goto). */
  control?: { role: string; name: string; locator: string }
  /** What was typed or chosen; a password is not kept. */
  value?: string
  secret?: boolean
  /** The screen before and after it. */
  from?: string
  to: string
}

/** A path an agent took: its name, and its steps from the screen it opened. */
export interface PathFact {
  id: string
  name: string
  /** The origin the application was served from. */
  origin: string
  /** The code repository that builds the application: its e2e/assay/ gets the path's test. */
  repository: string
  steps: Step[]
  evidence: Evidence
}

/** The page a route is, whatever its data: the query left out, a segment of digits or an id as {id}.
 *  Screens of one page share it, so a mockup stands for all of them. */
export const pageOf = (route: string): string =>
  (route.split(/[?#]/)[0].replace(/\/(\d+|[0-9a-f]{8}-[0-9a-f-]{27,}|[0-9a-f]{24,})(?=\/|$)/gi, '/{id}').replace(/\/+$/, '') || '/')

/** What a step does, as a person would say it: the label of a navigates-to. */
export function stepLabel(step: Step): string {
  if (step.action === 'goto') return 'opens it'
  if (step.action === 'expect') return `sees "${step.value ?? ''}"`
  const what = step.control ? `${step.control.role} "${step.control.name}"` : 'the page'
  if (step.action === 'click') return `clicks ${what}`
  if (step.action === 'fill') return `fills ${what}`
  if (step.action === 'select') return `chooses ${step.value ?? ''} in ${what}`
  if (step.action === 'check') return `checks ${what}`
  return `presses ${step.value ?? ''} on ${what}`
}

/** The file a path's test is written to, from the repository's root. */
export const pathTestFile = (path: PathFact): string =>
  `e2e/assay/${path.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'path'}.spec.ts`

/** The test id .radical/radical.json verifies binds to the path's test. */
export const pathTestId = (path: PathFact): string => `${pathTestFile(path)} › ${path.name}`

const quote = (text: string): string => JSON.stringify(text)

/** How the test checks that a screen is the one the recording reached: its first heading, else its address. */
function checkScreen(screen: ScreenFact | undefined): string[] {
  if (!screen) return []
  const heading = screen.headings[0]
  // A number in a heading is the data of the run that recorded it (Order 3): any number holds.
  if (heading && /\d/.test(heading)) return [`  await expect(page.getByRole('heading', { name: /^${heading.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&').replace(/\d+/g, '\\d+')}$/ }).first()).toBeVisible()`]
  if (heading) return [`  await expect(page.getByRole('heading', { name: ${quote(heading)}, exact: true }).first()).toBeVisible()`]
  const path = screen.route.split('?')[0]
  return [`  await expect(page).toHaveURL(new RegExp(${quote(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\?|#|$)`)}))`]
}

/** The path as a Playwright test: it opens the route the path started on, replays each step with the
 *  locator the recording checked, and checks each screen it reaches. The origin comes from E2E_BASE_URL,
 *  else the one recorded; a password typed while exploring is read from E2E_PASSWORD, not kept. */
export function pathTest(path: PathFact, screens: Map<string, ScreenFact>, recorded: string): string {
  const lines: string[] = [
    `// Written by Radical Assay from the path "${path.name}", explored on ${recorded} at ${path.origin}.`,
    '// It replays what was done then, on the data the application had: keep it, change it or delete it.',
    "import { expect, test } from '@playwright/test'",
    '',
    `const BASE = process.env.E2E_BASE_URL ?? ${quote(path.origin)}`,
    ...(path.steps.some((x) => x.secret) ? ["const PASSWORD = process.env.E2E_PASSWORD ?? ''"] : []),
    '',
    `test(${quote(path.name)}, async ({ page }) => {`,
    // An unset password would sign in with none and fail somewhere less clear.
    ...(path.steps.some((x) => x.secret) ? ["  expect(PASSWORD, 'Set E2E_PASSWORD to the password of the test account').not.toBe('')"] : []),
  ]
  let checked: string | undefined
  for (const step of path.steps) {
    const to = screens.get(step.to)
    if (step.action === 'goto') {
      lines.push(`  await page.goto(\`\${BASE}${(to?.route ?? '/').replace(/[`$\\]/g, '\\$&')}\`)`)
    } else if (step.action === 'expect') {
      // The outcome the agent saw and named: the scenario's then.
      lines.push(`  await expect(page.getByText(${quote(step.value ?? '')}).first()).toBeVisible()`)
    } else if (step.control) {
      const target = `page.${step.control.locator}`
      const value = step.secret ? 'PASSWORD' : quote(step.value ?? '')
      if (step.action === 'click') lines.push(`  await ${target}.click()`)
      else if (step.action === 'fill') lines.push(`  await ${target}.fill(${value})`)
      else if (step.action === 'select') lines.push(`  await ${target}.selectOption(${value})`)
      else if (step.action === 'check') lines.push(`  await ${target}.check()`)
      else lines.push(`  await ${target}.press(${value})`)
    }
    if (step.to !== checked) { lines.push(...checkScreen(to)); checked = step.to }
  }
  lines.push('})', '')
  return lines.join('\n')
}
