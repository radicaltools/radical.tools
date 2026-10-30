import { expect } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import type { C4Node, DiagramData } from '@radical/common/c4'

// A canvas draws up to 1,000 elements. A view whose filter gives more says
// so in place of the canvas, and offers a table (any number) or its filter.

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 240, height: 140, collapsed: false, ...props }) as C4Node

const nodes: C4Node[] = []
for (let i = 0; i < 1001; i++) nodes.push(node(`r${i}`, 'requirement', `Requirement ${i}`, { x: (i % 40) * 260, y: Math.floor(i / 40) * 160 }))
nodes.push(node('shop', 'system', 'Shop', { x: 0, y: -400 }))

const MODEL: DiagramData = {
  metamodel: builtInGovernanceMetamodel(),
  nodes,
  relations: [],
  views: [
    { id: 'v-shop', name: 'Shop', nodeIds: ['shop'], positions: {} },
    { id: 'v-reqs', name: 'Every requirement', nodeIds: [], positions: {}, pipeline: { levels: [{ ways: [{ types: ['requirement'] }] }] } },
  ],
}

test('a canvas of more than 1,000 elements is not drawn: it offers a table or its filter', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(MODEL, 'Large'))) await folder.write(path, content)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  await studio.designer()
  const card = (name: string) => page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: new RegExp(`^${name}$`) }) })

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
