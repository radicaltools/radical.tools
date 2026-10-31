import { expect } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeMeasurementStore, serializeTestResults, type TestCase } from '@radical/common/check'
import { serializeModelBase } from '@radical/common/formats/modelBase'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { HUB_PORT } from '../../playwright.config'

// The Inspector perspective shows what radical check says about a model
// kept in a folder: the rules run on the model as it is, the test results
// come from .radical/test-results.json, which `radical check --report`
// writes beside the model, and what sensors measured from
// .radical/measurements.json, which `radical sense` keeps there. Its tabs: Overview (the scores and what
// needs attention), Model, Implementation (what the tests say), This branch (with a base beside the
// model) and Settings (the folder's check.json); its header says how old the evidence is.

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

const results = (status: TestCase['status']): string =>
  serializeTestResults([{ file: '/repo/tests/pay.test.ts', title: ['pays by card'], status }], ['reports/unit.json'])

test('the Inspector shows what radical check says, and its links lead to the element', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(MODEL, 'Shop'))) await folder.write(path, content)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()

  // No report beside the model yet: nothing to inspect.
  const inspector = page.getByRole('button', { name: /^Inspector/ })
  await expect(inspector).toBeDisabled()
  await expect(inspector).toHaveAttribute('title', /no check report or measurements beside this model/)

  // radical check --report wrote one in which the scenario's test failed.
  await folder.write('.radical/test-results.json', results('failed'))
  await expect(inspector).toBeEnabled({ timeout: 10_000 })
  await expect(inspector.locator('.insp-count .e')).toHaveText('✖ 1')

  await inspector.click()
  await expect(page.locator('.insp-verdict')).toHaveText(/✖ 1 errors/)
  // No canvas here: no Fit All, zoom, Smart Layout, Undo or Redo.
  for (const name of ['Fit All', 'Smart Layout', 'Undo', 'Redo']) {
    await expect(page.locator('.toolbar').getByRole('button', { name })).toHaveCount(0)
  }
  // It opens on Overview. A failed test is about the implementation, not the model.
  await expect(page.getByRole('tab', { name: /^Overview/ })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: /^Model/ }).click()
  await expect(page.locator('.insp-error')).toHaveCount(0)
  await expect(page.locator('.insp-tile[data-dimension="traceability"]')).toContainText('100%')
  await page.getByRole('tab', { name: /^Implementation/ }).click()
  const error = page.locator('.insp-error')
  await expect(error).toContainText('test tests/pay.test.ts › pays by card failed.')
  await expect(page.locator('.insp-tile').first()).toContainText('0% · 0 / 1')
  await expect(page.locator('.insp-tile').first()).toContainText('1 broken')

  // What the failure leaves unverified is a link to the element.
  await error.locator('.insp-chain').getByRole('button', { name: /Take card payments/ }).click()
  const peek = page.getByRole('complementary', { name: 'Element' })
  await expect(peek.locator('h3')).toHaveText('Take card payments')
  await expect(peek).toContainText('broken')
  await expect(peek.locator('.insp-peek-sec').filter({ hasText: 'Checked by' })).toContainText('Paying by card')

  // From there to Designer, on the canvas that shows it, selected.
  await peek.getByRole('button', { name: /^Show on canvas/ }).click()
  // The canvas views that show it, to choose from.
  await expect(page.getByRole('menuitem')).toHaveText([/^Specification/])
  await page.getByRole('menuitem', { name: /^Specification/ }).click()
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Designer/)
  await expect(page.locator('.canvas-controls').getByRole('button', { name: 'Fit All' })).toBeVisible()
  await expect(page.getByText(/^Structure:/)).toHaveText('Structure: Specification')
  await expect(studio.node('req')).toHaveClass(/selected/)
  // One Back leads back to the Inspector: the move is one step.
  await expect(page).toHaveURL(/m\/designer\/v\/v-spec\/e\/req/)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Inspector/)
  await page.getByRole('button', { name: 'Forward', exact: true }).click()
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Designer/)
  await expect(studio.node('req')).toHaveClass(/selected/)

  // The test passes in the next run: the model is verified, no errors.
  await folder.write('.radical/test-results.json', results('passed'))
  await expect(inspector.locator('.insp-count .e')).toHaveCount(0, { timeout: 10_000 })
  await inspector.click()
  await expect(page.locator('.insp-verdict')).toHaveText(/No errors/)
  await page.getByRole('tab', { name: /^Implementation/ }).click()
  await expect(page.locator('.insp-tile').first()).toContainText('100% · 1 / 1')
  await expect(page.locator('.insp-tile').first()).toContainText('0 broken')
})

test('the Inspector opens on Overview with what needs attention, and each finding leads to its element or fixes it', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  // The branch added a requirement no scenario verifies and an accepted
  // decision no fitness function implements; the scenario's test failed.
  const model: DiagramData = {
    ...MODEL,
    nodes: [
      ...MODEL.nodes,
      node('refund', 'requirement', 'Refund payments', { x: 960, y: 220, ears_type: 'ubiquitous', action: 'refund payments' }),
      node('adr', 'adr', 'Card payments only', { x: 40, y: 400, status: 'accepted', date: '2026-10-29', context: 'c', decision: 'd', consequences: 'q' }),
    ],
    relations: [
      ...MODEL.relations,
      { id: 'r4', relationType: 'derives', sourceId: 'refund', targetId: 'need' },
      { id: 'r5', relationType: 'satisfies', sourceId: 'api', targetId: 'refund' },
    ],
    views: [MODEL.views![0], { id: 'v-spec', name: 'Specification', nodeIds: ['need', 'req', 'sc', 'refund', 'adr'], positions: {} }],
  }
  for (const [path, content] of Object.entries(serializeToMdFolder(model, 'Shop'))) await folder.write(path, content)
  await folder.write('.radical/test-results.json', results('failed'))
  await folder.write('.radical/base.json', serializeModelBase({ commit: '534f32f0a1b2c3d4e5f60718293a4b5c6d7e8f90', described: 'merge base with origin/main', branch: 'feat/refunds', nodes: MODEL.nodes, relations: MODEL.relations }))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await studio.ready()
  await page.getByRole('button', { name: /^Inspector/ }).click({ timeout: 10_000 })

  // Overview first: the scores of the model and of what the tests verify.
  await expect(page.getByRole('tab', { name: /^Overview/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab')).toHaveText([/^Overview/, /^Model/, /^Implementation/, /^This branch/, /^Settings/])
  const scores = page.getByRole('region', { name: 'Model scores' }).locator('.insp-score')
  await expect(scores).toHaveCount(4)
  await expect(scores.first()).toContainText('Consistency')
  const verified = page.getByRole('region', { name: 'Implementation scores' }).locator('.insp-score[data-metric="requirements-verified"]')
  await expect(verified).toContainText('Requirements verified')
  await expect(verified).toContainText('0%')

  // Needs attention: the error first, then the warnings, a group per rule with its count.
  const attention = page.getByRole('region', { name: 'Needs attention' })
  const groups = attention.locator('details.insp-group')
  await expect(groups.first()).toHaveAttribute('data-rule', 'test-failed')
  await expect(groups.first()).toHaveClass(/error/)
  await expect(groups.first()).toHaveAttribute('open', '')
  await expect(groups.first()).toContainText('test tests/pay.test.ts › pays by card failed.')
  const severities = await groups.evaluateAll((list) => list.map((g) => (g.classList.contains('error') ? 'error' : 'warning')))
  expect(severities.lastIndexOf('error')).toBeLessThan(severities.indexOf('warning'))
  const missing = attention.locator('details.insp-group[data-rule="requirement-without-scenario"]')
  await expect(missing.locator('summary')).toContainText('Requirement without scenario')
  await expect(missing.locator('summary')).toContainText('Every requirement is verified by at least one scenario.')
  await expect(missing.locator('summary .insp-rcount')).toHaveText('1')
  const undecided = attention.locator('details.insp-group[data-rule="adr-without-fitness-fn"]')
  await expect(undecided.locator('summary .insp-rcount')).toHaveText('1')
  // Warnings wait closed; a click opens the group to its elements.
  await expect(undecided).not.toHaveAttribute('open')
  await undecided.locator('summary').click()
  await expect(undecided.getByRole('button', { name: 'Add fitness function' })).toBeVisible()
  await undecided.getByRole('button', { name: 'Open Card payments only' }).click()
  const peek = page.getByRole('complementary', { name: 'Element' })
  await expect(peek.locator('h3')).toHaveText('Card payments only')
  await expect(peek.getByRole('button', { name: /^Show on canvas/ })).toBeVisible()

  // Add scenario: the scenario's wizard, the requirement offered as what it verifies.
  await missing.locator('summary').click()
  await missing.getByRole('button', { name: 'Add scenario' }).click()
  const wizard = page.getByRole('dialog', { name: 'New Scenario — wizard' })
  await expect(wizard).toBeVisible()
  await wizard.getByRole('textbox').first().fill('Refunding a payment')
  await wizard.getByRole('button', { name: 'Create' }).first().click()
  await expect(wizard).toBeHidden()
  await expect(peek.locator('h3')).toHaveText('Refunding a payment')
  // Nothing is left without a scenario; the new one stands beside the requirement.
  await expect(missing).toHaveCount(0, { timeout: 10_000 })
  await peek.getByRole('button', { name: /^Show on canvas/ }).click()
  await expect(page.getByRole('menuitem')).toHaveText([/^Specification/])
  await page.keyboard.press('Escape')
  // It verifies the requirement: This branch lists it as the requirement's scenario.
  await page.getByRole('tab', { name: /^This branch/ }).click()
  await expect(page.locator('.insp-branch-row', { hasText: 'Refund payments' }).first()).toContainText('Refunding a payment')
  // The verdict leads back to what needs attention.
  await page.locator('.insp-verdict').click()
  await expect(page.getByRole('tab', { name: /^Overview/ })).toHaveAttribute('aria-selected', 'true')
  await expect(attention.getByRole('heading', { name: 'Needs attention' })).toBeFocused()

  // This branch: only what the branch changed, so not the failed test.
  const onBranch = attention.getByRole('button', { name: 'This branch' })
  await expect(onBranch).toBeEnabled()
  await onBranch.click()
  await expect(attention.locator('details.insp-group[data-rule="test-failed"]')).toHaveCount(0)
  await expect(undecided).toBeVisible()
  await attention.getByRole('button', { name: 'All', exact: true }).click()
  await expect(attention.locator('details.insp-group[data-rule="test-failed"]')).toBeVisible()
})

test('the Inspector header says how old the test results are, and how to read them again', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(MODEL, 'Shop'))) await folder.write(path, content)
  const readAt = new Date(Date.now() - 8 * 86400e3)
  await folder.write('.radical/test-results.json', serializeTestResults([{ file: '/repo/tests/pay.test.ts', title: ['pays by card'], status: 'passed' }], ['reports/unit.json', 'reports/e2e.json'], readAt))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await studio.ready()
  await page.getByRole('button', { name: /^Inspector/ }).click({ timeout: 10_000 })

  // Eight days old, and the header says so, marked.
  const tests = page.locator('.insp-head .insp-age', { hasText: /Tests/ })
  await expect(tests).toContainText('8 d old')
  await expect(tests).toHaveClass(/marked/)
  await expect(page.locator('.insp-meta')).not.toContainText('tests read')
  await expect(page.locator('.insp-fresh')).toHaveCount(0)
  // Opened: when they were read, from which reports, and the command that reads them again.
  await tests.click()
  const pop = page.getByRole('dialog', { name: 'Tests' })
  const when = await page.evaluate((iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }), readAt.toISOString())
  await expect(pop).toContainText(`Test results read ${when}, 1 test case.`)
  await expect(pop).toContainText('From reports/unit.json, reports/e2e.json.')
  await expect(pop).toContainText('Read with --report.')
  // Read again here, or fetched from CI.
  await expect(pop.locator('.branch-cmd code')).toHaveText([/^npm run test:reports && radical check \S+ --report reports$/, /^radical check \S+ --from-ci$/])
  await expect(pop.getByRole('button', { name: 'Copy' })).toHaveCount(2)
  await page.keyboard.press('Escape')
  await expect(pop).toBeHidden()
  // Nothing measured, and no reviews to speak of.
  await expect(page.locator('.insp-head .insp-age', { hasText: /measurements/i })).toHaveText('No measurements')
  await expect(page.locator('.insp-head .insp-age', { hasText: /reviews/i })).toHaveCount(0)
})

test('the Overview tells an ADR without a fitness function from one whose fitness function has not run', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  const adr = (id: string, label: string, y: number): C4Node => node(id, 'adr', label, { x: 40, y, status: 'accepted', date: '2026-10-29', context: 'c', decision: 'd', consequences: 'q' })
  const model: DiagramData = {
    metamodel: builtInGovernanceMetamodel(),
    nodes: [
      adr('a-none', 'Payments in one service', 40),
      adr('a-empty', 'Errors as problem details', 200), node('f-empty', 'fitness-fn', 'Problem details everywhere', { x: 300, y: 200 }),
      adr('a-night', 'Large models open fast', 360),
      node('f-night', 'fitness-fn', 'Open time', { x: 300, y: 360, cadence: 'triggered', trigger: 'nightly', invocation: 'automated', metrics: 'studio.open_ms <= 11000 ms' }),
      adr('a-pr', 'One build for all workspaces', 520),
      node('f-pr', 'fitness-fn', 'Workspaces build', { x: 300, y: 520, cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', metrics: 'workspaces.exit_code == 0' }),
      adr('a-fail', 'Layered packages', 680),
      node('f-fail', 'fitness-fn', 'Layers hold', { x: 300, y: 680, cadence: 'triggered', trigger: 'pull-request', metrics: 'test(tests/layers.test.ts › layers hold) passed' }),
    ],
    relations: [
      { id: 'i1', relationType: 'implements', sourceId: 'f-empty', targetId: 'a-empty' },
      { id: 'i2', relationType: 'implements', sourceId: 'f-night', targetId: 'a-night' },
      { id: 'i3', relationType: 'implements', sourceId: 'f-pr', targetId: 'a-pr' },
      { id: 'i4', relationType: 'implements', sourceId: 'f-fail', targetId: 'a-fail' },
    ],
    views: [{ id: 'v-decisions', name: 'Decisions', nodeIds: [], positions: {} }],
  }
  for (const [path, content] of Object.entries(serializeToMdFolder(model, 'Shop'))) await folder.write(path, content)
  // Test results, in which the layers test failed; nothing measured.
  await folder.write('.radical/test-results.json', serializeTestResults([{ file: '/repo/tests/layers.test.ts', title: ['layers hold'], status: 'failed' }], ['reports/unit.json']))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await studio.ready()
  await page.getByRole('button', { name: /^Inspector/ }).click({ timeout: 10_000 })

  // Why each decision is not verified, the parts adding up to the five.
  const decisions = page.getByRole('region', { name: 'Implementation scores' }).locator('.insp-score[data-metric="adrs-verified"]')
  await expect(decisions).toContainText('0 of 5')
  await expect(decisions.locator('[data-why]')).toHaveText(['1 no fitness function', '1 no check', '2 not run (1 measured nightly)', '1 failing'])

  // Not run: both fitness functions nothing measured, with when they run;
  // the nightly one is expected not to have run here.
  const attention = page.getByRole('region', { name: 'Needs attention' })
  const notRun = attention.locator('details.insp-group[data-rule="not-run"]')
  await expect(notRun.locator('summary')).toContainText('Not run')
  await expect(notRun.locator('summary')).toContainText('Scenarios and fitness functions whose checks nothing ran in the results and measurements here.')
  await expect(notRun.locator('summary .insp-rcount')).toHaveText('2')
  await notRun.locator('summary').click()
  const pr = notRun.locator('.insp-finding[data-trigger="pull-request"]')
  await expect(pr).toContainText('Workspaces build')
  await expect(pr).toContainText('nothing measured workspaces.exit_code == 0')
  await expect(pr).not.toHaveClass(/expected/)
  const nightly = notRun.locator('.insp-finding[data-trigger="nightly"]')
  await expect(nightly).toContainText('Open time')
  await expect(nightly).toHaveClass(/expected/)
  await expect(nightly).toContainText('measured nightly — expected here')
  // After the rule groups.
  await expect(attention.locator('details.insp-group').last()).toHaveAttribute('data-rule', 'not-run')
  await nightly.getByRole('button', { name: 'Open Open time' }).click()
  await expect(page.getByRole('complementary', { name: 'Element' }).locator('h3')).toHaveText('Open time')

  // The Measurements chip: what waits for a measurement, and how to measure here.
  const measured = page.locator('.insp-head .insp-age', { hasText: /measurements/i })
  await expect(measured).toHaveText('No measurements')
  await measured.click()
  const pop = page.getByRole('dialog', { name: 'Measurements' })
  await expect(pop.locator('.insp-age-list li')).toHaveText([/^Workspaces build\s+pull-request$/, /^Open time\s+nightly$/])
  await expect(pop.locator('.branch-cmd code')).toHaveText([
    /^radical sense run --trigger pull-request --folder \S+ --out reports\/metrics$/,
    /^radical check \S+ --metrics reports\/metrics$/,
  ])
  await expect(pop.getByRole('button', { name: 'Copy' })).toHaveCount(2)
  await expect(pop).toContainText('the nightly workflow measures the nightly ones')
})

test('the Inspector shows each condition with its measurement', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  const model: DiagramData = {
    ...MODEL,
    nodes: [
      ...MODEL.nodes,
      node('adr', 'adr', 'Fast checkout', { x: 40, y: 400, status: 'accepted', date: '2026-10-29', context: 'c', decision: 'd', consequences: 'q' }),
      node('ff', 'fitness-fn', 'Checkout latency', { x: 40, y: 520, max_age: '7d', metrics: 'checkout.latency.p95{env=staging} <= 300 ms\ncheckout.errors.rate{env=staging} < 1 %' }),
    ],
    relations: [...MODEL.relations, { id: 'i', relationType: 'implements', sourceId: 'ff', targetId: 'adr' }],
  }
  for (const [path, content] of Object.entries(serializeToMdFolder(model, 'Shop'))) await folder.write(path, content)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()

  // radical sense measured the latency, too slow, two hours ago; nothing
  // measured the error rate. No test report: the measurements alone open it.
  const at = new Date(Date.now() - 2 * 3600e3).toISOString()
  await folder.write('.radical/measurements.json', serializeMeasurementStore([
    { metric: 'checkout.latency.p95', value: 0.42, unit: 's', labels: { env: 'staging' }, source: 'json', at },
  ]))
  const inspector = page.getByRole('button', { name: /^Inspector/ })
  await expect(inspector).toBeEnabled({ timeout: 10_000 })
  await inspector.click()
  await page.getByRole('tab', { name: /^Implementation/ }).click()
  await expect(page.locator('.insp-error')).toContainText('checkout.latency.p95{env=staging} <= 300 ms does not hold (0.42 s from json, 2 h ago).')
  const item = page.locator('.insp-attn-item').filter({ hasText: 'Checkout latency' })
  await expect(item).toContainText('a value is off its threshold, nothing measured a value')
  await item.getByRole('button', { name: /Checkout latency/ }).click()

  const checks = page.getByRole('complementary', { name: 'Element' }).locator('.insp-peek-sec').filter({ hasText: 'Checks (2)' })
  const lines = checks.locator('.insp-test')
  await expect(lines.nth(0)).toContainText('checkout.latency.p95{env=staging} <= 300 ms')
  await expect(lines.nth(0)).toContainText('failed')
  await expect(lines.nth(0).locator('.insp-measured')).toHaveText('0.42 s · json · 2 h ago')
  await expect(lines.nth(1)).toContainText('checkout.errors.rate{env=staging} < 1 %')
  await expect(lines.nth(1)).toContainText('not measured')

  // Measured again, both within their thresholds: the decision is verified.
  const now = new Date().toISOString()
  await folder.write('.radical/measurements.json', serializeMeasurementStore([
    { metric: 'checkout.errors.rate', value: 0.2, unit: '%', labels: { env: 'staging' }, source: 'json', at: now },
    { metric: 'checkout.latency.p95', value: 210, unit: 'ms', labels: { env: 'staging' }, source: 'json', at: now },
  ]))
  await expect(page.locator('.insp-error')).toHaveCount(0, { timeout: 10_000 })
  await expect(lines.nth(0).locator('.insp-measured')).toHaveText('210 ms · json · 0 min ago')
  await expect(lines.nth(1)).not.toContainText('not measured')
})

test('a deep link opens the Inspector at once, and only with all it reads', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(MODEL, 'Shop'))) await folder.write(path, content)
  await folder.write('.radical/test-results.json', results('failed'))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await studio.ready()
  await page.getByRole('button', { name: /^Inspector/ }).click({ timeout: 10_000 })
  await expect(page).toHaveURL(/m\/inspector/)

  // Record what the page shows from its first paint on.
  await page.addInitScript(() => {
    const seen = new Set<string>()
    ;(window as unknown as { __seen: Set<string> }).__seen = seen
    new MutationObserver(() => {
      if (document.querySelector('.react-flow')) seen.add('canvas')
      if (document.querySelector('.insp-notice') || document.querySelector('.insp-tabs')?.textContent?.includes('no results')) seen.add('inspector without test results')
      const tile = document.querySelector('.insp-tile .insp-label')?.textContent
      if (tile && tile !== 'Consistency') seen.add(`tile ${tile}`)
    }).observe(document, { childList: true, subtree: true, characterData: true })
  })
  await page.reload()
  await expect(page.locator('.insp-verdict')).toHaveText(/✖ 1 errors/, { timeout: 15_000 })
  await expect(page.getByRole('tab', { name: /^Implementation/ })).toContainText('✗ 1')
  expect(await page.evaluate(() => [...(window as unknown as { __seen: Set<string> }).__seen])).toEqual([])
})

test('Settings save goals and rules to check.json, and say when a change loosens the gate', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(MODEL, 'Shop'))) await folder.write(path, content)
  await folder.write('check.json', JSON.stringify({ rules: { 'requirement-without-scenario': { severity: 'error', max: 3 } } }, null, 2) + '\n')
  await folder.write('.radical/test-results.json', results('passed'))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await studio.ready()
  await page.getByRole('button', { name: /^Inspector/ }).click({ timeout: 10_000 })
  await page.getByRole('tab', { name: /^Settings/ }).click()

  // A higher baseline lets more through: the row and the bar say so.
  await page.getByRole('spinbutton', { name: 'Baseline of requirement-without-scenario' }).fill('5')
  await expect(page.locator('.insp-savebar')).toContainText('1 unsaved change')
  await expect(page.locator('.insp-savebar')).toContainText('It loosens the CI gate.')
  await expect(page.locator('.insp-set-warn')).toContainText('max 3 → 5 loosens the CI gate')
  await page.getByRole('button', { name: 'Discard' }).click()
  await expect(page.locator('.insp-savebar')).toHaveCount(0)

  // Ratchet brings the baseline down to what the check finds: none.
  await page.getByRole('button', { name: 'Ratchet' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Baseline of requirement-without-scenario' })).toHaveValue('0')
  await expect(page.locator('.insp-savebar')).toContainText('Each one tightens the gate or keeps it.')

  // Two goals, one on the model and one on what the tests verify, saved
  // with the ratchet as the diff shows them.
  await page.getByRole('button', { name: '+ Add goal' }).click()
  await page.getByRole('spinbutton', { name: 'Goal for Requirements verified' }).fill('100')
  await page.getByRole('spinbutton', { name: 'Goal for Scenarios that name a check' }).fill('90')
  await page.locator('.insp-diff summary').click()
  await expect(page.locator('.insp-diff pre')).toContainText('+   "goals": {')
  await page.getByRole('button', { name: 'Save to check.json' }).click()
  await expect(page.locator('.insp-savebar')).toHaveCount(0)

  const saved = JSON.parse((await folder.files())['check.json'])
  expect(saved).toEqual({
    rules: { 'requirement-without-scenario': { severity: 'error', max: 0 } },
    goals: { 'requirements-verified': { min: 100 }, 'scenarios-with-metrics': { min: 90 } },
  })
  await page.getByRole('tab', { name: /^Model/ }).click()
  await expect(page.getByRole('tab', { name: /^Model/ })).toContainText('1 / 1 goals')
  await expect(page.getByRole('tab', { name: /^Implementation/ })).toContainText('1 / 1 goals')
})

test('Settings edits wait for Save on another tab and after Back, and the tab says so', async ({ page, studio }) => {
  // The draft lived in the tab: another tab or Back dropped it without a word.
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(MODEL, 'Shop'))) await folder.write(path, content)
  await folder.write('.radical/test-results.json', results('passed'))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await studio.ready()
  await page.getByRole('button', { name: /^Inspector/ }).click({ timeout: 10_000 })
  const settings = page.getByRole('tab', { name: /^Settings/ })
  await settings.click()
  await page.getByRole('button', { name: '+ Add goal' }).click()
  await page.getByRole('spinbutton', { name: 'Goal for Requirements verified' }).fill('90')
  await expect(page.locator('.insp-savebar')).toContainText('1 unsaved change')
  await expect(settings).toContainText('unsaved')

  await page.getByRole('tab', { name: /^Model/ }).click()
  await expect(page).toHaveURL(/\/t\/model/)
  await settings.click()
  await expect(page).toHaveURL(/\/t\/settings/)
  await expect(page.locator('.insp-savebar')).toContainText('1 unsaved change')
  await page.getByRole('tab', { name: /^Implementation/ }).click()
  await expect(page).toHaveURL(/\/t\/implementation/)
  await page.goBack()
  await expect(settings).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('spinbutton', { name: 'Goal for Requirements verified' })).toHaveValue('90')
  // Discarded, the tab is check.json again.
  await page.getByRole('button', { name: 'Discard' }).click()
  await expect(settings).not.toContainText('unsaved')
  expect((await folder.files())['check.json']).toBeUndefined()
})

test('Settings count stale references as the check does, and leave the rules on the folder\'s files to radical check', async ({ page, studio }) => {
  // Studio said "—" for stale-reference, which it counts, and counted 0 for
  // folder-not-a-node, which only the CLI reads: Ratchet took its baseline
  // to 0 while CI still found 1.
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  const model = { ...MODEL, views: [...MODEL.views!, { id: 'v-gone', name: 'Gone', nodeIds: ['nobody'], positions: {} }] }
  for (const [path, content] of Object.entries(serializeToMdFolder(model, 'Shop'))) await folder.write(path, content)
  await folder.write('check.json', JSON.stringify({ rules: { 'folder-not-a-node': { severity: 'error', max: 1 }, 'stale-reference': { max: 2 } } }, null, 2) + '\n')
  await folder.write('.radical/test-results.json', results('passed'))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await studio.ready()
  await page.getByRole('button', { name: /^Inspector/ }).click({ timeout: 10_000 })
  await page.getByRole('tab', { name: /^Settings/ }).click()
  await expect(page.locator('.insp-set-row[data-rule="stale-reference"] .insp-set-now')).toHaveText('1')
  await expect(page.locator('.insp-set-row[data-rule="folder-not-a-node"] .insp-set-now')).toHaveText('—')
  await expect(page.locator('.insp-ratchet')).toContainText('1 baseline can come down: stale-reference 2 → 1')
  await page.getByRole('button', { name: 'Ratchet' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Baseline of folder-not-a-node' })).toHaveValue('1')
})

test('a link to the Inspector of a model with nothing for it opens Viewer, as its greyed-out button says', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(MODEL, 'Shop'))) await folder.write(path, content)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await studio.ready()
  const inspector = page.getByRole('button', { name: /^Inspector/ })
  await expect(inspector).toBeDisabled()
  await expect(page).toHaveURL(/\/m\/viewer/)
  await page.goto(page.url().replace(/\/m\/[a-z]+.*$/, '/m/inspector/v/all/t/settings'))
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Viewer/, { timeout: 15_000 })
  await expect(page).toHaveURL(/\/m\/viewer/)
  await expect(page.locator('.insp')).toHaveCount(0)
  await expect(inspector).toBeDisabled()
})

test('the Inspector asks the questions of an unaddressed concern and the import settles it', async ({ page, studio }) => {
  // The Hub's catalogue, from this build's Hub instead of hub.radical.tools.
  await page.route(/^https:\/\/hub\.radical\.tools\/hub\//, async (route) => {
    const response = await route.fetch({ url: `http://localhost:${HUB_PORT}` + new URL(route.request().url()).pathname })
    await route.fulfill({ response, headers: { ...response.headers(), 'content-type': 'application/json' } })
  })
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  const shop: DiagramData = {
    metamodel: builtInGovernanceMetamodel(),
    nodes: [
      node('user', 'person', 'Customer', { x: 40, y: 40 }),
      node('shop', 'system', 'Shop', { x: 40, y: 260, width: 360, height: 220 }),
      node('web', 'webapp', 'Storefront', { parentId: 'shop', x: 40, y: 60 }),
    ],
    relations: [{ id: 'u', relationType: 'interacts', sourceId: 'user', targetId: 'web' }],
    views: [{ id: 'v-shop', name: 'Shop', nodeIds: [], positions: {} }],
  }
  for (const [path, content] of Object.entries(serializeToMdFolder(shop, 'Shop'))) await folder.write(path, content)
  await folder.write('.radical/test-results.json', results('passed'))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await studio.ready()
  await page.getByRole('button', { name: /^Inspector/ }).click({ timeout: 10_000 })
  await page.getByRole('tab', { name: /^Model/ }).click()

  const decisions = page.locator('details.insp-dim[data-dimension="decisions"]')
  await expect(decisions).toBeVisible({ timeout: 10_000 })
  if ((await decisions.getAttribute('open')) === null) await decisions.locator('summary').click()
  // Several packs apply to a web app people use; authentication is one.
  const item = page.locator('.insp-item', { has: page.getByTestId('concern-finding') }).filter({ hasText: 'Authentication:' })
  await expect(item).toBeVisible({ timeout: 10_000 })
  const finding = item.getByTestId('concern-finding')
  await expect(item).toContainText('Authentication: people or external systems reach these elements')
  await expect(item).toContainText('Storefront')
  await expect(finding).toContainText('How do people sign in?')

  await finding.getByRole('button', { name: 'Answer the questions…' }).click()
  const wizard = page.getByTestId('concern-wizard')
  await expect(wizard).toBeVisible()
  await expect(wizard.getByRole('checkbox', { name: /^Storefront.*Suggested/ })).toHaveAttribute('aria-checked', 'true')
  const step = (title: string) => wizard.locator('.nw-step', { hasText: title })
  await step('Sign-in').click()
  await wizard.getByRole('radio', { name: /^Nobody signs in/ }).click()
  // Nobody signs in: no second factor to ask about.
  await expect(step('Second factor')).toHaveCount(0)
  await step('Other systems').click()
  await wizard.getByRole('radio', { name: /^None\b/ }).click()
  await step('Review').click()
  await expect(wizard.getByTestId('concern-brings')).toContainText('1 requirement')
  await expect(wizard.getByTestId('concern-brings')).toContainText('Public by design')
  await wizard.getByRole('button', { name: 'Add to model' }).click()

  // Still in the Inspector, the concern settled.
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Inspector/)
  await expect(page.locator('.insp-item').filter({ hasText: 'Authentication:' })).toHaveCount(0, { timeout: 10_000 })
  await expect(page.getByTestId('concern-finding').first()).toBeVisible()
})
