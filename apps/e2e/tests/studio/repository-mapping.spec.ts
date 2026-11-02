import { expect } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeTestResults } from '@radical/common/check'
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

test('the card says where an element is built, for a .radical folder opened', async ({ page, studio }) => {
  // A picker that shows hidden folders may pick .radical/ itself.
  const folder = new ModelFolder(page, '.radical')
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(SHOP, 'shop'))) await folder.write(`model/${path}`, content)
  await folder.write('radical.json', MAPPING)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  await studio.designer()
  await page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: 'Everything' }) }).click()

  await studio.node('api').dblclick()
  await expect(studio.properties.getByRole('region', { name: 'Built in' })).toHaveText(/Built in\s*services\/orders-api$/)
})

test('the card of a scenario lists its tests', async ({ page, studio }) => {
  const scenarios: DiagramData = {
    metamodel: builtInGovernanceMetamodel(),
    nodes: [
      node('pays', 'scenario', 'Pays', { x: 40, y: 40, given: 'a cart', when: 'paying', then: 'paid' }),
      node('quotes', 'scenario', 'Quotes', { x: 400, y: 40, given: 'a cart', when: 'quoting', then: 'quoted' }),
    ],
    relations: [],
    views: [{ id: 'v-sc', name: 'Scenarios', nodeIds: ['pays', 'quotes'], positions: {} }],
  }
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(scenarios, 'shop'))) await folder.write(`.radical/model/${path}`, content)
  await folder.write('.radical/radical.json', JSON.stringify({ implements: [], verifies: [
    { element: 'pays', name: 'Pays', tests: ['tests/pay.test.ts › pays', 'tests/pay.test.ts › declines'] },
  ] }))
  // The test results radical check kept beside the model: one of the two ran.
  await folder.write('.radical/model/.state/test-results.json', serializeTestResults(
    [{ file: 'tests/pay.test.ts', title: ['pays'], status: 'passed' }], ['reports/vitest.json'], new Date()))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  await studio.designer()
  await page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: 'Scenarios' }) }).click()

  const tests = studio.properties.getByRole('region', { name: 'Tests' })
  await studio.node('pays').dblclick()
  await expect(tests.locator('.pp-section-title')).toHaveText('Tests · 2')
  await expect(tests.locator('li')).toHaveText(['tests/pay.test.ts › payspassed', 'tests/pay.test.ts › declinesgone'])

  await page.keyboard.press('Escape')
  await studio.node('quotes').dblclick()
  await expect(tests).toContainText('radical verify "Quotes" --test "<file> › <title>"')
})

test('Settings save the repository\'s test files to .radical/radical.json', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(SHOP, 'shop'))) await folder.write(`.radical/model/${path}`, content)
  // check.json still holds the repository's test files, as before .radical/radical.json did.
  await folder.write('.radical/model/check.json', JSON.stringify({ rules: { 'test-unbound': { severity: 'warning', include: ['apps/e2e/**'] } } }, null, 2) + '\n')
  await folder.write('.radical/radical.json', MAPPING)
  await folder.write('.radical/model/.state/test-results.json', serializeTestResults([{ file: 'apps/e2e/a.spec.ts', title: ['a'], status: 'passed' }], ['reports/e2e.json'], new Date()))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await studio.ready()
  await page.getByRole('button', { name: /^Inspector/ }).click({ timeout: 10_000 })
  await page.getByRole('tab', { name: /^Settings/ }).click()

  await page.getByRole('textbox', { name: 'Add to Include' }).fill('apps/web/**')
  await page.getByRole('textbox', { name: 'Add to Include' }).press('Enter')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.insp-savebar')).toHaveCount(0)
  await expect.poll(async () => JSON.parse((await folder.files())['.radical/radical.json']).tests).toEqual({ include: ['apps/e2e/**', 'apps/web/**'] })
  // The mapping stays; check.json keeps only the model's rule.
  expect(JSON.parse((await folder.files())['.radical/radical.json']).implements).toHaveLength(2)
  expect(JSON.parse((await folder.files())['.radical/model/check.json']).rules['test-unbound']).toEqual({ severity: 'warning' })
})
