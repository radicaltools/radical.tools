import { expect } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import type { Page } from '@playwright/test'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { parseModelBase, serializeModelBase } from '@radical/common/formats/modelBase'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeTestResults, type TestCase } from '@radical/common/check'
import type { C4Node, C4Relation, DiagramData } from '@radical/common/c4'

// Changes on branch: Studio compares a folder model with the base the CLI or
// the MCP server saved beside it (.radical/base.json, the model where the
// branch left main) and shows the changes on the canvas, in the list of
// views, on the properties card and in the Inspector. Studio has no git: the
// tests write the base file as radical diff --save-base would.

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
const rel = (id: string, relationType: string, sourceId: string, targetId: string): C4Relation => ({ id, relationType, sourceId, targetId })

const COMMIT = '534f32f0a1b2c3d4e5f60718293a4b5c6d7e8f90'
const base = (nodes: C4Node[], relations: C4Relation[], savedAt = new Date(), branch = 'feat/payments'): string =>
  serializeModelBase({ commit: COMMIT, described: 'merge base with origin/main', branch, nodes, relations }, savedAt)

async function openFolder(page: Page, studio: { ready(): Promise<void>; designer(): Promise<void> }, model: DiagramData, extra: Record<string, string> = {}): Promise<ModelFolder> {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries({ ...serializeToMdFolder(model, 'Shop'), ...extra })) await folder.write(path, content)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  // Opened without a link, it starts in Viewer; these tests edit.
  await studio.designer()
  return folder
}

const ARCH: DiagramData = {
  metamodel: builtInGovernanceMetamodel(),
  nodes: [
    node('shop', 'system', 'Shop', { x: 40, y: 40, width: 760, height: 300 }),
    node('api', 'container', 'Checkout API', { parentId: 'shop', x: 40, y: 80, description: 'Takes the card payment and confirms the order' }),
    node('fraud', 'container', 'Fraud check', { parentId: 'shop', x: 300, y: 80 }),
    node('need', 'need', 'Pay online', { x: 900, y: 40 }),
  ],
  relations: [rel('r1', 'interacts', 'api', 'fraud')],
  views: [
    { id: 'v-arch', name: 'Architecture', nodeIds: ['shop', 'api', 'fraud', 'legacy'], positions: {} },
    { id: 'v-spec', name: 'Specification', nodeIds: ['need'], positions: {} },
  ],
}
// At the base the API took the payment only, Fraud check was not there and a legacy container was.
const ARCH_BASE = base([
  node('shop', 'system', 'Shop', { x: 40, y: 40, width: 760, height: 300 }),
  node('api', 'container', 'Checkout API', { parentId: 'shop', x: 40, y: 80, description: 'Takes the payment' }),
  node('legacy', 'container', 'Legacy billing', { parentId: 'shop', x: 560, y: 80 }),
  node('need', 'need', 'Pay online', { x: 900, y: 40 }),
], [])

test('the changes since the base show on the canvas, in the list of views and on the card', async ({ page, studio }) => {
  await openFolder(page, studio, ARCH, { '.radical/base.json': ARCH_BASE })

  const button = page.getByRole('button', { name: /^Changes on branch/ })
  await expect(button.locator('.branch-count')).toHaveText('3', { timeout: 10_000 })
  await expect(button).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.lp-branch-count')).toHaveCount(0)

  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  // On hover the name, and what the count is about.
  await button.hover()
  const tip = page.getByRole('tooltip')
  await expect(tip).toBeVisible()
  await expect(tip).toContainText('Changes on branch')
  await expect(tip).toContainText('3 elements changed since main 534f32f')

  // Each view counts the changes it shows; All elements counts them all.
  const card = (name: string) => page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: name }) })
  await expect(card('All elements').locator('.lp-branch-count')).toHaveText('3')
  await expect(card('Architecture').locator('.lp-branch-count')).toHaveText('3')
  await expect(card('Specification').locator('.lp-branch-count')).toHaveCount(0)

  // On the canvas: the new and changed elements marked, the removed one a ghost.
  await card('Architecture').click()
  await expect(studio.node('fraud')).toContainText('NEW')
  await expect(studio.node('api')).toContainText('CHANGED')
  await expect(studio.node('legacy')).toHaveClass(/rf-node-ghost/)
  await expect(studio.node('legacy')).toContainText('REMOVED')
  await expect(studio.node('shop')).not.toContainText(/NEW|CHANGED|REMOVED/)

  // The card names what changed, word by word.
  await studio.node('api').click()
  const changes = studio.properties.getByRole('region', { name: 'Changes on branch' })
  await expect(changes).toContainText('Changed')
  await expect(changes.locator('.pp-branch-name')).toHaveText(['Description'])
  await expect(changes.locator('ins')).toHaveText(['card ', ' and confirms the order'])
  await expect(changes.locator('del')).toHaveCount(0)

  // An edit is a change at once.
  await studio.node('shop').click({ position: { x: 40, y: 12 } })
  await studio.properties.getByRole('textbox', { name: 'Name' }).fill('Book shop')
  await expect(button.locator('.branch-count')).toHaveText('4')
  await expect(studio.node('shop')).toContainText('CHANGED')
  await expect(studio.properties.getByRole('region', { name: 'Changes on branch' }).locator('del')).toHaveText(['Shop'])

  // Off: no marks, no ghost, no counts.
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'false')
  await expect(studio.node('legacy')).toHaveCount(0)
  await expect(studio.node('api')).not.toContainText('CHANGED')
  await expect(page.locator('.lp-branch-count')).toHaveCount(0)
})

test('a removed element is drawn inside its container on a view laid out its own way, and a view with a chain counts it', async ({ page, studio }) => {
  // Containers draws what its chain gives, the shop narrower than on All
  // elements (room below its containers): where the base had Legacy billing
  // (x 560 in the shop) lies outside the shop's frame there.
  const model: DiagramData = {
    ...ARCH,
    views: [
      ...ARCH.views!,
      {
        id: 'v-cont', name: 'Containers', nodeIds: [],
        pipeline: { levels: [{ ways: [{ types: ['system', 'container'] }] }] },
        positions: {
          shop: { x: 0, y: 0, width: 560, height: 480 },
          api: { x: 20, y: 120, width: 240, height: 150 },
          fraud: { x: 290, y: 120, width: 240, height: 150 },
        },
      },
    ],
  }
  // Legacy billing gone from every list, as a deletion leaves it.
  model.views = model.views!.map((v) => ({ ...v, nodeIds: v.nodeIds.filter((id) => id !== 'legacy') }))
  await openFolder(page, studio, model, { '.radical/base.json': ARCH_BASE })
  const button = page.getByRole('button', { name: /^Changes on branch/ })
  await expect(button.locator('.branch-count')).toHaveText('3', { timeout: 10_000 })
  await button.click()
  const card = (name: string) => page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: name }) })
  await expect(card('Containers').locator('.lp-branch-count')).toHaveText('3')

  await card('Containers').click()
  const ghost = studio.node('legacy')
  await expect(ghost).toHaveClass(/rf-node-ghost/)
  await studio.settle()
  const box = async (id: string) => (await studio.node(id).boundingBox())!
  // Inside the shop's frame, over neither of the containers it holds. Read
  // again until the camera has come to rest: boxes taken while it still
  // moves belong to different frames.
  await expect.poll(async () => {
    const [g, shop, api, fraud] = [await box('legacy'), await box('shop'), await box('api'), await box('fraud')]
    const problems: string[] = []
    if (g.x < shop.x || g.y < shop.y || g.x + g.width > shop.x + shop.width + 0.5 || g.y + g.height > shop.y + shop.height + 0.5) problems.push('outside the shop')
    for (const [name, other] of [['api', api], ['fraud', fraud]] as const) {
      const apart = g.x + g.width <= other.x || other.x + other.width <= g.x || g.y + g.height <= other.y || other.y + other.height <= g.y
      if (!apart) problems.push(`over ${name}`)
    }
    return problems
  }, { timeout: 10_000 }).toEqual([])
})

test('a base saved since HEAD says so', async ({ page, studio }) => {
  const sinceHead = serializeModelBase({ commit: COMMIT, described: 'HEAD', branch: 'main', nodes: JSON.parse(ARCH_BASE).nodes, relations: [] })
  await openFolder(page, studio, ARCH, { '.radical/base.json': sinceHead })
  const button = page.getByRole('button', { name: /^Changes on branch/ })
  await expect(button.locator('.branch-count')).toHaveText('3', { timeout: 10_000 })
  await button.hover()
  await expect(page.getByRole('tooltip')).toContainText('3 elements changed since HEAD 534f32f')
  await expect(page.getByRole('tooltip')).not.toContainText('main 534f32f')
  await page.getByRole('button', { name: /^Inspector/ }).click()
  await page.getByRole('tab', { name: /^Changes/ }).click()
  const changes = page.getByRole('region', { name: 'Changes', exact: true })
  await expect(changes).toContainText('since HEAD 534f32f (main), uncommitted edits included')
})

test('the Inspector lists every change since the base, and a click leads to the element', async ({ page, studio }) => {
  await openFolder(page, studio, ARCH, { '.radical/base.json': ARCH_BASE })
  // No test report, but a base: the Inspector has the branch's changes to show.
  const inspector = page.getByRole('button', { name: /^Inspector/ })
  await expect(inspector).toBeEnabled({ timeout: 10_000 })
  await inspector.click()
  // The Inspector lists the changes itself: no toggle there.
  await expect(page.getByRole('button', { name: /^Changes on branch/ })).toHaveCount(0)
  // Changes comes first, and the Inspector opens on it.
  await expect(page.getByRole('tab').first()).toHaveText(/^Changes/)
  await expect(page.getByRole('tab', { name: /^Changes/ })).toHaveAttribute('aria-selected', 'true')
  // Implementation's This change leads back to it.
  await page.getByRole('tab', { name: /^Implementation/ }).click()
  await page.getByRole('region', { name: 'This change' }).getByRole('button', { name: /^All changes/ }).click()
  const tab = page.getByRole('tab', { name: /^Changes/ })
  await expect(tab).toHaveAttribute('aria-selected', 'true')
  await expect(tab).toContainText('3')

  const changes = page.getByRole('region', { name: 'Changes', exact: true })
  await expect(changes).toContainText('since main 534f32f')
  await expect(changes).toContainText('3 elements changed: 1 added, 1 changed, 1 removed')
  const all = changes.getByRole('region', { name: 'All changes' })
  await expect(all.getByRole('region', { name: 'Added' })).toContainText('Fraud check')
  await expect(all.getByRole('region', { name: 'Changed' })).toContainText('Checkout API')
  await expect(all.getByRole('region', { name: 'Changed' })).toContainText('description')
  await expect(all.getByRole('region', { name: 'Removed' })).toContainText('Legacy billing')
  // A removed element is no link: there is nothing to go to.
  await expect(all.getByRole('region', { name: 'Removed' }).getByRole('button')).toHaveCount(0)
  await all.getByRole('button', { name: /^Relations/ }).click()
  await expect(all.getByRole('region', { name: 'Relations' })).toContainText('Checkout API → Fraud check')

  // From the list to the element's card, Designer's own, read-only, with what changed.
  const before = await page.locator('.insp-main').boundingBox()
  await all.getByRole('region', { name: 'Changed' }).getByRole('button', { name: /Checkout API/ }).click()
  const card = page.getByRole('complementary', { name: 'Properties' })
  await expect(card).toBeVisible()
  // It lies over the page: nothing beneath moves.
  expect(await page.locator('.insp-main').boundingBox()).toEqual(before)
  await expect(card.locator('.pp-title')).toHaveText('Checkout API')
  await expect(card.getByRole('textbox', { name: 'Name' })).toHaveCount(0)
  await expect(card.getByRole('region', { name: 'Changes on branch' }).locator('ins')).toHaveText(['card ', ' and confirms the order'])
  await expect(page.getByRole('complementary', { name: 'Element' })).toHaveCount(0)
  // No wiki view has a page for it: nothing to open there.
  await expect(card.getByRole('button', { name: /^Open wiki page/ })).toBeDisabled()
  // And on to a canvas that holds it.
  await card.getByRole('button', { name: /^Show on canvas/ }).click()
  await expect(page.getByRole('menuitem')).toHaveText([/^Architecture/])
  await page.getByRole('menuitem', { name: /^Architecture/ }).click()
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Designer/)
  await expect(page.getByText(/^Structure:/)).toHaveText('Structure: Architecture')
  await expect(studio.node('api')).toHaveClass(/selected/)
})

// Five requirements and a decision changed on the branch, and a test report.
const SPEC_NOW: DiagramData = {
  metamodel: builtInGovernanceMetamodel(),
  nodes: [
    node('api', 'container', 'Checkout API', { x: 40, y: 40 }),
    node('pay', 'requirement', 'Take card payments', { x: 300, y: 40, ears_type: 'ubiquitous', action: 'take card payments' }),
    node('s-pay', 'scenario', 'Paying by card', { x: 300, y: 200, given: 'a cart', when: 'the user pays', then: 'it is paid', tests: 'tests/pay.test.ts › pays by card' }),
    node('refund', 'requirement', 'Refund payments', { x: 560, y: 40, ears_type: 'ubiquitous', action: 'refund payments' }),
    node('s-refund', 'scenario', 'Refunding', { x: 560, y: 200, given: 'a paid order', when: 'it is refunded', then: 'the money goes back', tests: 'tests/refund.test.ts › refunds' }),
    node('wallet', 'requirement', 'Pay by wallet', { x: 820, y: 40, ears_type: 'ubiquitous', action: 'take wallet payments' }),
    node('s-wallet', 'scenario', 'Paying by wallet', { x: 820, y: 200, given: 'a cart', when: 'the user pays by wallet', then: 'it is paid', tests: 'tests/pay.test.ts › pays by wallet' }),
    node('edit', 'requirement', 'Edit the order', { x: 40, y: 400, ears_type: 'ubiquitous', action: 'let the order be edited within a day' }),
    node('s-edit', 'scenario', 'Editing', { x: 40, y: 560, given: 'an order', when: 'it is edited', then: 'it changes', tests: 'tests/edit.test.ts › edits' }),
  ],
  relations: [
    rel('sat', 'satisfies', 'api', 'pay'), rel('v-pay', 'verifies', 's-pay', 'pay'), rel('v-refund', 'verifies', 's-refund', 'refund'),
    rel('v-wallet', 'verifies', 's-wallet', 'wallet'), rel('v-edit', 'verifies', 's-edit', 'edit'),
  ],
  views: [{ id: 'v-spec', name: 'Specification', nodeIds: [], positions: {} }],
}
const SPEC_BASE = base([
  node('api', 'container', 'Checkout API', { x: 40, y: 40 }),
  node('edit', 'requirement', 'Edit the order', { x: 40, y: 400, ears_type: 'ubiquitous', action: 'let the order be edited' }),
  node('s-edit', 'scenario', 'Editing', { x: 40, y: 560, given: 'an order', when: 'it is edited', then: 'it changes', tests: 'tests/edit.test.ts › edits' }),
  node('invoice', 'requirement', 'Send invoices', { x: 300, y: 400, ears_type: 'ubiquitous', action: 'send an invoice' }),
  node('s-invoice', 'scenario', 'Invoicing', { x: 300, y: 560, given: 'a paid order', when: 'it is invoiced', then: 'the invoice is sent', tests: 'tests/invoice.test.ts › invoices' }),
], [rel('v-edit', 'verifies', 's-edit', 'edit'), rel('v-invoice', 'verifies', 's-invoice', 'invoice')])
const tc = (file: string, title: string, status: TestCase['status']): TestCase => ({ file: `/repo/${file}`, title: [title], status })
const SPEC_RESULTS = serializeTestResults([
  tc('tests/pay.test.ts', 'pays by card', 'passed'),
  tc('tests/refund.test.ts', 'refunds', 'failed'),
  tc('tests/edit.test.ts', 'edits', 'passed'),
  tc('tests/invoice.test.ts', 'invoices', 'passed'),
], ['reports/unit.json'])

test('the Inspector lists this change with what the tests say', async ({ page, studio }) => {
  await openFolder(page, studio, SPEC_NOW, { '.radical/base.json': SPEC_BASE, '.radical/test-results.json': SPEC_RESULTS })

  const inspector = page.getByRole('button', { name: /^Inspector/ })
  await expect(inspector).toBeEnabled({ timeout: 10_000 })
  await inspector.click()
  const tab = page.getByRole('tab', { name: /^Implementation/ })
  await expect(tab).toContainText('This change 1 / 3', { timeout: 10_000 })
  await tab.click()

  const change = page.getByRole('region', { name: 'This change' })
  await expect(change).toContainText('Since main 534f32f')
  await expect(change).toContainText('1 of 3 verified')
  const row = (label: string) => change.locator('.insp-change-row').filter({ hasText: label })
  await expect(row('Take card payments').locator('.insp-pill')).toHaveText('✓ verified')
  await expect(row('Take card payments')).toContainText('satisfied by')
  await expect(row('Refund payments').locator('.insp-pill')).toHaveText('✗ test failing')
  await expect(row('Refund payments')).toContainText('tests/refund.test.ts › refunds failed')
  await expect(row('Pay by wallet').locator('.insp-pill')).toHaveText('○ test not written')
  await expect(row('Pay by wallet')).toContainText('tests/pay.test.ts › pays by wallet is not in the report')
  await expect(row('Edit the order').locator('.insp-pill')).toHaveText('⚠ check its tests')
  await expect(row('Send invoices').locator('.insp-pill')).toHaveText('⚠ test still runs')
  await expect(row('Send invoices')).toContainText('Removed')

  // What is left to do: everything but the verified one.
  await change.getByRole('button', { name: 'Still to do 4' }).click()
  await expect(change.locator('.insp-change-row')).toHaveCount(4)
  await expect(row('Take card payments')).toHaveCount(0)
  await change.getByRole('button', { name: 'All 5' }).click()
  await expect(change.locator('.insp-change-row')).toHaveCount(5)
})

test('without a base the button says how to save one, and an old base is marked', async ({ page, studio }) => {
  const folder = await openFolder(page, studio, ARCH)

  const button = page.getByRole('button', { name: /^Changes on branch/ })
  await expect(button).toHaveClass(/unavailable/)
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await button.click()
  const help = page.getByRole('dialog', { name: 'Changes on branch' })
  await expect(help).toContainText('Nothing to compare with yet')
  await expect(help.locator('code')).toHaveText(['radical hooks install <model folder>', 'radical diff <model folder> --save-base'])
  await button.click()
  await expect(help).toBeHidden()

  // A base saved two days ago, on another branch.
  await folder.write('.radical/base.json', base(JSON.parse(ARCH_BASE).nodes, [], new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), 'feat/inspector-tabs'))
  await expect(button.locator('.branch-count')).toHaveText('⚠ 3', { timeout: 10_000 })
  await button.hover()
  await expect(page.getByRole('tooltip')).toContainText('old base, saved 2 days ago on feat/inspector-tabs')
  const inspector = page.getByRole('button', { name: /^Inspector/ })
  await inspector.click()
  await page.getByRole('tab', { name: /^Changes/ }).click()
  const change = page.getByRole('region', { name: 'Changes', exact: true })
  await expect(change).toContainText('The base was saved 2 days ago, on feat/inspector-tabs.')
  await expect(change.locator('.branch-cmd code')).toHaveText(['radical hooks install <model folder>', 'radical diff <model folder> --save-base'])
  await page.locator('.toolbar-mode-btn', { hasText: 'Designer' }).click()

  // A file that is no base counts as none.
  await folder.write('.radical/base.json', '{ "version": 1 }')
  await expect(button).toHaveClass(/unavailable/, { timeout: 10_000 })
  await expect(button.locator('.branch-count')).toHaveCount(0)
  // Neither a report nor a base: nothing to inspect.
  await expect(inspector).toBeDisabled()
})

test('a Forge run in a folder without a base from git saves one, and Changes on branch shows the run', async ({ page, studio }) => {
  // A scripted AI provider: no questions, and the requirements stage adds one requirement.
  await page.addInitScript(() => {
    localStorage.setItem('radical-ai-settings', JSON.stringify({
      enabled: true, active: 'anthropic', providers: { anthropic: { apiKey: 'e2e', baseUrl: '', model: '' } },
    }))
  })
  await page.route('https://api.anthropic.com/v1/messages', async (route) => {
    const body = route.request().postDataJSON() as { tools?: unknown[]; messages: unknown[] }
    const all = JSON.stringify(body.messages)
    const content = !body.tools ? [{ type: 'text', text: '[]' }]
      : all.includes('tool_result') || !/extract its functional requirements/.test(all) ? [{ type: 'text', text: 'Done.' }]
      : [{ type: 'tool_use', id: 't0', name: 'add_node', input: { tempId: 'r', type: 'requirement', label: 'Pay by card', properties: { ears_type: 'ubiquitous', action: 'take card payments' } } }]
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ model: 'claude-haiku-4-5', content, stop_reason: content[0].type === 'tool_use' ? 'tool_use' : 'end_turn', usage: { input_tokens: 10, output_tokens: 10 } }),
    })
  })
  const folder = await openFolder(page, studio, ARCH)
  const button = page.getByRole('button', { name: /^Changes on branch/ })
  await expect(button).toHaveClass(/unavailable/)

  await page.getByTitle('Menu').click()
  await page.getByRole('menuitem', { name: 'Radical Forge…' }).click()
  await page.locator('.forge-textarea').fill('# Card payments\n\nShoppers pay by card.')
  await page.getByRole('button', { name: 'Start →' }).click()
  await page.getByRole('button', { name: 'Generate requirements' }).click()
  await expect(page.locator('.forge-stage-result')).toBeVisible()

  // The model as it was before the run, as a Forge run's base.
  const saved = parseModelBase((await folder.files())['.radical/base.json'])!
  expect(saved).toMatchObject({ source: 'forge', commit: '' })
  expect(saved.nodes.map((n) => n.id).sort()).toEqual(['api', 'fraud', 'need', 'shop'])
  // The run's need and requirement are what changed.
  await expect(button.locator('.branch-count')).toHaveText('2', { timeout: 10_000 })
  await page.getByRole('button', { name: 'Close' }).first().click()
  await button.hover()
  await expect(page.getByRole('tooltip')).toContainText('2 elements changed since the start of the Forge run')
})
