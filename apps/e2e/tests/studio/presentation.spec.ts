import { test, expect } from '../../support/fixtures'

// The bookstore fixture has one presentation, "Main", with two slides:
// Context (v-context) and Containers (v-containers).

test.beforeEach(async ({ studio }) => {
  await studio.freezeTime()
  await studio.seed()
  await studio.open('v-containers', 'presenter')
})

test('play through the slides', async ({ page, studio }) => {
  await page.getByRole('button', { name: 'Present', exact: true }).click()
  await studio.settle()
  await expect(page).toHaveURL(/\/v\/v-context\/p\/pres-main\/play\/1\/sl\/0$/)
  await expect(studio.nodes).toHaveCount(3)
  await expect(page.getByText('1 / 2')).toBeVisible()
  await expect(page).toHaveScreenshot('slide-1.png')

  await page.keyboard.press('ArrowRight')
  await studio.settle()
  await expect(page).toHaveURL(/\/v\/v-containers\/p\/pres-main\/play\/1\/sl\/1$/)
  await expect(studio.nodes).toHaveCount(6)
  await expect(page.getByText('2 / 2')).toBeVisible()
  await expect(page).toHaveScreenshot('slide-2.png')

  await page.keyboard.press('ArrowLeft')
  await studio.settle()
  await expect(page).toHaveURL(/\/sl\/0$/)

  await page.keyboard.press('Escape')
  await studio.settle()
  await expect(page).toHaveURL(/\/m\/presenter\/v\/[^/]+$/)
  await expect(page.getByRole('button', { name: 'Present', exact: true })).toBeVisible()
})

test('a slide deep link opens the running presentation', async ({ page, studio }) => {
  await page.goto('/#/d/ls%3Ae2e-doc/m/presenter/v/v-containers/p/pres-main/play/1/sl/1')
  await studio.ready()
  await expect(page.getByText('2 / 2')).toBeVisible()
  await expect(studio.nodes).toHaveCount(6)
})
