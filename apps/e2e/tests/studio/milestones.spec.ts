import { test, expect, fixture } from '../../support/fixtures'

// Milestones: what is shown and asked while one is open, and what the
// answers keep.

/** The sample on All elements (a table), with milestone `name` shown. */
async function sampleTableIn(page: import('@playwright/test').Page, studio: import('../../support/fixtures').Studio, name: string): Promise<void> {
  await studio.openSample()
  await studio.open('canvas', 'designer', studio.activeDocId())
  await page.getByRole('tab', { name: 'Milestones' }).click()
  await page.locator('.lp-snap-card', { hasText: name }).first().click()
  await expect(page).toHaveURL(/\/s\//)
}

test('a table in a milestone names it, with Propagate, New milestone and Discard once it is edited', async ({ page, studio }) => {
  // The chip was the canvas's: a table, wiki, hierarchy, matrix or Warnier
  // view said nothing of the milestone shown or of its unsaved edits.
  await sampleTableIn(page, studio, 'v4')
  const chip = page.locator('.milestone-chip')
  await expect(chip).toContainText('Milestone: v4')
  await expect(chip.getByRole('button', { name: 'Propagate' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Add under API Gateway' }).click()
  await page.locator('.milestone-modal').getByRole('button', { name: 'Continue editing (decide later)' }).click()
  await expect(chip).toContainText('unsaved')
  await expect(chip.getByRole('button', { name: 'Propagate' })).toBeVisible()
  await expect(chip.getByRole('button', { name: 'Discard' })).toBeVisible()
})

test('in a milestone, the name of a row added to a table stays open through the question how to save it', async ({ page, studio }) => {
  // The question took the focus from the new row's name, which closed: what
  // was typed then was lost, and the row stayed "New Component".
  await sampleTableIn(page, studio, 'v4')
  await page.getByRole('button', { name: 'Add under API Gateway' }).click()
  await page.locator('.milestone-modal').getByRole('button', { name: 'Continue editing (decide later)' }).click()
  const input = page.locator('input.tv-cell-input')
  await expect(input).toBeFocused()
  await page.keyboard.type('Rate limiter')
  await page.keyboard.press('Enter')
  await expect(input).toHaveCount(0)
  await expect(page.locator('tr.tv-row .tv-chain-cell', { hasText: /Rate limiter$/ })).toHaveCount(1)
  await expect(page.locator('tr.tv-row .tv-chain-cell', { hasText: /New Component$/ })).toHaveCount(0)
})

test('a space typed into the name of a new milestone is part of the name', async ({ page, studio }) => {
  // The field lay inside the Save as new button: the space pressed it, the
  // milestone was saved as "Target", and "2027" went to the canvas.
  await sampleTableIn(page, studio, 'v4')
  const docId = studio.activeDocId()
  await page.getByRole('button', { name: 'Add under API Gateway' }).click()
  const name = page.locator('.milestone-modal .milestone-option-input')
  await name.fill('')
  await name.pressSequentially('Target 2027')
  await expect(page.locator('.milestone-modal')).toBeVisible()
  await expect(name).toHaveValue('Target 2027')
  await name.press('Enter')
  await expect(page.locator('.milestone-modal')).toHaveCount(0)
  await expect.poll(async () => (await studio.storedDoc(docId) as unknown as { snapshots: Array<{ name: string }> }).snapshots.map((m) => m.name))
    .toContain('Target 2027')
})

test('the diff of a flow view finds a step removed whose relation is another step too', async ({ page, studio }) => {
  // The diff compared sets of relation ids: As-is r1 r2 r3 r4 r2 against
  // Target r1 r2 r3 r4 showed no ghost for the second r2.
  const doc = JSON.parse(fixture('bookstore'))
  const seq = doc.sequences[0]
  const copy = (relationIds: string[], stepDescriptions: string[]) => ({
    nodes: Object.fromEntries(doc.nodes.map((n: { id: string }) => [n.id, n])),
    relations: Object.fromEntries(doc.relations.map((r: { id: string }) => [r.id, r])),
    sequences: { [seq.id]: { ...seq, relationIds, stepDescriptions } },
  })
  doc.snapshots = [
    { id: 'm-asis', name: 'As-is', timestamp: 1, ...copy(['r1', 'r2', 'r3', 'r4', 'r2'], ['submits', 'posts', 'stores', 'charges', 'posts again']) },
    { id: 'm-target', name: 'Target', timestamp: 2, ...copy(['r1', 'r2', 'r3', 'r4'], ['submits', 'posts', 'stores', 'charges']) },
  ]
  await studio.seedDocument(JSON.stringify(doc))
  await studio.open('v-context')
  await page.locator('.lp-view-card', { hasText: 'Order Flow' }).first().click()
  await expect(page.locator('.seq-diagram-step')).toHaveCount(4)
  await page.getByRole('tab', { name: 'Milestones' }).click()
  await page.locator('.lp-snap-card', { hasText: 'Target' }).first().click()
  await expect(page).toHaveURL(/\/s\//)
  await page.getByRole('button', { name: '⊙ diff' }).first().click()
  const steps = page.locator('.seq-diagram-step')
  await expect(steps).toHaveCount(5)
  await expect(page.locator('.seq-diagram-step[data-diff="removed"]')).toHaveCount(1)
  await expect(page.locator('.seq-diagram-step[data-diff="new"], .seq-diagram-step[data-diff="changed"]')).toHaveCount(0)
})

test('opening a milestone and going back to the live model writes nothing', async ({ page, studio }) => {
  // Showing one saved the live document as the store had it: every view's
  // positions trimmed to what it draws, a node's place mirror changed, a
  // camera and empty Hub records written. Nothing was edited (D15).
  await studio.openSample()
  const docId = studio.activeDocId()
  await studio.designer()
  const stored = () => page.evaluate((k) => localStorage.getItem(k), `radical-doc:${docId}`)
  await expect.poll(stored).not.toBeNull()
  await page.waitForTimeout(1500)
  const before = await stored()
  await page.getByRole('tab', { name: 'Milestones' }).click()
  await page.locator('.lp-snap-card', { hasText: 'v1' }).first().click()
  await expect(page).toHaveURL(/\/s\//)
  await studio.settle()
  await page.waitForTimeout(1500)
  expect(await stored()).toBe(before)
  await page.locator('.lp-snap-current').click()
  await expect(page).not.toHaveURL(/\/s\//)
  await studio.settle()
  await page.waitForTimeout(1500)
  expect(await stored()).toBe(before)
})

test('a name typed in a milestone before and after the question is one undo step', async ({ page, studio }) => {
  // The question took the focus from the field and gave it back: what was
  // typed before it and after it were two steps.
  await studio.openSample('view-core')
  await page.getByRole('tab', { name: 'Milestones' }).click()
  await page.locator('.lp-snap-card', { hasText: 'v3' }).first().click()
  await expect(page).toHaveURL(/\/s\//)
  await studio.settle()
  await page.locator('.react-flow__node[data-id="ctn-fraud"]').first().click({ position: { x: 30, y: 10 } })
  const name = page.getByLabel('Name', { exact: true }).first()
  const was = await name.inputValue()
  await name.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' XYZ')
  await page.locator('.milestone-modal').getByRole('button', { name: 'Continue editing (decide later)' }).click()
  await expect(page.locator('.milestone-modal')).toHaveCount(0)
  await expect(name).toBeFocused()
  await page.keyboard.type('Q')
  await expect(name).toHaveValue(`${was} XYZQ`)
  await name.press('Enter')
  await expect(page.getByText('· unsaved')).toBeVisible()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(name).toHaveValue(was)
  await expect(page.getByText('· unsaved')).toHaveCount(0)
})

test('leaving the page with a milestone shown and nothing edited in it asks nothing', async ({ page, studio }) => {
  // A reload dropped them without a word (a reload saves nothing).
  await studio.openSample('view-core')
  const asked: string[] = []
  page.on('dialog', (d) => { asked.push(d.type()); void d.dismiss() })
  await page.getByRole('tab', { name: 'Milestones' }).click()
  await page.locator('.lp-snap-card', { hasText: 'v3' }).first().click()
  await expect(page).toHaveURL(/\/s\//)
  await studio.settle()
  // Nothing edited: nothing to ask.
  await page.close({ runBeforeUnload: true })
  await expect.poll(() => page.isClosed()).toBe(true)
  expect(asked).toEqual([])
})

test('leaving the page with unsaved edits of a milestone asks, and staying keeps them', async ({ page, studio }) => {
  await studio.openSample('view-core')
  const asked: string[] = []
  page.on('dialog', (d) => { asked.push(d.type()); void d.dismiss() })
  await page.getByRole('tab', { name: 'Milestones' }).click()
  await page.locator('.lp-snap-card', { hasText: 'v3' }).first().click()
  await expect(page).toHaveURL(/\/s\//)
  await studio.settle()
  await page.locator('.react-flow__node[data-id="ctn-fraud"]').first().click({ position: { x: 30, y: 10 } })
  const name = page.getByLabel('Name', { exact: true }).first()
  await name.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' v2')
  await page.locator('.milestone-modal').getByRole('button', { name: 'Continue editing (decide later)' }).click()
  await name.press('Enter')
  await page.close({ runBeforeUnload: true })
  await expect.poll(() => asked).toEqual(['beforeunload'])
  expect(page.isClosed()).toBe(false)
  await expect(page.getByText('· unsaved')).toBeVisible()
})

/** Milestone sizes and the live model's in the saved document. */
async function storedCounts(studio: import('../../support/fixtures').Studio, docId: string): Promise<string> {
  const doc = await studio.storedDoc(docId) as unknown as { nodes: unknown[]; snapshots: Array<{ nodes: Record<string, unknown> }> }
  return [...doc.snapshots.map((m) => Object.keys(m.nodes).length), doc.nodes.length].join(' ')
}

test('a slide that plays the live model while a milestone is open names no milestone, and offers neither its diff nor Propagate', async ({ page, studio }) => {
  // F-0027: the sample's first slide has neither a milestone nor a copy and
  // draws the live model, under a chip naming v1, with diff and Propagate.
  await studio.openSample()
  await studio.open('view-ctx', 'designer', studio.activeDocId())
  await page.getByRole('tab', { name: 'Milestones' }).click()
  await page.locator('.lp-snap-card', { hasText: 'v1' }).first().click()
  await expect(page).toHaveURL(/\/s\//)
  await studio.settle()
  const chip = page.getByText(/^Milestone: v1/)
  await expect(chip).toBeVisible()
  await page.keyboard.press('F5')
  await expect(page).toHaveURL(/\/play\//)
  await studio.settle()
  await expect(page.locator('.react-flow__node[data-id="sys-swift"]')).toHaveCount(1)
  await expect(chip).toHaveCount(0)
  await expect(page.getByRole('button', { name: /⊙ diff/ })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page).not.toHaveURL(/\/play\//)
  await expect(chip).toBeVisible()
})

test('F5 does not start behind the milestone question, and Propagate after a slide played carries the milestone\'s edit', async ({ page, studio }) => {
  // F-0022: F5 started the presentation behind the question; its Propagate
  // (or the chip's) then wrote the playing slide's model into v2, v3, v4
  // and the live model.
  await sampleTableIn(page, studio, 'v2')
  const docId = studio.activeDocId()
  await expect.poll(() => storedCounts(studio, docId)).toBe('11 17 30 65 283')
  await page.getByRole('button', { name: 'Add under API Gateway' }).click()
  const question = page.locator('.milestone-modal')
  await expect(question).toBeVisible()
  await page.keyboard.press('F5')
  await page.waitForTimeout(500)
  await expect(page).not.toHaveURL(/\/play\//)
  await expect(question).toBeVisible()
  await question.getByRole('button', { name: 'Continue editing (decide later)' }).click()
  await page.keyboard.press('Escape')
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press('F5')
  await expect(page).toHaveURL(/\/play\//)
  // The slide draws the live model: nothing of v2's to propagate there.
  await expect(page.getByRole('button', { name: 'Propagate' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page).not.toHaveURL(/\/play\//)
  await page.getByRole('button', { name: 'Propagate' }).click()
  await expect.poll(() => storedCounts(studio, docId)).toBe('11 18 31 66 284')
})
