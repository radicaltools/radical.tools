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
    const rows = page.locator('tbody tr.tv-row')
    await expect(rows).toHaveCount(6)
    // A + row where an element can go: inside Bookstore and its containers, and at the top.
    await expect(page.getByRole('button', { name: 'Add under Bookstore' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add at the top' })).toBeVisible()
    // Its name and its summary, by its type's template; a click on its row opens its attributes.
    await expect(page.locator('thead th')).toHaveText(['Name', 'Summary'])
    const provider = rows.filter({ hasText: 'Payment Provider' })
    await expect(provider).toContainText('Card payments')
    await provider.click()
    await expect(studio.attribute('Name')).toHaveValue('Payment Provider')
    // One click does not rename it: a double-click does (next test).
    await expect(page.locator('.tv-cell-input')).toHaveCount(0)
    // A C4 type has no wizard.
    await expect(studio.properties.getByRole('button', { name: 'Wizard', exact: true })).toHaveCount(0)
    // The containment tree: Bookstore's containers under it, one guide line in.
    await expect(page.locator('.tv-chain-row.depth-1')).toHaveCount(3)
    await expect(page.locator('.tv-tabs')).toHaveCount(0)
    await expect(page).toHaveScreenshot('bookstore-table.png')
  })

  test('a name is renamed in place in the table', async ({ page, studio }) => {
    await studio.open('v-table')
    await page.locator('tr[data-node-id="payments"] .tv-chain-cell').dblclick()
    const input = page.locator('tr[data-node-id="payments"] input.tv-cell-input')
    await input.fill('Card Gateway')
    await input.press('Enter')
    await expect(page.locator('tr[data-node-id="payments"]')).toContainText('Card Gateway')
    await studio.advance(1000) // the autosave, on the frozen clock
    await expect.poll(async () => (await studio.storedDoc()).nodes.find((n) => n.id === 'payments')?.label).toBe('Card Gateway')
  })
})

test.describe('views panel', () => {
  test.beforeEach(async ({ studio }) => {
    await studio.seed()
  })

  test('a whole-model view counts every element it shows', async ({ page, studio }) => {
    await studio.open('v-context')
    // It said "All nodes" where the other cards give a count (open point of runs 25–34).
    await expect(page.locator('.lp-view-card').filter({ hasText: 'Element Table' })).toContainText('6 nodes')
    await expect(page.locator('.lp-view-card').filter({ hasText: 'System Context' })).toContainText('3 nodes')
  })

  test('a view moves into a folder from its properties, the folder opens, closes and is renamed', async ({ page, studio }) => {
    await studio.open('v-context')
    const card = page.locator('.lp-view-card').filter({ hasText: 'System Context' })
    await card.hover()
    await card.getByTitle('View properties').click()
    await page.getByTitle('Move to folder…').click()
    await page.getByLabel('Folder').fill(' C4 / Context ')
    await page.getByLabel('Folder').press('Enter')
    await expect(page.locator('.props-content')).toContainText('C4/Context')
    await page.locator('.left-panel .rp-back-btn').click()
    const c4 = page.locator('.lp-folder-row', { hasText: 'C4' })
    await expect(c4).toContainText('1')
    await expect(page.locator('.lp-folder-body .lp-folder-body .lp-view-card')).toHaveText(/System Context/)
    // A folder's properties rename it; the views in it move along.
    await c4.hover()
    await c4.getByTitle('Folder properties').click()
    await page.getByTitle('Rename folder').click()
    await page.getByLabel('Folder name').fill('a/b')
    await page.getByLabel('Folder name').press('Enter')
    await expect(page.getByRole('alert')).toContainText('no "/"')
    await page.getByLabel('Folder name').fill('Model')
    await page.getByLabel('Folder name').press('Enter')
    await expect(page.locator('.props-content')).toContainText('Views · 1')
    await expect(page.locator('.props-content')).toContainText('Context / System Context')
    await page.locator('.left-panel .rp-back-btn').click()
    const model = page.locator('.lp-folder-row', { hasText: 'Model' })
    await expect(model).toBeVisible()
    await model.click()
    await expect(card).toBeHidden()
    // Kept with the model; the folder of the active view opens by itself.
    await page.reload()
    await studio.ready()
    await expect(page.locator('.lp-folder-body .lp-view-card')).toHaveText(/System Context/)
    await expect(page.locator('.lp-folder-row').first()).toContainText('Model')
    await card.hover()
    await card.getByTitle('View properties').click()
    await page.getByTitle('Move to folder…').click()
    await page.getByRole('button', { name: 'No folder' }).click()
    await page.locator('.left-panel .rp-back-btn').click()
    await expect(page.locator('.lp-folder-row')).toHaveCount(0)
    await expect(card).toBeVisible()
  })

  test('a folder moves up and down among the folders beside it', async ({ page, studio }) => {
    await studio.open('v-context')
    const moveTo = async (viewName: string, folder: string) => {
      const card = page.locator('.lp-view-card').filter({ hasText: viewName })
      await card.hover()
      await card.getByTitle('View properties').click()
      await page.getByTitle('Move to folder…').click()
      await page.getByLabel('Folder').fill(folder)
      await page.getByLabel('Folder').press('Enter')
      await page.locator('.left-panel .rp-back-btn').click()
    }
    await moveTo('System Context', 'Context')
    await moveTo('Containers', 'Containers')
    const folders = page.locator('.lp-folder-row .lp-folder-name')
    await expect(folders).toHaveText(['Context', 'Containers'])
    const row = page.locator('.lp-folder-row', { hasText: 'Containers' })
    await row.hover()
    await row.getByTitle('Folder properties').click()
    await expect(page.locator('.props-content')).toContainText('Order · 2 of 2')
    await expect(page.getByRole('button', { name: 'Move down' })).toBeDisabled()
    await page.getByRole('button', { name: 'Move up' }).click()
    await expect(page.locator('.props-content')).toContainText('Order · 1 of 2')
    await page.locator('.left-panel .rp-back-btn').click()
    await expect(folders).toHaveText(['Containers', 'Context'])
    await page.keyboard.press('ControlOrMeta+z')
    await expect(folders).toHaveText(['Context', 'Containers'])
  })
})

test.describe('line style', () => {
  test('a view draws its relations curved or orthogonal, as set in its properties, and keeps it', async ({ page, studio }) => {
    await studio.seed()
    await studio.open('v-containers')
    const paths = () => page.locator('.react-flow__edge-path').evaluateAll((els) => els.map((e) => e.getAttribute('d') ?? ''))
    // Curved: cubic Béziers.
    await expect.poll(async () => (await paths()).every((d) => d.includes('C'))).toBe(true)
    const card = page.locator('.lp-view-card').filter({ hasText: 'Containers' })
    await card.hover()
    await card.getByTitle('View properties').click()
    await page.getByLabel('Lines').selectOption('orthogonal')
    // Orthogonal: straight segments and rounded corners, no Bézier.
    await expect.poll(async () => (await paths()).every((d) => !d.includes('C'))).toBe(true)
    await page.reload()
    await studio.ready()
    await expect.poll(async () => (await paths()).every((d) => !d.includes('C'))).toBe(true)
  })
})

test.describe('left panel', () => {
  test('its edge drags it wider, it stays so after a reload, and a double-click sets it back', async ({ page, studio }) => {
    await studio.seed()
    await studio.open('v-context')
    const panel = page.locator('.left-panel')
    const handle = page.getByRole('separator', { name: 'Resize panel' })
    const width = async () => Math.round((await panel.boundingBox())!.width)
    const start = await width()
    expect(start).toBe(260)
    const box = (await handle.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + 200)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + 200, { steps: 5 })
    await page.mouse.up()
    await expect.poll(width).toBe(start + 60)
    await page.reload()
    await studio.ready()
    await expect.poll(width).toBe(start + 60)
    await handle.dblclick()
    await expect.poll(width).toBe(start)
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
    // The name is text, and no attribute takes typing.
    await expect(studio.properties.locator('.pp-title')).toHaveText('API')
    await expect(studio.attribute('Name')).toHaveCount(0)
    await expect(studio.properties.locator('input, select')).not.toHaveCount(0)
    for (const control of await studio.properties.locator('input, select, textarea').all()) await expect(control).not.toBeEditable()
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

test.describe('hidden relations', () => {
  // "charges card" (api → payments) is hidden in the matrix view.
  test.beforeEach(async ({ studio }) => {
    const doc = JSON.parse(fixture('bookstore'))
    const views = doc.views.map((v: { id: string }) => (v.id === 'v-table' ? { ...v, hiddenRelationIds: ['r4'] } : v))
    views.push({ id: 'v-matrix', name: 'Matrix', kind: 'matrix', nodeIds: [], positions: {}, hiddenRelationIds: ['r4'] })
    await studio.seedDocument(JSON.stringify({ ...doc, views }))
  })

  test('stay out of the matrix', async ({ page, studio }) => {
    await studio.open('v-matrix')
    await expect(page.locator('.mx-cell.mx-has-rel')).toHaveCount(3)
    await expect(page.locator('.mx-cell[title*="charges card"]')).toHaveCount(0)
  })
})

test.describe('Viewer', () => {
  test('Viewer opens on what Designer showed, then shows each view with its own layout', async ({ page, studio }) => {
    // System Context places the nodes it shares with Containers far away
    // from where Containers has them.
    const model = JSON.parse(fixture('bookstore'))
    const context = model.views.find((v: { id: string }) => v.id === 'v-context')
    for (const p of Object.values(context.positions) as Array<{ x: number; y: number }>) { p.x += 900; p.y += 700 }
    await studio.seedDocument(JSON.stringify(model))
    const layout = (): Promise<Record<string, number[]>> => page.$$eval('.react-flow__node', (els) =>
      Object.fromEntries(els.map((el) => [
        el.getAttribute('data-id') ?? '',
        ((el as HTMLElement).style.transform.match(/-?[\d.]+/g) ?? []).map(Number),
      ])))
    /** The nodes more than 2 px from where `expected` has them (a fresh load
     *  settles nodes by a fraction of a pixel). */
    const moved = (actual: Record<string, number[]>, expected: Record<string, number[]>): string[] =>
      Object.keys(expected).filter((id) => !actual[id] ||
        Math.hypot(actual[id][0] - expected[id][0], actual[id][1] - expected[id][1]) > 2)

    // Containers as Viewer shows it when it is the first view loaded.
    await studio.open('v-containers', 'viewer')
    await page.reload()
    await studio.ready()
    const containers = await layout()

    // Designer, then Viewer, then another view.
    await studio.open('v-context')
    await page.reload()
    await studio.ready()
    const designer = await layout()
    await page.getByRole('button', { name: 'Viewer', exact: true }).click()
    await studio.settle()
    // Viewer opens on what Designer showed: the same view, every node in
    // the same place. (Its left panel is a little wider, so the camera
    // refits the narrower canvas.)
    await expect(page.getByText('Structure: System Context')).toBeVisible()
    expect(moved(await layout(), designer)).toEqual([])

    await page.locator('.lp-view-card').filter({ hasText: 'Containers' }).click()
    await studio.settle()
    const shown = await layout()
    expect(Object.keys(shown).sort()).toEqual(Object.keys(containers).sort())
    expect(moved(shown, containers)).toEqual([])
  })
})

test('back in Designer, the view shown in Viewer stays, with Designer\'s layout', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-containers')
  const designer = await studio.positions()
  await page.locator('.lp-view-card').filter({ hasText: 'System Context' }).click()
  await expect(page.getByText('Structure: System Context')).toBeVisible()
  await studio.settle()
  const saved = await studio.storedJson()

  // In Viewer: another view, re-laid out.
  await page.getByRole('button', { name: 'Viewer', exact: true }).click()
  await page.locator('.lp-view-card').filter({ hasText: 'Containers' }).click()
  await expect(page.getByText('Structure: Containers')).toBeVisible()
  await studio.settle()
  await studio.smartLayout()

  // Designer stays on Containers, as Designer has it.
  await page.getByRole('button', { name: 'Designer', exact: true }).click()
  await studio.settle()
  await expect(page.getByText('Structure: Containers')).toBeVisible()
  await expect(page).toHaveURL(/\/m\/designer\/v\/v-containers$/)
  expect(await studio.positions()).toEqual(designer)
  // Nothing of Viewer was saved: the views are as Designer left them (the
  // nodes' own positions follow the canvas shown).
  const stored = JSON.parse(await studio.storedJson())
  expect(stored.views).toEqual(JSON.parse(saved).views)
})

test.describe('what is arranged in Viewer and Presenter stays there', () => {
  for (const perspective of ['Viewer', 'Presenter']) {
    test(`Smart Layout in ${perspective} is not saved`, async ({ page, studio }) => {
      // Smart Layout writes the document at once so that a reload shows it.
      // It did that here too: back in Designer the canvas showed the old
      // layout, the file held this one, and a reload brought it up.
      await studio.seed()
      await studio.open('v-containers')
      const designer = await studio.positions()
      const saved = await studio.storedJson()

      await page.getByRole('button', { name: perspective, exact: true }).click()
      await studio.settle()
      await studio.smartLayout()
      await page.waitForTimeout(1000)
      expect(await studio.storedJson()).toBe(saved)

      await page.getByRole('button', { name: 'Designer', exact: true }).click()
      await studio.settle()
      await page.reload()
      await studio.ready()
      expect(await studio.positions()).toEqual(designer)
    })
  }
})

test('Studio opens a model in Viewer unless a link names a perspective, and a new model in Designer', async ({ page, studio }) => {
  await studio.seed()
  await page.goto('/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.locator('.msteps-row').first().click()
  await studio.ready()
  // No route: Viewer, read-only, and the address says so.
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Viewer/)
  await expect(page.locator('.palette-item')).toHaveCount(0)
  await expect(page).toHaveURL(/\/m\/viewer\//)

  // A link keeps the perspective it names.
  await studio.open('v-containers')
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Designer/)

  // A new model is there to be edited.
  await page.goto('/')
  await page.getByRole('button', { name: 'New model' }).click()
  await page.getByRole('button', { name: 'Create model' }).click()
  await studio.ready()
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Designer/)
  await expect(page).toHaveURL(/\/m\/designer\//)
})

// Undoing a new view takes its properties with it: the list comes back,
// not an empty properties pane with only ◀ Back.
test('undoing a new view brings back the list of views, not its empty properties', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-context')
  await page.getByRole('button', { name: 'New view' }).click()
  await page.getByRole('menuitem', { name: /Blank view/ }).click()
  await page.locator('.view-kind-btn', { hasText: 'Flow' }).click()
  await expect(page.locator('.left-panel .rp-slider.show-props')).toBeVisible()
  // The blank view and its kind are two steps.
  await page.keyboard.press('ControlOrMeta+z')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.locator('.left-panel .rp-slider.show-props')).toHaveCount(0)
  await expect(page.locator('.lp-view-card', { hasText: 'System Context' })).toBeVisible()
})

// Open point of runs 25 to 34: a blank view was named after the number of
// views ("View 6" for the first); the manual says View 1, View 2…
test('blank views are named View 1, View 2…', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-context')
  for (const name of ['View 1', 'View 2']) {
    await page.getByRole('button', { name: 'New view' }).click()
    await page.getByRole('menuitem', { name: /Blank view/ }).click()
    await expect(page.locator('.lp-view-card', { hasText: name })).toHaveCount(1)
    await page.locator('.left-panel .rp-back-btn').click()
  }
})
