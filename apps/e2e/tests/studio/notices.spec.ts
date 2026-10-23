import { test, expect } from '../../support/fixtures'

// Notices (toasts): where they stand and when they go.

// F-0050: at 1280 px wide the Smart Layout notice opened over the Smart
// Layout button and took its clicks; and a notice that appears under a
// resting pointer stayed, as if the user had moved onto it to read it.
test('a notice stays clear of the canvas controls and goes under a resting pointer', async ({ page, studio }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await studio.openSample()
  await studio.designer()
  const button = page.getByRole('button', { name: 'Smart Layout', exact: true })
  const notice = page.locator('.toast')
  // Where the notice comes, the pointer waits without moving.
  await page.mouse.move(1280 - 40, 720 - 80)
  await button.focus()
  await page.keyboard.press('Enter')
  await expect(notice.filter({ hasText: 'Smart layout' }).first()).toBeVisible({ timeout: 30_000 })
  const controls = (await page.getByRole('toolbar', { name: 'Canvas' }).boundingBox())!
  const toast = (await notice.first().boundingBox())!
  expect(toast.y + toast.height).toBeLessThanOrEqual(controls.y)
  const b = (await button.boundingBox())!
  expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.canvas-controls'), [b.x + b.width / 2, b.y + b.height / 2])).toBe(true)
  // The pointer rests on the notice, which still goes after its 5 s.
  await expect.poll(() => page.evaluate(() => !!document.querySelector('.toast:hover'))).toBe(true)
  await expect(notice).toHaveCount(0, { timeout: 8_000 })
})
