import { expect } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeMeasurementStore } from '@radical/common/check'
import type { C4Node, DiagramData } from '@radical/common/c4'

// One cause is one thing to fix. A scenario and a fitness function may
// state the same metric condition; one measurement off its limit then
// fails both, and radical check reports a finding for each. The Inspector
// shows them on one row, with both elements and all they leave unverified,
// and counts one to fix.

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

const CONDITION = 'tests.unit.over_100ms == 0'
const MODEL: DiagramData = {
  metamodel: builtInGovernanceMetamodel(),
  nodes: [
    node('shop', 'system', 'Shop', { x: 40, y: 40, width: 520, height: 300 }),
    node('need', 'need', 'Fast feedback', { x: 700, y: 40 }),
    node('req', 'requirement', 'Mostly fast unit tests', { x: 700, y: 220, ears_type: 'ubiquitous', action: 'keep the unit tests fast' }),
    node('sc', 'scenario', 'Unit test stays isolated', { x: 700, y: 400, given: 'the unit tests', when: 'they run', then: 'none takes over 100 ms', metrics: CONDITION }),
    node('adr', 'adr', 'A test pyramid', { x: 40, y: 400, status: 'accepted', date: '2026-10-29', context: 'c', decision: 'd', consequences: 'q' }),
    node('ff', 'fitness-fn', 'Unit tests stay fast', { x: 40, y: 560, max_age: '7d', metrics: CONDITION }),
  ],
  relations: [
    { id: 'r1', relationType: 'derives', sourceId: 'req', targetId: 'need' },
    { id: 'r2', relationType: 'satisfies', sourceId: 'shop', targetId: 'req' },
    { id: 'r3', relationType: 'verifies', sourceId: 'sc', targetId: 'req' },
    { id: 'r4', relationType: 'implements', sourceId: 'ff', targetId: 'adr' },
  ],
  views: [{ id: 'v-spec', name: 'Specification', nodeIds: ['need', 'req', 'sc', 'adr', 'ff'], positions: {} }],
}

test('a condition two elements state of one measurement is one row, and one to fix', async ({ page, studio }) => {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(MODEL, 'Shop'))) await folder.write(path, content)
  // Two unit tests took over 100 ms, measured seventeen hours ago.
  await folder.write('.state/measurements.json', serializeMeasurementStore([
    { metric: 'tests.unit.over_100ms', value: 2, labels: {}, source: 'json', at: new Date(Date.now() - 17 * 3600e3).toISOString() },
  ]))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await studio.ready()
  const inspector = page.locator('.activity-rail').getByRole('button', { name: /^Inspector(,|$)/ })
  await inspector.click({ timeout: 10_000 })

  // One to fix: on the rail, in the verdict and in the group, though the
  // check reports the condition for the scenario and for the fitness function.
  await expect(inspector.locator('.lp-rail-count')).toHaveText('1')
  const verdict = page.locator('.insp-verdict')
  await expect(verdict).toHaveText('✖ 1 to fix')
  await expect(verdict).toHaveAttribute('title', /radical check counts 2 errors/)
  const failed = page.getByRole('region', { name: 'To fix' }).locator('details.insp-group[data-rule="metric-failed"]')
  await expect(failed.locator('summary .insp-rcount')).toHaveText('1')

  // One row: the condition once, what was measured, both elements that
  // state it and both what they leave unverified.
  const row = failed.locator('.insp-finding')
  await expect(row).toHaveCount(1)
  await expect(row.locator('.insp-cond code')).toHaveText(CONDITION)
  await expect(row.locator('.insp-measured')).toHaveText('Measured 2 · json · 17 h ago')
  await expect(row.locator('.insp-finding-what > .insp-chip .insp-chip-label')).toHaveText(['Unit test stays isolated', 'Unit tests stay fast'])
  await expect(row.locator('.insp-chain .insp-chip-label')).toHaveText(['Mostly fast unit tests', 'A test pyramid'])
})
