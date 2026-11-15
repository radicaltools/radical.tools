// F2: with an element selected, the Delete key pressed in Setup…, About, AI providers or the
// Models dialog opens the canvas' delete prompt behind the dialog.
// node f2-delete-behind-dialog.mjs [studioPort=4505]
import { launch, wait, out, seedFixture, markSetUp, open, node, settingsMenu, settle, shot } from './lib.mjs'
const port = +(process.argv[2] ?? 4505)
const r = {}
for (const which of ['Setup…', 'About Radical Studio', 'AI providers…', 'Models']) {
  const { browser, context, page, problems } = await launch({ port })
  const id = await seedFixture(context, 'bookstore')
  await markSetUp(context)
  await open(page, id, 'v-containers')
  await wait(page, 1500)
  await node(page, 'db').click({ position: { x: 14, y: 8 } })
  await settle(page)
  if (which === 'Models') {
    await page.getByRole('button', { name: 'Models', exact: true }).click(); await wait(page, 300)
    await page.getByRole('menuitem', { name: /Manage models/ }).click()
  } else {
    await settingsMenu(page)
    await page.getByRole('menuitem', { name: which, exact: true }).click()
  }
  await wait(page, 600)
  const dialog = await page.locator('[role=dialog][aria-modal=true]').first().getAttribute('aria-label')
  const prompts = () => page.locator('.milestone-modal-title').evaluateAll((els) => els.map((e) => e.textContent.trim()).filter((t) => /^Delete/.test(t)))
  const before = await prompts()
  await page.keyboard.press('Delete'); await wait(page, 600)
  const after = await prompts()
  if (which === 'Setup…') {
    await shot(page, 'f2-delete-under-setup')
    // Finish leaves the prompt nobody asked for.
    await page.getByRole('button', { name: 'Skip setup' }).click(); await wait(page, 400)
    await shot(page, 'f2-after-setup-closed')
  }
  r[which] = { dialog, focusIn: await page.evaluate(() => document.activeElement?.className), deletePromptBefore: before, deletePromptAfter: after, problems }
  await browser.close()
}
out(r)
const hits = Object.values(r).filter((x) => x.deletePromptAfter.length > 0).length
console.log(hits ? `REPRODUCED in ${hits} of 4 dialogs` : 'NOT REPRODUCED')
