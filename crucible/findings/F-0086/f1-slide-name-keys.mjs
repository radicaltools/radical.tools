// The sample model in Presenter. Double-click a slide's name in the dock to rename it, type, then
// press F5 and Cmd/Ctrl+P. They reach the browser (not prevented: F5 reloads the page and loses the
// name being typed, Cmd+P opens the print dialog), while in the presentation's own name field, and in
// every other field of Studio since F-0068, Studio takes them (F5 presents, Cmd/Ctrl+P = Quick Search).
// Headless Chromium has no browser accelerators, so the proof is defaultPrevented, read after dispatch.
// Args: [port=4599]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4599)
const { page, problems, close } = await L.launch({ port })
page.setDefaultTimeout(10000)
const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
const press = async () => {
  await page.keyboard.press('F5'); await L.wait(page, 400)
  if (await page.locator('.mode-presenting').count()) { await page.keyboard.press('Escape'); await L.wait(page, 400) }
  await page.keyboard.press(`${mod}+p`)
  return (await L.keysLog(page)).map((k) => `${k.key}: ${k.prevented ? 'taken by Studio' : 'NOT prevented (browser)'}`).join(', ')
}
try {
  await L.openSample(page)
  await page.goto(page.url().replace('/m/designer/', '/m/presenter/'))
  await page.locator('.pres-dock').waitFor(); await L.settle(page)
  // Control: the presentation's name field (✎ Rename presentation).
  await page.getByTitle('Rename presentation').click()
  await page.locator('.pres-picker-input').waitFor(); await page.keyboard.type(' v2')
  await L.probeKeys(page)
  console.log('presentation name field:', await press())
  await page.keyboard.press('Escape'); await L.wait(page, 300)
  if (await page.locator('.pres-picker-input').count()) { await page.locator('.pres-picker-input').press('Escape') }
  // The slide name field.
  await page.locator('.pres-slide-name').first().dblclick()
  const input = page.locator('.pres-slide-name-input'); await input.waitFor()
  await page.keyboard.type('Opening slide')
  await L.probeKeys(page)
  console.log('slide name field:       ', await press())
  console.log('slide name field still open with', JSON.stringify(await input.inputValue().catch(() => null)))
  await L.shot(page, 'f1-slide-name')
} finally { console.log('problems', problems); await close() }
