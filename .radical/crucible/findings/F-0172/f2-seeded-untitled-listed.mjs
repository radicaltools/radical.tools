// F2: after a first visit (Skip setup, then the sample), Models > Manage models lists an "Untitled"
// model the user never made, while the Welcome screen's "In this browser…" leaves it out.
// node f2-seeded-untitled-listed.mjs [studioPort=4515]
import { launch, wait, out, shot, settle } from './lib.mjs'
const port = +(process.argv[2] ?? 4515)
const { browser, page, problems } = await launch({ port })
const r = {}
await page.goto('/'); await wait(page, 3000)
await page.getByRole('button', { name: 'Skip setup' }).click(); await wait(page, 600)
await page.getByRole('button', { name: 'Open', exact: true }).click(); await wait(page, 400)
r.welcomeInThisBrowser = (await page.locator('.welcome-right').innerText()).match(/In this browser…\s*\n?\s*([^\n]+)/)?.[1]
await page.getByRole('button', { name: /Sample model/ }).click()
await page.waitForURL(/\/v\/view-ctx$/); await settle(page)
await page.reload(); await wait(page, 3000)
// A reload with the address of the sample opens it; Models > Manage models…
await page.getByRole('button', { name: 'Models', exact: true }).click(); await wait(page, 300)
await page.locator('[role=menuitem]', { hasText: 'Manage models' }).click(); await wait(page, 600)
const dlg = page.locator('[role=dialog][aria-modal=true]')
r.managerRows = await dlg.locator('text=This browser').evaluateAll(els => els.map(e => e.parentElement?.parentElement?.innerText.split('\n')[0]))
r.managerText = (await dlg.innerText()).replace(/\n/g, ' · ').slice(0, 300)
await shot(page, 'f2-manage-models-untitled')
r.index = JSON.parse(await page.evaluate(() => localStorage.getItem('radical-docs-index'))).docs.map(d => ({ name: d.name, seeded: !!d.seeded }))
r.problems = problems
out(r)
await browser.close()
const listed = /Untitled/.test(r.managerText) && r.index.some(d => d.name === 'Untitled' && d.seeded)
console.log(`Manage models lists the first visit's seeded Untitled: ${listed}`)
console.log(`REPRODUCED: ${listed ? 'yes' : 'no'}`)
process.exit(listed ? 1 : 0)
