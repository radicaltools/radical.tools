import { test, expect, fixture, DOC_ID } from '../../support/fixtures'
import { HUB_PORT } from '../../playwright.config'

// Import from the Hub into an existing model. Studio reads the catalogue
// from hub.radical.tools; served here from this build's Hub.

/** Models → Import from Hub…, the pack's Add to Model: its wizard. */
async function packWizard(page: import('@playwright/test').Page, name: string): Promise<import('@playwright/test').Locator> {
  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await page.getByText(/Import from Hub/).first().click()
  const dialog = page.locator('[aria-label="Import from Hub"]')
  await dialog.getByPlaceholder('Search concern packs…').pressSequentially(name)
  await dialog.locator('div', { has: page.getByRole('heading', { name, exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Add to Model' }) }).last()
    .getByRole('button', { name: 'Add to Model' }).click()
  return page.getByTestId('concern-wizard')
}

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/hub\.radical\.tools\/hub\//, async (route) => {
    const local = `http://localhost:${HUB_PORT}` + new URL(route.request().url()).pathname
    const response = await route.fetch({ url: local })
    await route.fulfill({ response, headers: { ...response.headers(), 'content-type': 'application/json' } })
  })
})

test('a concept added from a Hub link in Viewer reaches the model', async ({ page, studio }) => {
  // The Hub's link lands in Viewer, a perspective for looking: Add to Model
  // said "imported" and drew it, but it went into what Viewer shows, was
  // never saved and was gone on the way to Designer. The import switches to
  // Designer first, as a Forge run does.
  const doc = JSON.parse(fixture('bookstore'))
  doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} }
  await studio.seedDocument(JSON.stringify(doc))
  await page.goto(`/?hub=concern-authentication#/d/${encodeURIComponent(`ls:${DOC_ID}`)}/m/viewer/v/canvas`)
  await studio.ready()
  const before = (await studio.storedDoc()).nodes.length
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Viewer/)
  // The link's pack opens in its wizard by itself; at its default answers:
  // the decision for an identity provider.
  await page.getByTestId('concern-wizard').getByRole('button', { name: 'Add to model' }).click()
  await expect.poll(async () => (await studio.storedDoc()).nodes.length).toBe(before + 16)
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Designer/)
  expect(await studio.storedJson()).toContain('Users sign in through an identity provider')
  await studio.settle()
  expect((await studio.storedDoc()).nodes.length).toBe(before + 16)
})

test('a concern pack is imported with its answers and bound to the element in one undo step', async ({ page, studio }) => {
  const box = { x: 0, y: 0, width: 200, height: 100, collapsed: false }
  await studio.seedDocument(JSON.stringify({
    metamodel: { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} },
    nodes: [
      { id: 'user', type: 'person', label: 'Customer', ...box, x: 40, y: 40 },
      { id: 'shop', type: 'system', label: 'Shop', ...box, x: 40, y: 260, width: 360, height: 220 },
      { id: 'web', type: 'webapp', label: 'Storefront', ...box, parentId: 'shop', x: 40, y: 60 },
      { id: 'admin', type: 'webapp', label: 'Back office', ...box, parentId: 'shop', x: 280, y: 60 },
    ],
    relations: [
      { id: 'u', sourceId: 'user', targetId: 'web', relationType: 'interacts', label: 'shops' },
      { id: 'a', sourceId: 'user', targetId: 'admin', relationType: 'interacts', label: 'manages' },
    ],
    views: [{ id: 'v-shop', name: 'Shop', kind: 'static', nodeIds: [], positions: {} }],
  }))
  await studio.open('v-shop')
  await studio.node('web').click()
  const before = (await studio.storedDoc()).nodes.length

  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await page.getByText(/Import from Hub/).first().click()
  const dialog = page.locator('[aria-label="Import from Hub"]')
  await dialog.getByPlaceholder('Search concern packs…').pressSequentially('Authentication')
  const card = dialog.locator('div', { has: page.getByRole('heading', { name: 'Authentication', exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Add to Model' }) }).last()
  await card.getByRole('button', { name: 'Add to Model' }).click()

  // A wizard: where it applies first, the shop suggested since it covers
  // both web apps; any other element can be added from the list.
  const wizard = page.getByTestId('concern-wizard')
  const scope = wizard.getByRole('group', { name: 'Bind to' })
  await expect(scope.getByRole('checkbox')).toHaveCount(3)
  await expect(scope.getByRole('checkbox', { name: /^Shop.*Suggested/ })).toHaveAttribute('aria-checked', 'true')
  await expect(scope).toContainText('Covers 2: Back office, Storefront.')
  await expect(wizard).toContainText('2 of 2 covered')
  await expect(wizard.getByRole('checkbox', { name: 'Customer' })).not.toBeChecked()
  // Bound to the two web apps instead.
  await scope.getByRole('checkbox', { name: /^Shop/ }).click()
  await expect(wizard).toContainText('0 of 2 covered')
  // Bound to nothing it may still come in; the wizard says the check will list it.
  await expect(wizard.locator('.nw-missing')).toHaveText('Not bound: the check will list it until it is')
  await expect(wizard.getByRole('button', { name: 'Add to model' })).toBeEnabled()
  await scope.getByRole('checkbox', { name: /^Storefront/ }).click()
  await scope.getByRole('checkbox', { name: /^Back office/ }).click()
  await expect(wizard).toContainText('2 of 2 covered')
  const step = (title: string) => wizard.locator('.nw-step', { hasText: title })
  const brings = wizard.getByTestId('concern-brings')

  // One question a step, the answers as cards; the review says what they bring.
  await wizard.getByRole('button', { name: 'Next' }).click()
  await expect(wizard.locator('.nw-heading')).toHaveText('How do people sign in?')
  await wizard.getByRole('radio', { name: /^Our own user store/ }).click()
  await step('Review').click()
  await expect(brings).toContainText('8 requirements')
  await expect(brings).toContainText('Passwords stored as hashes')
  await step('Sign-in').click()
  await wizard.getByRole('radio', { name: /^An external identity provider/ }).click()
  await step('Second factor').click()
  await wizard.getByRole('radio', { name: /^No\b/ }).click()
  // Which operations need it is no longer asked.
  await step('Details').click()
  await expect(wizard.getByLabel('How long may a session stay idle (minutes)?')).toBeVisible()
  await expect(wizard.getByLabel('Which operations need a second factor?')).toHaveCount(0)
  await step('Review').click()
  await expect(brings).toContainText('5 requirements')
  await expect(wizard.locator('.nw-heading')).toHaveText('What comes into 2 elements')
  await wizard.getByRole('button', { name: 'Add to model' }).click()
  await expect(wizard).toBeHidden()
  await expect(dialog).toBeHidden()

  // need + 5 requirements + 5 scenarios + ADR + 2 fitness functions.
  await expect.poll(async () => (await studio.storedDoc()).nodes.length).toBe(before + 14)
  const doc = await studio.storedDoc() as unknown as {
    nodes: Array<{ id: string; type: string; status?: string; concern?: string }>
    relations: Array<{ sourceId: string; targetId: string; relationType?: string }>
  }
  const adr = doc.nodes.find((n) => n.type === 'adr')!
  expect(adr).toMatchObject({ status: 'accepted', concern: 'authentication' })
  const has = (type: string, from: string, to: string) => doc.relations.some((r) => r.relationType === type && r.sourceId === from && r.targetId === to)
  for (const app of ['web', 'admin']) {
    expect(has('constrains', adr.id, app)).toBe(true)
    for (const req of doc.nodes.filter((n) => n.type === 'requirement')) expect(has('satisfies', app, req.id)).toBe(true)
  }
  expect(has('constrains', adr.id, 'shop')).toBe(false)

  await studio.pane.click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(async () => (await studio.storedDoc()).nodes.length).toBe(before)
})

test('the import dialog filters concern packs by group', async ({ page, studio }) => {
  await studio.seed('bookstore')
  await studio.open('v-containers')
  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await page.getByText(/Import from Hub/).first().click()
  const dialog = page.locator('[aria-label="Import from Hub"]')
  const groups = dialog.getByRole('group', { name: 'Concern groups' })
  await expect(groups.getByRole('button')).toHaveText(['All', 'Architecture', 'Identity & access', 'Security', 'Data', 'Integration', 'Reliability', 'Operations', 'Maintainability', 'Technology'])
  await expect(dialog.getByRole('heading', { name: 'Authentication', exact: true })).toBeVisible()
  await groups.getByRole('button', { name: 'Data', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Personal data', exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Authentication', exact: true })).toHaveCount(0)
  // Every card names its group.
  const cards = dialog.locator('h4')
  for (const name of await cards.allInnerTexts()) {
    await expect(dialog.locator('div', { has: page.getByRole('heading', { name, exact: true }) }).last()).toContainText('Data')
  }
})

test('several concern packs from a Hub link open their wizards one after another, each with its view', async ({ page, studio }) => {
  const doc = JSON.parse(fixture('bookstore'))
  doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} }
  await studio.seedDocument(JSON.stringify(doc))
  await page.goto(`/?hub=concern-authentication,concern-secrets#/d/${encodeURIComponent(`ls:${DOC_ID}`)}/m/designer/v/v-containers`)
  await studio.ready()
  const wizard = page.getByTestId('concern-wizard')
  await expect(wizard.locator('.nw-title')).toHaveText('Authentication')
  await expect(wizard.getByTestId('concern-position')).toHaveText('Pack 1 of 2')
  await wizard.getByRole('button', { name: 'Add to model' }).click()
  await expect(wizard.locator('.nw-title')).toHaveText('Secrets')
  await expect(wizard.getByTestId('concern-position')).toHaveText('Pack 2 of 2')
  await wizard.getByRole('button', { name: 'Add to model' }).click()
  await expect(page.locator('[aria-label="Import from Hub"]')).toBeHidden()
  await expect.poll(async () => {
    const stored = await studio.storedDoc() as unknown as { nodes: Array<{ type: string; concern?: string }>; views: Array<{ name: string; folder?: string }> }
    return [stored.nodes.filter((n) => n.type === 'adr').map((n) => n.concern).sort(), stored.views.filter((v) => v.folder === 'Concerns').map((v) => v.name).sort()]
  }).toEqual([['authentication', 'secrets'], ['Authentication', 'Secrets']])
})

test('a pack bound to an element inside a container opens its view as saved, the container holding it on the left', async ({ page, studio }) => {
  // F-0008: the view listed Web App without a place and placed Bookstore
  // without listing it: opening it laid all 16 pack elements out again,
  // Web App in the middle, and Bookstore was not drawn.
  const doc = JSON.parse(fixture('bookstore'))
  doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} }
  await studio.seedDocument(JSON.stringify(doc))
  await studio.open('v-containers')
  const wizard = await packWizard(page, 'Authentication')
  await expect(wizard.getByRole('group', { name: 'Bind to' }).getByRole('checkbox', { name: /^Web App/ })).toHaveAttribute('aria-checked', 'true')
  await wizard.getByRole('button', { name: 'Add to model' }).click()
  await expect(wizard).toBeHidden()

  type View = { id: string; name: string; folder?: string; nodeIds: string[]; positions: Record<string, { x: number; y: number }> }
  const packView = async () => ((await studio.storedDoc()) as unknown as { views: View[] }).views.find((v) => v.folder === 'Concerns')
  await expect.poll(async () => (await packView())?.nodeIds.length ?? 0).toBeGreaterThan(16)
  const saved = (await packView())!

  await studio.open(saved.id)
  await studio.settle()
  // Nothing it placed moves (the container may fit what it shows).
  const opened = (await packView())!
  for (const id of Object.keys(saved.positions).filter((id) => id !== 'bookstore')) {
    expect(opened.positions[id], id).toMatchObject({ x: saved.positions[id].x, y: saved.positions[id].y })
  }
  await expect(studio.node('bookstore')).toBeVisible()
  await expect(studio.node('web')).toBeVisible()
  expect(saved.nodeIds).toEqual(expect.arrayContaining(['bookstore', 'web']))
  for (const id of saved.nodeIds) expect(saved.positions[id], id).toBeDefined()
  // On the left of the pack's columns.
  const boxes = await studio.boxes()
  const packLeft = Math.min(...saved.nodeIds.filter((id) => !['bookstore', 'web'].includes(id)).map((id) => boxes[id].x))
  expect(boxes.bookstore.x + boxes.bookstore.width).toBeLessThan(packLeft)
})

test('a concern pack is not added to a model whose metamodel cannot hold it, and the wizard says why', async ({ page, studio }) => {
  // F-0009: on the C4 metamodel it came in all the same and validation
  // flagged its 16 elements of unknown type; the MCP server refuses it.
  const doc = JSON.parse(fixture('bookstore'))
  doc.metamodel = { id: 'c4-builtin', name: 'C4 (built-in)', nodeTypes: {}, relationTypes: {} }
  await studio.seedDocument(JSON.stringify(doc))
  await studio.open('v-containers')
  const before = (await studio.storedDoc()).nodes.length
  const wizard = await packWizard(page, 'Authentication')
  await expect(wizard.getByRole('alert')).toHaveText(/^Cannot be added: the metamodel "C4[^"]*" has no type need, .*such as Radical$/)
  await expect(wizard.getByText(/^This model cannot take the pack: /)).toBeVisible()
  for (const button of await wizard.getByRole('button', { name: 'Add to model' }).all()) await expect(button).toBeDisabled()
  await page.keyboard.press('ControlOrMeta+Enter')
  await expect(wizard).toBeVisible()
  expect((await studio.storedDoc()).nodes.length).toBe(before)
})

test('a concern pack imported in a milestone brings its view with its elements: Discard takes it back, Propagate keeps it', async ({ page, studio }) => {
  // F-0010: the pack's view was saved into the live model before the
  // milestone question was answered, and stayed after Discard listing 22
  // elements that do not exist.
  type Doc = { nodes: Array<{ id: string }>; views: Array<{ id: string; name: string; folder?: string; nodeIds: string[] }> }
  await studio.openSample()
  const docId = studio.activeDocId()
  await studio.open('view-core', 'designer', docId)
  const stored = async () => await studio.storedDoc(docId) as unknown as Doc
  const lists = (doc: Doc) => doc.views.map((v) => [v.id, [...v.nodeIds].sort()])
  const before = await stored()
  const inV3 = async () => {
    const v3 = page.locator('.lp-snap-card', { hasText: 'v3' }).first()
    // The rail's tab closes its panel when it is open already.
    if (!(await v3.isVisible())) await page.getByRole('tab', { name: 'Milestones' }).click()
    await v3.click()
    await expect(page).toHaveURL(/\/s\//)
    await studio.settle()
    const wizard = await packWizard(page, 'Secrets')
    await wizard.getByRole('button', { name: 'Add to model' }).first().click()
    await page.locator('.milestone-modal').getByRole('button', { name: 'Continue editing (decide later)' }).click()
    await expect(wizard).toBeHidden()
  }
  // The canvas's milestone bar: Propagate, New milestone, Discard.
  const button = (name: string) => page.getByRole('button', { name, exact: true }).first()

  await inV3()
  // Not decided yet: the live model's views are as they were.
  await page.waitForTimeout(1000)
  expect(lists(await stored())).toEqual(lists(before))
  await button('Discard').click()
  await expect(button('Discard')).toHaveCount(0)
  await page.waitForTimeout(1000)
  const discarded = await stored()
  expect(discarded.nodes.length).toBe(before.nodes.length)
  expect(lists(discarded)).toEqual(lists(before))

  await inV3()
  await button('Propagate').click()
  await expect.poll(async () => (await stored()).views.filter((v) => v.folder === 'Concerns').map((v) => v.name)).toEqual(['Secrets'])
  const propagated = await stored()
  const ids = new Set(propagated.nodes.map((n) => n.id))
  const view = propagated.views.find((v) => v.folder === 'Concerns')!
  expect(view.nodeIds.length).toBeGreaterThan(10)
  expect(view.nodeIds.filter((id) => !ids.has(id))).toEqual([])
})
