// The Inspector's "Answer the questions…" on the Authentication concern of Storefront, then Add to model:
// the pack's 20 elements are listed in the view Designer last showed ("Payments", which shows only
// Payment Provider), unseen, besides the pack's own view in Concerns.
// Usage (Studio and the Hub served): node f1-inspector-pack-into-open-view.mjs [--port 4511] [--hub 4611]
import { startBrowser, sleep, designer, shot, opfsFiles, opfsWrite, openViewCard, workDir, diskFiles, ready, viewsOf, BASE } from './lib.mjs'
import { buildShop } from './shopc4.mjs'
import { join } from 'node:path'
const dir = join(await workDir('c4-'), 'model')
await buildShop(dir) // Customer, Shop {Storefront, Orders API, Orders DB}, Payment Provider; views Shop (6) and Payments (Payment Provider)
const testResults = JSON.stringify({ version: 1, readAt: new Date().toISOString(), reports: ['reports/unit.json'], cases: [{ file: '/repo/tests/pay.test.ts', title: ['pays by card'], status: 'passed' }] })
const { page, close } = await startBrowser()
const persp = (name) => page.locator('.toolbar-mode-btn', { hasText: name }).click()
const payments = async () => viewsOf(await opfsFiles(page)).find((v) => v.name === 'Payments')?.nodeIds?.length
let bug = false
try {
  await page.goto(BASE + '/')
  for (const [p, c] of Object.entries(await diskFiles(dir))) if (!p.endsWith('agent-activity.json')) await opfsWrite(page, p, c)
  await opfsWrite(page, '.state/test-results.json', testResults)
  await page.reload()
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await page.locator('.welcome-overlay').waitFor({ state: 'hidden', timeout: 60000 })
  await ready(page); await designer(page)
  await openViewCard(page, 'Payments'); await sleep(1500)
  const drawnBefore = await page.locator('.react-flow__node').count()
  console.log('Designer, view Payments: drawn', drawnBefore, '; saved Payments lists', await payments())
  await persp('Inspector'); await sleep(2500)
  await page.locator('details[data-rule="concern-unaddressed"] > summary').click(); await sleep(400)
  const more = page.getByRole('button', { name: /^Show \d+ more/ }); if (await more.count()) await more.first().click()
  await page.locator('.insp-finding').filter({ hasText: 'Authentication:' }).first().getByRole('button', { name: 'Answer the questions…' }).click()
  const wiz = page.getByTestId('concern-wizard'); await wiz.waitFor()
  await wiz.getByRole('button', { name: 'Add to model' }).click()
  await wiz.waitFor({ state: 'detached' }); await sleep(6000)
  const savedAfter = await payments()
  await persp('Designer'); await sleep(2500)
  const drawnAfter = await page.locator('.react-flow__node').count()
  await shot(page, 'f1-payments-after.png')
  console.log('After Add to model in the Inspector: saved Payments lists', savedAfter, '; Designer, view Payments: drawn', drawnAfter)
  bug = savedAfter > 1 || drawnAfter > drawnBefore
} finally { await close() }
console.log(`REPRODUCED: ${bug ? 'yes' : 'no'}`)
process.exit(bug ? 1 : 0)
