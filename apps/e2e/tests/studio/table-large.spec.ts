import { test, expect } from '../../support/fixtures'

// A long table draws only the lines near what is scrolled into sight
// (TableView, useTableWindow): 30 needs with 10 requirements each are 330
// rows and their + rows, of which it draws a screenful and some around it.

function largeRegister(): string {
  const nodes: object[] = [], relations: object[] = []
  for (let n = 0; n < 30; n++) {
    nodes.push({ id: `n${n}`, type: 'need', label: `Need ${String(n).padStart(2, '0')}`, description: '', x: 0, y: 0, width: 160, height: 60, collapsed: false })
    for (let r = 0; r < 10; r++) {
      const id = `r${n}_${r}`
      nodes.push({ id, type: 'requirement', label: `Requirement ${String(n).padStart(2, '0')}.${r}`, description: '', x: 0, y: 0, width: 160, height: 60, collapsed: false, ears_type: 'ubiquitous', action: `The system shall do ${n}.${r}.` })
      relations.push({ id: `d${n}_${r}`, sourceId: id, targetId: `n${n}`, relationType: 'derives' })
    }
  }
  const view = {
    id: 'v-register', name: 'Register', kind: 'table', nodeIds: [], positions: {},
    pipeline: { levels: [{ ways: [{ types: ['need'] }] }, { ways: [{ via: { relationType: 'derives', direction: 'in' }, types: ['requirement'] }] }] },
  }
  return JSON.stringify({ nodes, relations, views: [view], metamodel: { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} } })
}

test('a long table draws the lines in sight, scrolls to the end, and to a new row', async ({ page, studio }) => {
  await studio.seedDocument(largeRegister())
  await studio.open('v-register')
  const rows = page.locator('.tv-chain-row')
  await expect(rows.first()).toContainText('Need 00')
  // A screenful and some around it, not all 330.
  const drawn = await rows.count()
  expect(drawn).toBeGreaterThan(10)
  expect(drawn).toBeLessThan(150)
  // The scrolled height stands for every line.
  const wrap = page.locator('.tv-table-wrap')
  expect(await wrap.evaluate((el) => el.scrollHeight)).toBeGreaterThan(330 * 20)

  // At the end: the last requirement and the + row for a new need.
  await wrap.evaluate((el) => { el.scrollTop = el.scrollHeight })
  await expect(page.locator('.tv-chain-row', { hasText: 'Requirement 29.9' })).toBeInViewport()
  await expect(page.locator('.tv-chain-row', { hasText: 'Need 00' })).toHaveCount(0)
  // A need is made in its wizard; the new row is drawn and in sight.
  await page.getByRole('button', { name: 'Add at the top' }).click()
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.locator('.tv-chain-row', { hasText: 'New Need' })).toBeInViewport()
})
