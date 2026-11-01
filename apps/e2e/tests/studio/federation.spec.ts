import type { Page } from '@playwright/test'
import { expect, type Studio } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { serializeFederationFile, type FederationFile } from '@radical/common/federation'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import type { C4Node, DiagramData } from '@radical/common/c4'

// A federation: a model folder's deps.json names the models it depends on,
// and radical federation fetch writes their elements, each marked with its
// origin (<name>@<commit>), into the folder's .radical/federation.json.
// Studio opens the model folder itself and shows them beside its own,
// dashed and read-only, and writes only its own back. The test writes the
// folder as git and the CLI would.

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 240, height: 140, collapsed: false, ...props }) as C4Node

/** The payments model's own: its relation reads Orders, of the model orders. */
const PAYMENTS: DiagramData = {
  metamodel: builtInGovernanceMetamodel(),
  nodes: [node('pay', 'system', 'Payments', { x: 40, y: 40 })],
  relations: [{ id: 'r-reads', relationType: 'interacts', sourceId: 'pay', targetId: 'ord', label: 'reads orders' }],
  views: [
    { id: 'v-landscape', name: 'Landscape', nodeIds: ['pay', 'ord'], positions: {} },
    { id: 'v-table', name: 'Systems table', kind: 'table', nodeIds: ['pay', 'ord'], positions: {} },
    { id: 'v-wiki', name: 'Systems wiki', kind: 'wiki', nodeIds: ['pay', 'ord'], positions: {} },
    // As one of orders' views is named.
    { id: 'v-containers', name: 'Containers', nodeIds: ['pay'], positions: {} },
  ],
}

const DEPS = JSON.stringify({ name: 'payments', dependencies: [{ name: 'orders', repo: '../orders', path: 'architecture', ref: 'main' }] }, null, 2)

/** .radical/federation.json as radical federation fetch writes it, with Orders named `label`. */
const fetched = (label = 'Orders'): string => serializeFederationFile({
  version: 2,
  name: 'payments',
  fetchedAt: new Date().toISOString(),
  dependencies: [{ name: 'orders', repo: '../orders', path: 'architecture', ref: 'main', commit: 'abc1234def' }],
  notes: [],
  nodes: [node('ord', 'system', label, { x: 420, y: 40, origin: 'orders@abc1234', description: 'Takes orders.' })],
  relations: [],
  // A view of orders, in its folder Logical there.
  views: [{ id: 'v-ord-containers', name: 'Containers', folder: 'Logical', nodeIds: ['ord'], positions: { ord: { x: 300, y: 200, width: 240, height: 140 } }, origin: 'orders@abc1234' }],
} satisfies FederationFile)

/** Opens the payments folder (`own`) in Studio, in Designer, on the view
 *  named, with the other models `federation` fetched (null: none fetched). */
async function openComposed(page: Page, studio: Studio, view: string, { own = PAYMENTS, federation = fetched() }: { own?: DiagramData; federation?: string | null } = {}): Promise<ModelFolder> {
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  const files = { ...serializeToMdFolder(own, 'payments'), 'deps.json': DEPS, ...(federation ? { '.radical/federation.json': federation } : {}) }
  for (const [path, content] of Object.entries(files)) await folder.write(path, content)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  await studio.designer()
  await page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: view }) }).click()
  return folder
}

/** Whether any of the folder's node files is of the element labelled `label`. */
const nodeFileOf = (files: Record<string, string>, label: string): boolean =>
  Object.entries(files).some(([path, text]) => path.startsWith('nodes/') && text.includes(`label: "${label}"`))

test('an element of another model is marked and cannot be changed', async ({ page, studio }) => {
  const folder = await openComposed(page, studio, 'Landscape')

  // Dashed: another model's. This model's own element is drawn as ever.
  await expect(studio.node('ord')).toHaveClass(/rf-node-other-model/)
  await expect(studio.node('pay')).not.toHaveClass(/rf-node-other-model/)
  const outline = await studio.node('ord').evaluate((el) => getComputedStyle(el).outlineStyle)
  expect(outline).toBe('dashed')

  // The card says where it is from, and has nothing to edit.
  await studio.node('ord').dblclick()
  const note = studio.properties.getByRole('note')
  await expect(note).toHaveText('From the model orders at abc1234 · read-only. Change it in that model\'s repository.')
  await expect(studio.properties.locator('.pp-title')).toContainText('Orders')
  await expect(studio.attribute('Name')).toHaveCount(0)
  await expect(studio.properties.getByRole('button', { name: 'Edit Description' })).toHaveCount(0)
  await expect(studio.properties.getByRole('button', { name: /^Delete element/ })).toHaveCount(0)

  // Delete is refused, with a notice that names the model.
  await page.keyboard.press('Delete')
  await expect(page.getByRole('region', { name: 'Notifications' })).toContainText('"Orders" belongs to the model orders (orders@abc1234)')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(studio.node('ord')).toBeVisible()
  // It is not written into the folder: it stays in .radical/federation.json.
  const files = await folder.files()
  expect(nodeFileOf(files, 'Orders')).toBe(false)
  expect(files['.radical/federation.json']).toContain('"label": "Orders"')

  // This model's element is edited as ever.
  await studio.node('pay').dblclick()
  await expect(studio.attribute('Name')).toHaveValue('Payments')
  await expect(studio.properties.getByRole('note')).toHaveCount(0)
})

test('an element of another model is read-only in a table and the wiki', async ({ page, studio }) => {
  await openComposed(page, studio, 'Systems table')

  // Its row names its model; F2 opens no name field, and nothing is added inside it.
  const theirs = page.locator('tr.tv-row[data-node-id="ord"]')
  await expect(theirs.locator('.tv-origin')).toHaveText('orders')
  await theirs.locator('.tv-chain-cell').click()
  await page.keyboard.press('F2')
  await expect(page.locator('.tv-cell-input')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add under Orders' })).toHaveCount(0)
  // This model's own row is renamed as ever, and takes what goes inside it.
  await expect(page.getByRole('button', { name: 'Add under Payments' })).toHaveCount(1)
  const ours = page.locator('tr.tv-row[data-node-id="pay"]')
  await ours.locator('.tv-chain-cell').click()
  await page.keyboard.press('F2')
  await expect(page.locator('.tv-cell-input')).toHaveValue('Payments')
  await page.keyboard.press('Escape')

  // Its wiki page: the title opens no field, the menu offers no edit.
  await page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: 'Systems wiki' }) }).click()
  await page.locator('.wiki-nav-row', { hasText: 'Orders' }).click()
  await expect(page.locator('.wiki-title')).toHaveText('Orders')
  await page.locator('.wiki-title .wiki-inline-view').click()
  await expect(page.locator('.wiki-title input')).toHaveCount(0)
  await page.locator('.wiki-nav-row', { hasText: 'Orders' }).click({ button: 'right' })
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Edit facts' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  // This model's own page is edited as ever.
  await page.locator('.wiki-nav-row', { hasText: 'Payments' }).click()
  await expect(page.locator('.wiki-title')).toHaveText('Payments')
  await page.locator('.wiki-title .wiki-inline-view').click()
  await expect(page.locator('.wiki-title input')).toHaveValue('Payments')
})

test('edits stay the model\'s own, and a new fetch reaches the open model', async ({ page, studio }) => {
  const folder = await openComposed(page, studio, 'Landscape')
  await expect(studio.node('ord')).toContainText('Orders')

  // An edit of the model's own is written; the other model's element is not.
  await studio.node('pay').dblclick()
  await studio.attribute('Name').fill('Payments v2')
  await studio.attribute('Name').press('Tab')
  await expect.poll(async () => nodeFileOf(await folder.files(), 'Payments v2'), { timeout: 10_000 }).toBe(true)
  const files = await folder.files()
  expect(nodeFileOf(files, 'Orders')).toBe(false)
  expect(Object.entries(files).some(([path, text]) => !path.startsWith('.radical/') && text.includes('orders@abc1234'))).toBe(false)
  expect(JSON.parse(files['relations.json'])).toEqual([expect.objectContaining({ id: 'r-reads', sourceId: 'pay', targetId: 'ord' })])
  // Its place on the view is kept, as the model's layout keeps it.
  expect(JSON.parse(files['views.json']).find((v: { id: string }) => v.id === 'v-landscape').nodeIds).toContain('ord')

  // A new fetch: Studio shows the other model as fetched now, the edit kept.
  await folder.write('.radical/federation.json', fetched('Orders v2'))
  await expect(studio.node('ord')).toContainText('Orders v2', { timeout: 10_000 })
  await expect(studio.node('ord')).toHaveClass(/rf-node-other-model/)
  await expect(studio.node('pay')).toContainText('Payments v2')
  const after = await folder.files()
  expect(nodeFileOf(after, 'Orders v2')).toBe(false)
  expect(nodeFileOf(after, 'Payments v2')).toBe(true)
})

test('a model whose other models are not fetched says how to fetch them', async ({ page, studio }) => {
  await openComposed(page, studio, 'Landscape', { federation: null })
  await expect(page.getByRole('region', { name: 'Notifications' }))
    .toContainText('This model depends on orders, which are not fetched yet. Run radical federation fetch in the model folder to see them.')
  // Its own model is shown as ever, without the other model's element.
  await expect(studio.node('pay')).toBeVisible()
  await expect(studio.node('ord')).toHaveCount(0)
})

test('another model\'s view is listed in its folder, read-only, and copied into the model', async ({ page, studio }) => {
  const folder = await openComposed(page, studio, 'Landscape')

  // Under orders › Logical, marked as orders'.
  const named = (name: string) => page.locator('.lp-folder-name', { hasText: new RegExp(`^${name}$`) })
  const logical = page.locator('.lp-folder').filter({ has: named('orders') }).locator('.lp-folder').filter({ has: named('Logical') })
  const theirs = logical.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: 'Containers' }) })
  await expect(theirs).toHaveCount(1)
  await expect(theirs.locator('.lp-view-origin')).toHaveText('orders')

  // Opened, it shows orders' elements only, where orders has them, and says it is read-only.
  await theirs.click()
  await expect(studio.node('ord')).toBeVisible()
  await expect(studio.node('pay')).toHaveCount(0)
  const bar = page.locator('.other-model-bar')
  await expect(bar).toContainText('A view of the model orders at abc1234 · read-only.')
  await expect(page.locator('.element-palette')).toHaveCount(0)

  // Its properties offer no rename, move or delete.
  await theirs.getByTitle('View properties').click()
  await expect(page.locator('.rp-pane').getByRole('note')).toContainText('read-only')
  await expect(page.getByTitle('Rename view')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Move to folder' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete view' })).toHaveCount(0)
  await page.getByRole('button', { name: '◀ Back' }).click()

  // Copied: the model's own view, named apart from payments' Containers, opened and editable.
  await bar.getByRole('button', { name: 'Copy to this model' }).click()
  const copy = page.locator('.lp-view-card.active')
  await expect(copy.locator('.lp-card-title')).toHaveText('Containers (orders)')
  await expect(copy.locator('.lp-view-origin')).toHaveCount(0)
  await expect(bar).toHaveCount(0)
  await expect(studio.node('ord')).toBeVisible()
  await copy.getByTitle('View properties').click()
  await expect(page.getByTitle('Rename view')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Delete view' })).toHaveCount(1)

  // The folder keeps the copy and payments' own view, not orders' view.
  type SavedView = { id: string; name: string; folder?: string; nodeIds: string[]; origin?: string }
  const saved = async (): Promise<SavedView[]> => JSON.parse((await folder.files())['views.json'] ?? '[]')
  await expect.poll(async () => (await saved()).map((v) => v.name), { timeout: 10_000 }).toContain('Containers (orders)')
  const views = await saved()
  expect(views.find((v) => v.name === 'Containers (orders)')).toMatchObject({ folder: 'Logical', nodeIds: ['ord'] })
  expect(views.some((v) => v.id === 'v-ord-containers' || v.origin)).toBe(false)
  expect(views.some((v) => v.id === 'v-containers')).toBe(true)
})

test('a milestone shows the other models as they were when it was made', async ({ page, studio }) => {
  // orders at a commit A has Orders and Orders API; payments reads Orders API.
  const ordersAt = (commit: string, api: string, extra: Partial<FederationFile> = {}): string => serializeFederationFile({
    version: 2,
    name: 'payments',
    fetchedAt: new Date().toISOString(),
    dependencies: [{ name: 'orders', repo: '../orders', path: 'architecture', ref: 'main', commit }],
    notes: [],
    nodes: [
      node('ord', 'system', 'Orders', { x: 420, y: 40, origin: `orders@${commit.slice(0, 7)}` }),
      node('ord-api', 'system', api, { x: 420, y: 300, origin: `orders@${commit.slice(0, 7)}` }),
    ],
    relations: [],
    ...extra,
  } satisfies FederationFile)
  const A = 'abc1234def'
  const B = 'bbbbbbb999'
  const own: DiagramData = {
    ...PAYMENTS,
    relations: [...PAYMENTS.relations, { id: 'r-api', relationType: 'interacts', sourceId: 'pay', targetId: 'ord-api', label: 'calls' }],
    views: PAYMENTS.views!.map((v) => (v.id === 'v-landscape' ? { ...v, nodeIds: ['pay', 'ord', 'ord-api'] } : v)),
  }
  const folder = await openComposed(page, studio, 'Landscape', { own, federation: ordersAt(A, 'Orders API') })
  await expect(studio.node('ord-api')).toContainText('Orders API')

  // A milestone made now keeps payments' own and the commit of orders.
  await page.getByRole('tab', { name: 'Milestones' }).click()
  await page.getByRole('button', { name: 'New milestone' }).click()
  await page.getByPlaceholder('Milestone name…').fill('As-is')
  await page.getByPlaceholder('Milestone name…').press('Enter')
  type Saved = { name: string; nodes: Record<string, unknown>; relations: Record<string, unknown>; otherModels?: unknown }
  const milestone = async (): Promise<Saved | undefined> =>
    (JSON.parse((await folder.files())['snapshots.json'] ?? '[]') as Saved[]).find((m) => m.name === 'As-is')
  await expect.poll(milestone, { timeout: 10_000 }).toBeTruthy()
  const saved = (await milestone())!
  expect(Object.keys(saved.nodes)).toEqual(['pay'])
  expect(Object.keys(saved.relations).sort()).toEqual(['r-api', 'r-reads'])
  expect(saved.otherModels).toEqual([{ name: 'orders', commit: A }])

  // orders is fetched again at B, Orders API renamed; A is kept for the milestone.
  const atA = JSON.parse(ordersAt(A, 'Orders API')) as FederationFile
  await folder.write('.radical/federation.json', ordersAt(B, 'Orders Gateway', { atCommits: { 'orders@abc1234': { nodes: atA.nodes, relations: [] } } }))
  await expect(studio.node('ord-api')).toContainText('Orders Gateway', { timeout: 10_000 })

  // As-is shows orders as it was at A, the line to it too.
  await page.locator('.lp-snap-card', { hasText: 'As-is' }).click()
  await expect(studio.node('ord-api')).toContainText('Orders API')
  await expect(studio.node('ord-api')).toHaveClass(/rf-node-other-model/)
  await expect(page.locator('[data-testid="rf__edge-r-api"]')).toHaveCount(1)
  // The live model: orders as fetched now.
  await page.locator('.lp-snap-current').click()
  await expect(studio.node('ord-api')).toContainText('Orders Gateway')

  // Without A fetched, As-is shows payments' own and says how to fetch it.
  await folder.write('.radical/federation.json', ordersAt(B, 'Orders Gateway v2'))
  await expect(studio.node('ord-api')).toContainText('Orders Gateway v2', { timeout: 10_000 })
  await page.locator('.lp-snap-card', { hasText: 'As-is' }).click()
  await expect(page.getByRole('region', { name: 'Notifications' }))
    .toContainText('This milestone was made with orders at abc1234, which is not fetched. Run radical federation fetch in the model folder to see it.')
  await expect(studio.node('pay')).toBeVisible()
  await expect(studio.node('ord-api')).toHaveCount(0)
})
