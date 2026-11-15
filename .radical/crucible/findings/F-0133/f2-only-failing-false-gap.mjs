// Verification path › "Only what does not pass" on an element whose checks all pass: the path keeps
// the element and draws, under it, the gap card "no scenario verifies it" (a requirement with a
// passing scenario) or "names no check" (a scenario whose test passed).
// Usage (Studio served on the port): node f2-only-failing-false-gap.mjs [--port 4501]
import { startBrowser, openRepoFolder, quickOpen, card, tracePanel, traceItems, shot, sleep } from './lib.mjs'
import { buildShop } from './shop.mjs'
const { repo } = await buildShop()
const { page, errors, close } = await startBrowser()
const cells = async () => (await traceItems(page)).filter((i) => i.row !== '1').map((i) => `col ${i.col}, row ${Number(i.row) - 1}: ${i.text.replace(/ Details Show on canvas.*$/, '').slice(0, 70)}`)
try {
  await openRepoFolder(page, repo)
  for (const name of ['Check 3-D Secure', 'Paying by card']) {
    await page.locator('.toolbar-mode-btn', { hasText: 'Viewer' }).click(); await sleep(500)
    await quickOpen(page, name)
    console.log(`\n${name}: card says`, await card(page).getByRole('region', { name: 'Verification' }).locator('.pp-ver-status').innerText())
    await card(page).getByRole('button', { name: 'Path', exact: true }).click()
    await tracePanel(page).waitFor()
    console.log('Path:', await cells())
    await tracePanel(page).getByLabel('Only what does not pass').check()
    await sleep(400)
    console.log('Only what does not pass:', await cells())
    await shot(page, `f2-${name.replace(/\W+/g, '-').toLowerCase()}.png`)
    await tracePanel(page).getByRole('button', { name: 'Close' }).click(); await sleep(300)
  }
  console.log('errors', errors)
} finally { await close() }
