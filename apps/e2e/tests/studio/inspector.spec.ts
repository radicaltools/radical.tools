import { expect } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeTestResults, type TestCase } from '@radical/common/check'
import type { C4Node, DiagramData } from '@radical/common/c4'

// The Inspector perspective shows what radical check says about a model
// kept in a folder: the rules run on the model as it is, the test results
// come from .radical/test-results.json, which `radical check --report`
// writes beside the model.

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

const MODEL: DiagramData = {
  metamodel: builtInGovernanceMetamodel(),
  nodes: [
    node('shop', 'system', 'Shop', { x: 40, y: 40, width: 520, height: 300 }),
    node('api', 'container', 'Checkout API', { parentId: 'shop', x: 40, y: 60 }),
    node('need', 'need', 'Pay online', { x: 700, y: 40 }),
    node('req', 'requirement', 'Take card payments', { x: 700, y: 220, ears_type: 'ubiquitous', action: 'take card payments' }),
    node('sc', 'scenario', 'Paying by card', { x: 700, y: 400, given: 'a cart', when: 'the user pays by card', then: 'the order is paid', tests: 'tests/pay.test.ts › pays by card' }),
  ],
  relations: [
    { id: 'r1', relationType: 'derives', sourceId: 'req', targetId: 'need' },
    { id: 'r2', relationType: 'satisfies', sourceId: 'api', targetId: 'req' },
    { id: 'r3', relationType: 'verifies', sourceId: 'sc', targetId: 'req' },
  ],
  views: [
    { id: 'v-arch', name: 'Architecture', nodeIds: ['shop', 'api'], positions: {} },
    { id: 'v-spec', name: 'Specification', nodeIds: ['need', 'req', 'sc'], positions: {} },
  ],
}

const results = (status: TestCase['status']): string =>
  serializeTestResults([{ file: '/repo/tests/pay.test.ts', title: ['pays by card'], status }], ['reports/unit.json'])

test('the Inspector shows what radical check says, and its links lead to the element', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(MODEL, 'Shop'))) await folder.write(path, content)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()

  // No report beside the model yet: nothing to inspect.
  const inspector = page.getByRole('button', { name: /^Inspector/ })
  await expect(inspector).toBeDisabled()
  await expect(inspector).toHaveAttribute('title', /no check report beside this model/)

  // radical check --report wrote one in which the scenario's test failed.
  await folder.write('.radical/test-results.json', results('failed'))
  await expect(inspector).toBeEnabled({ timeout: 10_000 })
  await expect(inspector.locator('.insp-count .e')).toHaveText('✖ 1')

  await inspector.click()
  await expect(page.locator('.insp-verdict')).toHaveText(/✖ 1 errors/)
  // No canvas here: no Fit All, zoom, Smart Layout, Undo or Redo.
  for (const name of ['Fit All', 'Smart Layout', 'Undo', 'Redo']) {
    await expect(page.locator('.toolbar').getByRole('button', { name })).toHaveCount(0)
  }
  const error = page.locator('.insp-error')
  await expect(error).toContainText('test tests/pay.test.ts › pays by card failed.')
  await expect(page.locator('.insp-tile').first()).toContainText('0 / 11 broken')

  // What the failure leaves unverified is a link to the element.
  await error.locator('.insp-chain').getByRole('button', { name: /Take card payments/ }).click()
  const peek = page.getByRole('complementary', { name: 'Element' })
  await expect(peek.locator('h3')).toHaveText('Take card payments')
  await expect(peek).toContainText('broken')
  await expect(peek.locator('.insp-peek-sec').filter({ hasText: 'Checked by' })).toContainText('Paying by card')

  // From there to Designer, on the canvas that shows it, selected.
  await peek.getByRole('button', { name: 'Show on canvas' }).click()
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Designer/)
  await expect(page.locator('.canvas-controls').getByRole('button', { name: 'Fit All' })).toBeVisible()
  await expect(page.getByText(/^Structure:/)).toHaveText('Structure: Specification')
  await expect(studio.node('req')).toHaveClass(/selected/)

  // The test passes in the next run: the model is verified, no errors.
  await folder.write('.radical/test-results.json', results('passed'))
  await expect(inspector.locator('.insp-count .e')).toHaveCount(0, { timeout: 10_000 })
  await inspector.click()
  await expect(page.locator('.insp-verdict')).toHaveText(/No errors/)
  await expect(page.locator('.insp-tile').first()).toContainText('1 / 10 broken')
})

test('a deep link opens the Inspector at once, and only with all it reads', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(MODEL, 'Shop'))) await folder.write(path, content)
  await folder.write('.radical/test-results.json', results('failed'))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await studio.ready()
  await page.getByRole('button', { name: /^Inspector/ }).click({ timeout: 10_000 })
  await expect(page).toHaveURL(/m\/inspector/)

  // Record what the page shows from its first paint on.
  await page.addInitScript(() => {
    const seen = new Set<string>()
    ;(window as unknown as { __seen: Set<string> }).__seen = seen
    new MutationObserver(() => {
      if (document.querySelector('.react-flow')) seen.add('canvas')
      if (document.querySelector('.insp-notice')) seen.add('inspector without test results')
      const tile = document.querySelector('.insp-tile .insp-label')?.textContent
      if (tile && tile !== 'Requirements verified') seen.add(`tile ${tile}`)
    }).observe(document, { childList: true, subtree: true, characterData: true })
  })
  await page.reload()
  await expect(page.locator('.insp-verdict')).toHaveText(/✖ 1 errors/, { timeout: 15_000 })
  await expect(page.locator('.insp-tile').first()).toContainText('0 / 11 broken')
  expect(await page.evaluate(() => [...(window as unknown as { __seen: Set<string> }).__seen])).toEqual([])
})
