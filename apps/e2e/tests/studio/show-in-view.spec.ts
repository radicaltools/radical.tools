import { test, expect, fixture } from '../../support/fixtures'

// A view opened for an element from the properties card's Views
// (showNodeInView) puts the element in sight there, also on the views that
// are lists: a table scrolls to its row, a wiki opens its page at the top.

const FILLERS = 80
const LONG = Array.from({ length: 40 }, (_, i) => `Paragraph ${i + 1} of what the target does.`).join('\n\n')

test.describe('views that are lists', () => {
test.beforeEach(async ({ studio }) => {
  const doc = JSON.parse(fixture('bookstore'))
  for (let i = 0; i < FILLERS; i++) {
    doc.nodes.push({ id: `filler-${i}`, type: 'person', label: `Filler ${String(i).padStart(2, '0')}`, description: '', x: 0, y: 1000 + i * 100, width: 200, height: 80, collapsed: false })
  }
  doc.nodes.push({ id: 'target', type: 'person', label: 'Target', description: LONG, x: 0, y: 0, width: 200, height: 80, collapsed: false })
  doc.views.push(
    { id: 'v-target', kind: 'static', name: 'Target Canvas', nodeIds: ['target'], positions: {} },
    { id: 'v-wiki-a', kind: 'wiki', name: 'Wiki A', nodeIds: [], positions: {} },
    { id: 'v-wiki-b', kind: 'wiki', name: 'Wiki B', nodeIds: [], positions: {} },
    ...Array.from({ length: 30 }, (_, i) => ({ id: `v-more-${i}`, kind: 'static', name: `More ${String(i).padStart(2, '0')}`, nodeIds: ['target'], positions: {} })),
  )
  await studio.seedDocument(JSON.stringify(doc))
  await studio.open('v-target')
  await expect(studio.nodes).toHaveCount(1)
})

test('a table opened from the card scrolls to the element\'s row, again on a second click', async ({ page, studio }) => {
  await studio.node('target').click()
  const views = studio.properties.getByRole('region', { name: 'Views' })
  await views.getByRole('button', { name: /^Element Table/ }).click()
  await expect(page).toHaveURL(/\/v\/v-table/)
  const row = page.locator('tr[data-node-id="target"]')
  await expect(row).toHaveClass(/tv-row-selected/)
  await expect(row).toBeInViewport()

  // Scrolled away, the open view in the card brings it back.
  await page.locator('.tv-table-wrap').evaluate((el) => {
    const at = el.querySelector<HTMLElement>('tr[data-node-id="target"]')!.offsetTop
    el.scrollTop = at > el.scrollHeight / 2 ? 0 : el.scrollHeight
  })
  await expect(row).not.toBeInViewport()
  await views.getByRole('button', { name: /^Element Table/ }).click()
  await expect(row).toBeInViewport()
})

test('a view opened from the card is scrolled into sight in the list of views', async ({ page, studio }) => {
  await studio.node('target').click()
  const views = studio.properties.getByRole('region', { name: 'Views' })
  const listed = page.locator('.lp-view-card', { hasText: 'More 29' })
  await expect(listed).not.toBeInViewport()
  await views.getByRole('button', { name: /^More 29/ }).click()
  await expect(page).toHaveURL(/\/v\/v-more-29/)
  await expect(listed).toHaveClass(/active/)
  await expect(listed).toBeInViewport()
})

test('a wiki opened from the card shows the element\'s page from its top, also after another wiki', async ({ page, studio }) => {
  await studio.node('target').click()
  const views = studio.properties.getByRole('region', { name: 'Views' })
  await views.getByRole('button', { name: /^Wiki A/ }).click()
  await expect(page).toHaveURL(/\/v\/v-wiki-a/)
  const wikiPage = page.locator('.wiki-page')
  await expect(wikiPage.locator('h1')).toHaveText(/Target/)

  await wikiPage.evaluate((el) => { el.scrollTop = el.scrollHeight })
  await expect.poll(() => wikiPage.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  await views.getByRole('button', { name: /^Wiki B/ }).click()
  await expect(page).toHaveURL(/\/v\/v-wiki-b/)
  await expect(wikiPage.locator('h1')).toHaveText(/Target/)
  await expect.poll(() => wikiPage.evaluate((el) => el.scrollTop)).toBe(0)

  // The open one asked for again goes back to the top too.
  await wikiPage.evaluate((el) => { el.scrollTop = el.scrollHeight })
  await views.getByRole('button', { name: /^Wiki B/ }).click()
  await expect.poll(() => wikiPage.evaluate((el) => el.scrollTop)).toBe(0)
})
})

// A wiki's Pages follow its filter's chain: a requirement sits under the
// need it derives from, not under what contains it.
test.describe('a wiki nested by its chain', () => {
  test.beforeEach(async ({ studio }) => {
    const doc = JSON.parse(fixture('bookstore'))
    doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} }
    const need = (id: string, label: string) => ({ id, type: 'need', label, description: '', x: 0, y: 0, width: 200, height: 80, collapsed: false })
    doc.nodes.push(
      need('need-top', 'Click & collect'),
      need('need-shop', 'Shop staff interviews'),
      { id: 'req-pickup', type: 'requirement', label: 'Pick up in store', ears_type: 'ubiquitous', action: 'let a customer pick up an order in a store', x: 0, y: 0, width: 200, height: 80, collapsed: false },
    )
    doc.relations.push(
      { id: 'd-shop', sourceId: 'need-shop', targetId: 'need-top', relationType: 'derives' },
      { id: 'd-pickup', sourceId: 'req-pickup', targetId: 'need-shop', relationType: 'derives' },
    )
    const refined = { ways: [{ via: { relationType: 'derives', direction: 'in' } }] }
    doc.views.push(
      { id: 'v-req', kind: 'static', name: 'Requirement Canvas', nodeIds: ['req-pickup'], positions: {} },
      { id: 'v-trace', kind: 'wiki', name: 'Trace Wiki', nodeIds: [], positions: {}, wikiFocusId: 'req-pickup', pipeline: { levels: [
        { ways: [{ types: ['need'] }], filters: [{ kind: 'relation', relationType: 'derives', direction: 'out', has: false }] }, refined, refined,
      ] } },
    )
    await studio.seedDocument(JSON.stringify(doc))
    await studio.open('v-req')
    await expect(studio.nodes).toHaveCount(1)
  })

  test('the Pages open the way to the element and mark it, also through a branch closed by hand', async ({ page, studio }) => {
    await studio.node('req-pickup').click()
    const views = studio.properties.getByRole('region', { name: 'Views' })
    await views.getByRole('button', { name: /^Trace Wiki/ }).click()
    await expect(page).toHaveURL(/\/v\/v-trace/)
    const active = page.locator('.wiki-nav-item.active')
    await expect(active).toHaveText('Pick up in store')
    await expect(active).toBeInViewport()

    // Closed by hand and left for the Overview, the branch opens again for the page.
    await page.getByRole('button', { name: 'Collapse Shop staff interviews' }).click()
    await expect(page.locator('.wiki-nav-item', { hasText: 'Pick up in store' })).toHaveCount(0)
    await page.locator('.wiki-nav-front').click()
    await views.getByRole('button', { name: /^Trace Wiki/ }).click()
    await expect(active).toHaveText('Pick up in store')
    await expect(active).toBeInViewport()
  })
  test('a wiki opened from the list of views shows the page it was left on in the Pages, its way open', async ({ page }) => {
    await page.locator('.lp-view-card', { hasText: 'Trace Wiki' }).click()
    await expect(page).toHaveURL(/\/v\/v-trace/)
    const active = page.locator('.wiki-nav-item.active')
    await expect(active).toHaveText('Pick up in store')
    await expect(active).toBeInViewport()
  })
  test('a page\'s properties button opens its element in the card, which an open card follows to the page read', async ({ page, studio }) => {
    await studio.open('v-trace/f/need-top')
    // Closed, the card stays closed on another page.
    await page.locator('.wiki-nav-item', { hasText: 'Shop staff interviews' }).click()
    await expect(page.locator('.wiki-nav-item.active')).toHaveText('Shop staff interviews')
    await expect(studio.properties).toHaveCount(0)
    await page.getByRole('button', { name: 'Properties of Shop staff interviews' }).click()
    await expect(studio.attribute('Name')).toHaveValue('Shop staff interviews')
    // Open, it goes along; after ✕ it stays closed.
    await page.locator('.wiki-nav-item', { hasText: 'Pick up in store' }).click()
    await expect(page.locator('.wiki-nav-item.active')).toHaveText('Pick up in store')
    await expect(studio.attribute('Name')).toHaveValue('Pick up in store')
    await studio.properties.getByRole('button', { name: 'Close properties' }).click()
    await expect(studio.properties).toHaveCount(0)
    await page.locator('.wiki-nav-item', { hasText: 'Shop staff interviews' }).click()
    await expect(page.locator('.wiki-nav-item.active')).toHaveText('Shop staff interviews')
    await expect(studio.properties).toHaveCount(0)

    // Viewer: the same button, the card read-only.
    await studio.open('v-trace/f/req-pickup', 'viewer')
    await page.getByRole('button', { name: 'Properties of Pick up in store' }).click()
    await expect(studio.properties.getByText('Pick up in store').first()).toBeVisible()
  })
})

test('in a milestone, a view opened from the card opens the element\'s containers without asking how to save the milestone', async ({ page, studio }) => {
  // F-0011: the containers opened around the element were a milestone
  // edit; the question opened and the chip said unsaved, nothing edited.
  await studio.openSample('view-core')
  await studio.node('dom-banking').locator('.c4-node-collapse-btn').dispatchEvent('click')
  await expect(studio.node('ctn-payments')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Milestones' }).click()
  await page.locator('.lp-snap-card', { hasText: 'v3' }).first().click()
  await expect(page).toHaveURL(/\/s\//)
  await page.getByRole('tab', { name: 'Views' }).click()
  await page.locator('.lp-view-card', { hasText: 'Payments Domain' }).first().click()
  await expect(page).toHaveURL(/\/v\/view-payments/)
  await studio.settle()
  await expect(page.getByText(/^Milestone: v3/)).toBeVisible()
  await studio.node('ctn-payments').click({ position: { x: 30, y: 10 } })
  await studio.properties.getByRole('region', { name: 'Views' }).getByRole('button', { name: /^Core Banking/ }).click()
  await expect(page).toHaveURL(/\/v\/view-core/)
  await expect(studio.node('ctn-payments')).toHaveCount(1)
  await expect(studio.node('ctn-payments')).toHaveClass(/selected/)
  await expect(page.locator('.milestone-modal')).toHaveCount(0)
  await expect(page.getByText(/^Milestone: v3/)).toBeVisible()
  await expect(page.getByText('· unsaved')).toHaveCount(0)
})
