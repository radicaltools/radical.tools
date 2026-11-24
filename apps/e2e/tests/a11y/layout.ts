// What the reflow and target-size check measures on one page (Mobile and
// perceived performance pack, WCAG 2.2 SC 1.4.10 Reflow and SC 2.5.8 Target
// Size (Minimum)): how far the page scrolls sideways, and its pointer
// targets smaller than MIN × MIN CSS px that none of the exceptions of
// 2.5.8 excuses. It judges nothing; layout.spec.ts compares with the limits.
import { devices, type BrowserContextOptions, type Page } from '@playwright/test'

/** The target size decided (TOUCH = 24): WCAG 2.2 level AA. */
export const MIN = 24

/** The viewports every main page is measured in. */
export const VIEWPORTS: Record<string, BrowserContextOptions> = {
  // The width of a 1280 px window at 400% zoom.
  '320 px': { viewport: { width: 320, height: 640 } },
  'iPhone 15': devices['iPhone 15'],
  'Pixel 7': devices['Pixel 7'],
  'desktop': { viewport: { width: 1280, height: 800 } },
}

const TARGETS = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=checkbox], [role=radio], [role=switch], [role=tab], [role=menuitem], [tabindex]:not([tabindex="-1"])'

export interface Layout {
  /** CSS px the page scrolls sideways. */
  sideways: number
  /** The small targets no exception excuses: `tag.class "name" W×H`. */
  small: string[]
}

/** Measures the page as it is now. */
export function measureLayout(page: Page, min = MIN): Promise<Layout> {
  return page.evaluate(({ min, selector }) => {
    const width = document.documentElement.clientWidth
    const sideways = Math.max(0, document.documentElement.scrollWidth - width)
    const targets = [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((el) => el.checkVisibility({ visibilityProperty: true }) && !el.closest('[inert]') && !(el as HTMLButtonElement).disabled)
      // A diagram's elements and lines are drawn at the zoom the person
      // picks: the canvas is a map, measured by its controls, not its content.
      .filter((el) => !el.closest('.react-flow__viewport'))
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
    const boxes = targets.map((el) => el.getBoundingClientRect())
    const under = (r: DOMRect) => r.width < min || r.height < min
    const centre = (r: DOMRect) => [r.x + r.width / 2, r.y + r.height / 2]
    // WCAG 2.5.8 exceptions: inline in a sentence (a link in running text);
    // an input whose label is large enough (its equivalent).
    const exempt = (el: HTMLElement) =>
      (getComputedStyle(el).display === 'inline' && (el.parentElement?.textContent ?? '').trim().length > (el.textContent ?? '').trim().length)
      || [...((el as HTMLInputElement).labels ?? [])].some((l) => !under(l.getBoundingClientRect()))
    const small = targets.flatMap((el, i) => {
      const r = boxes[i]
      if (!under(r) || exempt(el)) return []
      // Spacing: a circle of diameter MIN on its centre intersects no other
      // target, and no other small target's circle.
      const [x, y] = centre(r)
      const crowded = boxes.some((o, j) => j !== i && !targets[j].contains(el) && !el.contains(targets[j])
        && (Math.hypot(Math.max(o.left - x, 0, x - o.right), Math.max(o.top - y, 0, y - o.bottom)) < min / 2
          || (under(o) && Math.hypot(centre(o)[0] - x, centre(o)[1] - y) < min)))
      const name = (el.getAttribute('aria-label') ?? el.getAttribute('title') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
      // Its kind: the tag and first class name of the component that drew it.
      const kind = el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : '')
      return crowded ? [`${kind} "${name}" ${Math.round(r.width)}×${Math.round(r.height)}`] : []
    })
    return { sideways, small }
  }, { min, selector: TARGETS })
}

/** What a front end's pages did on the day the limits were set
 *  (tests/a11y/layout-today.json): no page may do worse. */
export interface Today {
  /** CSS px a state scrolled sideways, per viewport; absent = 0. */
  overflow: Record<string, Record<string, number>>
  /** The kinds of small target a state had in any viewport (`tag.class`,
   *  or `tag "name"` for an element without a class): the names and counts
   *  change with the content, the component that draws them does not. */
  smallTargets: Record<string, string[]>
}

/** How much more a page that already scrolls sideways may scroll: its text
 *  is set in the system's fonts, which differ between macOS, where the
 *  limits were measured, and the Linux image CI runs in. */
export const OVERFLOW_MARGIN = 1.25

/** A small target's kind: `tag.class`, or `tag "name"` when it has no class. */
export const identity = (small: string): string => {
  const [kind] = small.split(' "')
  return kind.includes('.') ? kind : small.replace(/ \d+×\d+$/, '')
}

/** What `found` does worse than `today` in `state` and `viewport`. */
export function worse(state: string, viewport: string, found: Layout, today: Today): string[] {
  const problems: string[] = []
  const before = today.overflow[state]?.[viewport] ?? 0
  const limit = Math.ceil(before * OVERFLOW_MARGIN)
  if (found.sideways > limit) problems.push(`${state} (${viewport}): scrolls ${found.sideways} px sideways, limit ${limit} px`)
  const known = new Set(today.smallTargets[state] ?? [])
  for (const small of found.small) if (!known.has(identity(small))) problems.push(`${state} (${viewport}): small target ${small}`)
  return problems
}
