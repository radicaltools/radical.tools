import { test, expect, fixture, DOC_ID } from '../../support/fixtures'
import { HUB_PORT } from '../../playwright.config'

// Import from the Hub into an existing model. Studio reads the catalogue
// from hub.radical.tools; served here from this build's Hub.

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
