import { expect } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeMeasurementStore, serializeTestResults } from '@radical/common/check'
import type { C4Node, DiagramData } from '@radical/common/c4'

// The properties card is one in every perspective, and says what the check
// says of the element: its Verification (status, the conditions that are
// no test with what was measured, what checks it, the findings, Path). A
// link in the Inspector opens that card on the element's view.

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

const MODEL: DiagramData = {
  metamodel: builtInGovernanceMetamodel(),
  nodes: [
    node('shop', 'system', 'Shop', { x: 40, y: 40, width: 400, height: 260 }),
    node('api', 'container', 'Checkout API', { parentId: 'shop', x: 40, y: 60 }),
    node('need', 'need', 'Pay online', { x: 600, y: 40 }),
    node('req', 'requirement', 'Take card payments', { x: 600, y: 220, ears_type: 'ubiquitous', action: 'take card payments' }),
    node('s-green', 'scenario', 'Paying by card', { x: 600, y: 400, given: 'a cart', when: 'paying', then: 'paid', metrics: 'test(tests/pay.test.ts › pays by card) passed' }),
    node('s-red', 'scenario', 'Refunding a card', { x: 860, y: 400, given: 'a paid order', when: 'refunding', then: 'refunded', metrics: 'test(tests/pay.test.ts › refunds) passed' }),
    node('adr', 'adr', 'Fast checkout', { x: 1100, y: 40, status: 'accepted', date: '2026-11-01', context: 'c', decision: 'd', consequences: 'c' }),
    node('ff', 'fitness-fn', 'Checkout latency', { x: 1100, y: 220, metrics: 'checkout.latency.p95 <= 300 ms' }),
  ],
  relations: [
    { id: 'r1', relationType: 'derives', sourceId: 'req', targetId: 'need' },
    { id: 'r2', relationType: 'satisfies', sourceId: 'api', targetId: 'req' },
    { id: 'r3', relationType: 'verifies', sourceId: 's-green', targetId: 'req' },
    { id: 'r4', relationType: 'verifies', sourceId: 's-red', targetId: 'req' },
    { id: 'r5', relationType: 'implements', sourceId: 'ff', targetId: 'adr' },
    { id: 'r6', relationType: 'constrains', sourceId: 'adr', targetId: 'api' },
  ],
  views: [
    { id: 'v-arch', name: 'Architecture', nodeIds: ['shop', 'api'], positions: {} },
    { id: 'v-spec', name: 'Specification', nodeIds: ['need', 'req', 's-green', 's-red', 'adr', 'ff'], positions: {} },
  ],
}

test('the card says in every perspective what the check says of the element, and the Inspector opens the same card', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(MODEL, 'Shop'))) await folder.write(path, content)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  await folder.write('.state/test-results.json', serializeTestResults([
    { file: '/repo/tests/pay.test.ts', title: ['pays by card'], status: 'passed' },
    { file: '/repo/tests/pay.test.ts', title: ['refunds'], status: 'failed', message: 'AssertionError: expected "pending" to be "refunded"' },
  ], ['reports/unit.json']))
  await folder.write('.state/measurements.json', serializeMeasurementStore([
    { metric: 'checkout.latency.p95', value: 420, unit: 'ms', labels: {}, source: 'k6', at: new Date(Date.now() - 2 * 3600_000).toISOString() },
  ]))
  const inspector = page.locator('.activity-rail').getByRole('button', { name: /^Inspector(,|$)/ })
  await expect(inspector).toBeEnabled({ timeout: 10_000 })

  // In Viewer, where the model opens.
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Viewer/)
  const open = async (name: string): Promise<void> => {
    await page.locator('.quick-search-bar').getByPlaceholder(/^Search/).click()
    await page.keyboard.type(name)
    await page.locator('.quick-search-item', { hasText: name }).first().click()
    await expect(studio.properties.locator('.pp-title')).toHaveText(name)
  }
  await open('Take card payments')
  const verification = studio.properties.getByRole('region', { name: 'Verification' })
  await expect(verification.locator('.pp-ver-status')).toHaveText('✗ broken')
  await expect(verification.getByRole('group', { name: 'Checked by' }).getByRole('button')).toHaveText([/Paying by card.*✓/, /Refunding a card.*✗/])
  // What is wrong first, then the test by its title, its file apart, why it
  // failed, and the scenario that names it.
  const finding = verification.getByRole('group', { name: 'Findings' }).locator('.pp-ver-finding')
  await expect(finding.locator('.pp-ver-verdict')).toHaveText(/Test failed$/)
  await expect(finding.locator('.pp-ver-test b')).toHaveText('refunds')
  await expect(finding.locator('.pp-ver-test code')).toHaveText('tests/pay.test.ts')
  await expect(finding.locator('.pp-ver-reason')).toHaveText('AssertionError: expected "pending" to be "refunded"')
  await expect(finding.locator('.pp-ver-down').filter({ hasText: 'Named by' }).getByRole('button', { name: /Refunding a card/ })).toBeVisible()
  await expect(verification.getByRole('button', { name: 'Path', exact: true })).toBeEnabled()
  // A link moves the card to the element it names.
  await verification.getByRole('group', { name: 'Checked by' }).getByRole('button', { name: /Refunding a card/ }).click()
  await expect(studio.properties.locator('.pp-title')).toHaveText('Refunding a card')
  await expect(studio.properties.getByRole('region', { name: 'Verification' }).locator('.pp-ver-status')).toHaveText('✗ failed')

  // A fitness function: its metric condition with what was measured.
  await open('Checkout latency')
  // Off its limit, it is a finding, shown once: the condition, what was
  // measured, and no second line among the checks.
  const ffVerification = studio.properties.getByRole('region', { name: 'Verification' })
  const off = ffVerification.getByRole('group', { name: 'Findings' }).locator('.pp-ver-finding[data-rule="metric-failed"]')
  await expect(off.locator('.pp-ver-verdict')).toHaveText(/Metric failed$/)
  await expect(off.locator('.pp-ver-condition')).toHaveText('checkout.latency.p95 <= 300 ms')
  await expect(off.locator('.pp-ver-note')).toHaveText('Measured 420 ms · k6 · 2 h ago')
  await expect(ffVerification.getByRole('list', { name: 'Checks' }).locator('.pp-ver-cond')).toHaveCount(0)

  // A link in the Inspector opens the same card, on the element's view, in
  // the perspective open: read-only in Viewer.
  await inspector.click()
  await page.getByRole('tablist', { name: 'Inspector' }).getByRole('tab', { name: /^Overview/ }).click()
  await page.getByRole('region', { name: 'To fix' }).locator('.insp-finding').first().getByRole('button', { name: /Take card payments/ }).click()
  await expect(page.getByRole('region', { name: 'Inspector' })).toHaveCount(0)
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Viewer/)
  await expect(studio.node('req')).toHaveClass(/selected/)
  const card = studio.properties
  await expect(card.locator('.pp-title')).toHaveText('Take card payments')
  await expect(card.getByRole('textbox', { name: 'Name' })).toHaveCount(0)
  await expect(page.getByRole('complementary')).toHaveCount(1)
  await expect(card.getByRole('region', { name: 'Verification' }).locator('.pp-ver-status')).toHaveText('✗ broken')
  // Its links move the card, as in every perspective.
  await card.getByRole('group', { name: 'Checked by' }).getByRole('button', { name: /Paying by card/ }).click()
  await expect(card.locator('.pp-title')).toHaveText('Paying by card')
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Viewer/)
})
