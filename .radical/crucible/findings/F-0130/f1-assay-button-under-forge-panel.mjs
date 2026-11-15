// F1: with the agent's Forge panel open, a click on the Assay button does nothing; the Assay panel then opens by itself
// when the Forge panel is closed (Escape or its Close button). The other way round too.
// Bookstore fixture moved to a folder; an agent's finished Forge run and an active Assay run on it (.state/*.json, written
// as the MCP server writes them). Usage: node f1-assay-button-under-forge-panel.mjs [--port 4506]
import { startBrowser, seed, open, saveAsFolder, fixture, opfsWrite, sleep, shot } from './flib.mjs'

const now = () => new Date().toISOString()
const forgeStages = ['requirements', 'domain', 'fitness', 'scenarios', 'states', 'processes', 'mockups', 'c4', 'review']
const forgeRun = JSON.stringify({
  version: 1, client: 'claude-code', need: { id: 'n1', label: 'Click & collect' }, startedAt: now(), updatedAt: now(), state: 'finished',
  stages: forgeStages.map((id) => ({ id, status: 'done', summary: `${id} done`, added: { nodes: 1, relations: 0 } })),
})
const assayStages = ['c4', 'explore', 'documents', 'domain', 'processes', 'states', 'scenarios']
const assayRun = JSON.stringify({
  version: 1, client: 'claude-code', repositories: [{ name: 'orders', units: 1, facts: 12 }], sources: 0, startedAt: now(), updatedAt: now(), state: 'active',
  stages: assayStages.map((id, i) => ({ id, status: i === 0 ? 'working' : 'pending' })), proposals: { waiting: 0, accepted: 0, rejected: 0 },
})

const b = await startBrowser()
const { page, errors } = b
let bad = 0
try {
  await seed(page, fixture('bookstore'))
  await open(page, 'v-context')
  await saveAsFolder(page)
  await opfsWrite(page, '.state/forge-run.json', forgeRun)
  await opfsWrite(page, '.state/assay-run.json', assayRun)
  const forgeBtn = page.locator('.qs-forge-toggle:not(.qs-assay-toggle)')
  const assayBtn = page.locator('.qs-assay-toggle')
  await assayBtn.waitFor({ timeout: 10000 })
  await page.waitForFunction(() => document.querySelector('.qs-forge-toggle:not(.qs-assay-toggle)')?.getAttribute('data-agent-phase') === 'done', null, { timeout: 10000 })
  const forgePanel = page.getByRole('dialog', { name: 'Radical Forge — agent run' })
  const assayPanel = page.getByRole('dialog', { name: 'Radical Assay — agent run' })
  const state = async () => ({ forge: await forgePanel.count(), assay: await assayPanel.count() })
  const step = async (label, want) => {
    await sleep(500)
    const got = await state()
    const ok = got.forge === want.forge && got.assay === want.assay
    if (!ok) bad++
    console.log(`${ok ? 'ok ' : 'BAD'} ${label}: forge panel ${got.forge}, assay panel ${got.assay} (expected ${want.forge}, ${want.assay})`)
  }

  await forgeBtn.click()
  await step('click the Forge button (finished run)', { forge: 1, assay: 0 })
  await assayBtn.click()
  await step('click the Assay button while the Forge panel is open', { forge: 0, assay: 1 })
  await shot(page, 'f1-assay-click-under-forge.png')
  await page.keyboard.press('Escape')
  await step('Escape', { forge: 0, assay: 0 })
  await shot(page, 'f1-after-escape.png')
  await page.keyboard.press('Escape')
  await step('Escape again', { forge: 0, assay: 0 })

  await assayBtn.click()
  await step('click the Assay button', { forge: 0, assay: 1 })
  await forgeBtn.click()
  await step('click the Forge button while the Assay panel is open', { forge: 1, assay: 0 })
  await forgePanel.getByRole('button', { name: 'Close' }).click()
  await step("the Forge panel's Close button", { forge: 0, assay: 0 })
  if (errors.length) console.log('errors', errors)
  console.log(bad ? `REPRODUCED: ${bad} steps differ` : 'not reproduced')
} finally {
  await b.close()
}
process.exitCode = bad ? 1 : 0
