import { expect } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeTestResults, type TestCase } from '@radical/common/check'
import { serializeModelBase } from '@radical/common/formats/modelBase'
import type { C4Node, DiagramData } from '@radical/common/c4'
import type { Page } from '@playwright/test'

// What the Inspector says the user has to fix. Under the Overview's scores,
// To fix lists only what fails the check, counted as what has to be settled for the
// check to pass, so a rule one finding over its baseline is one to fix, not
// every finding it has, and the one the branch brought comes first. A goal
// not met says how many more elements reach it. What does not fail the
// check is in the Debt tab, and each finding is in one place: Model and
// Implementation list none. A finding says what is wrong first, and a test
// shows by its title, its file apart.

const inspectorButton = (page: Page) => page.locator('.activity-rail').getByRole('button', { name: /^Inspector(,|$)/ })
const tab = (page: Page, name: RegExp) => page.getByRole('tablist', { name: 'Inspector' }).getByRole('tab', { name })
const report = (page: Page) => page.getByRole('region', { name: 'Inspector' })

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
const requirement = (id: string, label: string, y: number): C4Node =>
  node(id, 'requirement', label, { x: 960, y, ears_type: 'ubiquitous', action: label.toLowerCase() })

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

/** MODEL with requirements no scenario verifies, derived from the need and
 *  satisfied by the API. */
function withRequirements(model: DiagramData, added: C4Node[]): DiagramData {
  return {
    ...model,
    nodes: [...model.nodes, ...added],
    relations: [...model.relations, ...added.flatMap((n) => [
      { id: `d-${n.id}`, relationType: 'derives', sourceId: n.id, targetId: 'need' },
      { id: `s-${n.id}`, relationType: 'satisfies', sourceId: 'api', targetId: n.id },
    ])],
    views: [model.views![0], { ...model.views![1], nodeIds: [...model.views![1].nodeIds, ...added.map((n) => n.id)] }],
  }
}

const results = (status: TestCase['status'], message?: string): string =>
  serializeTestResults([{ file: '/repo/tests/pay.test.ts', title: ['pays by card'], status, ...(message ? { message } : {}) }], ['reports/unit.json'])

async function openFolder(page: Page, studio: { ready: () => Promise<void> }, folder: ModelFolder, files: Record<string, string>): Promise<void> {
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(files)) await folder.write(path, content)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await studio.ready()
  await inspectorButton(page).click({ timeout: 10_000 })
}

test('a rule one finding over its baseline is one to fix, and the finding of the branch comes first', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  // Two requirements without a scenario were there, within the baseline of
  // two; the branch added a third.
  const before = withRequirements(MODEL, [requirement('gift', 'Take gift cards', 220), requirement('tax', 'Add the tax', 400)])
  const model = withRequirements(before, [requirement('abroad', 'Ship abroad', 580)])
  await openFolder(page, studio, folder, {
    ...serializeToMdFolder(model, 'Shop'),
    'check.json': JSON.stringify({ rules: { 'requirement-without-scenario': { severity: 'error', max: 2 } } }, null, 2) + '\n',
    '.state/test-results.json': results('passed'),
    '.state/base.json': serializeModelBase({ commit: '534f32f0a1b2c3d4e5f60718293a4b5c6d7e8f90', described: 'merge base with origin/main', branch: 'feat/abroad', nodes: before.nodes, relations: before.relations }),
  })

  // One to fix, on the rail and in the verdict, whose tooltip says what
  // radical check counts: every finding of the rule is an error there.
  await expect(inspectorButton(page).locator('.lp-rail-count')).toHaveText('1')
  const verdict = page.locator('.insp-verdict')
  await expect(verdict).toHaveText('✖ 1 to fix')
  await expect(verdict).toHaveAttribute('title', /radical check counts 3 errors/)
  await expect(tab(page, /^Overview/)).toContainText('1 to fix')

  // To fix says how far over its baseline the rule is, and what settles it.
  const toFix = page.getByRole('region', { name: 'To fix' })
  const rule = toFix.locator('details.insp-group[data-rule="requirement-without-scenario"]')
  await expect(rule.locator('summary .insp-group-name')).toHaveText('Requirement without scenario')
  await expect(rule.locator('summary .insp-rcount')).toHaveText('1 over · 3 · max 2')
  await expect(rule.locator('.insp-settle')).toHaveText('1 over its baseline of 2: settling any one of its 3 findings passes the check. One is about what this branch changed.')
  // The requirement of the branch first, marked, with its fix.
  const mine = rule.locator('.insp-group-items > .insp-finding')
  await expect(mine).toHaveCount(1)
  await expect(mine).toContainText('Ship abroad')
  await expect(mine).toHaveAttribute('data-branch', '')
  await expect(mine.locator('.insp-pill.new')).toHaveText('this branch')
  await expect(mine.getByRole('button', { name: 'Add scenario in Designer' })).toBeVisible()
  // The other two wait folded: any of them settles it too.
  const others = rule.locator('details.insp-others')
  await expect(others.locator('summary')).toHaveText('Any of the other 2 settles it too')
  await expect(others).not.toHaveAttribute('open')
  await others.locator('summary').click()
  await expect(others.locator('.insp-finding')).toHaveCount(2)
  await expect(others).toContainText('Take gift cards')
  await expect(others.locator('.insp-pill.new')).toHaveCount(0)

  // What is to fix is not debt: the Debt tab does not list the rule.
  await tab(page, /^Debt/).click()
  await expect(report(page).locator('details.insp-group').first()).toBeVisible()
  await expect(report(page).locator('[data-rule="requirement-without-scenario"]')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Within baselines' })).toHaveCount(0)

  // Settled, the rule is within its baseline again: nothing to fix, and
  // the two of before are debt.
  await tab(page, /^Overview/).click()
  await studio.designer()
  await mine.getByRole('button', { name: 'Add scenario', exact: true }).click()
  const wizard = page.getByRole('dialog', { name: 'New Scenario — wizard' })
  await wizard.getByRole('textbox').first().fill('Shipping to another country')
  await wizard.getByRole('button', { name: 'Create' }).first().click()
  await expect(wizard).toBeHidden()
  await expect(inspectorButton(page).locator('.lp-rail-count')).toHaveText('0', { timeout: 10_000 })
  await inspectorButton(page).click()
  await expect(page.locator('.insp-verdict')).toHaveText('✓ Nothing to fix')
  await expect(toFix).toContainText('Nothing to fix. The check passes')
  await tab(page, /^Debt/).click()
  const within = page.getByRole('region', { name: 'Within baselines' })
  await expect(within.locator('details.insp-group[data-rule="requirement-without-scenario"] .insp-rcount')).toHaveText('2 · max 2')
})

test('a goal not met is one to fix that says how many more reach it, and leads to what misses it', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  // One requirement of two has a scenario; the goal is 100%.
  await openFolder(page, studio, folder, {
    ...serializeToMdFolder(withRequirements(MODEL, [requirement('refund', 'Refund payments', 220)]), 'Shop'),
    'check.json': JSON.stringify({ goals: { 'requirements-with-scenario': { min: 100 } } }, null, 2) + '\n',
    '.state/test-results.json': results('passed'),
  })

  await expect(page.locator('.insp-verdict')).toHaveText('✖ 1 to fix')
  const toFix = page.getByRole('region', { name: 'To fix' })
  const goal = toFix.locator('details.insp-group[data-rule="goal-unmet/requirements-with-scenario"]')
  await expect(goal.locator('summary .insp-group-name')).toHaveText('Goal not met: Requirements with a scenario')
  await expect(goal.locator('summary .insp-rcount')).toHaveText('50% · goal ≥ 100%')
  await expect(goal.locator('.insp-finding')).toContainText('1 more reaches the goal: 1 of 2 meet it now.')
  // The requirement that misses it is a warning of its rule: no group of To fix.
  await expect(toFix.locator('details.insp-group')).toHaveCount(1)

  // Show what misses it: the rule's findings, in Debt, open.
  await goal.getByRole('button', { name: 'Show what misses it' }).click()
  await expect(tab(page, /^Debt/)).toHaveAttribute('aria-selected', 'true')
  const missing = report(page).locator('details.insp-group[data-rule="requirement-without-scenario"]')
  await expect(missing).toHaveAttribute('open', '')
  await expect(missing).toHaveClass(/asked/)
  await expect(missing.locator('.insp-finding')).toContainText('Refund payments')
})

test('Model and Implementation list no findings, and a link of the chain opens the findings of its rule', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await openFolder(page, studio, folder, {
    ...serializeToMdFolder(withRequirements(MODEL, [requirement('refund', 'Refund payments', 220)]), 'Shop'),
    '.state/test-results.json': results('failed'),
  })

  // Model: the analysis, and neither errors nor findings by dimension.
  await tab(page, /^Model/).click()
  await expect(report(page).getByRole('heading', { name: 'Traceability chain' })).toBeVisible()
  await expect(report(page).getByRole('heading', { name: 'Goals' })).toBeVisible()
  await expect(report(page).getByRole('heading', { name: /^(Errors|Findings by dimension)$/ })).toHaveCount(0)
  await expect(report(page).locator('.insp-finding')).toHaveCount(0)
  // The link that falls short opens the findings of its rule where they
  // are: it warns, so in Debt.
  await report(page).getByRole('button', { name: /verified by a scenario/ }).click()
  await expect(tab(page, /^Debt/)).toHaveAttribute('aria-selected', 'true')
  const missing = report(page).locator('details.insp-group[data-rule="requirement-without-scenario"]')
  await expect(missing).toHaveAttribute('open', '')
  await expect(missing.locator('.insp-finding')).toContainText('Refund payments')
  // What the rule asks is in bold in its description, and what the
  // finding's sentence quotes in bold in it.
  await expect(missing.locator('summary .insp-rdesc')).toHaveText('Every requirement is verified by at least one scenario.')
  await expect(missing.locator('summary .insp-rdesc strong')).toHaveText('Every requirement is verified by at least one scenario')
  await expect(missing.locator('.insp-finding .finding-quote')).toHaveText('"Refund payments"')

  // Implementation: the scenario that does not pass under Not passing, and no findings.
  await tab(page, /^Implementation/).click()
  const notPassing = page.getByRole('region', { name: 'Not passing' })
  await expect(notPassing).toContainText('Paying by card')
  await expect(notPassing).toContainText('a test failed')
  await expect(report(page).getByRole('heading', { name: /^(Errors|Findings by dimension|Needs attention)$/ })).toHaveCount(0)
  await expect(report(page).locator('.insp-finding')).toHaveCount(0)
})

test('a finding about a test says what is wrong first, and shows the test by its title, its file apart', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  // The scenario names a test that failed, and one whose file no report has.
  const model: DiagramData = {
    ...MODEL,
    nodes: MODEL.nodes.map((n) => n.id === 'sc'
      ? { ...n, metrics: 'test(tests/pay.test.ts › Checkout › pays by card) passed\ntest(tests/later.test.ts › refunds a payment) passed' } as C4Node
      : n),
  }
  await openFolder(page, studio, folder, {
    ...serializeToMdFolder(model, 'Shop'),
    '.state/test-results.json': serializeTestResults([
      { file: '/repo/tests/pay.test.ts', title: ['Checkout', 'pays by card'], status: 'failed', message: 'AssertionError: expected "pending" to be "paid"' },
    ], ['reports/unit.json']),
  })

  // To fix: under Test failed, the test by its title, with where it is,
  // why it failed, and what it leaves unverified.
  const failed = page.getByRole('region', { name: 'To fix' }).locator('details.insp-group[data-rule="test-failed"]')
  await expect(failed.locator('summary .insp-group-name')).toHaveText('Test failed')
  const finding = failed.locator('.insp-finding')
  await expect(finding.locator('.insp-test b')).toHaveText('pays by card')
  await expect(finding.locator('.insp-test code')).toHaveText('tests/pay.test.ts › Checkout')
  // What the test was to show: the scenario's given, when and then.
  await expect(finding.locator('.insp-expects-part b')).toHaveText(['Given', 'When', 'Then'])
  await expect(finding.locator('.insp-expects-part')).toHaveText(['Given a cart', 'When the user pays by card', 'Then the order is paid'])
  await finding.getByText('Why it failed').click()
  await expect(finding.locator('.insp-reason')).toHaveText('AssertionError: expected "pending" to be "paid"')
  await expect(finding.locator('.insp-chain')).toContainText('Leaves unverified')
  await expect(finding.locator('.insp-chain').getByRole('button', { name: /Take card payments/ })).toBeVisible()

  // Debt: under Test did not run, with what that means.
  await tab(page, /^Debt/).click()
  const notRun = report(page).locator('details.insp-group[data-rule="test-not-run"]')
  await expect(notRun.locator('summary .insp-group-name')).toHaveText('Test did not run')
  await notRun.locator('summary').click()
  await expect(notRun.locator('.insp-test b')).toHaveText('refunds a payment')
  await expect(notRun.locator('.insp-test code')).toHaveText('tests/later.test.ts')
  await expect(notRun.locator('.insp-note')).toHaveText('No test report read here has its file: the test did not run, or its report was not read.')

  // The scenario's card: both findings, what is wrong first, the error
  // before the warnings.
  await notRun.getByRole('button', { name: 'Open Paying by card' }).click()
  const all = page.getByRole('complementary', { name: 'Properties' }).getByRole('region', { name: 'Verification' }).getByRole('group', { name: 'Findings' }).locator('.pp-ver-finding')
  await expect(all.first()).toHaveAttribute('data-rule', 'test-failed')
  const findings = all.and(page.locator('[data-rule^="test-"]'))
  await expect(findings).toHaveCount(2)
  await expect(findings.locator('.pp-ver-verdict')).toHaveText([/Test failed$/, /Test did not run$/])
  await expect(findings.locator('.pp-ver-test b')).toHaveText(['pays by card', 'refunds a payment'])
  await expect(findings.locator('.pp-ver-test code')).toHaveText(['tests/pay.test.ts › Checkout', 'tests/later.test.ts'])
  await expect(findings.nth(0).locator('.pp-ver-reason')).toHaveText('AssertionError: expected "pending" to be "paid"')
  await expect(findings.nth(0).locator('.pp-ver-down')).toContainText('Leaves unverified')
  await expect(findings.nth(0).locator('.pp-ver-down').getByRole('button', { name: /Take card payments/ })).toBeVisible()
  await expect(findings.nth(1).locator('.pp-ver-note')).toHaveText('No test report read here has its file: the test did not run, or its report was not read.')
  // Its own name is the card's title: no finding repeats it.
  await expect(findings.first()).not.toContainText('Paying by card')
})
