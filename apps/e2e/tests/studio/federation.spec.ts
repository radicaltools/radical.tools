import { expect } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import type { C4Node, DiagramData } from '@radical/common/c4'

// A federation: radical federation open composes a model folder with the
// models its deps.json names, and marks their elements with an origin
// (<name>@<commit>). Studio opens the composed folder as any other; the
// elements of other models are drawn dashed and cannot be changed. The test
// writes the composed folder as the CLI would.

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 240, height: 140, collapsed: false, ...props }) as C4Node

const COMPOSED: DiagramData = {
  metamodel: builtInGovernanceMetamodel(),
  nodes: [
    node('pay', 'system', 'Payments', { x: 40, y: 40 }),
    node('ord', 'system', 'Orders', { x: 420, y: 40, origin: 'orders@abc1234', description: 'Takes orders.' }),
  ],
  relations: [{ id: 'r-reads', relationType: 'interacts', sourceId: 'pay', targetId: 'ord', label: 'reads orders' }],
  views: [{ id: 'v-landscape', name: 'Landscape', nodeIds: ['pay', 'ord'], positions: {} }],
}

test('an element of another model is marked and cannot be changed', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(COMPOSED, 'payments'))) await folder.write(path, content)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  await page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: 'Landscape' }) }).click()

  // Dashed: another model's. This model's own element is drawn as ever.
  await expect(studio.node('ord')).toHaveClass(/rf-node-other-model/)
  await expect(studio.node('pay')).not.toHaveClass(/rf-node-other-model/)
  const outline = await studio.node('ord').evaluate((el) => getComputedStyle(el).outlineStyle)
  expect(outline).toBe('dashed')

  // The card says where it is from, and has nothing to edit.
  await studio.node('ord').click()
  const note = studio.properties.getByRole('note')
  await expect(note).toHaveText('From the model orders at abc1234 · read-only. Change it in that model\'s repository.')
  await expect(studio.properties.locator('.pp-title')).toContainText('Orders')
  await expect(studio.attribute('Name')).toHaveCount(0)
  await expect(studio.properties.getByRole('button', { name: 'Edit Description' })).toHaveCount(0)
  await expect(studio.properties.getByRole('button', { name: 'More actions' })).toHaveCount(0)

  // Delete is refused, with a notice that names the model.
  await page.keyboard.press('Delete')
  await expect(page.getByRole('region', { name: 'Notifications' })).toContainText('"Orders" belongs to the model orders (orders@abc1234)')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(studio.node('ord')).toBeVisible()
  const files = await folder.files()
  expect(Object.entries(files).some(([path, text]) => path.startsWith('nodes/') && text.includes('label: "Orders"') && text.includes('origin: "orders@abc1234"'))).toBe(true)

  // This model's element is edited as ever.
  await studio.node('pay').click()
  await expect(studio.attribute('Name')).toHaveValue('Payments')
  await expect(studio.properties.getByRole('note')).toHaveCount(0)
})
