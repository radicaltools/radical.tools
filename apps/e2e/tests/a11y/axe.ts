// The automated accessibility check of one page in one state: axe-core with
// the rules of WCAG 2.2 level AA (Accessibility pack, LEVEL = wcag22aa).
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { isTracked, type Tracked } from './known'

/** WCAG 2.2 level AA, with the levels it includes. */
export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

export interface Found {
  /** Elements found per impact. */
  byImpact: Record<'critical' | 'serious' | 'moderate' | 'minor', number>
  /** Serious and critical violations not in the tracked list: "state: rule (impact) at elements". */
  untracked: string[]
  /** Serious and critical violations the tracked list accepts: rule ids. */
  tracked: string[]
}

export async function checkState(page: Page, state: string, known: Tracked[]): Promise<Found> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(TAGS)
    // Target size is decided and measured in the Mobile and perceived
    // performance pack (tests/a11y/layout.spec.ts).
    .disableRules(['target-size'])
    .analyze()
  const found: Found = { byImpact: { critical: 0, serious: 0, moderate: 0, minor: 0 }, untracked: [], tracked: [] }
  for (const v of violations) {
    const impact = (v.impact ?? 'minor') as keyof Found['byImpact']
    found.byImpact[impact] += v.nodes.length
    if (impact !== 'serious' && impact !== 'critical') continue
    if (isTracked(known, v.id, state)) { found.tracked.push(v.id); continue }
    found.untracked.push(`${state}: ${v.id} (${impact}, ${v.help}) at ${v.nodes.slice(0, 5).map((n) => n.target.join(' ')).join(', ')}${v.nodes.length > 5 ? ` and ${v.nodes.length - 5} more` : ''}`)
  }
  return found
}
