import { expect, test } from './shots'

// The Hub's screenshot in the manual: the catalogue beside a blueprint.

test('hub-catalogue', async ({ page, shot }) => {
  await page.goto('/#/c/bp-analytical-data-platform/v/canvas')
  await expect(page.getByText('Analytical Data Platform', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
  await page.waitForTimeout(1500)
  await shot('hub-catalogue')
})
