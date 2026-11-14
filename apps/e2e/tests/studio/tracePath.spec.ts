import { expect } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeTestResults } from '@radical/common/check'
import type { C4Node, DiagramData } from '@radical/common/c4'

// The Inspector's verification path: from the element panel of a
// requirement, every path through it in columns, need → requirement →
// scenario → test, the failing branch first with why its test failed.

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

const MODEL: DiagramData = {
  metamodel: builtInGovernanceMetamodel(),
  nodes: [
    node('need', 'need', 'Pay online', { x: 40, y: 40 }),
    node('req', 'requirement', 'Take card payments', { x: 40, y: 220, ears_type: 'ubiquitous', action: 'take card payments' }),
    node('s-green', 'scenario', 'Paying by card', { x: 40, y: 400, given: 'a cart', when: 'paying', then: 'paid', metrics: 'test(tests/pay.test.ts › pays by card) passed' }),
    node('s-red', 'scenario', 'Refunding a card', { x: 300, y: 400, given: 'a paid order', when: 'refunding', then: 'refunded', metrics: 'test(tests/pay.test.ts › refunds) passed' }),
  ],
  relations: [
    { id: 'r1', relationType: 'derives', sourceId: 'req', targetId: 'need' },
    { id: 'r2', relationType: 'verifies', sourceId: 's-green', targetId: 'req' },
    { id: 'r3', relationType: 'verifies', sourceId: 's-red', targetId: 'req' },
  ],
  views: [{ id: 'v-spec', name: 'Specification', nodeIds: ['need', 'req', 's-green', 's-red'], positions: {} }],
}

test('the verification path goes from a requirement to its need and to the test that fails it', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(MODEL, 'Shop'))) await folder.write(path, content)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  await folder.write('.state/test-results.json', serializeTestResults([
    { file: '/repo/tests/pay.test.ts', title: ['pays by card'], status: 'passed', durationMs: 40, line: 5 },
    { file: '/repo/tests/pay.test.ts', title: ['refunds'], status: 'failed', durationMs: 1200, line: 12, message: 'AssertionError: expected "pending" to be "refunded"' },
  ], ['reports/unit.json']))
  const inspector = page.getByRole('button', { name: /^Inspector/ })
  await expect(inspector).toBeEnabled({ timeout: 10_000 })
  await inspector.click()
  await page.getByRole('tab', { name: /^Implementation/ }).click()
  await page.locator('.insp-error .insp-chain').getByRole('button', { name: /Take card payments/ }).click()

  // The element's card, as in every perspective, with a way to the whole path.
  const peek = page.getByRole('complementary', { name: 'Properties' })
  const verification = peek.getByRole('region', { name: 'Verification' })
  await expect(verification.getByRole('group', { name: 'Checked by' })).toContainText('Refunding a card')
  await verification.getByRole('button', { name: 'Path', exact: true }).click()

  const panel = page.getByTestId('trace-panel')
  await expect(panel).toBeVisible()
  // The path is a place of its own: a link opens it, Back leaves it.
  await expect(page).toHaveURL(/\/m\/inspector\/.*\/tr\/req/)
  await expect(page.getByRole('tab', { name: /^Implementation/ })).toBeHidden()
  await expect(panel.locator('.trace-col-head')).toHaveText(['Need', 'Requirement', 'Scenario', 'Test'])
  // The failing scenario first; the requirement asked for marked.
  await expect(panel.getByTestId('trace-node')).toHaveText([/Pay online/, /Take card payments/, /Refunding a card/, /Paying by card/])
  await expect(panel.locator('[data-testid="trace-node"].target')).toHaveAttribute('data-id', 'req')
  const failed = panel.getByTestId('trace-result').first()
  await expect(failed).toContainText('tests/pay.test.ts')
  await expect(failed).toContainText('refunds')
  await expect(failed).toContainText('failed')
  await expect(failed.locator('.trace-message')).toHaveText('AssertionError: expected "pending" to be "refunded"')
  await expect(failed).toContainText('1.2 s')
  // A folder picked in the browser has no path for VS Code to open.
  await expect(panel.getByRole('link', { name: /Open in VS Code/ })).toHaveCount(0)
  // A line from each element to what is under it, red where it fails.
  await expect(panel.locator('.trace-line')).toHaveCount(5)
  await expect(panel.locator('.trace-line.bad')).toHaveCount(3)

  // Only what does not pass.
  await panel.getByLabel('Only what does not pass').check()
  await expect(panel.getByTestId('trace-node')).toHaveText([/Pay online/, /Take card payments/, /Refunding a card/])
  await panel.getByLabel('Only what does not pass').uncheck()

  // A click on the need makes the path the need's; Back returns.
  await panel.getByTestId('trace-node').filter({ hasText: 'Pay online' }).locator('.trace-label').click()
  await expect(panel.locator('[data-testid="trace-node"].target')).toHaveAttribute('data-id', 'need')
  await expect(panel.locator('.insp-meta')).toContainText('Pay online')
  await panel.getByRole('button', { name: '← Back' }).click()
  await expect(panel.locator('[data-testid="trace-node"].target')).toHaveAttribute('data-id', 'req')

  // Details opens an element's panel beside the path.
  await panel.getByTestId('trace-node').filter({ hasText: 'Refunding a card' }).getByRole('button', { name: 'Details' }).click()
  await expect(peek.locator('.pp-title')).toHaveText('Refunding a card')

  await panel.getByRole('button', { name: 'Close' }).click()
  await expect(panel).toBeHidden()
  await expect(page.getByRole('tab', { name: /^Implementation/ })).toBeVisible()
  await expect(page).not.toHaveURL(/\/tr\//)
  // Studio's Back returns to the path, Forward leaves it again.
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(panel.locator('[data-testid="trace-node"].target')).toHaveAttribute('data-id', 'req')
  await page.getByRole('button', { name: 'Forward', exact: true }).click()
  await expect(panel).toBeHidden()
})

test('the properties card in Viewer opens the verification path in the Inspector', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  const model: DiagramData = {
    ...MODEL,
    nodes: [...MODEL.nodes, node('api', 'container', 'Checkout API', { x: 600, y: 40 })],
    views: [{ id: 'v-spec', name: 'Specification', nodeIds: ['need', 'req', 's-green', 's-red', 'api'], positions: {} }],
  }
  for (const [path, content] of Object.entries(serializeToMdFolder(model, 'Shop'))) await folder.write(path, content)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  // A model opened without a link starts in Viewer.
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Viewer/)
  // Each element opened from Quick Search, with its card.
  const open = async (name: string): Promise<void> => {
    await page.locator('.quick-search-bar').getByPlaceholder(/^Search/).click()
    await page.keyboard.type(name)
    await page.locator('.quick-search-item', { hasText: name }).first().click()
    await expect(studio.properties).toContainText(name)
  }

  // Only on what a path is made of: not on a container.
  await open('Checkout API')
  await expect(studio.properties.getByRole('button', { name: 'Explore', exact: true })).toBeVisible()
  await expect(studio.properties.getByRole('button', { name: 'Path', exact: true })).toHaveCount(0)

  // No test results beside the model yet: Path says why it waits.
  await open('Take card payments')
  const path = studio.properties.getByRole('button', { name: 'Path', exact: true })
  await expect(path).toBeDisabled()
  await expect(path).toHaveAttribute('title', /no check report or measurements beside this model/)

  await folder.write('.state/test-results.json', serializeTestResults([
    { file: '/repo/tests/pay.test.ts', title: ['pays by card'], status: 'passed' },
    { file: '/repo/tests/pay.test.ts', title: ['refunds'], status: 'failed', message: 'AssertionError: expected "pending" to be "refunded"' },
  ], ['reports/unit.json']))
  await expect(path).toBeEnabled({ timeout: 10_000 })

  await studio.properties.getByRole('button', { name: 'Path', exact: true }).click()
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Inspector/)
  const panel = page.getByTestId('trace-panel')
  await expect(panel.locator('[data-testid="trace-node"].target')).toHaveAttribute('data-id', 'req')
  await expect(panel.locator('.trace-message')).toHaveText('AssertionError: expected "pending" to be "refunded"')
  await expect(page).toHaveURL(/\/tr\/req/)

  // Back returns to Viewer; the Inspector's button then opens its tabs.
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Viewer/)
  await expect(page).not.toHaveURL(/\/tr\//)
  await page.locator('.toolbar-mode-btn', { hasText: 'Inspector' }).click()
  await expect(page.getByRole('tab', { name: /^Overview/ })).toBeVisible()
  await expect(panel).toBeHidden()
})
