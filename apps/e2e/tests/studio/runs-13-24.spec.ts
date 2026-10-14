import { builtInC4Metamodel } from '@radical/common/metamodel'
import { test, expect, fixture } from '../../support/fixtures'

// Bugs found by exploratory runs 13 to 24 that only a browser shows. Each
// test fails without its fix (docs/IMPROVEMENTS.md, items 59 on).

const radicalBookstore = (): string => {
  const doc = JSON.parse(fixture('bookstore'))
  doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} }
  return JSON.stringify(doc)
}

test('Ctrl/Cmd+Z in an open wizard leaves the model behind it alone', async ({ page, studio }) => {
  // It took back the element the wizard was creating its child in; Create
  // then saved a child of nothing and the model could not be opened again.
  await studio.seedDocument(radicalBookstore())
  await studio.open('canvas')
  const pane = (await studio.pane.boundingBox())!
  // A system of its own, then an ADR into it: the wizard opens.
  await studio.addFromPalette('Software System', { x: 300, y: pane.height - 200 })
  await expect.poll(async () => (await studio.storedDoc()).nodes.length).toBe(7)
  await page.waitForTimeout(800)
  const before = await studio.nodes.count()
  const sys = (await studio.storedDoc()).nodes.find((n) => !['customer', 'bookstore', 'web', 'api', 'db', 'payments'].includes(n.id))!
  const box = (await studio.node(sys.id).boundingBox())!
  await page.locator('.palette-item').filter({ has: page.getByText('ADR', { exact: true }) }).first()
    .dragTo(studio.pane, { targetPosition: { x: box.x - pane.x + box.width / 2, y: box.y - pane.y + box.height * 0.7 } })
  const wizard = page.getByRole('dialog', { name: /wizard/ })
  await expect(wizard).toBeVisible()
  await wizard.getByLabel('Name').pressSequentially('Use Postgres')
  await wizard.getByRole('radio', { name: 'accepted' }).click()
  await page.keyboard.press('ControlOrMeta+z')
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(500)
  await expect(wizard).toBeVisible()
  await expect(studio.nodes).toHaveCount(before)
  await page.keyboard.press('Control+Enter')
  await expect(wizard).toHaveCount(0)
  await expect(page.getByText('Runtime Error')).toHaveCount(0)
  // The ADR is saved inside the system, which is still there.
  await expect.poll(async () => {
    const nodes = (await studio.storedDoc()).nodes as Array<{ id: string; type?: string; parentId?: string }>
    const adr = nodes.find((n) => n.type === 'adr')
    return !!adr && adr.parentId === sys.id && nodes.some((n) => n.id === sys.id)
  }).toBe(true)
})

test('the arrow keys do not move an element on screen only', async ({ page, studio }) => {
  // React Flow moved the selected element by the arrow keys: out of its
  // container, not saved, not undoable, back on reload.
  await studio.seed()
  await studio.open('v-containers')
  const before = await studio.positions()
  await studio.node('web').click()
  for (let i = 0; i < 10; i++) await page.keyboard.press('Shift+ArrowLeft')
  await page.waitForTimeout(300)
  expect(await studio.positions()).toEqual(before)
})

test('Delete while a presentation plays does nothing', async ({ page, studio }) => {
  // It opened the delete prompt; "Remove from model" hid the element from
  // the view for good while the model kept it.
  await studio.seed()
  await studio.open('v-context')
  await page.keyboard.press('F5')
  await page.waitForTimeout(800)
  await studio.node('payments').click({ force: true })
  await page.keyboard.press('Delete')
  await page.waitForTimeout(400)
  await expect(page.locator('.milestone-modal')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const view = (JSON.parse(await studio.storedJson()) as { views: Array<{ id: string; nodeIds: string[] }> }).views.find((v) => v.id === 'v-context')!
  expect(view.nodeIds).toContain('payments')
})

test('dragging an element whose container is also selected moves and saves them', async ({ page, studio }) => {
  // React Flow gave no node to the drag handlers: errors on every frame
  // (the guard fixture fails on them), nothing saved, back on reload.
  await studio.seed()
  await studio.open('v-containers')
  await studio.node('bookstore').click({ position: { x: 40, y: 12 } })
  await page.keyboard.down('Shift')
  await studio.node('web').click()
  await page.keyboard.up('Shift')
  const before = await studio.positions()
  const box = (await studio.node('web').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 15; i++) await page.mouse.move(box.x + box.width / 2 + 8 * i, box.y + box.height / 2 + 10 * i)
  await page.mouse.up()
  await page.waitForTimeout(1500)
  const after = await studio.positions()
  expect(after.bookstore).not.toBe(before.bookstore)
  await page.reload()
  await studio.ready()
  expect(await studio.positions()).toEqual(after)
})

test('dragging a child of a box-selected container moves and saves them, as one undo step', async ({ page, studio }) => {
  // The handlers got the grabbed child, which React Flow does not move
  // when its container is selected too: the container moved on screen
  // only, nothing was saved and Undo stayed off.
  await studio.seed()
  await studio.open('v-containers')
  const frame = (await studio.node('bookstore').boundingBox())!
  await page.keyboard.down('Shift')
  await page.mouse.move(frame.x - 20, frame.y - 20)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(frame.x - 20 + (frame.width + 40) * i / 10, frame.y - 20 + (frame.height + 40) * i / 10)
  await page.mouse.up()
  await page.keyboard.up('Shift')
  await expect(studio.node('bookstore')).toHaveClass(/selected/)
  await expect(studio.node('db')).toHaveClass(/selected/)
  const before = await studio.positions()
  const box = (await studio.node('db').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 15; i++) await page.mouse.move(box.x + box.width / 2 + 7 * i, box.y + box.height / 2 + 10 * i)
  await page.mouse.up()
  await page.waitForTimeout(1500)
  const after = await studio.positions()
  expect(after.bookstore).not.toEqual(before.bookstore)
  await page.keyboard.press('ControlOrMeta+z')
  await page.waitForTimeout(800)
  expect((await studio.positions()).bookstore).toEqual(before.bookstore)
})

test('a number property is a number field and saves a number, on elements and relations', async ({ page, studio }) => {
  // A relation's number property was a text field that saved "abc5" as
  // typed; an element's saved Number(text): 0 for an emptied field.
  const doc = JSON.parse(fixture('bookstore'))
  const metamodel = builtInC4Metamodel()
  metamodel.id = 'c4-numbers'
  metamodel.nodeTypes.container.properties = [...(metamodel.nodeTypes.container.properties ?? []), { key: 'replicas', label: 'Replicas', type: 'number' }]
  metamodel.relationTypes.interacts.properties = [...(metamodel.relationTypes.interacts.properties ?? []), { key: 'weight', label: 'Weight', type: 'number' }]
  for (const r of doc.relations) r.relationType = 'interacts'
  await studio.seedDocument(JSON.stringify({ ...doc, metamodel }))
  await studio.open('v-containers')
  type Saved = { nodes: Array<Record<string, unknown>>; relations: Array<Record<string, unknown>> }
  const saved = async (): Promise<Saved> => JSON.parse(await studio.storedJson()) as Saved

  await studio.node('api').click()
  const replicas = page.locator('.props-field', { hasText: 'Replicas' }).locator('input')
  await expect(replicas).toHaveAttribute('type', 'number')
  await replicas.fill('3')
  await expect.poll(async () => (await saved()).nodes.find((n) => n.id === 'api')!.replicas).toBe(3)
  await replicas.fill('')
  await expect.poll(async () => 'replicas' in (await saved()).nodes.find((n) => n.id === 'api')!).toBe(false)

  const edge = page.locator('[data-testid="rf__edge-r3"] path.react-flow__edge-interaction').first()
  await edge.click({ force: true })
  const weight = page.locator('.props-field', { hasText: 'Weight' }).locator('input')
  await expect(weight).toHaveAttribute('type', 'number')
  await weight.fill('5')
  await expect.poll(async () => (await saved()).relations.find((r) => r.id === 'r3')!.weight).toBe(5)
})

test('expanding a container in a large nested model moves only what is around it, and stands', async ({ page, studio }) => {
  // Run 19: every child the expand showed counted as new to the physics and
  // freed the 40 elements nearest to it by relation, in other systems whose
  // frames stayed fixed: a hundred elements scattered, the canvas never came
  // to rest, and a reload drew another picture.
  let seed = 11
  const rnd = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  const nodes: Array<Record<string, unknown>> = []
  const leaves: string[] = []
  const cw = 48 + 3 * 220, ch = 110 + 2 * 140 + 20, sw = 60 + 2 * (cw + 30), sh = 120 + 2 * (ch + 30) + 20
  for (let s = 0; s < 4; s++) {
    nodes.push({ id: `s${s}`, type: 'system', label: `System ${s}`, x: (s % 2) * (sw + 80), y: Math.floor(s / 2) * (sh + 80), width: sw, height: sh, collapsed: false })
    for (let c = 0; c < 4; c++) {
      nodes.push({ id: `s${s}c${c}`, type: 'container', label: `Service ${s}.${c}`, parentId: `s${s}`, x: 30 + (c % 2) * (cw + 30), y: 120 + Math.floor(c / 2) * (ch + 30), width: cw, height: ch, collapsed: false })
      for (let k = 0; k < 6; k++) {
        nodes.push({ id: `s${s}c${c}k${k}`, type: 'component', label: `Part ${s}.${c}.${k}`, parentId: `s${s}c${c}`, x: 24 + (k % 3) * 220, y: 110 + Math.floor(k / 3) * 140, width: 200, height: 120, collapsed: false })
        leaves.push(`s${s}c${c}k${k}`)
      }
    }
  }
  const relations: Array<Record<string, unknown>> = []
  const seen = new Set<string>()
  while (relations.length < leaves.length * 1.5) {
    const a = leaves[Math.floor(rnd() * leaves.length)], b = leaves[Math.floor(rnd() * leaves.length)]
    if (a === b || seen.has(`${a}>${b}`)) continue
    seen.add(`${a}>${b}`)
    relations.push({ id: `r${relations.length}`, sourceId: a, targetId: b, label: 'uses' })
  }
  await studio.seedDocument(JSON.stringify({ nodes, relations, sequences: [], views: [], snapshots: [], presentations: [] }))
  await studio.open('canvas')
  await page.waitForTimeout(1500)
  const toggle = (): Promise<void> => studio.node('s0c0').locator('.c4-node-collapse-btn').first().dispatchEvent('click')
  await toggle()
  await page.waitForTimeout(2500)
  const collapsed = await studio.positions()
  await toggle()
  await page.waitForTimeout(3000)
  const expanded = await studio.positions()
  const elsewhere = Object.keys(collapsed).filter((id) => !id.startsWith('s0'))
  expect(elsewhere.filter((id) => expanded[id] !== collapsed[id])).toEqual([])
  // At rest: nothing moves any more.
  await page.waitForTimeout(3000)
  expect(await studio.positions()).toEqual(expanded)
})

test('a yes/no cell on the table\'s Relations tab saves the relation', async ({ page, studio }) => {
  // The click went to updateNode with a relation's id and did nothing.
  const doc = JSON.parse(fixture('bookstore'))
  const metamodel = builtInC4Metamodel()
  metamodel.id = 'c4-async'
  metamodel.relationTypes.interacts.properties = [...(metamodel.relationTypes.interacts.properties ?? []), { key: 'async', label: 'Async', type: 'boolean' }]
  for (const r of doc.relations) r.relationType = 'interacts'
  await studio.seedDocument(JSON.stringify({ ...doc, metamodel }))
  await studio.open('v-table')
  await page.locator('.tv-tabs').getByRole('button', { name: /^Relations/ }).click()
  await page.locator('tbody tr').filter({ hasText: 'reads/writes' }).locator('.tv-bool').click()
  await expect.poll(async () => (JSON.parse(await studio.storedJson()) as { relations: Array<{ id: string; async?: boolean }> })
    .relations.find((r) => r.id === 'r3')?.async).toBe(true)
})

test('a milestone without the treemap\'s drill element leaves the view\'s drill level alone', async ({ page, studio }) => {
  // Shown on a milestone that lacks the element, the treemap reset the
  // view's focus and saved that: back on the live model it showed the top.
  await studio.openSample('view-treemap')
  const docId = studio.activeDocId()
  const drill = async (label: string): Promise<void> => {
    const at = await page.evaluate((text) => {
      const t = Array.from(document.querySelectorAll('.treemap-wrap svg text'))
        .find((el) => (el as SVGTextElement).style.display !== 'none' && el.textContent === text)
      if (!t) return null
      const r = t.getBoundingClientRect()
      return { x: r.x + Math.min(10, r.width / 2), y: r.y + r.height / 2 }
    }, label)
    expect(at, label).not.toBeNull()
    await page.mouse.dblclick(at!.x, at!.y)
    await page.waitForTimeout(900)
  }
  for (const label of ['Core Banking Platform', 'Banking Services', 'Payments Service']) await drill(label)
  const focus = async (): Promise<string | undefined> =>
    (await studio.storedDoc(docId) as unknown as { views: Array<{ id: string; treemapFocusId?: string }> }).views.find((v) => v.id === 'view-treemap')?.treemapFocusId
  await expect.poll(focus).toBe('ctn-payments')
  await page.locator('.lp-section-header', { hasText: 'Milestones' }).click()
  await page.locator('.lp-snap-card', { hasText: 'v1' }).first().click()
  await expect(page).toHaveURL(/\/s\//)
  await page.waitForTimeout(1500) // the autosave
  await page.locator('.lp-snap-current').click()
  await page.waitForTimeout(1500)
  expect(await focus()).toBe('ctn-payments')
})

test.describe('the table view', () => {
  test.beforeEach(async ({ studio }) => {
    const doc = JSON.parse(fixture('order-machine'))
    doc.views.push({ id: 'v-tbl', name: 'Table', kind: 'table', nodeIds: [], positions: {} })
    doc.metamodel = doc.metamodel ?? { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} }
    await studio.seedDocument(JSON.stringify(doc))
  })

  test('an enum cell without a value shows as not set, and its first option can be chosen', async ({ page, studio }) => {
    // The select showed its first option as if set; choosing it did nothing.
    await studio.open('v-tbl')
    await page.locator('.tv-tabs').getByRole('button', { name: /^Relations/ }).click()
    const row = page.locator('tbody tr').filter({ hasText: 'Pending payment' }).filter({ hasText: 'Confirmed' }).first()
    const headers = await page.locator('thead th').allInnerTexts()
    const kindCol = headers.findIndex((h) => /^kind/i.test(h.trim()))
    expect(kindCol).toBeGreaterThan(-1)
    await row.locator('td').nth(kindCol).click()
    const select = row.locator('td').nth(kindCol).locator('select')
    await expect(select).toHaveValue('')
    const first = await select.locator('option').nth(1).getAttribute('value')
    await select.selectOption(first!)
    await expect.poll(async () => {
      const doc = JSON.parse(await studio.storedJson()) as { relations: Array<{ sourceId: string; targetId: string; kind?: string }> }
      return doc.relations.find((r) => r.sourceId === 'pending' && r.targetId === 'confirmed')?.kind
    }).toBe(first)
  })
})

test('one click on a matrix cell selected in Viewer does not remove it in Designer', async ({ page, studio }) => {
  // The click in Viewer armed the cell, and the first click back in
  // Designer removed the relation.
  const doc = JSON.parse(fixture('bookstore'))
  doc.views.push({ id: 'v-matrix', name: 'Matrix', kind: 'matrix', nodeIds: [], positions: {} })
  await studio.seedDocument(JSON.stringify(doc))
  await studio.open('v-matrix')
  await page.getByRole('button', { name: 'Viewer', exact: true }).click()
  const cell = page.locator('.mx-cell.mx-has-rel[title*="calls"]')
  await cell.click()
  await page.getByRole('button', { name: 'Designer', exact: true }).click()
  await cell.click()
  await page.waitForTimeout(800)
  expect((await studio.storedDoc()).relations.map((r) => r.id)).toContain('r2')
})

test.describe('the wiki', () => {
  test('a requirement pointing at a state reads by the state, as on the canvas', async ({ page, studio }) => {
    // The wiki read the precondition text the wizard writes, the canvas card
    // the state: one model, two sentences.
    const doc = JSON.parse(fixture('order-machine'))
    doc.nodes.push({ id: 'req-ship', type: 'requirement', label: 'Ship confirmed orders', x: 900, y: 40, width: 280, height: 160,
      ears_type: 'state-driven', precondition: 'the order is waiting', precondition_state: 'confirmed', action: 'ship the order within one day' })
    doc.views.push({ id: 'v-wiki', kind: 'wiki', name: 'Wiki', nodeIds: [], positions: {} })
    await studio.seedDocument(JSON.stringify(doc))
    await page.goto(`/#/d/${encodeURIComponent('ls:e2e-doc')}/m/designer/v/v-wiki/f/req-ship`)
    await studio.ready()
    await expect(page.locator('.ears-sentence').first()).toContainText('While the Order is Confirmed')
  })

  test('after writing an element, one click on an "Add:" link opens its line', async ({ page, studio }) => {
    // The writing line's hint vanished on blur and everything below moved
    // up between mouse down and up: the first click was lost.
    const doc = JSON.parse(radicalBookstore())
    doc.views.push({ id: 'v-wiki', kind: 'wiki', name: 'Wiki', nodeIds: [], positions: {} })
    await studio.seedDocument(JSON.stringify(doc))
    // Tall enough that the link shows without scrolling: a scrolled page
    // keeps what is under the pointer in place and hides the jump.
    await page.setViewportSize({ width: 1600, height: 1200 })
    await page.goto(`/#/d/${encodeURIComponent('ls:e2e-doc')}/m/designer/v/v-wiki/f/bookstore`)
    await studio.ready()
    const line = page.getByRole('textbox', { name: 'Write a container' })
    await line.click()
    await page.keyboard.type('Search Service')
    await page.keyboard.press('Enter')
    const lines = page.getByRole('textbox', { name: /^Write a/ })
    await expect(page.locator('.wiki-write-input:focus')).toHaveCount(1)
    const before = await lines.count()
    // A click as a hand makes it: a moment between press and release.
    const link = page.locator('.wiki-page .wiki-write-start').last().locator('.wiki-link').first()
    const box = (await link.boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(1200)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(100)
    await page.mouse.up()
    await expect(lines).toHaveCount(before + 1)
  })
})
