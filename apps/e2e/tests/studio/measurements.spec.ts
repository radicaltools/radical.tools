import { expect } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeMeasurementStore } from '@radical/common/check'
import type { C4Node, DiagramData } from '@radical/common/c4'
import type { Page } from '@playwright/test'

// The Inspector's Measurements tab: what the sensors measured, from
// .state/measurements.json beside the model, by metric, each value with its
// labels, source and age, and under it the scenarios and fitness functions
// whose conditions read it with their outcomes; after them the metric
// conditions nothing measured; Path on a reader opens its verification
// path, the whole evaluation flow, and Back returns to the tab.

const inspectorButton = (page: Page) => page.locator('.activity-rail').getByRole('button', { name: 'Inspector', exact: true })
const tab = (page: Page, name: RegExp) => page.getByRole('tablist', { name: 'Inspector' }).getByRole('tab', { name })

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

// A fitness function with two metric conditions, one measured off its
// threshold and one within it, and a scenario with a condition nothing
// measured.
const MODEL: DiagramData = {
  metamodel: builtInGovernanceMetamodel(),
  nodes: [
    node('shop', 'system', 'Shop', { x: 40, y: 40, width: 520, height: 300 }),
    node('api', 'container', 'Checkout API', { parentId: 'shop', x: 40, y: 60 }),
    node('need', 'need', 'Pay online', { x: 700, y: 40 }),
    node('req', 'requirement', 'Take card payments', { x: 700, y: 220, ears_type: 'ubiquitous', action: 'take card payments' }),
    node('sc', 'scenario', 'Paying by card', { x: 700, y: 400, given: 'a cart', when: 'the user pays by card', then: 'the order is paid', metrics: 'checkout.queue.depth{env=staging} <= 100' }),
    node('adr', 'adr', 'Fast checkout', { x: 40, y: 400, status: 'accepted', date: '2026-10-29', context: 'c', decision: 'd', consequences: 'q' }),
    node('ff', 'fitness-fn', 'Checkout latency', { x: 40, y: 520, max_age: '7d', metrics: 'checkout.latency.p95{env=staging} <= 300 ms\ncheckout.errors.rate{env=staging} < 1 %' }),
  ],
  relations: [
    { id: 'r1', relationType: 'derives', sourceId: 'req', targetId: 'need' },
    { id: 'r2', relationType: 'satisfies', sourceId: 'api', targetId: 'req' },
    { id: 'r3', relationType: 'verifies', sourceId: 'sc', targetId: 'req' },
    { id: 'i', relationType: 'implements', sourceId: 'ff', targetId: 'adr' },
    { id: 'c', relationType: 'constrains', sourceId: 'adr', targetId: 'api' },
  ],
  views: [
    { id: 'v-arch', name: 'Architecture', nodeIds: ['shop', 'api'], positions: {} },
    { id: 'v-spec', name: 'Specification', nodeIds: ['need', 'req', 'sc', 'adr', 'ff'], positions: {} },
  ],
}

/** The model in a folder with what the json sensor measured: the latency
 *  too slow two hours ago, the error rate within its threshold now. Opens
 *  the Inspector on its Measurements tab. */
async function openMeasurements(page: Page, studio: { ready: () => Promise<void> }): Promise<void> {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(MODEL, 'Shop'))) await folder.write(path, content)
  const twoHoursAgo = new Date(Date.now() - 2 * 3600e3).toISOString()
  await folder.write('.state/measurements.json', serializeMeasurementStore([
    { metric: 'checkout.latency.p95', value: 0.42, unit: 's', labels: { env: 'staging' }, source: 'json', at: twoHoursAgo, context: { commit: 'abc1234' } },
    { metric: 'checkout.errors.rate', value: 0.2, unit: '%', labels: { env: 'staging' }, source: 'json', at: new Date().toISOString() },
  ]))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  await expect(inspectorButton(page)).toBeEnabled({ timeout: 10_000 })
  await inspectorButton(page).click()
  await tab(page, /^Measurements/).click()
  await expect(page).toHaveURL(/\/i\/measurements$/)
}

test('the Measurements tab lists what the sensors measured, by metric, with what reads each value', async ({ page, studio }) => {
  await openMeasurements(page, studio)

  // The tab's card counts the measurements and the values off their condition.
  const card = tab(page, /^Measurements/)
  await expect(card.locator('.insp-pill')).toHaveText(['2', '✗ 1'])

  // One section per metric, the one with a failing reader first.
  const metrics = page.getByTestId('insp-metric')
  await expect(metrics).toHaveCount(2)
  const latency = metrics.nth(0)
  await expect(latency).toHaveAttribute('aria-label', 'checkout.latency.p95')
  await expect(latency.locator('.insp-metric-head')).toContainText('1 measurement · by json · 2 h ago')
  await expect(latency.locator('.insp-metric-head .insp-pill.bad')).toHaveText('✗ 1 failed')
  const row = latency.getByTestId('insp-measurement')
  await expect(row.locator('.insp-meas-labels')).toHaveText('env=staging')
  await expect(row.locator('.insp-meas-value')).toHaveText('0.42 s')
  await expect(row).toContainText('json · 2 h ago')
  await expect(row).toHaveClass(/alert/)
  // Under the value, who reads it: the fitness function, its condition, the outcome.
  const reader = row.getByRole('list', { name: 'Read by' }).locator('li')
  await expect(reader).toHaveCount(1)
  await expect(reader).toContainText('Checkout latency')
  await expect(reader.locator('code')).toHaveText('checkout.latency.p95{env=staging} <= 300 ms')
  await expect(reader.locator('.insp-pill')).toHaveText('failed')
  await expect(reader.getByRole('button', { name: 'Path' })).toBeVisible()

  const errors = metrics.nth(1)
  await expect(errors).toHaveAttribute('aria-label', 'checkout.errors.rate')
  await expect(errors.getByTestId('insp-measurement').locator('.insp-meas-value')).toHaveText('0.2 %')
  await expect(errors.getByRole('list', { name: 'Read by' }).locator('li .insp-pill')).toHaveText('passed')

  // What waits for a sensor: the scenario's condition nothing measured.
  const waiting = page.getByTestId('insp-unmeasured').locator('li')
  await expect(waiting).toHaveCount(1)
  await expect(waiting).toContainText('Paying by card')
  await expect(waiting.locator('code')).toHaveText('checkout.queue.depth{env=staging} <= 100')
  await expect(waiting.locator('.insp-pill')).toHaveText('not run')

  // The filter narrows the metrics, and what waits, by the text typed.
  const filter = page.getByRole('searchbox', { name: 'Filter measurements' })
  await filter.fill('errors')
  await expect(metrics).toHaveCount(1)
  await expect(metrics).toHaveAttribute('aria-label', 'checkout.errors.rate')
  await expect(page.getByTestId('insp-unmeasured')).toHaveCount(0)
  await expect(page.locator('.insp-meas-bar')).toContainText('2 measurements of 2 metrics, 1 shown')
  // By the name of the element that reads it, too.
  await filter.fill('paying')
  await expect(metrics).toHaveCount(0)
  await expect(page.getByTestId('insp-unmeasured').locator('li')).toHaveCount(1)
  await filter.fill('')
  await expect(metrics).toHaveCount(2)

  // An element named is a link to it, the Inspector giving the view back.
  await reader.getByRole('button', { name: /Checkout latency/ }).click()
  await expect(page.getByRole('complementary', { name: 'Properties' }).locator('.pp-title')).toHaveText('Checkout latency')
  await expect(page.getByRole('region', { name: 'Inspector' })).toHaveCount(0)
})

test('Path on a reader opens its verification path, and Back returns to the tab', async ({ page, studio }) => {
  await openMeasurements(page, studio)
  const latency = page.getByTestId('insp-metric').nth(0)
  await latency.getByRole('list', { name: 'Read by' }).getByRole('button', { name: 'Path' }).click()

  // The whole evaluation flow: from the ADR to the fitness function and its
  // conditions, this measurement at the end.
  const panel = page.getByTestId('trace-panel')
  await expect(panel).toBeVisible()
  await expect(page).toHaveURL(/\/i\/measurements\/tr\/ff$/)
  await expect(panel).toContainText('Fast checkout')
  await expect(panel).toContainText('Checkout latency')
  await expect(panel).toContainText('0.42 s')
  // The tab stays mounted under the path, out of sight.
  await expect(page.getByTestId('insp-metric').first()).toBeHidden()

  // Back leaves the path for the tab it was opened from.
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL(/\/i\/measurements$/)
  await expect(panel).toHaveCount(0)
  await expect(page.getByTestId('insp-metric')).toHaveCount(2)
  await expect(page.getByTestId('insp-metric').first()).toBeVisible()
  await expect(tab(page, /^Measurements/)).toHaveAttribute('aria-selected', 'true')
})
