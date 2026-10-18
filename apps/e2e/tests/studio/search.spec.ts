import { expect } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import type { C4Node, DiagramData } from '@radical/common/c4'

// Quick Search, with its Forge button, is in the toolbar on every view, not
// only on canvases: a model opens on All elements, a table.

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
