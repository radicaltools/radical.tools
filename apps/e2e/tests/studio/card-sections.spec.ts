import { expect } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeTestResults } from '@radical/common/check'
import type { C4Node, DiagramData } from '@radical/common/c4'

// Under an element's attributes the properties card has Verification, Tests
// and Views. Open, they filled the lower half of the card, so each is
// folded to its head, which says what the section holds: Verification its
// status and its findings, Tests how many there are and what the results
// say of them, Views how many show the element. A click on a head, Enter or
// Space opens it, and it stays as the user left it, for every element and
// after a reload.

// As Studio starts: the sections folded (the other tests read what they hold).
test.use({ cardSections: 'folded' })

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

const MODEL: DiagramData = {
  metamodel: builtInGovernanceMetamodel(),
  nodes: [
    node('need', 'need', 'Pay online', { x: 40, y: 40 }),
    node('req', 'requirement', 'Take card payments', { x: 40, y: 220, ears_type: 'ubiquitous', action: 'take card payments' }),
    node('sc', 'scenario', 'Paying by card', { x: 40, y: 400, given: 'a cart', when: 'the user pays by card', then: 'the order is paid' }),
  ],
  relations: [
    { id: 'r1', relationType: 'derives', sourceId: 'req', targetId: 'need' },
    { id: 'r3', relationType: 'verifies', sourceId: 'sc', targetId: 'req' },
  ],
  views: [{ id: 'v-spec', name: 'Specification', nodeIds: ['need', 'req', 'sc'], positions: {} }],
}

test('the card folds Verification, Tests and Views to their heads, and keeps them as the user leaves them', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(MODEL, 'shop'))) await folder.write(`.radical/model/${path}`, content)
  await folder.write('.radical/radical.json', JSON.stringify({ implements: [], verifies: [{ element: 'sc', name: 'Paying by card', tests: ['tests/pay.test.ts › pays by card'] }] }))
  await folder.write('.radical/model/.state/test-results.json', serializeTestResults(
    [{ file: 'tests/pay.test.ts', title: ['pays by card'], status: 'failed', message: 'AssertionError: expected "pending" to be "paid"' }], ['reports/vitest.json'], new Date()))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  await studio.designer()
  await page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: 'Specification' }) }).click()

  const card = studio.properties
  const section = (name: string) => card.getByRole('region', { name, exact: true })
  const head = (name: string) => section(name).locator('.pp-fold-toggle')
  await studio.node('sc').dblclick()
  await expect(card.locator('.pp-title')).toHaveValue('Paying by card')

  // Folded, each head says what its section holds.
  for (const name of ['Verification', 'Tests', 'Views']) await expect(head(name)).toHaveAttribute('aria-expanded', 'false')
  await expect(section('Verification').locator('.pp-ver-status')).toHaveText('✗ failed')
  await expect(section('Verification').locator('.pp-fold-count.error')).toHaveText('✖ 1')
  await expect(section('Verification').locator('.pp-fold-count.warning')).toHaveCount(0)
  await expect(section('Verification').locator('.pp-ver-finding')).toHaveCount(0)
  await expect(section('Verification').getByRole('button', { name: 'Path', exact: true })).toBeVisible()
  await expect(section('Tests').locator('.pp-fold-label')).toHaveText('Tests · 1')
  await expect(section('Tests').locator('.pp-fold-toggle .pp-test-outcome')).toHaveText(['1 failed'])
  await expect(section('Tests').locator('li')).toHaveCount(0)
  await expect(section('Views').locator('.pp-fold-label')).toHaveText('Views · 1')
  await expect(section('Views').locator('.pp-view')).toHaveCount(0)

  // A click opens Verification to its finding.
  await head('Verification').click()
  await expect(head('Verification')).toHaveAttribute('aria-expanded', 'true')
  await expect(section('Verification').locator('.pp-ver-finding .pp-ver-verdict')).toHaveText(/Test failed$/)
  // Open, its parts are apart, each under its own head: what is wrong
  // first, then what checks the element.
  await expect(section('Verification').locator('.pp-ver-group .pp-ver-sub')).toHaveText([/^Findings · 1$/])
  // Space opens Views to the view; Enter opens Tests and folds it again.
  await head('Views').focus()
  await page.keyboard.press('Space')
  await expect(head('Views')).toHaveAttribute('aria-expanded', 'true')
  await expect(section('Views').locator('.pp-view')).toHaveText(/Specification/)
  await head('Tests').focus()
  await page.keyboard.press('Enter')
  await expect(section('Tests').locator('li')).toHaveText(['tests/pay.test.ts › pays by cardfailed'])
  await page.keyboard.press('Enter')
  await expect(head('Tests')).toHaveAttribute('aria-expanded', 'false')
  await expect(section('Tests').locator('li')).toHaveCount(0)

  // As the user left them, for another element: the requirement it verifies.
  await page.keyboard.press('Escape')
  await studio.node('req').dblclick()
  await expect(card.locator('.pp-title')).toHaveValue('Take card payments')
  await expect(head('Verification')).toHaveAttribute('aria-expanded', 'true')
  await expect(section('Verification').getByRole('group', { name: 'Checked by' })).toContainText('Paying by card')
  await expect(head('Views')).toHaveAttribute('aria-expanded', 'true')

  // And after a reload.
  await page.reload()
  await studio.ready()
  await studio.node('sc').dblclick()
  await expect(card.locator('.pp-title')).toHaveValue('Paying by card')
  await expect(head('Verification')).toHaveAttribute('aria-expanded', 'true')
  await expect(head('Views')).toHaveAttribute('aria-expanded', 'true')
  await expect(head('Tests')).toHaveAttribute('aria-expanded', 'false')
})
