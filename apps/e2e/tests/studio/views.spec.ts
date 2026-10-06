import { builtInC4Metamodel } from '@radical/common/metamodel'
import { test, expect, fixture } from '../../support/fixtures'

// Every view kind renders, from a deep link, the same way it did before.
// Screenshots run on a frozen clock so animations and the live layout land
// on the same frame every time.

test.beforeEach(async ({ studio }) => {
  await studio.freezeTime()
})

test.describe('bookstore views', () => {
  test.beforeEach(async ({ studio }) => {
    await studio.seed()
  })

  test('System Context (static)', async ({ page, studio }) => {
    await studio.open('v-context')
    await expect(page.getByText('Structure: System Context')).toBeVisible()
    await expect(studio.nodes).toHaveCount(3)
    await expect(studio.edges).toHaveCount(2)
    await expect(page).toHaveScreenshot('bookstore-context.png')
  })

  test('Containers (static, nested)', async ({ page, studio }) => {
    await studio.open('v-containers')
    await expect(studio.nodes).toHaveCount(6)
    await expect(studio.edges).toHaveCount(4)
    await expect(page).toHaveScreenshot('bookstore-containers.png')
  })

  test('Place Order Flow (dynamic)', async ({ page, studio }) => {
    await studio.open('v-order')
    await expect(page.getByText('Flow:')).toBeVisible()
    await expect(page.getByText('4 steps · 5 participants')).toBeVisible()
    for (const step of ['submits the order', 'posts the order', 'stores the order', 'charges the card']) {
      await expect(page.getByText(step, { exact: true })).toBeVisible()
    }
    await expect(page).toHaveScreenshot('bookstore-order-flow.png')
  })

  test('Element Table (table)', async ({ page, studio }) => {
    await studio.open('v-table')
    const rows = page.locator('tbody tr')
    await expect(rows).toHaveCount(6)
    await expect(rows.filter({ hasText: 'Payment Provider' })).toContainText('Card payments')
    const tabs = page.locator('.tv-tabs')
    await tabs.getByRole('button', { name: /^Relations\s*4$/ }).click()
    await expect(page.locator('tbody tr')).toHaveCount(4)
    await tabs.getByRole('button', { name: /^All Nodes/ }).click()
    await expect(page).toHaveScreenshot('bookstore-table.png')
  })
})

test.describe('sample views', () => {
  for (const [view, name] of [
    ['view-core', 'Core Banking'],
    ['view-treemap', 'Platform Hierarchy'],
    ['view-matrix', 'Dependency Matrix'],
    ['view-wiki', 'Architecture Wiki'],
    ['view-screens', 'Screen Map'],
  ] as const) {
    test(`${name} (${view})`, async ({ page, studio }) => {
      await studio.openSample(view)
      await expect(page).toHaveURL(new RegExp(`/v/${view}$`))
      await expect(page).toHaveScreenshot(`sample-${view}.png`)
    })
  }
})

test.describe('perspectives', () => {
  test.beforeEach(async ({ studio }) => {
    await studio.seed()
  })

  test('Viewer is read-only', async ({ page, studio }) => {
    await studio.open('v-containers', 'viewer')
    await expect(page.getByRole('button', { name: 'Viewer', exact: true })).toBeVisible()
    await expect(page.locator('.palette-item')).toHaveCount(0)
    await studio.node('api').click()
    await studio.advance(500)
    const label = page.locator('.props-field').filter({ has: page.getByText('Label', { exact: true }) }).locator('input')
    await expect(label).toHaveValue('API')
    await expect(label).not.toBeEditable()
    await expect(page).toHaveScreenshot('viewer-containers.png')
  })

  test('switching perspective keeps the view and updates the URL', async ({ page, studio }) => {
    await studio.open('v-containers')
    await page.getByRole('button', { name: 'Presenter', exact: true }).click()
    await studio.advance(500)
    await expect(page).toHaveURL(/\/m\/presenter\/v\/v-containers$/)
    await expect(page.getByRole('button', { name: 'Present', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Designer', exact: true }).click()
    await studio.advance(500)
    await expect(page).toHaveURL(/\/m\/designer\/v\/v-containers$/)
    await expect(page.locator('.palette-item').first()).toBeVisible()
  })
})

test.describe('custom metamodel', () => {
  // Built-in presets have no boolean column on a type with its own table tab,
  // so give Software System a tab: its External column is a boolean.
  test.beforeEach(async ({ studio }) => {
    const doc = JSON.parse(fixture('bookstore'))
    const metamodel = builtInC4Metamodel()
    metamodel.id = 'c4-system-tab'
    metamodel.nodeTypes.system.tableTab = true
    await studio.seedDocument(JSON.stringify({ ...doc, metamodel }))
  })

  test('boolean table cells are read-only in Viewer', async ({ page, studio }) => {
    await studio.open('v-table', 'viewer')
    await page.locator('.tv-tabs').getByRole('button', { name: /^Software System/ }).click()
    const external = page.locator('tbody tr').filter({ hasText: 'Payment Provider' }).locator('.tv-bool')
    await expect(external).toHaveText('✓')
    await external.click()
    await studio.advance(500)
    await expect(external).toHaveText('✓')
  })
})
