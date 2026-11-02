import { expect } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import type { C4Node, DiagramData } from '@radical/common/c4'

// A repository says where it builds the model's elements in its
// .radical/radical.json. Opened in Studio by the repository (the picker
// hides .radical/), the card of an element says where it is built: its own
// paths, or its nearest mapped ancestor's, and for one built nowhere the
// radical implement command that maps it.

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 240, height: 140, collapsed: false, ...props }) as C4Node

const SHOP: DiagramData = {
  metamodel: builtInGovernanceMetamodel(),
  nodes: [
    node('shop', 'system', 'Shop', { x: 40, y: 40, width: 700, height: 420 }),
    node('api', 'container', 'Orders API', { parentId: 'shop', x: 80, y: 120, width: 520, height: 300 }),
    node('checkout', 'component', 'Checkout', { parentId: 'api', x: 120, y: 200 }),
    node('legacy', 'system', 'Legacy', { x: 820, y: 40 }),
  ],
  relations: [],
  views: [{ id: 'v-all', name: 'Everything', nodeIds: ['shop', 'api', 'checkout', 'legacy'], positions: {} }],
}

const MAPPING = JSON.stringify({ implements: [
  { element: 'shop', name: 'Shop', paths: ['.'] },
  { element: 'api', name: 'Orders API', paths: ['services/orders-api'] },
] })

test('the card says where an element is built, for a repository opened', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(SHOP, 'shop'))) await folder.write(`.radical/model/${path}`, content)
  await folder.write('.radical/radical.json', MAPPING)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  await studio.designer()
  await page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: 'Everything' }) }).click()

  const builtIn = studio.properties.getByRole('region', { name: 'Built in' })
  await studio.node('api').dblclick()
  await expect(builtIn).toHaveText(/Built in\s*services\/orders-api$/)

  // A component without an entry is built where its container is.
  await studio.node('checkout').dblclick()
  await expect(builtIn).toContainText('services/orders-api · as Orders API')

  // Built nowhere the file says: the command that maps it, to copy.
  await page.keyboard.press('Escape')
  await studio.node('legacy').dblclick()
  await expect(builtIn).toContainText('radical implement "Legacy" --path <folder>')
  await expect(builtIn.getByRole('button', { name: 'Copy' })).toBeVisible()
})
