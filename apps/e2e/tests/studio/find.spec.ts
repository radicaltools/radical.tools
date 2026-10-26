import { expect, fixture } from '../../support/fixtures'
import { test } from '../../support/folder'

// Find in the view (⌘/Ctrl+F): the elements of the view shown by the words
// typed, the rest dimmed, Enter and Shift+Enter from one to the next.

/** The bookstore, with "orders" said by three elements: Orders DB by its
 *  name, the API and the customer by their descriptions. */
function bookstore(): string {
  const doc = JSON.parse(fixture('bookstore'))
  doc.nodes.find((n: { id: string }) => n.id === 'customer').description = 'Places orders online'
  doc.views.push({ id: 'v-wiki', name: 'Wiki', kind: 'wiki', nodeIds: [], positions: {} })
  return JSON.stringify(doc)
}

test('Cmd+F finds in the view: the rest dimmed, Enter and Shift+Enter step through the hits', async ({ page, studio }) => {
  await studio.seedDocument(bookstore())
  await studio.open('v-containers')
  await studio.pane.click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('ControlOrMeta+f')
  const input = page.locator('.find-in-view input')
  await expect(input).toBeFocused()
  await page.keyboard.type('orders')
  const count = page.locator('.find-in-view-count')
  await expect(count).toHaveText('3 found')

  // What it did not find is dimmed; the container of a hit is not.
  for (const id of ['web', 'payments']) await expect(studio.node(id)).toHaveClass(/focus-dim/)
  for (const id of ['db', 'api', 'customer', 'bookstore']) await expect(studio.node(id)).not.toHaveClass(/focus-dim/)

  // The best hit first: Orders DB by its name.
  await page.keyboard.press('Enter')
  await expect(count).toHaveText('1 of 3')
  await expect(studio.node('db')).toHaveClass(/selected/)
  await page.keyboard.press('Enter')
  await expect(count).toHaveText('2 of 3')
  await expect(studio.node('db')).not.toHaveClass(/selected/)
  await page.keyboard.press('Shift+Enter')
  await expect(count).toHaveText('1 of 3')
  await expect(studio.node('db')).toHaveClass(/selected/)

  // Escape closes it and the hit stays selected; with nothing selected,
  // nothing is dimmed.
  await page.keyboard.press('Escape')
  await expect(page.locator('.find-in-view')).toHaveCount(0)
  await expect(studio.node('db')).toHaveClass(/selected/)
  await studio.pane.click({ position: { x: 5, y: 5 } })
  for (const id of ['web', 'payments', 'customer']) await expect(studio.node(id)).not.toHaveClass(/focus-dim/)
})

test('Cmd+F on a table dims the rows not found, and on a wiki goes to its search box', async ({ page, studio }) => {
  await studio.seedDocument(bookstore())
  await studio.open('v-table')
  await page.locator('.tv-wrap').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('ControlOrMeta+f')
  await page.keyboard.type('orders')
  for (const id of ['db', 'api', 'customer']) await expect(studio.row(id)).toHaveClass(/tv-row-found/)
  await expect(studio.row('web')).toHaveClass(/tv-row-dim/)
  // Only the rows found, and the container they are in.
  await page.getByRole('button', { name: 'Only the rows found' }).click()
  await expect(studio.row('web')).toHaveCount(0)
  await expect(studio.row('bookstore')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.locator('.lp-view-card', { hasText: 'Wiki' }).first().click()
  await expect(page).toHaveURL(/\/v\/v-wiki/)
  await page.locator('.wiki-page').first().click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('ControlOrMeta+f')
  await expect(page.getByLabel('Search pages')).toBeFocused()
  await expect(page.locator('.find-in-view')).toHaveCount(0)
})
