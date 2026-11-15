import { expect, type Studio } from '../../support/fixtures'
import type { Page } from '@playwright/test'
import { ModelFolder, test } from '../../support/folder'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import type { C4Node, C4Relation, DiagramData } from '@radical/common/c4'

// A canvas draws up to 1,000 elements. A view whose filter gives more says
// so in place of the canvas, and offers a table (any number) or its filter.

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 240, height: 140, collapsed: false, ...props }) as C4Node

const nodes: C4Node[] = []
for (let i = 0; i < 1001; i++) nodes.push(node(`r${i}`, 'requirement', `Requirement ${i}`, { x: (i % 40) * 260, y: Math.floor(i / 40) * 160 }))
nodes.push(node('shop', 'system', 'Shop', { x: 0, y: -400 }))
// A brief every requirement derives from: its + would add all 1,001.
nodes.push(node('need', 'need', 'The brief', { x: 300, y: -400 }))
const relations: C4Relation[] = nodes.filter((n) => n.type === 'requirement').map((n) => ({ id: `d-${n.id}`, sourceId: n.id, targetId: 'need', relationType: 'derives', label: '' }))

const MODEL: DiagramData = {
  metamodel: builtInGovernanceMetamodel(),
  nodes,
  relations,
  views: [
    { id: 'v-shop', name: 'Shop', nodeIds: ['shop'], positions: {} },
    { id: 'v-brief', name: 'Brief', nodeIds: ['need'], positions: {} },
    { id: 'v-reqs', name: 'Every requirement', nodeIds: [], positions: {}, pipeline: { levels: [{ ways: [{ types: ['requirement'] }] }] } },
  ],
}

async function openLarge(page: Page, studio: Studio): Promise<void> {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(MODEL, 'Large'))) await folder.write(path, content)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  await studio.designer()
}

const viewCard = (page: Page, name: string) => page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: new RegExp(`^${name}$`) }) })

test('a canvas of more than 1,000 elements is not drawn: it offers a table or its filter', async ({ page, studio }) => {
  await openLarge(page, studio)
  const card = (name: string) => viewCard(page, name)

  await card('Every requirement').click()
  const notice = page.getByRole('main', { name: 'View too large for a canvas' })
  await expect(notice).toContainText('Every requirement shows 1,001 elements')
  await expect(notice).toContainText('A canvas draws up to 1,000')
  await expect(page.locator('.react-flow__node')).toHaveCount(0)

  // Edit the filter: the view's properties open in the left panel.
  await notice.getByRole('button', { name: 'Edit the filter' }).click()
  await expect(page.locator('.rp-pipeline')).toBeVisible()
  await page.locator('.rp-back-btn').click()

  // A smaller canvas is drawn as before.
  await card('Shop').click()
  await expect(studio.nodes).toHaveCount(1)

  // Show as a table: the view becomes a table, with every row.
  await card('Every requirement').click()
  await notice.getByRole('button', { name: 'Show as a table' }).click()
  await expect(page.locator('.tv-wrap')).toBeVisible()
  await expect(notice).toHaveCount(0)
  await expect(card('Every requirement').locator('.lp-view-kind')).toHaveText(/^table$/i)
})

test('no exploration draws more than 1,000 elements: neither a view switched to Explore nor a +', async ({ page, studio }) => {
  // Switched to Explore, the view of 1,001 requirements drew every one of
  // them on a canvas (34 s for 3,978), with no notice.
  await openLarge(page, studio)
  await viewCard(page, 'Every requirement').click()
  const notice = page.getByRole('main', { name: 'View too large for a canvas' })
  await notice.getByRole('button', { name: 'Edit the filter' }).click()
  const explore = page.locator('button.view-kind-btn', { hasText: /^\s*Explore\s*$/ })
  await expect(explore).toBeDisabled()
  await expect(explore).toHaveAttribute('title', 'The view shows more elements than a canvas draws (1,000)')
  await explore.click({ force: true })
  await expect(notice).toContainText('Every requirement shows 1,001 elements')
  await expect(page.locator('.react-flow__node')).toHaveCount(0)
  await expect(viewCard(page, 'Every requirement').locator('.lp-view-kind')).not.toHaveText(/^explore$/i)
  await page.locator('.rp-back-btn').click()

  // Explore from here on the brief: its + would add all 1,001 requirements.
  await viewCard(page, 'Brief').click()
  await studio.node('need').dblclick()
  await studio.properties.getByRole('button', { name: 'Explore', exact: true }).click()
  const menu = page.getByRole('menu', { name: 'Add to The brief' })
  await expect(menu).toBeVisible()
  const all = menu.getByRole('menuitem', { name: /^Show all/ })
  await expect(all).toBeDisabled()
  await expect(all).toHaveAttribute('title', 'More than a canvas draws (1,000 elements)')
  for (const row of await menu.locator('.explore-menu-add').all()) await expect(row).toBeDisabled()
  await all.click({ force: true })
  await expect(studio.nodes).toHaveCount(1)
})
