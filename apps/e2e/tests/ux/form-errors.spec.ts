// Usability pack, "Form errors shown as decided" (ERRORS=field): a form of
// the main journeys submitted empty marks each field in error
// (aria-invalid="true"), ties a message to it (aria-describedby or
// aria-errormessage) and moves focus to the first of them.
//
//   radical sense playwright tests/ux/form-errors.spec.ts --cwd apps/e2e --project ux
//
// writes ux.forms.unmarked{app}, ux.forms.unexplained{app} and
// ux.forms.focus.missed{app}.
//
// Adapted to radical.tools: the site and the Hub have no form that checks
// what is typed in (the Hub's search filters as you type), so the forms are
// Studio's: the wizard of a new element (Designer) and the AI provider
// settings (setup). Both keep their button disabled until the form is
// complete instead of answering an empty submit, so the test clicks the
// disabled button as a person would (nothing happens) and reads what the
// form shows.
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test'
import { FIXTURE, STUDIO, settle, webContext, writeMetrics, type App } from './journeys'

interface Form {
  app: App
  name: string
  /** Opens the form, empty, and returns its submit button. */
  open: (page: Page) => Promise<Locator>
}

/** The sample model in Designer, as "Try the sample model" opens it and the Designer switch. */
async function sampleInDesigner(page: Page): Promise<void> {
  await page.goto(`${STUDIO}/`)
  await page.getByRole('button', { name: 'Try the sample model' }).click()
  await expect(page).toHaveURL(/\/v\/view-ctx$/)
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
  await page.locator('.toolbar-mode-btn', { hasText: 'Designer' }).click()
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Designer/)
  await settle(page)
}

export const FORMS: Form[] = [
  { app: 'studio', name: 'New ADR wizard', open: async (page) => {
    await sampleInDesigner(page)
    const pane = (await page.locator('.react-flow__pane').boundingBox())!
    await page.locator('.palette-item', { hasText: 'ADR' }).first().dragTo(page.locator('.react-flow__pane'), { targetPosition: { x: 150, y: pane.height - 100 } })
    const wizard = page.getByRole('dialog', { name: /New ADR/ })
    await expect(wizard).toBeVisible()
    await wizard.getByLabel('Name').fill('')
    return wizard.getByRole('button', { name: 'Create', exact: true })
  } },
  { app: 'studio', name: 'AI provider settings', open: async (page) => {
    await sampleInDesigner(page)
    await page.getByRole('navigation', { name: 'Activity bar' }).getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('menuitem', { name: 'AI providers…', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'AI provider settings' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('textbox', { name: 'API key' }).fill('')
    return dialog.getByRole('button', { name: 'Test connection' })
  } },
]

/**
 * Forms that do not show errors as decided today, held as the limit (no
 * worse than today). The product owner decided to change nothing in the UI,
 * so this is reported, not fixed: both of Studio's forms keep their button
 * disabled while a required field is empty and mark no field invalid (the
 * wizard says "Required: Name" in its footer, tied to no field; the AI
 * settings say nothing until a key is typed). So ux.forms.unmarked = 2, and
 * with no field marked, nothing is counted unexplained or focus missed.
 */
const TODAY = { unmarked: 2, unexplained: 0, missed: 0 }

/** What the page shows after a submit that failed. */
const shown = (page: Page) => page.evaluate(() => {
  const invalid = [...document.querySelectorAll<HTMLElement>('[aria-invalid="true"]')]
  const explained = (f: HTMLElement) => `${f.getAttribute('aria-describedby') ?? ''} ${f.getAttribute('aria-errormessage') ?? ''}`
    .split(/\s+/).some((id) => id && document.getElementById(id)?.textContent?.trim())
  return {
    invalid: invalid.length,
    unexplained: invalid.filter((f) => !explained(f)).length,
    firstFocused: Boolean(invalid.length) && invalid[0] === document.activeElement,
  }
})

type Found = { unmarked: string[]; unexplained: number; missed: string[] }

/** Submits each form empty, each in a page of its own, and counts what it fails to show. */
async function measure(newPage: () => Promise<Page>, forms: Form[]): Promise<Found> {
  const found: Found = { unmarked: [], unexplained: 0, missed: [] }
  for (const form of forms) {
    const page = await newPage()
    const submit = await form.open(page)
    // A disabled button takes the click and does nothing, as for a person.
    await submit.click({ force: await submit.isDisabled() })
    await page.locator('[aria-invalid="true"]').first().waitFor({ state: 'attached', timeout: 2_000 }).catch(() => undefined)
    const after = await shown(page)
    if (!after.invalid) found.unmarked.push(form.name)
    found.unexplained += after.unexplained
    if (after.invalid && !after.firstFocused) found.missed.push(form.name)
    await page.close()
  }
  if (process.env.UX_DEBUG) console.log(JSON.stringify(found, null, 1))
  return found
}

test.describe('Form errors shown as decided', () => {
  test("Studio's forms show their errors as decided", async ({ browser }, info) => {
    const contexts: BrowserContext[] = []
    const found = await measure(async () => {
      const context = await webContext(browser, info, {}, { studioSetUp: true })
      contexts.push(context)
      return context.newPage()
    }, FORMS)
    writeMetrics('form-errors-studio.json', [
      { metric: 'ux.forms.unmarked', value: found.unmarked.length, labels: { app: 'studio' } },
      { metric: 'ux.forms.unexplained', value: found.unexplained, labels: { app: 'studio' } },
      { metric: 'ux.forms.focus.missed', value: found.missed.length, labels: { app: 'studio' } },
    ])
    expect.soft(found.unmarked.length, `forms that marked no field: ${found.unmarked.join(', ')}`).toBeLessThanOrEqual(TODAY.unmarked)
    expect.soft(found.unexplained, 'fields marked invalid without a message tied to them').toBeLessThanOrEqual(TODAY.unexplained)
    expect.soft(found.missed.length, `forms where focus did not move to the first field in error: ${found.missed.join(', ')}`).toBeLessThanOrEqual(TODAY.missed)
    for (const context of contexts) await context.close()
  })

  test('an empty submit points at the field, and a form that does not is caught', async ({ browser }, info) => {
    const form = (script: string) => `<!doctype html><html lang="en"><title>Register</title><body><main>
      <form novalidate>
        <p id="top-error" hidden>There is a problem.</p>
        <label for="email">Email address</label> <input id="email" name="email">
        <span id="email-error"></span>
        <label for="name">Full name</label> <input id="name" name="name">
        <span id="name-error"></span>
        <button>Continue</button>
      </form>
      <script>document.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); ${script} })</script>
    </main></body></html>`
    const context = await webContext(browser, info, {
      // As decided: each field marked, its message tied to it, focus on the first.
      '/good': form(`for (const id of ['email', 'name']) {
          const f = document.getElementById(id)
          f.setAttribute('aria-invalid', 'true'); f.setAttribute('aria-describedby', id + '-error')
          document.getElementById(id + '-error').textContent = 'Enter your ' + (id === 'email' ? 'email address' : 'full name')
        }
        document.getElementById('email').focus()`),
      // Only a message at the top: no field marked.
      '/top-only': form(`document.getElementById('top-error').hidden = false`),
      // Fields marked, no message tied to them, focus left on the button.
      '/marked-only': form(`for (const id of ['email', 'name']) document.getElementById(id).setAttribute('aria-invalid', 'true')`),
    })
    const newPage = () => context.newPage()
    const fixture = (path: string): Form => ({ app: 'site', name: path, open: async (p) => {
      await p.goto(`${FIXTURE}${path}`)
      return p.getByRole('button', { name: 'Continue' })
    } })
    expect(await measure(newPage, [fixture('/good')])).toEqual({ unmarked: [], unexplained: 0, missed: [] })
    expect(await measure(newPage, [fixture('/top-only'), fixture('/marked-only')])).toEqual({ unmarked: ['/top-only'], unexplained: 2, missed: ['/marked-only'] })
    await context.close()
  })
})
