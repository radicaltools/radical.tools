import { expect, test } from './shots'

// The Hub's screenshot in the manual: the Authentication concern pack, with
// its group and sources, over the catalogue grouped by concern group.

test('hub-catalogue', async ({ page, shot }) => {
  await page.goto('/#/c/concern-authentication/v/wiki')
  await expect(page.getByText('Authentication', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('navigation', { name: 'Sources' })).toBeVisible()
  await page.waitForTimeout(1500)
  await shot('hub-catalogue')
})
