// F3: with the focus on a button in the Radical Forge panel, Delete opens the canvas' delete prompt for
// the element selected behind it (hidden under the panel), while Ctrl+Z, F5 and Cmd/Ctrl+= are held there.
// node f3-delete-behind-forge.mjs [studioPort=4515]
import { launch, wait, out, shot, seedFixture, markSetUp, open, node, settle } from './lib.mjs'
const port = +(process.argv[2] ?? 4515)
const r = {}
for (const key of ['F5', 'Delete']) {
  const { browser, context, page, problems } = await launch({ port })
  const id = await seedFixture(context, 'bookstore'); await markSetUp(context)
  // An AI provider set up (nothing is sent: no run is started), so Radical Forge opens.
  await context.addInitScript(() => localStorage.setItem('radical-ai-settings', JSON.stringify({ enabled: true, active: 'openai', providers: { openai: { apiKey: 'sk-test', baseUrl: '', model: '' } } })))
  await open(page, id, 'v-containers'); await wait(page, 1200)
  await node(page, 'db').click({ position: { x: 14, y: 8 } }); await settle(page)
  await page.getByRole('button', { name: 'Open Radical Forge' }).click(); await wait(page, 800)
  const panel = page.getByRole('dialog', { name: 'Radical Forge' })
  // Click the Description stage (a button in the panel): the focus is in Forge, as a user's click leaves it.
  await panel.getByRole('tab', { name: 'Description', exact: true }).click(); await wait(page, 300)
  const focusInForge = await page.evaluate(() => !!document.activeElement?.closest('.forge-panel') && document.activeElement?.tagName)
  await page.keyboard.press(key); await wait(page, 900)
  const res = { focusInForge, deletePrompt: (await page.locator('.milestone-modal-title').allTextContents()).filter(t => /^Delete/.test(t)), presenting: await page.locator('.mode-presenting').count(), forgeStill: await panel.count() }
  if (key === 'Delete') {
    await shot(page, 'f3-delete-in-forge')
    await panel.getByRole('button', { name: 'Close' }).click(); await wait(page, 600)
    res.afterForgeClosed = (await page.locator('.milestone-modal-title').allTextContents())
    await shot(page, 'f3-after-forge-closed')
  }
  res.problems = problems
  r[key] = res
  await browser.close()
}
out(r)
const bug = r.Delete.focusInForge && r.Delete.deletePrompt.length > 0
console.log(`F5 held by Forge: ${r.F5.presenting === 0}; Delete in Forge asks to delete the canvas selection: ${bug}`)
console.log(`REPRODUCED: ${bug ? 'yes' : 'no'}`)
process.exit(bug ? 1 : 0)
