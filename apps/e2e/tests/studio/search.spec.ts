import { expect, fixture } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import type { C4Node, DiagramData } from '@radical/common/c4'

// Quick Search, with its Forge button, is in the toolbar on every view, not
// only on canvases.

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 240, height: 140, collapsed: false, ...props }) as C4Node

const MODEL: DiagramData = {
  metamodel: builtInGovernanceMetamodel(),
  nodes: [
    node('shop', 'system', 'Shop', { x: 40, y: 40, width: 600, height: 300 }),
    node('api', 'container', 'Checkout API', { parentId: 'shop', x: 40, y: 80 }),
    node('checkout', 'process', 'Checkout'),
    node('take', 'step', 'Take the order', { parentId: 'checkout', order: 1 }),
  ],
  relations: [],
  views: [
    { id: 'v-docs', name: 'Docs', kind: 'wiki', nodeIds: [], positions: {} },
    { id: 'v-proc', name: 'Processes', kind: 'warnier', viewpoint: 'process-warnier', nodeIds: [], positions: {}, pipeline: { levels: [{ ways: [{ types: ['process', 'step'] }] }] } },
  ],
}

test('Quick Search is on every view, and a pick on a table selects the element', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(MODEL, 'Shop'))) await folder.write(path, content)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  await studio.designer()
  // The model opens on its first view (decided 2026-10-21), the wiki.
  await expect(page).toHaveURL(/\/v\/v-docs$/)
  await page.locator('.lp-view-card', { hasText: 'All elements' }).click()

  // All elements is a table: the bar and its Forge button are there.
  const search = page.locator('.quick-search-bar').getByPlaceholder(/^Search/)
  await expect(page.locator('.tv-wrap')).toBeVisible()
  await expect(search).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open Radical Forge' })).toBeVisible()

  // A pick selects the element where it is: the table, with its card.
  await search.click()
  await page.keyboard.type('Checkout API')
  await page.locator('.quick-search-item', { hasText: 'Checkout API' }).first().click()
  await expect(studio.attribute('Name')).toHaveValue('Checkout API')
  await expect(page.locator('.tv-wrap')).toBeVisible()

  // And on a wiki and a Warnier view.
  for (const name of ['Docs', 'Processes']) {
    await page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: new RegExp(`^${name}$`) }) }).click()
    await expect(search).toBeVisible()
  }
  await expect(page.getByLabel('Warnier diagram')).toBeVisible()
})

// F-0021: Quick Search opened a group of views per element as a canvas of
// its own, and saved positions into it.
test('Quick Search opens a group of views per element on its first view', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(MODEL, 'Shop'))) await folder.write(path, content)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  await studio.designer()
  await page.getByRole('button', { name: 'New view' }).click()
  await page.getByRole('menu', { name: 'New view' }).getByRole('menuitem', { name: /^Containers of a system\s*Structure/ }).click()
  await page.locator('.left-panel .rp-slider.show-props .rp-back-btn').click()
  await page.locator('.lp-view-card', { hasText: 'All elements' }).click()
  await expect(page).toHaveURL(/\/v\/all$/)

  const search = page.locator('.quick-search-bar').getByPlaceholder(/^Search/)
  await search.click()
  await page.keyboard.type('Containers of a system')
  await expect(page.locator('.quick-search-item').first()).toContainText('Group · 1 view')
  await page.keyboard.press('Enter')
  // Shop's view in the group, drawn as a canvas; the group is no canvas.
  const active = page.locator('.lp-view-card.active')
  await expect(active).toHaveCount(1)
  await expect(active.locator('.lp-card-title')).toHaveText('Shop')
  await expect(page.locator('.lp-view-card.lp-view-group')).not.toHaveClass(/active/)
  await expect(studio.node('shop')).toBeVisible()
})

test('a pick on a wiki opens the element\'s page, and the highlighted result stays in sight', async ({ page, studio }) => {
  const many: DiagramData = { ...MODEL, nodes: [...MODEL.nodes, ...Array.from({ length: 25 }, (_, i) => node(`svc${i}`, 'system', `Service ${String(i).padStart(2, '0')}`))] }
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(many, 'Shop'))) await folder.write(path, content)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  await expect(page).toHaveURL(/\/v\/v-docs$/)
  const search = page.locator('.quick-search-bar').getByPlaceholder(/^Search/)

  // On the wiki a pick showed the element selected on the Overview.
  await search.click()
  await page.keyboard.type('Checkout API')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/v\/v-docs\/f\/api/)
  await expect(page.locator('.wiki-page .wiki-title').first()).toHaveText('Checkout API')

  // Item 216: ↓ took the highlight under the list's bottom.
  await search.click()
  await page.keyboard.type('Service')
  for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowDown')
  const list = page.locator('.quick-search-results')
  const active = page.locator('.quick-search-item.active')
  // Measured once the list has scrolled (it scrolls after the highlight moves).
  await expect.poll(async () => {
    const [l, a] = [(await list.boundingBox())!, (await active.boundingBox())!]
    return a.y >= l.y - 1 && a.y + a.height <= l.y + l.height + 1
  }).toBe(true)
})

// Item 245: Enter on a relation opened the smallest view with its source
// (System Context), which draws only the folded line customer → bookstore:
// nothing was selected, while the result's chips listed Containers.
test('a pick of a relation opens a view that draws it, with it selected', async ({ page, studio }) => {
  const doc = JSON.parse(fixture('bookstore'))
  doc.views.push({ id: 'v-pay', name: 'Payments only', kind: 'static', nodeIds: ['payments'], positions: { payments: { x: 0, y: 0 } } })
  await studio.seedDocument(JSON.stringify(doc))
  await studio.open('v-pay')
  const search = page.locator('.quick-search-bar').getByPlaceholder(/^Search/)
  await search.click()
  await page.keyboard.type('browses')
  await expect(page.locator('.quick-search-item').first()).toContainText('browses and orders')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/v\/v-containers$/)
  await expect(page.locator('.react-flow__edge.selected')).toHaveCount(1)
  await expect(page.locator('.react-flow__edge.selected')).toHaveAttribute('data-testid', 'rf__edge-r1')
})

// ── Every kind of place (asked for 2026-10-26) ───────────────────────────────

/** The bookstore with its views in folders, a third slide and a milestone,
 *  all named with "order". */
function bookstoreWithPlaces(): Record<string, any> {
  const doc = JSON.parse(fixture('bookstore'))
  doc.views.find((v: { id: string }) => v.id === 'v-context').folder = 'Order area'
  doc.views.find((v: { id: string }) => v.id === 'v-containers').folder = 'Order area/Inside'
  doc.presentations[0].slides.push({ id: 'slide-3', name: 'Order flow', snapshotId: null, viewId: 'v-order', viewport: { x: 0, y: 0, zoom: 1 } })
  doc.snapshots = [{
    id: 'm-1', name: 'Order rework', timestamp: 1,
    nodes: Object.fromEntries(doc.nodes.map((n: { id: string }) => [n.id, n])),
    relations: Object.fromEntries(doc.relations.map((r: { id: string }) => [r.id, r])),
    sequences: Object.fromEntries(doc.sequences.map((s: { id: string }) => [s.id, s])),
  }]
  return doc
}

const section = (page: import('@playwright/test').Page, title: string) => page.locator(`.qs-section[aria-label="${title}"]`)

test('Quick Search finds views, folders, sequences, slides and milestones, in sections', async ({ page, studio }) => {
  await studio.seedDocument(JSON.stringify(bookstoreWithPlaces()))
  await studio.open('v-table')
  const search = page.locator('.quick-search-bar').getByPlaceholder(/^Search/)
  await search.click()
  await page.keyboard.type('order')

  // A view by its name or its folder.
  await expect(section(page, 'Views').locator('.quick-search-item')).toHaveText([/./, /./, /./])
  await expect(section(page, 'Views')).toContainText('Place Order Flow')
  await expect(section(page, 'Views')).toContainText('System Context')
  await expect(section(page, 'Views').locator('.qs-section-count')).toHaveText('3')
  await expect(section(page, 'Folders')).toContainText('Order area')
  await expect(section(page, 'Elements')).toContainText('Orders DB')
  await expect(section(page, 'Sequences')).toContainText('Place Order')
  await expect(section(page, 'Slides')).toContainText('Order flow')
  await expect(section(page, 'Slides')).toContainText('Main · slide 3')
  await expect(section(page, 'Milestones')).toContainText('Order rework')
  // The part that matched is marked.
  await expect(section(page, 'Elements').locator('.qs-mark').first()).toHaveText('Order')

  // A sequence opens the flow view that plays it.
  await section(page, 'Sequences').locator('.quick-search-item').first().click()
  await expect(page).toHaveURL(/\/v\/v-order$/)
  // A milestone is shown.
  await search.click()
  await page.keyboard.type('m: rework')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/s\//)
})

test('a folder pick shows it open in the list of views', async ({ page, studio }) => {
  await studio.seedDocument(JSON.stringify(bookstoreWithPlaces()))
  await studio.open('v-table')
  // The folder it is in is folded away.
  await page.locator('.lp-folder-row[data-folder-path="Order area"] .lp-folder-toggle').click()
  await expect(page.locator('.lp-folder-row[data-folder-path="Order area/Inside"]')).toHaveCount(0)

  const search = page.locator('.quick-search-bar').getByPlaceholder(/^Search/)
  await search.click()
  await page.keyboard.type('f: inside')
  await expect(page.locator('.quick-search-item').first()).toContainText('Inside')
  await page.keyboard.press('Enter')
  const row = page.locator('.lp-folder-row[data-folder-path="Order area/Inside"]')
  await expect(row).toBeVisible()
  await expect(row).toHaveClass(/lp-folder-found/)
  await expect(page.locator('.lp-view-card', { hasText: 'Containers' }).first()).toBeVisible()
})

test('a pick of a slide opens it in Presenter, and Shift+Enter plays the presentation from it', async ({ page, studio }) => {
  await studio.seedDocument(JSON.stringify(bookstoreWithPlaces()))
  await studio.open('v-context')
  const search = page.locator('.quick-search-bar').getByPlaceholder(/^Search/)
  await search.click()
  await page.keyboard.type('p: order flow')
  await expect(page.locator('.quick-search-item').first()).toContainText('Order flow')
  await page.keyboard.press('Enter')
  // Presenter, on the slide and the view it shows.
  await expect(page).toHaveURL(/\/m\/presenter\/v\/v-order$/)
  await expect(page.locator('.pres-slide-card.active')).toContainText('Order flow')

  await search.click()
  await page.keyboard.type('p: containers')
  await expect(page.locator('.quick-search-item').first()).toContainText('Containers')
  await page.keyboard.press('Shift+Enter')
  await expect(page).toHaveURL(/\/p\/pres-main\/play\/1\/sl\/1$/)
})

test('prefixes narrow the search: @ to the view shown, in: to a view, type: and a property', async ({ page, studio }) => {
  await studio.seedDocument(JSON.stringify({
    metamodel: builtInGovernanceMetamodel(),
    nodes: [
      node('shop', 'system', 'Shop', { x: 40, y: 40, width: 600, height: 300 }),
      node('api', 'container', 'Use API', { parentId: 'shop', x: 40, y: 80 }),
      node('adr1', 'adr', 'Use Postgres', { status: 'accepted' }),
      node('adr2', 'adr', 'Use Kafka', { status: 'proposed' }),
    ],
    relations: [], sequences: [], snapshots: [], presentations: [],
    views: [
      { id: 'v-api', name: 'API only', kind: 'table', nodeIds: ['api'], positions: {} },
      { id: 'v-adr', name: 'Decisions', kind: 'table', nodeIds: ['adr1', 'adr2'], positions: {} },
    ],
  }))
  await studio.open('v-api')
  const search = page.locator('.quick-search-bar').getByPlaceholder(/^Search/)
  const items = page.locator('.quick-search-item')
  await search.click()

  // @: the view shown has one "use".
  await page.keyboard.type('@ use')
  await expect(page.locator('.qs-scope')).toContainText('API only')
  await expect(items).toHaveCount(1)
  await expect(items.first()).toContainText('Use API')

  // in: suggests the views, and Tab takes the first.
  await search.fill('in:')
  await expect(page.locator('.qs-suggest-chip').first()).toContainText('API only')
  await page.keyboard.press('End')
  await page.keyboard.type('Dec')
  await page.keyboard.press('Tab')
  await expect(search).toHaveValue('in:Decisions ')
  await page.keyboard.type('use')
  await expect(section(page, 'Elements').locator('.quick-search-item[data-kind="element"]')).toHaveCount(2)

  // type: and a property's value.
  await search.fill('type:adr status:accepted')
  await expect(items).toHaveCount(1)
  await expect(items.first()).toContainText('Use Postgres')

  // v: only views.
  await search.fill('v: api')
  await expect(page.locator('.qs-section')).toHaveCount(1)
  await expect(section(page, 'Views')).toContainText('API only')
})

test('the empty bar lists the places visited, and a pick goes back there', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-context')
  await page.locator('.lp-view-card', { hasText: 'Containers' }).first().click()
  await expect(page).toHaveURL(/\/v\/v-containers$/)
  await page.locator('.lp-view-card', { hasText: 'Element Table' }).first().click()
  await expect(page).toHaveURL(/\/v\/v-table$/)

  await page.locator('.quick-search-bar').getByPlaceholder(/^Search/).click()
  const recent = section(page, 'Recent').locator('.quick-search-item')
  // Newest first, the one shown left out.
  await expect(recent.first()).toContainText('Containers')
  await expect(recent.nth(1)).toContainText('System Context')
  await expect(section(page, 'Recent')).not.toContainText('Element Table')
  await recent.nth(1).click()
  await expect(page).toHaveURL(/\/v\/v-context$/)
})

test('Show all in a table lists only the elements found', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-context')
  await page.locator('.quick-search-bar').getByPlaceholder(/^Search/).click()
  await page.keyboard.type('order')
  await page.locator('.quick-search-item', { hasText: /Show all \d+ elements in a table/ }).click()
  await expect(page).toHaveURL(/\/v\/all$/)
  await expect(page.locator('.find-in-view input')).toHaveValue('order')
  await expect(studio.row('db')).toBeVisible()
  await expect(studio.row('api')).toBeVisible()
  await expect(studio.row('customer')).toHaveCount(0)
  // Closing the find bar shows every row again.
  await page.getByRole('button', { name: 'Close find' }).click()
  await expect(studio.row('customer')).toBeVisible()
})

test('> lists the commands and runs the one picked', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-context')
  const search = page.locator('.quick-search-bar').getByPlaceholder(/^Search/)
  await search.click()
  await page.keyboard.type('>undo')
  // Nothing done yet: nothing to undo.
  await expect(page.locator('.quick-search-hint')).toContainText('No command matches.')
  await search.fill('>viewer')
  await expect(section(page, 'Commands').locator('.quick-search-item').first()).toContainText('Viewer')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/m\/viewer\//)

  const before = await page.locator('html').getAttribute('data-theme')
  await search.click()
  await page.keyboard.type('>theme')
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', before ?? 'dark')
  // Designer's own commands are not listed in Viewer.
  await search.click()
  await page.keyboard.type('>import from radical hub')
  await expect(page.locator('.quick-search-hint')).toContainText('No command matches.')
})
