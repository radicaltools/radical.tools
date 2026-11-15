// F1: with the Radical Forge panel open (it leaves the canvas usable), the Delete prompt, the Models dialog,
// AI providers… and About open UNDER the panel (.forge-panel z-index 4000): their buttons cannot be clicked.
// Bookstore fixture, an AI provider set (no request is sent). Usage: node f1-dialogs-under-forge-panel.mjs [studioPort=4516]
import { launch, wait, fixture, seed, markSetUp, shot } from './lib.mjs'
const port = +(process.argv[2] ?? 4516)
const covered = (page, dialog) => dialog.locator('button').evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => {
  const b = e.getBoundingClientRect(); const top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)
  return { name: (e.innerText || e.getAttribute('aria-label') || '').trim().split('\n')[0].slice(0, 24), covered: !e.contains(top) && !!top?.closest('.forge-panel') }
}))
async function start() {
  const env = await launch({ port, hubPort: 0 })
  await seed(env.context, fixture('bookstore')); await markSetUp(env.context)
  await env.context.addInitScript(() => localStorage.setItem('radical-ai-settings', JSON.stringify({ enabled: true, active: 'anthropic', providers: { anthropic: { apiKey: 'e2e', baseUrl: '', model: '' } } })))
  await env.page.goto(`/#/d/${encodeURIComponent('ls:run216-doc')}/m/designer/v/v-context`)
  await env.page.locator('.react-flow__node').first().waitFor(); await wait(env.page, 1200)
  await env.page.getByRole('button', { name: 'Open Radical Forge' }).click()
  await env.page.getByRole('dialog', { name: 'Radical Forge' }).waitFor()
  return env
}
const results = []
// 1. The Delete prompt of an element selected on the canvas beside the panel.
{
  const { browser, page } = await start()
  try {
    const at = await page.locator('.react-flow__node').evaluateAll((els) => {
      const f = document.querySelector('.forge-panel').getBoundingClientRect()
      for (const e of els) {
        const b = e.getBoundingClientRect()
        for (const [x, y] of [[b.x + 8, b.y + 8], [b.right - 8, b.y + 8], [b.x + 8, b.bottom - 8], [b.right - 8, b.bottom - 8]]) {
          if ((x < f.left || x > f.right || y < f.top || y > f.bottom) && document.elementFromPoint(x, y)?.closest('.react-flow__node') === e) return [x, y, e.dataset.id]
        }
      }
      return null
    })
    await page.mouse.click(at[0], at[1])
    await page.keyboard.press('Delete')
    const prompt = page.locator('.milestone-modal')
    await prompt.waitFor(); await wait(page, 400)
    const buttons = await covered(page, prompt)
    results.push({ what: `Delete prompt (element ${at[2]})`, buttons })
    await shot(page, 'f1-delete-prompt-under-forge')
  } finally { await browser.close() }
}
// 2. Models → Manage models…
{
  const { browser, page } = await start()
  try {
    await page.getByRole('button', { name: 'Models', exact: true }).click()
    await page.getByRole('menuitem', { name: /Manage models/ }).click()
    const models = page.getByRole('dialog', { name: 'Models' })
    await models.waitFor(); await wait(page, 400)
    results.push({ what: 'Models dialog', buttons: await covered(page, models) })
    await shot(page, 'f1-models-under-forge')
  } finally { await browser.close() }
}
// 3. Settings → AI providers…
{
  const { browser, page } = await start()
  try {
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('menuitem', { name: 'AI providers…', exact: true }).click()
    const ai = page.getByRole('dialog', { name: 'AI provider settings' })
    await ai.waitFor(); await wait(page, 400)
    results.push({ what: 'AI providers dialog', buttons: await covered(page, ai) })
  } finally { await browser.close() }
}
let bad = 0
for (const r of results) {
  const c = r.buttons.filter((b) => b.covered)
  if (c.length) bad++
  console.log(`${r.what}: ${c.length} of ${r.buttons.length} buttons under the Forge panel (${c.map((b) => b.name).join(', ')})`)
}
console.log(bad ? `${bad} of ${results.length} dialogs open under the Radical Forge panel` : 'every dialog opens over the Forge panel')
console.log(`REPRODUCED: ${bad ? 'yes' : 'no'}`)
process.exitCode = bad ? 1 : 0
