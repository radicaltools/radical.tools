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
  await studio.openSample('canvas')
  const filter = page.locator('.rp-pipeline')

  // New view: a blank view or one of the Radical metamodel's viewpoints.
  await page.getByRole('button', { name: 'New view' }).click()
  const menu = page.getByRole('menu', { name: 'New view' })
  await expect(menu.getByRole('menuitem').first()).toHaveText(/Blank view/)
  // By group, in two columns of about the same height: C4, Decisions and UX; Domain, Requirements and States.
  await expect(menu.getByRole('group')).toHaveText([/^C4/, /^Decisions/, /^UX/, /^Domain/, /^Requirements/, /^States/])
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
  await expect(section.locator('.mm-card')).toHaveCount(19)
  await expect.poll(async () => (await storedViews()).filter((v) => v.name === 'Governance').map((v) => [v.kind, v.viewpoint ?? null])).toEqual([['wiki', null]])

  // Kept in the metamodel, which stays the Radical preset.
  expect(JSON.parse(await studio.storedJson(studio.activeDocId())).metamodel.id).toBe('c4-ddd-governance-builtin')
})

// Every built-in viewpoint opens in the sample: a view of its type, named
// after it, showing what the sample has for it (it has no domains, entities
// or state machines, so those show nothing — but still open).
test('every viewpoint of the Radical metamodel opens as a view of its type', async ({ page, studio }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await studio.openSample('canvas')
  const expected: Array<[string, string, boolean]> = [
    ['System context', 'STRUCTURE VIEW', true], ['Containers', 'STRUCTURE VIEW', true], ['Components', 'STRUCTURE VIEW', true],
    ['Container dependencies', 'MATRIX VIEW', true],
    ['Domain map', 'STRUCTURE VIEW', false], ['Domain model', 'STRUCTURE VIEW', false], ['Domain realisation', 'TABLE VIEW', false],
    ['Traceability', 'TABLE VIEW', true], ['Requirement coverage', 'TABLE VIEW', true], ['Requirement gaps', 'TABLE VIEW', true],
    ['Responsibilities', 'TABLE VIEW', true], ['Specification', 'WIKI VIEW', true],
    ['Decisions', 'TABLE VIEW', true], ['Decision log', 'WIKI VIEW', true], ['Fitness functions', 'TABLE VIEW', true],
    ['Screen flow', 'STRUCTURE VIEW', true], ['Screens', 'TABLE VIEW', true],
    ['Entity lifecycles', 'TABLE VIEW', false], ['Event catalogue', 'TABLE VIEW', false],
  ]
  for (const [name, badge, shows] of expected) {
    const back = page.locator('.left-panel .rp-slider.show-props .rp-back-btn')
    if (await back.isVisible()) await back.click()
    await page.getByRole('button', { name: 'New view' }).click()
    await page.getByRole('menu', { name: 'New view' }).getByRole('menuitem', { name: new RegExp(`^${name}`) }).click()
    await expect(page.locator('.props-type-badge'), name).toContainText(`${badge} · ${name.toUpperCase()}`)
    await expect(page.getByText('Runtime Error')).toHaveCount(0)
    await page.locator('.left-panel .rp-slider.show-props .rp-back-btn').click()
    const meta = page.locator('.lp-view-card.active .lp-card-meta')
    if (shows) await expect(meta, `${name} shows elements`).toContainText(/\b[1-9]\d* nodes?/)
    else await expect(meta, `${name} shows nothing in the sample`).toContainText(/\b0 nodes/)
  }
  expect(errors).toEqual([])
})

// In a new model the New view button is near the top: the menu opens below
// it, inside the window, not above it out of sight.
test('the New view menu stays inside the window in a model without views', async ({ page, studio }) => {
  await studio.seedDocument(JSON.stringify({ nodes: [], relations: [], views: [], metamodel: { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} } }))
  await studio.open('canvas')
  await page.getByRole('button', { name: 'New view' }).click()
  const menu = page.getByRole('menu', { name: 'New view' })
  const box = (await menu.boundingBox())!
  const viewport = page.viewportSize()!
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
  await expect(menu.getByRole('menuitem', { name: /^System context/ })).toBeInViewport()
})
