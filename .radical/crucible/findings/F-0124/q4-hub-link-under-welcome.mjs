// Q4: the Hub's Open in Studio link (/?hub=<id>, no route) opens the Hub import under the Welcome screen.
// node q4-hub-link-under-welcome.mjs [studioPort=4505] [hubPort=4605] [new|returning]
import { launch, wait, out, seedFixture, markSetUp, shot } from './lib.mjs'
const port = +(process.argv[2] ?? 4505), hubPort = +(process.argv[3] ?? 4605), who = process.argv[4] ?? 'returning'
const { browser, context, page, problems } = await launch({ port })
if (who === 'returning') { await seedFixture(context, 'bookstore'); await markSetUp(context) }
// Studio reads the catalogue from hub.radical.tools: answer it from the local Hub build.
await page.route('https://hub.radical.tools/hub/**', async (route) => {
  const u = new URL(route.request().url())
  const response = await route.fetch({ url: `http://localhost:${hubPort}${u.pathname}` })
  await route.fulfill({ response, headers: { ...response.headers(), 'content-type': 'application/json' } })
})
await page.goto('/?hub=concern-authentication'); await wait(page, 3000)
if (who === 'new') { await page.getByRole('button', { name: 'Skip setup' }).click(); await wait(page, 600) }
const r = { who }
r.dialogsOpen = await page.getByRole('dialog').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
r.onTopAtCentre = await page.evaluate(() => { const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return el?.closest('[role=dialog]')?.getAttribute('aria-label') ?? (el?.closest('.welcome-overlay') ? 'Welcome screen' : el?.className) })
r.hubDialogClickable = await page.getByRole('dialog', { name: 'Import from Hub' }).evaluate((d) => { const b = d.getBoundingClientRect(); const el = document.elementFromPoint(b.x + b.width / 2, b.y + 20); return d.contains(el) }).catch(() => 'no dialog')
await shot(page, `q4-hub-link-${who}`)
r.problems = problems
out(r)
console.log(r.dialogsOpen.includes('Import from Hub') && r.onTopAtCentre === 'Welcome screen' ? 'REPRODUCED' : 'NOT REPRODUCED')
await browser.close()
