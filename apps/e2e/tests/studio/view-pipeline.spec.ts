import { test, expect, fixture } from '../../support/fixtures'
import type { Page } from '@playwright/test'

/** Opens view `name` and its properties, where its Filter is. */
async function openFilter(page: Page, name: string): Promise<void> {
  const card = page.locator('.lp-view-card', { hasText: name })
  await card.click()
  await card.hover()
  await card.getByTitle('View properties').click()
  await expect(page.locator('.rp-pipeline')).toBeVisible()
}

/** The sample's Requirements Register comes with its chain (needs →
 *  requirements → scenarios or mockups); tests that build one start from none. */
async function openRegisterWithoutChain(page: Page): Promise<void> {
  await openFilter(page, 'Requirements Register')
  await page.locator('.rp-pipeline').getByRole('button', { name: 'Reset' }).click()
  await expect(page.locator('.rp-pipeline .rp-level')).toHaveCount(0)
}

// A view's filter, set in its properties: a chain of
// levels — needs, under each the requirements refined from it, under each
// of those the scenarios verifying it — each level with its own filters.
// The table and the Structure tree show the tree; the steps stay with the view.

test('needs → requirements → scenarios, built in the Filter panel, shown as a tree in the table', async ({ page, studio }) => {
  await studio.openSample()
  await openRegisterWithoutChain(page)
  const steps = page.locator('.rp-pipeline')
  await expect(page.locator('.tv-row').first()).toBeVisible()

  // The chain, level by level, from what the menu offers.
  await steps.getByRole('button', { name: '+ Start with' }).click()
  await page.getByRole('menuitem', { name: /^Need/ }).click()
  await steps.getByRole('button', { name: '+ Level under' }).click()
  await page.getByRole('menuitem', { name: /Refined into → Requirement/ }).click()
  await steps.getByRole('button', { name: '+ Level under' }).click()
  await page.getByRole('menuitem', { name: /Verified by → Scenario/ }).click()
  await expect(steps.locator('.rp-level')).toHaveCount(3)

  // The table: needs at the top, their requirements, their scenarios.
  const row = (depth: number, name: string) => page.locator(`.tv-chain-row.depth-${depth}`, { hasText: name })
  await expect(page.locator('.tv-chain-row.depth-0')).toHaveCount(3)
  await expect(row(1, 'Four-eyes approval')).toBeVisible()
  await expect(row(2, 'Same signatory cannot approve twice')).toBeVisible()
  // Its card counts what the chain shows, not the whole model.
  const card = page.locator('.lp-view-card', { hasText: 'Requirements Register' }).locator('.lp-card-meta')
  await expect(card).toContainText(/\d+ nodes/)
  await expect(card).not.toContainText('All nodes')
  // A click on a row opens the element's attributes over the table; ✕ closes them.
  await row(2, 'Same signatory cannot approve twice').click()
  await expect(studio.properties.locator('.pp-type')).toContainText(/scenario/i)
  await studio.properties.getByRole('button', { name: 'Close properties' }).click()
  await expect(studio.properties).toHaveCount(0)

  // A need folds what hangs under it.
  await row(0, 'Corporate treasurer feedback').getByRole('button', { name: /Fold what hangs under/ }).click()
  await expect(row(1, 'Four-eyes approval')).toHaveCount(0)
  await row(0, 'Corporate treasurer feedback').getByRole('button', { name: /Show what hangs under/ }).click()
  await expect(row(1, 'Four-eyes approval')).toBeVisible()

  // A level's own filter, with how many go through; or widens it again.
  const requirements = steps.locator('.rp-level').nth(1)
  await requirements.getByRole('button', { name: /Add a filter/ }).click()
  await page.getByRole('menuitem', { name: /^EARS type is event-driven/ }).click()
  await expect(requirements.locator('.rp-step', { hasText: 'EARS type is event-driven' })).toContainText('7 →')
  await expect(row(1, 'Auditable case decisions')).toHaveCount(0)
  await requirements.getByRole('button', { name: /Add a filter/ }).click()
  await page.getByRole('menuitem', { name: 'or EARS type is ubiquitous' }).click()
  await expect(requirements.locator('.rp-step-join.or')).toHaveCount(1)
  await expect(row(1, 'Auditable case decisions')).toBeVisible()

  // Kept with the view; Reset removes every step.
  await expect.poll(async () => (await studio.storedJson(studio.activeDocId())).includes('"pipeline"')).toBe(true)
  await page.reload()
  await studio.ready()
  await openFilter(page, 'Requirements Register')
  await expect(steps.locator('.rp-level')).toHaveCount(3)
  await steps.getByRole('button', { name: 'Reset' }).click()
  await expect(steps.locator('.rp-level')).toHaveCount(0)
  // Back to the containment tree: the requirement is no longer under a need.
  await expect(row(1, 'Four-eyes approval')).toHaveCount(0)
})

test('the table adds an element under a row, on the next level of the chain as its filters ask, and one at the top', async ({ page, studio }) => {
  await studio.openSample()
  await openRegisterWithoutChain(page)
  const steps = page.locator('.rp-pipeline')
  await steps.getByRole('button', { name: '+ Start with' }).click()
  await page.getByRole('menuitem', { name: /^Need/ }).click()
  await steps.getByRole('button', { name: '+ Level under' }).click()
  await page.getByRole('menuitem', { name: /Refined into → Requirement/ }).click()
  // Only event-driven requirements.
  await steps.locator('.rp-level').nth(1).getByRole('button', { name: /Add a filter/ }).click()
  await page.getByRole('menuitem', { name: /^EARS type is event-driven/ }).click()
  const row = (depth: number, name: string) => page.locator(`.tv-chain-row.depth-${depth}`, { hasText: name })

  // The + row after a need's requirements: one refined from it, event-driven
  // as the filter asks, straight into its wizard (the only choice).
  const addUnder = page.getByRole('button', { name: 'Add under Corporate treasurer feedback' })
  await expect(addUnder).toContainText('Requirement')
  await expect(addUnder).toContainText('refined into')
  await expect(addUnder).toContainText('EARS type: event-driven')
  await addUnder.click()
  const wizard = page.getByRole('dialog', { name: /New Requirement/ })
  await wizard.getByLabel('Name').fill('Export the audit trail')
  await page.keyboard.press('ControlOrMeta+Enter')
  await expect(wizard).toHaveCount(0)
  await expect(row(1, 'Export the audit trail')).toBeVisible()
  await expect.poll(async () => {
    const doc = await studio.storedDoc(studio.activeDocId())
    const created = doc.nodes.find((n) => n.label === 'Export the audit trail')
    const need = doc.nodes.find((n) => n.label === 'Corporate treasurer feedback')
    return (created as { ears_type?: string } | undefined)?.ears_type === 'event-driven'
      && doc.relations.some((r) => r.sourceId === created?.id && r.targetId === need?.id && (r as { relationType?: string }).relationType === 'derives')
  }).toBe(true)
  // The last level has no + row.
  await expect(page.getByRole('button', { name: 'Add under Export the audit trail' })).toHaveCount(0)

  // The + row at the end: a need at the top, in its wizard too.
  await expect(page.getByRole('button', { name: 'Add at the top' })).toContainText('Need')
  await page.getByRole('button', { name: 'Add at the top' }).click()
  const needWizard = page.getByRole('dialog', { name: /New Need/ })
  await needWizard.getByLabel('Name').fill('Faster month-end close')
  await page.keyboard.press('ControlOrMeta+Enter')
  await expect(needWizard).toHaveCount(0)
  await expect(row(0, 'Faster month-end close')).toBeVisible()
})

test('a chain is built from the metamodel before its elements, and the table then adds them', async ({ page, studio }) => {
  // The bookstore on the Radical metamodel: no need and no requirement yet.
  const doc = JSON.parse(fixture('bookstore'))
  doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} }
  await studio.seedDocument(JSON.stringify(doc))
  await studio.open('v-table')
  await openFilter(page, 'Element Table')
  const steps = page.locator('.rp-pipeline')
  await steps.getByRole('button', { name: '+ Start with' }).click()
  await page.getByRole('menuitem', { name: /^Need/ }).click()
  await steps.getByRole('button', { name: '+ Level under' }).click()
  await page.getByRole('menuitem', { name: /Refined into → Requirement/ }).click()
  await expect(steps.locator('.rp-level')).toHaveCount(2)
  await expect(page.locator('.tv-chain-row')).toHaveCount(0)

  // A need at the top, then a requirement under it.
  await page.getByRole('button', { name: 'Add at the top' }).click()
  const needWizard = page.getByRole('dialog', { name: /New Need/ })
  await needWizard.getByLabel('Name').fill('Gift cards')
  await page.keyboard.press('ControlOrMeta+Enter')
  const need = page.locator('.tv-chain-row.depth-0', { hasText: 'Gift cards' })
  await expect(need).toBeVisible()
  await page.getByRole('button', { name: 'Add under Gift cards' }).click()
  const wizard = page.getByRole('dialog', { name: /New Requirement/ })
  await wizard.getByLabel('Name').fill('Redeem a gift card')
  await page.keyboard.press('ControlOrMeta+Enter')
  await expect(page.locator('.tv-chain-row.depth-1', { hasText: 'Redeem a gift card' })).toBeVisible()
  // Its attributes open its element's wizard again.
  await need.click()
  await studio.properties.getByRole('button', { name: 'Wizard', exact: true }).click()
  await expect(page.getByRole('dialog', { name: /Gift cards/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('a wiki view follows the same chain: needs on the overview, their requirements as chapters', async ({ page, studio }) => {
  await studio.openSample()
  await openFilter(page, 'Product Wiki')
  const steps = page.locator('.rp-pipeline')
  await steps.getByRole('button', { name: '+ Start with' }).click()
  await page.getByRole('menuitem', { name: /^Need/ }).click()
  await steps.getByRole('button', { name: '+ Level under' }).click()
  await page.getByRole('menuitem', { name: /Refined into → Requirement/ }).click()

  // The overview and the pages tree list the needs, and only what the chain gives.
  await expect(page.locator('.wiki-title')).toHaveText('Overview')
  await expect(page.getByRole('heading', { name: /^Needs \(3\)/ })).toBeVisible()
  await expect(page.locator('.wiki-doc-header .wiki-byline')).toContainText('10 elements')
  // A need's page has the requirements refined from it as its children.
  await page.locator('.wiki-nav-item', { hasText: 'Corporate treasurer feedback' }).first().click()
  await expect(page.locator('.wiki-title')).toHaveText('Corporate treasurer feedback')
  await expect(page.getByRole('heading', { name: /^Requirements \(2\)/ })).toBeVisible()
  // Product Wiki is one article (Multi page): each requirement is a chapter.
  await expect(page.getByRole('heading', { name: 'Four-eyes approval' })).toBeVisible()
})

test('a level takes any of its ways: needs or requirements as roots, the scenarios verifying either under them', async ({ page, studio }) => {
  await studio.openSample()
  await openRegisterWithoutChain(page)
  const steps = page.locator('.rp-pipeline')
  await steps.getByRole('button', { name: '+ Start with' }).click()
  await page.getByRole('menuitem', { name: /^Need/ }).click()
  await steps.getByRole('button', { name: /Add another way to Need/ }).click()
  await page.getByRole('menuitem', { name: 'or Requirement' }).click()
  const roots = steps.locator('.rp-level').first()
  await expect(roots.locator('.rp-level-way')).toContainText('Requirement')
  await expect(roots.locator('.rp-level-head')).toContainText('13')
  await expect(page.locator('.tv-chain-row.depth-0')).toHaveCount(13)

  await steps.getByRole('button', { name: '+ Level under' }).click()
  await page.getByRole('menuitem', { name: /Verified by → Scenario/ }).click()
  await expect(page.locator('.tv-chain-row.depth-1', { hasText: 'Same signatory cannot approve twice' })).toBeVisible()

  // Without its other way the level keeps the needs only.
  await roots.getByRole('button', { name: 'Remove or Requirement' }).click()
  await expect(page.locator('.tv-chain-row.depth-0')).toHaveCount(3)
})

test('a canvas view draws what its chain gives, and the relations it follows unless asked for all', async ({ page, studio }) => {
  await studio.openSample()
  await openFilter(page, 'Requirements Traceability')
  await studio.settle()
  await expect(studio.nodes).toHaveCount(23)
  const steps = page.locator('.rp-pipeline')
  await steps.getByRole('button', { name: '+ Start with' }).click()
  await page.getByRole('menuitem', { name: /^Need/ }).click()
  await steps.getByRole('button', { name: '+ Level under' }).click()
  await page.getByRole('menuitem', { name: /Refined into → Requirement/ }).click()

  // The needs and the requirements refined from them; the derives lines only.
  await expect(studio.nodes).toHaveCount(10)
  await expect(studio.nodeByLabel('Four-eyes approval').first()).toBeVisible()
  await expect(studio.edges).toHaveCount(7)

  // Requirements alone: the chain follows no relation, so none is drawn,
  // until every relation between them is asked for.
  await steps.getByRole('button', { name: /Remove level Need/ }).click()
  await steps.getByRole('button', { name: '+ Start with' }).click()
  await page.getByRole('menuitem', { name: /^Requirement/ }).click()
  await expect(studio.edges).toHaveCount(0)
  await steps.getByLabel('Draw every relation between them').check()
  await expect.poll(() => studio.edges.count()).toBeGreaterThan(0)

  // Without the chain the view draws all its elements again.
  await steps.getByRole('button', { name: 'Reset' }).click()
  await expect(studio.nodes).toHaveCount(23)
})

test('a view shows every element again from its steps, and a chain can start from every element', async ({ page, studio }) => {
  await studio.openSample()
  await openFilter(page, 'Requirements Traceability')
  const steps = page.locator('.rp-pipeline')
  await expect(steps).toContainText("This view's elements")
  await steps.getByRole('button', { name: '+ Start with' }).click()
  await page.getByRole('menuitem', { name: /^Every element/ }).click()
  await expect(steps.locator('.rp-level-head')).toContainText('Every element')
  await expect(steps.locator('.rp-level-head')).toContainText('23')

  await steps.getByRole('button', { name: 'Show every element' }).click()
  await expect(steps).toContainText('Every element')
  await expect(steps.getByRole('button', { name: 'Show every element' })).toHaveCount(0)
  await expect(steps.locator('.rp-level-head')).toContainText('78')
})

test('a matrix with a chain adds only a relation its cell shows, and never a copy', async ({ page, studio }) => {
  await studio.openSample()
  await openFilter(page, 'Requirements Register')
  await page.locator('.props-content').getByRole('button', { name: 'Matrix', exact: true }).click()
  const cell = async (from: string, to: string) => {
    const heads = await page.locator('.mx-rowhead').evaluateAll((els) => els.map((e) => e.textContent?.trim()))
    return page.locator('tbody tr').nth(heads.indexOf(from)).locator('td').nth(heads.indexOf(to))
  }
  const doc = studio.activeDocId()
  const count = async () => (await studio.storedDoc(doc)).relations.length
  const before = await count()

  // Between two requirements the chain follows nothing: clicks add nothing.
  for (let i = 0; i < 3; i++) await (await cell('PSD2-compliant payments', 'Hold high-risk payments')).click()
  await expect(page.locator('.toast-message').last()).toContainText('Not added')
  // A relation the matrix does not draw is not added again.
  await (await cell('Strong customer authentication', 'PSD2-compliant payments')).click()
  await expect(page.locator('.toast-message').last()).toContainText('that this matrix does not show')
  await page.waitForTimeout(800)
  expect(await count()).toBe(before)

  // A requirement refined from another need: the derives the chain follows, drawn.
  await (await cell('Hold high-risk payments', 'PSD2 & AMLD6 obligations')).click()
  await expect.poll(count).toBe(before + 1)
  await expect(await cell('Hold high-risk payments', 'PSD2 & AMLD6 obligations')).toHaveClass(/mx-has-rel/)
  const added = (await studio.storedDoc(doc)).relations.find((r) => r.sourceId === 'req-fraud-hold' && r.targetId === 'need-regulation')
  expect(added?.relationType).toBe('derives')
})

test('a hierarchy drilled into an element its filter then leaves out shows the top, with no way up', async ({ page, studio }) => {
  await studio.openSample('view-treemap')
  await page.locator('.treemap-wrap rect[data-id="dom-banking"]').dblclick({ force: true })
  await expect(page.locator('.tm-bc-item').last()).toHaveText('Banking Services')
  await openFilter(page, 'Platform Hierarchy')
  const steps = page.locator('.rp-pipeline')
  await steps.getByRole('button', { name: '+ Start with' }).click()
  await page.getByRole('menuitem', { name: /^Software System/ }).click()
  // Only the systems are drawn: the breadcrumb names none of their insides.
  await expect(page.locator('.tm-bc-item')).toHaveText(['All'])
  await expect(page.locator('.tm-bc-back')).toHaveCount(0)
  // The view keeps where it was drilled: without the filter it is there again.
  await steps.getByRole('button', { name: 'Reset' }).click()
  await expect(page.locator('.tm-bc-item').last()).toHaveText('Banking Services')
})

test('every kind of view follows its chain, again when the chain or the model changes', async ({ page, studio }) => {
  await studio.openSample()
  await openFilter(page, 'Requirements Traceability')
  const steps = page.locator('.rp-pipeline')
  const kind = (name: string) => page.locator('.props-content', { has: steps }).getByRole('button', { name, exact: true }).click()
  await steps.getByRole('button', { name: '+ Start with' }).click()
  await page.getByRole('menuitem', { name: /^Need/ }).click()
  await steps.getByRole('button', { name: '+ Level under' }).click()
  await page.getByRole('menuitem', { name: /Refined into → Requirement/ }).click()
  // Requirements with "approval" in them.
  const requirements = steps.locator('.rp-level').nth(1)
  await requirements.getByRole('button', { name: /Add a filter/ }).click()
  await page.getByPlaceholder('Text in name or description…').fill('approval')
  await page.getByPlaceholder('Text in name or description…').press('Enter')

  // The matrix: the chain's elements as rows and columns.
  await kind('Matrix')
  const rowHead = (name: string) => page.locator('.mx-rowhead', { hasText: name })
  await expect(rowHead('Four-eyes approval')).toBeVisible()
  await expect(rowHead('Same signatory cannot approve twice')).toHaveCount(0)
  // A level more: the scenarios verifying them join.
  await steps.getByRole('button', { name: '+ Level under' }).click()
  await page.getByRole('menuitem', { name: /Verified by → Scenario/ }).click()
  await expect(rowHead('Same signatory cannot approve twice')).toBeVisible()
  // A change to the model runs the chain again: renamed, the requirement no
  // longer passes the filter, and its scenario goes with it.
  await rowHead('Four-eyes approval').click()
  const label = studio.attribute('Name')
  await label.fill('Four-eyes sign-off')
  await label.press('Tab')
  await expect(rowHead('Four-eyes')).toHaveCount(0)
  await expect(rowHead('Same signatory cannot approve twice')).toHaveCount(0)
  await studio.properties.getByRole('button', { name: 'Close properties' }).click()

  // The hierarchy: the chain's elements in the containers they sit in.
  await kind('Hierarchy')
  const tiles = page.locator('.treemap-wrap svg rect[data-id]')
  await expect(tiles.first()).toBeVisible()
  const chained = await tiles.count()
  // The table and the wiki: the chain's tree.
  await kind('Table')
  await expect(page.locator('.tv-chain-row.depth-0').first()).toBeVisible()
  await expect(page.locator('.tv-row', { hasText: 'Four-eyes' })).toHaveCount(0)
  await kind('Wiki')
  await expect(page.locator('.wiki-view')).not.toContainText('Four-eyes sign-off')

  // Without the chain the hierarchy shows all the view's elements again.
  await steps.getByRole('button', { name: 'Reset' }).click()
  await kind('Hierarchy')
  await expect.poll(() => tiles.count()).toBeGreaterThan(chained)
})

test('a way and a filter are edited in place, and a level can follow any relation', async ({ page, studio }) => {
  await studio.openSample()
  await openRegisterWithoutChain(page)
  const steps = page.locator('.rp-pipeline')
  await steps.getByRole('button', { name: '+ Start with' }).click()
  await page.getByRole('menuitem', { name: /^Requirement/ }).click()
  // Any relation, either way, to any element.
  await steps.getByRole('button', { name: '+ Level under' }).click()
  await page.getByRole('menuitem', { name: /^Any relation → Any element/ }).click()
  const second = steps.locator('.rp-level').nth(1)
  await expect(second.locator('.rp-level-head')).toContainText('Any relation → Any element')
  const anyCount = Number(await second.locator('.rp-level-head .rp-step-count').innerText())

  // The way, edited: only the scenarios any relation reaches.
  await second.getByRole('button', { name: 'Edit Any relation → Any element' }).click()
  // The editor's name follows the way as it changes.
  const wayEditor = second.locator('.rp-edit')
  await wayEditor.getByRole('group', { name: 'Types' }).getByRole('checkbox', { name: /Scenario/ }).check()
  await expect(second.locator('.rp-level-head')).toContainText('Any relation → Scenario')
  await expect.poll(async () => Number(await second.locator('.rp-level-head .rp-step-count').innerText())).toBeLessThan(anyCount)
  // …and along Verified by instead.
  await wayEditor.getByLabel('Along').selectOption({ label: 'Verified by' })
  await expect(second.locator('.rp-level-head')).toContainText('Verified by → Scenario')
  await wayEditor.getByRole('button', { name: 'Done' }).click()
  await expect(wayEditor).toHaveCount(0)

  // A filter, edited: another value, then is not.
  const first = steps.locator('.rp-level').first()
  await first.getByRole('button', { name: /Add a filter/ }).click()
  await page.getByRole('menuitem', { name: /^EARS type is event-driven/ }).click()
  const filter = first.locator('.rp-step', { hasText: 'EARS type is event-driven' })
  const through = async () => Number((await filter.locator('.rp-step-count').innerText()).split('→')[1])
  const eventDriven = await through()
  await first.getByRole('button', { name: 'Edit EARS type is event-driven' }).click()
  const filterEditor = first.locator('.rp-edit')
  await filterEditor.getByRole('group', { name: 'Values' }).getByRole('checkbox', { name: /ubiquitous/ }).check()
  await expect(first.locator('.rp-step', { hasText: 'EARS type is event-driven or ubiquitous' })).toBeVisible()
  await expect.poll(() => first.locator('.rp-step', { hasText: 'or ubiquitous' }).locator('.rp-step-count').innerText()).not.toMatch(new RegExp(`→ ${eventDriven}$`))
  await page.screenshot({ path: test.info().outputPath('editing.png') })
  await filterEditor.getByLabel('Operator').selectOption('is-not')
  await expect(first.locator('.rp-step', { hasText: 'EARS type is not event-driven or ubiquitous' })).toBeVisible()
  // Kept with the view.
  await expect.poll(async () => (await studio.storedJson(studio.activeDocId())).includes('"is-not"')).toBe(true)
})
