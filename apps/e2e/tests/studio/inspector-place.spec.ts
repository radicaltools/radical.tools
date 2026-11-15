import { expect } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeTestResults } from '@radical/common/check'
import type { C4Node, DiagramData } from '@radical/common/c4'

// The Inspector is a place of the activity rail, as the Views section is:
// its button (just above Settings) shows its tabs in the left panel and the
// tab picked in place of the view. Lit, the button folds the left panel and
// opens it again, the report staying; a section's tab or ⌘J goes back to
// the view.

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

const MODEL: DiagramData = {
  metamodel: builtInGovernanceMetamodel(),
  nodes: [
    node('shop', 'system', 'Shop', { x: 40, y: 40, width: 520, height: 300 }),
    node('api', 'container', 'Checkout API', { parentId: 'shop', x: 40, y: 60 }),
    node('need', 'need', 'Pay online', { x: 700, y: 40 }),
    node('req', 'requirement', 'Take card payments', { x: 700, y: 220, ears_type: 'ubiquitous', action: 'take card payments' }),
    node('sc', 'scenario', 'Paying by card', { x: 700, y: 400, given: 'a cart', when: 'the user pays by card', then: 'the order is paid', metrics: 'test(tests/pay.test.ts › pays by card) passed' }),
  ],
  relations: [
    { id: 'r1', relationType: 'derives', sourceId: 'req', targetId: 'need' },
    { id: 'r2', relationType: 'satisfies', sourceId: 'api', targetId: 'req' },
    { id: 'r3', relationType: 'verifies', sourceId: 'sc', targetId: 'req' },
  ],
  views: [
    { id: 'v-arch', name: 'Architecture', nodeIds: ['shop', 'api'], positions: {} },
    { id: 'v-spec', name: 'Specification', nodeIds: ['need', 'req', 'sc'], positions: {} },
  ],
}

test('the Inspector is a place of the rail: its tabs in the left panel, its report in place of the view, folded as a section', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(MODEL, 'Shop'))) await folder.write(path, content)
  await folder.write('.state/test-results.json', serializeTestResults([{ file: '/repo/tests/pay.test.ts', title: ['pays by card'], status: 'failed' }], ['reports/unit.json']))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()

  const rail = page.locator('.activity-rail')
  const button = rail.getByRole('button', { name: 'Inspector', exact: true })
  const report = page.getByRole('region', { name: 'Inspector' })
  const tabs = page.getByRole('tablist', { name: 'Inspector' })
  const left = page.locator('.left-panel')
  const canvas = page.locator('.react-flow')
  // The toolbar holds the perspectives only; the button is on the rail, red with the error.
  await expect(page.locator('.toolbar').getByRole('button', { name: /Inspector/ })).toHaveCount(0)
  await expect(button).toBeEnabled({ timeout: 10_000 })
  await expect(button).toHaveClass(/\be\b/)
  await expect(button.locator('.lp-rail-count')).toHaveText('1')

  // Open: the tabs in the left panel, the report where the canvas was, no section lit.
  await button.click()
  await expect(report).toBeVisible()
  await expect(tabs.getByRole('tab', { name: /^Overview/ })).toHaveAttribute('aria-selected', 'true')
  // The report covers the view, which stays mounted under it.
  await expect.poll(() => page.evaluate(() => {
    const r = document.querySelector('.react-flow')!.getBoundingClientRect()
    return !!document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('#insp-dock')
  })).toBe(true)
  await expect(rail.getByRole('tab', { name: 'Views' })).toHaveAttribute('aria-selected', 'false')
  await expect(page).toHaveURL(/\/i\/overview/)
  await tabs.getByRole('tab', { name: /^Implementation/ }).click()
  await expect(page).toHaveURL(/\/i\/implementation/)

  // The chevron on the left panel's edge folds it: the report stays.
  await left.getByRole('button', { name: 'Collapse panel' }).click()
  await expect(page.locator('.app-layout')).toHaveClass(/lp-collapsed/)
  await expect(report).toBeVisible()
  // The lit button opens the left panel again, on the Inspector's tabs.
  await button.click()
  await expect(page.locator('.app-layout')).not.toHaveClass(/lp-collapsed/)
  await expect(tabs.getByRole('tab', { name: /^Implementation/ })).toHaveAttribute('aria-selected', 'true')
  await expect(report).toBeVisible()
  // Pressed again, it folds the left panel, as a section's tab does; the report stays.
  await button.click()
  await expect(page.locator('.app-layout')).toHaveClass(/lp-collapsed/)
  await expect(report).toBeVisible()
  await button.click()
  await expect(page.locator('.app-layout')).not.toHaveClass(/lp-collapsed/)

  // A section's tab goes back to the view and shows that section.
  await rail.getByRole('tab', { name: 'Milestones' }).click()
  await expect(report).toHaveCount(0)
  await expect(canvas).toBeVisible()
  await expect(rail.getByRole('tab', { name: 'Milestones' })).toHaveAttribute('aria-selected', 'true')
  await expect(page).not.toHaveURL(/\/i\//)

  // ⌘J opens it and goes back to the view; it is kept over a reload.
  await page.keyboard.press('ControlOrMeta+j')
  await expect(report).toBeVisible()
  // The address names the tab once it is written; a reload opens it there.
  await expect(page).toHaveURL(/\/i\/implementation/)
  await page.reload()
  await expect(report).toBeVisible({ timeout: 15_000 })
  await expect(tabs.getByRole('tab', { name: /^Implementation/ })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ControlOrMeta+j')
  await expect(report).toHaveCount(0)
  await expect(canvas).toBeVisible()
})
