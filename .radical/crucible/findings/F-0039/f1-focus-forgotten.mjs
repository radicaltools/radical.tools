// Sample, Designer. Focus (canvas controls) is switched off, then "Wizard on create" in Settings
// is switched, and Smart fit off in Settings before it. After a reload, is Focus still off, as the manual says the browser remembers it?
// Args: [port=4579]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4579)
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
const focusBtn = () => page.locator('.canvas-focus-toggle')
const settings = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('radical-studio-settings')) ?? 'null')
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-ctx', 'designer')
  console.log('start: Focus pressed', await focusBtn().getAttribute('aria-pressed'), 'stored', JSON.stringify(await settings()))
  await focusBtn().click()
  await L.wait(page, 300)
  console.log('after clicking Focus: pressed', await focusBtn().getAttribute('aria-pressed'), 'stored', JSON.stringify(await settings()))
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: /Smart fit/ }).click()
  await L.wait(page, 300)
  console.log('after switching Smart fit off: stored', JSON.stringify(await settings()))
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const wiz = page.locator('label.app-menu-row', { hasText: 'Wizard on create' }).locator('input')
  await wiz.click()
  await L.wait(page, 300)
  console.log('after switching Wizard on create: stored', JSON.stringify(await settings()))
  await page.keyboard.press('Escape')
  console.log('before reload: Focus pressed', await focusBtn().getAttribute('aria-pressed'))
  await page.reload(); await page.locator('.app-layout').waitFor(); await L.settle(page)
  console.log('after reload: Focus pressed', await focusBtn().getAttribute('aria-pressed'), '(expected false)')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  console.log('after reload: Settings shows', await page.getByRole('menuitemcheckbox', { name: /Smart fit/ }).innerText(), '(expected off)')
  await L.shot(page, 'f1-focus-back-on')
} finally { console.log('problems', problems); await browser.close() }
