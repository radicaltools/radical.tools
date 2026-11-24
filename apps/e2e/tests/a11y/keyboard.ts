// The keyboard walk of the Accessibility pack (WCAG 2.1.1 Keyboard, 2.1.2
// No Keyboard Trap, 2.4.7 Focus Visible, 2.4.11 Focus Not Obscured
// (Minimum)): a journey walked with Tab, typing and Enter or Space only.
import { expect, type Locator, type Page } from '@playwright/test'

/** A step: the control by its role and accessible name, what to type into
 *  it, the key that activates it, and what shows once it has. */
export interface Step {
  role: Parameters<Page['getByRole']>[0]
  name: string | RegExp
  type?: string
  key?: 'Enter' | 'Space'
  then?: (page: Page) => Promise<void>
}

export const MAX_TABS = 200

export interface Walk {
  /** Steps whose control Tab never reached (no such control by its role and
   *  name, a missing tabindex, or a trap); the walk ends at the first. */
  unreachable: string[]
  /** Steps whose control had focus without an outline or a box shadow. */
  invisible: string[]
  /** Steps whose control had focus under something drawn over all of it. */
  obscured: string[]
}

const label = (step: Step) => `${step.role} "${String(step.name)}"`

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

/** Walks `steps` from where the page is, with the keyboard alone. */
export async function walk(page: Page, steps: Step[]): Promise<Walk> {
  const result: Walk = { unreachable: [], invisible: [], obscured: [] }
  for (const step of steps) {
    const target = page.getByRole(step.role, { name: step.name, exact: typeof step.name === 'string' })
    // The page shows the control before the walk looks for it; one that
    // never shows (no element has that role and name) is not reached either.
    const shown = await target.first().waitFor({ state: 'attached', timeout: 10_000 }).then(() => true, () => false)
    if (!shown || !(await tabTo(page, target))) { result.unreachable.push(label(step)); break }
    const focus = await focusState(page)
    if (!focus.indicated) result.invisible.push(label(step))
    if (focus.hidden) result.obscured.push(label(step))
    if (step.type) await page.keyboard.type(step.type)
    if (step.key) await page.keyboard.press(step.key)
    if (step.then) await step.then(page)
  }
  return result
}

/** A step's `then`: `locator` shows. */
export const shows = (pick: (page: Page) => Locator) => async (page: Page) => { await expect(pick(page).first()).toBeVisible() }
