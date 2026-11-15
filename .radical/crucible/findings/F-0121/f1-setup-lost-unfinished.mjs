// F1: the Setup wizard of a first start, neither finished nor skipped, never opens again
// once the tab is reloaded or closed and Studio opened again.
// node f1-setup-lost-unfinished.mjs [studioPort=4505]
import { launch, wait, shot, out } from './lib.mjs'
const port = +(process.argv[2] ?? 4505)
const { browser, context, page, problems } = await launch({ port })
const wizard = (p) => p.getByRole('dialog', { name: 'Set up Radical Studio' })
await page.goto('/'); await wait(page, 2000)
const r = { firstStart: await wizard(page).isVisible() }
r.storedAfterFirstLoad = await page.evaluate(() => ({ settings: localStorage.getItem('radical-studio-settings'), theme: localStorage.getItem('radical-theme'), docs: JSON.parse(localStorage.getItem('radical-docs-index') ?? '{"docs":[]}').docs.map((d) => d.name) }))
// Nothing chosen, nothing skipped: the user closes the tab and comes back.
await page.close()
const again = await context.newPage()
again.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
await again.goto('/'); await wait(again, 2000)
r.wizardOnReturn = await wizard(again).isVisible()
r.storedOnReturn = await again.evaluate(() => localStorage.getItem('radical-studio-settings'))
await shot(again, 'f1-no-wizard-on-return')
r.problems = problems
out(r)
console.log(r.firstStart && !r.wizardOnReturn ? 'REPRODUCED' : 'NOT REPRODUCED')
await browser.close()
