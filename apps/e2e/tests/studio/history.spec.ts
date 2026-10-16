import { test, expect } from '../../support/fixtures'

// Navigation is the history of routes: the route names the place on screen
// (perspective, view, Inspector tab, selected element…), every change of
// place adds an entry, and ‹ ›, Alt+← / Alt+→ and the History list walk it.

test('back and forward walk through the places, the selection too', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-context')
  const back = page.getByRole('button', { name: 'Back', exact: true })
  const forward = page.getByRole('button', { name: 'Forward', exact: true })
  await expect(back).toBeDisabled()
  await expect(forward).toBeDisabled()

  // Three places: the customer selected, the Containers view, Viewer.
  await studio.node('customer').click()
  await expect(page).toHaveURL(/\/v\/v-context\/e\/customer$/)
  await page.locator('.lp-view-card', { has: page.locator('.lp-card-title', { hasText: 'Containers' }) }).click()
  await expect(page).toHaveURL(/\/m\/designer\/v\/v-containers$/)
  await page.locator('.toolbar-mode-btn', { hasText: 'Viewer' }).click()
  await expect(page).toHaveURL(/\/m\/viewer\/v\/v-containers$/)

  // ‹ names where it leads.
  await back.hover()
  await expect(page.locator('#nav-tip-back')).toContainText('to Designer › Containers')
  await back.click()
  await expect(page).toHaveURL(/\/m\/designer\/v\/v-containers$/)
  await expect(page.locator('.toolbar-mode-btn.active')).toHaveText(/Designer/)

  // The keys do the same, and the place comes back with its selection.
  await page.locator('body').press('Alt+ArrowLeft')
  await expect(page).toHaveURL(/\/v\/v-context\/e\/customer$/)
  await expect(page.getByText(/^Structure:/)).toHaveText('Structure: System Context')
  await expect(studio.node('customer')).toHaveClass(/selected/)

  await forward.click()
  await expect(page).toHaveURL(/\/m\/designer\/v\/v-containers$/)
  await expect(page.getByText(/^Structure:/)).toHaveText('Structure: Containers')

  // Back to the first place: the view as it opened, nothing selected.
  await back.click()
  await expect(page).toHaveURL(/\/e\/customer$/)
  await back.click()
  await expect(page).toHaveURL(/\/m\/designer\/v\/v-context$/)
  await expect(studio.node('customer')).not.toHaveClass(/selected/)
  await expect(back).toBeDisabled()
  await expect(forward).toBeEnabled()
})

test('the history lists the places and goes to the one picked', async ({ page, studio }) => {
  await studio.seed()
  await studio.open('v-context')
  await studio.node('customer').click()
  await expect(page).toHaveURL(/\/e\/customer$/)
  await page.locator('.lp-view-card', { has: page.locator('.lp-card-title', { hasText: 'Containers' }) }).click()
  await expect(page).toHaveURL(/\/v\/v-containers$/)
  await page.locator('.toolbar-mode-btn', { hasText: 'Viewer' }).click()
  await expect(page).toHaveURL(/\/m\/viewer\//)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL(/\/m\/designer\/v\/v-containers$/)

  await page.getByRole('button', { name: 'History' }).click()
  const menu = page.getByRole('menu', { name: 'History' })
  const rows = menu.getByRole('menuitem')
  // Newest first: the place ahead (Viewer), the current one, then those before.
  await expect(rows).toHaveCount(4)
  await expect(rows.nth(0)).toContainText('Containers')
  await expect(rows.nth(0)).toContainText('Viewer · forward')
  await expect(rows.nth(0)).toHaveClass(/ahead/)
  await expect(rows.nth(1)).toHaveAttribute('aria-current', 'location')
  await expect(rows.nth(1)).toContainText('Designer · you are here')
  await expect(rows.nth(2)).toContainText('System Context')
  await expect(rows.nth(2)).toContainText('Customer')
  await expect(rows.nth(3)).toContainText('System Context')

  // A reload keeps the list and the way back (the window's sessionStorage).
  await page.keyboard.press('Escape')
  await page.reload()
  await studio.ready()
  await expect(page).toHaveURL(/\/m\/designer\/v\/v-containers$/)
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'History' }).click()
  await expect(rows).toHaveCount(4)
  await expect(rows.nth(1)).toHaveAttribute('aria-current', 'location')

  // The first place, picked from the list.
  await rows.nth(3).click()
  await expect(menu).toBeHidden()
  await expect(page).toHaveURL(/\/m\/designer\/v\/v-context$/)
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeDisabled()
})
