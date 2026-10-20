import { test, expect } from '../../support/fixtures'
import type { Page } from '@playwright/test'

/** Opens view `name` and its properties, where its Viewpoint, View type and Filter are. */
async function openProps(page: Page, name: string): Promise<void> {
  const back = page.locator('.left-panel .rp-slider.show-props .rp-back-btn')
  if (await back.isVisible()) await back.click()
  const card = page.locator('.lp-view-card', { hasText: name }).first()
  await card.click()
  await card.hover()
  await card.getByTitle('View properties').click()
  await expect(page.locator('.rp-pipeline')).toBeVisible()
}

// Viewpoints: kinds of view the metamodel defines, each a kind (table,
// wiki, …) and a filter chain under a name. New view offers them; a view of
// a viewpoint has its kind and chain, read-only until detached, and follows the
// type when the metamodel changes it.

test('New view offers the metamodel\'s viewpoints; a view of one follows the viewpoint', async ({ page, studio }) => {
  await studio.openSample()
  const filter = page.locator('.rp-pipeline')

  // New view: a blank view or one of the Radical metamodel's viewpoints.
  await page.getByRole('button', { name: 'New view' }).click()
  const menu = page.getByRole('menu', { name: 'New view' })
  await expect(menu.getByRole('menuitem').first()).toHaveText(/Blank view/)
  // By group, in two columns of about the same height: C4, Decisions, UX and Process; Domain, Requirements and States.
  await expect(menu.getByRole('group')).toHaveText([/^C4/, /^Decisions/, /^UX/, /^Process/, /^Domain/, /^Requirements/, /^States/])
  await expect(menu.getByRole('group', { name: 'Requirements' }).getByRole('menuitem')).toHaveText([/^Traceability/, /^Requirement coverage/, /^Requirement gaps/, /^Responsibilities/, /^Specification/])
  await menu.getByRole('menuitem', { name: /^Traceability/ }).click()

  // A table of needs → requirements → scenarios, its chain the viewpoint's.
  await expect(page.locator('.props-type-badge')).toContainText('TABLE VIEW · TRACEABILITY')
  await expect(page.getByRole('combobox', { name: 'Viewpoint' }).locator('option:checked')).toHaveText('Traceability · Table')
  await expect(filter.locator('.rp-viewpoint')).toContainText('Set by the viewpoint')
  await expect(filter.locator('.rp-level')).toHaveCount(3)
  await expect(filter.getByRole('button', { name: '+ Level under' })).toHaveCount(0)
  await expect(page.locator('.tv-chain-row.depth-0')).toHaveCount(3)
  await expect(page.locator('.tv-chain-row.depth-2', { hasText: 'Same signatory cannot approve twice' })).toBeVisible()
  await expect(page.locator('.lp-view-card.active')).toContainText('Traceability')

  // Detached, the chain is the view's own; saved as a viewpoint, the view is of it.
  await filter.getByRole('button', { name: 'Detach' }).click()
  await filter.getByRole('button', { name: '+ Sort' }).click()
  await page.getByRole('menuitem', { name: 'Name' }).click()
  await filter.getByRole('button', { name: 'Save as viewpoint…' }).click()
  await filter.getByRole('textbox', { name: 'Viewpoint name' }).fill('Sorted trace')
  await filter.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(filter.locator('.rp-viewpoint')).toContainText('Set by the viewpoint')
  await expect(page.getByRole('combobox', { name: 'Viewpoint' }).locator('option:checked')).toHaveText('Sorted trace · Table')

  // Another view takes it from its Viewpoint list.
  await openProps(page, 'Governance')
  const viewpoint = page.getByRole('combobox', { name: 'Viewpoint' })
  await expect(viewpoint.locator('option:checked')).toHaveText(/None/)
  await viewpoint.selectOption({ label: 'Sorted trace · Table' })
  await expect(viewpoint.locator('option:checked')).toHaveText('Sorted trace · Table')
  await expect(filter.locator('.rp-level')).toHaveCount(3)
  await expect(filter.locator('.rp-step', { hasText: 'Sort' })).toContainText('Name')

  // The metamodel editor changes the viewpoint: both views follow; deleted, they keep it.
  await studio.open('view-governance', 'metamodel', studio.activeDocId())
  const editor = page.getByRole('dialog', { name: 'Metamodel editor' })
  await editor.getByRole('tab', { name: 'List' }).click()
  const section = editor.locator('.mm-section', { hasText: 'Viewpoints' })
  const card = section.locator('.mm-card', { hasText: 'Sorted trace' })
  await expect(card).toContainText('2 view(s)')
  await card.locator('.mm-card-header').click()
  await card.getByRole('combobox').selectOption({ label: 'Wiki' })
  const storedViews = async () => (JSON.parse(await studio.storedJson(studio.activeDocId())).views as Array<{ name: string; kind?: string; viewpoint?: string }>)
  const kinds = async () => (await storedViews()).filter((v) => v.viewpoint === 'sorted-trace').map((v) => v.kind)
  await expect.poll(kinds).toEqual(['wiki', 'wiki'])
  await editor.getByRole('button', { name: 'Delete viewpoint Sorted trace' }).click()
  await expect(section.locator('.mm-card')).toHaveCount(25)
  await expect.poll(async () => (await storedViews()).filter((v) => v.name === 'Governance').map((v) => [v.kind, v.viewpoint ?? null])).toEqual([['wiki', null]])

  // Kept in the metamodel, which stays the Radical preset.
  expect(JSON.parse(await studio.storedJson(studio.activeDocId())).metamodel.id).toBe('c4-ddd-governance-builtin')
})

// Every built-in viewpoint opens in the sample: a view of its type, named
// after it, showing what the sample has for it (it has no domains, entities
// or state machines, so those show nothing — but still open; it has one
// process).
test('every viewpoint of the Radical metamodel opens as a view of its type', async ({ page, studio }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await studio.openSample()
  // A viewpoint of one element makes a group and opens its first view, or
  // the group when the sample has no such element.
  const ONE = 'one'
  const NONE = 'none'
  const expected: Array<[string, string, boolean | typeof ONE | typeof NONE]> = [
    ['System context', 'STRUCTURE VIEW', true], ['Containers', 'STRUCTURE VIEW', true], ['Containers of a system', 'STRUCTURE VIEW', ONE],
    ['Components', 'STRUCTURE VIEW', true], ['Components of a container', 'STRUCTURE VIEW', ONE],
    ['Container dependencies', 'MATRIX VIEW', true],
    ['Domain map', 'STRUCTURE VIEW', false], ['Domain model', 'STRUCTURE VIEW', false], ['Entities of a domain', 'STRUCTURE VIEW', NONE],
    ['Domain realisation', 'TABLE VIEW', false],
    ['Traceability', 'TABLE VIEW', true], ['Requirement coverage', 'TABLE VIEW', true], ['Requirement gaps', 'TABLE VIEW', true],
    ['Responsibilities', 'TABLE VIEW', true], ['Specification', 'WIKI VIEW', true],
    ['Decisions', 'TABLE VIEW', true], ['Decision log', 'WIKI VIEW', true], ['Fitness functions', 'TABLE VIEW', true],
    ['Screen flow', 'STRUCTURE VIEW', true], ['Screens', 'TABLE VIEW', true],
    ['Entity lifecycles', 'TABLE VIEW', false], ['State machine', 'STRUCTURE VIEW', NONE], ['Event catalogue', 'TABLE VIEW', false],
    ['Process (Warnier)', 'WARNIER VIEW', true], ['Process', 'WARNIER VIEW', ONE],
  ]
  for (const [name, badge, shows] of expected) {
    const back = page.locator('.left-panel .rp-slider.show-props .rp-back-btn')
    if (await back.isVisible()) await back.click()
    await page.getByRole('button', { name: 'New view' }).click()
    // The name, then the view type: "Containers" is not "Containers of a system".
    const option = new RegExp(`^${name.replace(/[()]/g, '\\$&')}\\s*(Structure|Table|Matrix|Wiki|Warnier|Hierarchy)`)
    await page.getByRole('menu', { name: 'New view' }).getByRole('menuitem', { name: option }).click()
    await expect(page.locator('.props-type-badge'), name).toContainText(`${badge} · ${name.toUpperCase()}`)
    await expect(page.getByText('Runtime Error')).toHaveCount(0)
    await page.locator('.left-panel .rp-slider.show-props .rp-back-btn').click()
    const meta = page.locator('.lp-view-card.active .lp-card-meta')
    if (shows === NONE) await expect(meta, `${name} holds no view in the sample`).toContainText(/\b0 views/)
    else if (shows) await expect(meta, `${name} shows elements`).toContainText(/\b[1-9]\d* nodes?/)
    else await expect(meta, `${name} shows nothing in the sample`).toContainText(/\b0 nodes/)
  }
  expect(errors).toEqual([])
})

// A viewpoint that draws one element (ViewpointDef.subject) makes one view
// in the list, a group: a click shows a view of each such element, and a new
// element gets its view there at once.
test('a viewpoint that draws one element makes a group with a view of each, which a new element joins', async ({ page, studio }) => {
  const at = (x: number) => ({ x, y: 0, width: 300, height: 200, collapsed: false })
  const machine = (id: string, label: string, states: string[], x: number) => [
    { id, type: 'state-machine', label, ...at(x) },
    ...states.map((s, i) => ({ id: `${id}-${i}`, type: 'state', label: s, parentId: id, ...at(x + 20 + i * 120), y: 60, width: 100, height: 60 })),
  ]
  await studio.seedDocument(JSON.stringify({
    nodes: [...machine('order', 'Order', ['Placed', 'Paid'], 0), ...machine('payment', 'Payment', ['Pending'], 400)],
    relations: [], views: [],
    metamodel: { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} },
  }))
  await studio.open('all')
  await page.getByRole('button', { name: 'New view' }).click()
  await page.getByRole('menu', { name: 'New view' }).getByRole('menuitem', { name: /^State machine\s*Structure/ }).click()

  // One group in the list, open on its first view: Order with its states only.
  const group = page.locator('.lp-view-group', { hasText: 'State machine' })
  await expect(group).toContainText('2 views')
  const members = page.getByRole('group', { name: 'State machine' }).locator('.lp-card-title')
  await expect(members).toHaveText(['Order', 'Payment'])
  await expect(page.locator('.props-type-badge')).toContainText('STRUCTURE VIEW · STATE MACHINE')
  await expect(page.locator('.lp-view-card.active .lp-card-title')).toHaveText('Order')
  await expect(page.locator('.lp-view-card.active .lp-card-meta')).toContainText('3 nodes')
  // Opened for the first time, it is laid out by Smart Layout: positions of its own, no notice.
  const positionsOf = async (name: string) => Object.keys(((await studio.storedDoc()) as unknown as { views: Array<{ name: string; positions?: object }> }).views.find((v) => v.name === name)?.positions ?? {}).length
  await expect.poll(() => positionsOf('Order')).toBeGreaterThan(0)
  await expect(page.getByText('This diagram is not laid out yet')).toHaveCount(0)
  // Its viewpoint is the group's: no Viewpoint list, View type or Detach.
  await expect(page.getByText('One of the views of')).toBeVisible()
  await expect(page.getByLabel('Viewpoint', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Detach' })).toHaveCount(0)

  // Moving one of its views to a folder moves the group, with all its views.
  await page.getByRole('button', { name: 'Move the group to folder' }).click()
  await page.getByLabel('Folder', { exact: true }).fill('States')
  await page.getByLabel('Folder', { exact: true }).press('Enter')
  await expect(page.locator('.props-field', { hasText: 'States · with its group' })).toBeVisible()
  const stored = async () => ((await studio.storedDoc()) as unknown as { views: Array<{ name: string; folder?: string }> }).views.map((v) => [v.name, v.folder ?? ''])
  await expect.poll(stored).toEqual([['State machine', 'States'], ['Order', 'States'], ['Payment', 'States']])
  await expect(page.locator('.lp-folder', { hasText: 'States' }).locator('.lp-view-group')).toContainText('State machine')

  // Nothing is hidden from a view per element by hand.
  await studio.node('order-0').click()
  await expect(page.locator('.sel-bar-btn', { hasText: 'Hide from view' })).toHaveCount(0)
  await page.keyboard.press('Delete')
  await expect(page.getByRole('button', { name: /Hide from current view/ })).toBeDisabled()
  await page.getByRole('button', { name: /^Cancel/ }).click()

  // The group keeps its viewpoint: no View type, Viewpoint list or Filter to change.
  await page.locator('.left-panel .rp-slider.show-props .rp-back-btn').click()
  await group.hover()
  await group.getByTitle('View properties').click()
  await expect(page.getByText('One view per State Machine')).toBeVisible()
  await expect(page.getByRole('group', { name: 'View type' })).toHaveCount(0)
  await expect(page.getByLabel('Viewpoint', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Delete the group and its views/ })).toBeVisible()

  // A new state machine: the group gets its view at once.
  await page.locator('.left-panel .rp-slider.show-props .rp-back-btn').click()
  await studio.addFromPalette('State Machine', await studio.nearBottom())
  await expect(group).toContainText('3 views')
  await expect(members).toHaveText(['Order', 'Payment', 'State-machine'])

  // A click on the group hides its views.
  await group.click()
  await expect(members).toHaveCount(0)
})

// In a new model the New view button is near the top: the menu opens below
// it, inside the window, not above it out of sight.
test('the New view menu stays inside the window in a model without views', async ({ page, studio }) => {
  await studio.seedDocument(JSON.stringify({ nodes: [], relations: [], views: [], metamodel: { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} } }))
  await studio.open('all')
  await page.getByRole('button', { name: 'New view' }).click()
  const menu = page.getByRole('menu', { name: 'New view' })
  const box = (await menu.boundingBox())!
  const viewport = page.viewportSize()!
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
  await expect(menu.getByRole('menuitem', { name: /^System context/ })).toBeInViewport()
})

test('a blank view is a table of every element', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-context')
  await page.getByRole('button', { name: 'New view' }).click()
  await page.getByRole('menu', { name: 'New view' }).getByRole('menuitem', { name: /^Blank view/ }).click()
  await expect(page.locator('.props-type-badge')).toContainText('TABLE VIEW')
  // The bookstore's six elements, as the containment tree.
  await expect(page.locator('tr.tv-row')).toHaveCount(6)
})

test('a new view draws its elements inside their containers and clear of each other', async ({ page, studio }) => {
  // From System Context, where Bookstore is a small box beside Payment
  // Provider: the new view did not keep those places for its containers.
  await studio.seed()
  await studio.open('v-context')
  await page.getByRole('button', { name: 'New view' }).click()
  await page.getByRole('menu', { name: 'New view' }).getByRole('menuitem', { name: /^Containers(?! of)/ }).click()
  await expect(page.locator('.props-type-badge')).toContainText('STRUCTURE VIEW')
  await expect(studio.node('bookstore')).toBeVisible()
  await expect.poll(() => studio.layoutViolations()).toEqual([])
  // A blank view turned into a structure view, the same.
  await studio.open('v-context')
  await page.getByRole('button', { name: 'New view' }).click()
  await page.getByRole('menu', { name: 'New view' }).getByRole('menuitem', { name: /^Blank view/ }).click()
  await page.getByRole('group', { name: 'View type' }).getByRole('button', { name: 'Structure' }).click()
  await expect(studio.node('bookstore')).toBeVisible()
  await expect.poll(() => studio.layoutViolations()).toEqual([])
})
