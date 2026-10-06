import { test, expect, fixture } from '../../support/fixtures'

// The metamodel editor's Diagram tab, on the bookstore fixture switched to
// the Governance metamodel (16 node types, 14 relation types).
test.beforeEach(async ({ studio }) => {
  const doc = JSON.parse(fixture('bookstore'))
  doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'C4 + DDD + Governance', nodeTypes: {}, relationTypes: {} }
  await studio.seedDocument(JSON.stringify(doc))
})

test('the Diagram tab draws every node type and its relations', async ({ page, studio }) => {
  await studio.open('v-context', 'metamodel')
  const editor = page.getByRole('dialog', { name: 'Metamodel editor' })
  await editor.getByRole('tab', { name: 'Diagram' }).click()

  const diagram = editor.locator('.mmd-canvas')
  const legend = editor.locator('.mmd-legend')
  await expect(diagram.locator('.react-flow__node-mmType')).toHaveCount(16)
  await expect(diagram.locator('.mmd-status')).toHaveCount(0, { timeout: 30_000 })
  await expect(diagram.locator('.react-flow__edge').first()).toBeVisible()
  // Smart Layout, then the physics settles it: no two type boxes overlap.
  const boxes = await diagram.locator('.react-flow__node-mmType').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { id: (el as HTMLElement).dataset.id, x: r.x, y: r.y, w: r.width, h: r.height }
    }),
  )
  const overlaps = boxes.flatMap((a, i) =>
    boxes.slice(i + 1).filter((b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).map((b) => `${a.id}/${b.id}`),
  )
  expect(overlaps).toEqual([])

  // Types sit in a frame per palette category.
  await expect(diagram.locator('.mmd-category-label')).toHaveText(['C4', 'Domain', 'Governance', 'Requirements', 'UX', 'Other'])
  // Relation names are on the lines without selecting anything.
  await expect(diagram.locator('.mmd-edge-label', { hasText: 'Verifies' })).toBeVisible()
  // A relation from a type to itself is a chip, not a loop.
  await expect(diagram.getByTestId('rf__node-adr').getByText('↻ Supersedes')).toBeVisible()
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/diagram.png` })

  // By default every containment edge and every type's properties are shown.
  await expect(legend.getByRole('checkbox', { name: 'Show Contains' })).toBeChecked()
  await expect(legend.getByRole('checkbox', { name: 'Show properties on boxes' })).toBeChecked()
  await expect(diagram.locator('.react-flow__edge[data-testid^="rf__edge-contains:"]')).toHaveCount(35)
  await expect(diagram.getByTestId('rf__node-requirement').getByText('ears_type')).toBeVisible()

  // With Contains off, Blueprint (no relation type reaches it) still shows
  // its two allowed parents (Domain, Group), so it does not float.
  await legend.getByRole('checkbox', { name: 'Show Contains' }).uncheck()
  await expect(diagram.locator('.mmd-status')).toHaveCount(0, { timeout: 30_000 })
  await expect(diagram.locator('.react-flow__edge[data-testid^="rf__edge-contains:"]')).toHaveCount(2)

  // "none" hides every edge; one relation type back on shows only its edges.
  await legend.getByRole('button', { name: 'none' }).click()
  await expect(diagram.locator('.react-flow__edge')).toHaveCount(0)
  await legend.getByRole('checkbox', { name: 'Show Constrains' }).check()
  await expect(diagram.locator('.mmd-status')).toHaveCount(0, { timeout: 30_000 })
  // ADR, Fitness Function and Requirement each constrain all eight C4
  // element types: one edge per pair, each ending on its type — and only
  // those 11 types are left on the diagram.
  await expect(diagram.locator('.react-flow__edge')).toHaveCount(24)
  await expect(diagram.locator('.react-flow__node-mmType')).toHaveCount(11)
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/constrains.png` })

  await legend.getByRole('checkbox', { name: 'Show properties on boxes' }).uncheck()
  await expect(diagram.getByTestId('rf__node-requirement').getByText('ears_type')).toHaveCount(0, { timeout: 20_000 })
})

test('selecting a type shows its rules; Edit opens it in the list', async ({ page, studio }) => {
  await studio.open('v-context', 'metamodel')
  const editor = page.getByRole('dialog', { name: 'Metamodel editor' })
  await editor.getByRole('tab', { name: 'Diagram' }).click()

  const diagram = editor.locator('.mmd-canvas')
  await expect(diagram.locator('.mmd-status')).toHaveCount(0, { timeout: 30_000 })
  const zoom = async (): Promise<number> =>
    diagram.locator('.react-flow__viewport').evaluate((el) => Number(/scale\(([\d.]+)\)/.exec((el as HTMLElement).style.transform)?.[1]))
  // The fit after the physics animates; read the overview once it has stopped.
  let overview = await zoom()
  await expect
    .poll(async () => {
      const prev = overview
      overview = await zoom()
      return overview === prev
    }, { intervals: [150] })
    .toBe(true)

  // Selecting a type frames it with what it is connected to.
  await diagram.getByTestId('rf__node-blueprint').click()
  await expect.poll(zoom).toBeGreaterThan(overview * 1.5)
  await diagram.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } })
  await expect.poll(zoom).toBeCloseTo(overview, 2)

  // Selecting a relation shows only its sources and targets: ADR, Fitness
  // Function and Requirement constrain the eight C4 element types.
  await editor.locator('.mmd-legend').getByRole('button', { name: 'Constrains' }).click()
  await expect(diagram.locator('.react-flow__node-mmType')).toHaveCount(11)
  await expect(diagram.locator('.react-flow__edge')).toHaveCount(24)
  await expect(diagram.locator('.mmd-category-label')).toHaveText(['C4', 'Domain', 'Governance', 'Requirements'])
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/relation.png` })
  await page.keyboard.press('Escape')
  await expect(diagram.locator('.react-flow__node-mmType')).toHaveCount(16)

  await editor.locator('.mmd-canvas').getByTestId('rf__node-requirement').click()
  const inspector = editor.locator('.mm-editor-side')
  await expect(inspector.getByText('Relations out')).toBeVisible()
  await expect(inspector.getByRole('button', { name: 'Derives from' }).first()).toBeVisible()
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/selected.png` })

  // Esc clears the selection before it would close the editor.
  await page.keyboard.press('Escape')
  await expect(inspector.getByText('Validation')).toBeVisible()
  await expect(editor).toBeVisible()

  await editor.locator('.mmd-canvas').getByTestId('rf__node-requirement').click()
  await inspector.getByRole('button', { name: 'Edit type' }).click()
  await expect(editor.getByRole('tab', { name: 'List' })).toHaveAttribute('aria-selected', 'true')
  await expect(editor.locator('.mm-card.focused input.mm-input').first()).toHaveValue('Requirement')
})

// CI runners are slow: there the last frame of the physics used to leave the
// type boxes unmeasured, hidden and without edges. A throttled CPU reproduces it.
test('the diagram stays drawn on a slow machine', async ({ page, studio }) => {
  await studio.open('v-context', 'metamodel')
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 })
  const editor = page.getByRole('dialog', { name: 'Metamodel editor' })
  await editor.getByRole('tab', { name: 'Diagram' }).click()
  const diagram = editor.locator('.mmd-canvas')
  await expect(diagram.locator('.mmd-status')).toHaveCount(0, { timeout: 60_000 })
  await expect(diagram.locator('.react-flow__edge')).toHaveCount(96)
  await expect(diagram.getByTestId('rf__node-requirement')).toBeVisible()
})
