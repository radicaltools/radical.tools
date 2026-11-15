// The Inspector's "Answer the questions…" on an unaddressed concern, then Add to
// model: is the pack saved, and is it still there in Designer?
// The shop model is built through the MCP server in work/shop beside this script.
// Usage: node f1-inspector-import-lost.mjs <studioPort> <hubPort>
import { launchFolder, copyToOpfs, writeOpfs, readOpfs, openFolder, testResults, settle, wait, shot, out, arg, DIR } from './lib.mjs'
import { join } from 'node:path'
import { buildShop } from './shop.mjs'
const port = arg(0, '4507'), hubPort = arg(1, '4607'), src = join(DIR, 'work/shop')
await buildShop(src)
const { browser, page, problems } = await launchFolder({ port, hubPort })
const log = []
const saved = async () => {
  const files = await readOpfs(page)
  const views = JSON.parse(files['views.json'] ?? '{}')
  return { nodeFiles: Object.keys(files).filter((f) => f.startsWith('nodes/') && f.endsWith('.md')).length, views: (views.views ?? views).map?.((v) => v.name) }
}
const count = async () => (await page.locator('.insp').innerText()).match(/(\d+) elements/)?.[1]
try {
  await page.goto('/')
  await copyToOpfs(page, src)
  await writeOpfs(page, '.state/test-results.json', testResults())
  await openFolder(page)
  await page.getByRole('button', { name: /^Inspector/ }).click()
  await wait(page, 2500)
  log.push({ step: 'Inspector opened', inspectorElements: await count(), saved: await saved() })
  await page.locator('details, [data-rule]').filter({ hasText: 'Concern unaddressed' }).first().click()
  const finding = page.locator('.insp-finding').filter({ hasText: 'Authentication:' }).first()
  await finding.getByRole('button', { name: 'Answer the questions…' }).click()
  const wiz = page.getByTestId('concern-wizard')
  await wiz.getByRole('button', { name: 'Add to model' }).click()
  await wiz.waitFor({ state: 'detached' })
  await wait(page, 2000)
  log.push({ step: 'Add to model', mode: (await page.locator('.toolbar-mode-btn.active').innerText()).split('\n')[0], inspectorElements: await count() })
  await shot(page, 'f1-inspector-after-import')
  await wait(page, 5000)
  log.push({ step: '7 s later, still in the Inspector', saved: await saved() })
  await page.getByRole('button', { name: 'Designer', exact: true }).click()
  await settle(page); await wait(page, 1000)
  await page.getByRole('tab', { name: 'Views' }).click().catch(() => {})
  log.push({ step: 'Designer', viewCards: await page.locator('.lp-view-card').evaluateAll((els) => els.map((e) => e.textContent.trim().slice(0, 40))), saved: await saved() })
  await shot(page, 'f1-designer')
} finally {
  out({ log, problems })
  await browser.close()
}
