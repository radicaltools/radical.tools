// F2: Studio's Radical Forge between two stages (Requirements generated, Continue → offered); the agent's Assay button
// replaces the Forge panel, and the Forge button then opens a new run on an empty Description: the run is lost.
// Bookstore (Radical metamodel) moved to a folder, an AI provider scripted (no network), an active Assay run in .state/assay-run.json.
// Usage: node f2-forge-run-lost-to-assay.mjs [--port 4516]
import { startBrowser, seed, open, saveAsFolder, fixture, opfsWrite, sleep, shot } from './flib.mjs'
const now = () => new Date().toISOString()
const assayStages = ['c4', 'explore', 'documents', 'domain', 'processes', 'states', 'scenarios']
const assayRun = JSON.stringify({ version: 1, client: 'claude-code', repositories: [{ name: 'orders', units: 1, facts: 12 }], sources: 0, startedAt: now(), updatedAt: now(), state: 'active',
  stages: assayStages.map((id, i) => ({ id, status: i === 0 ? 'working' : 'pending' })), proposals: { waiting: 0, accepted: 0, rejected: 0 } })
const b = await startBrowser(); const { page, errors } = b
const forgeState = async () => {
  const p = page.getByRole('dialog', { name: 'Radical Forge' })
  if (!(await p.count())) return 'closed'
  const active = await p.locator('.forge-step.active, .forge-step[aria-current]').allInnerTexts().catch(() => [])
  const done = await p.locator('.forge-step.done').allInnerTexts().catch(() => [])
  const ta = await p.locator('.forge-textarea').inputValue().catch(() => null)
  return { active, done, description: ta?.slice(0, 40) ?? null, buttons: (await p.locator('button:visible').allInnerTexts()).map((t) => t.trim()).filter(Boolean).slice(-4) }
}
try {
  await page.addInitScript(() => {
    localStorage.setItem('radical-studio-settings', JSON.stringify({ setupDone: true }))
    localStorage.setItem('radical-ai-settings', JSON.stringify({ enabled: true, active: 'anthropic', providers: { anthropic: { apiKey: 'e2e', baseUrl: '', model: '' } } }))
  })
  await page.route('https://api.anthropic.com/v1/messages', async (route) => {
    const body = route.request().postDataJSON()
    const reply = (content, stop) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ model: 'claude-haiku-4-5', content, stop_reason: stop, usage: { input_tokens: 10, output_tokens: 10 } }) })
    if (!body.tools) return reply([{ type: 'text', text: '[]' }], 'end_turn')
    const all = JSON.stringify(body.messages)
    if (all.includes('tool_result')) return reply([{ type: 'text', text: 'Done.' }], 'end_turn')
    return reply([1, 2, 3].map((i) => ({ type: 'tool_use', id: `t${i}`, name: 'add_node', input: { tempId: `r${i}`, type: 'requirement', label: `Forged requirement ${i}`, properties: { ears_type: 'ubiquitous', action: `do thing ${i}` } } })), 'tool_use')
  })
  const doc = JSON.parse(fixture('bookstore')); doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} }
  await seed(page, JSON.stringify(doc)); await open(page, 'v-context'); await saveAsFolder(page)
  await page.getByRole('button', { name: 'Open Radical Forge' }).click()
  await page.locator('.forge-textarea').click(); await page.keyboard.type('Readers reserve a book online and pick it up in the shop.')
  await page.getByRole('group', { name: 'Views' }).getByLabel(/Layer canvases/).check()
  await page.getByRole('button', { name: 'Start →' }).click(); await sleep(1200)
  await page.getByRole('button', { name: 'Generate requirements' }).click(); await sleep(3000)
  const before = await forgeState()
  console.log('Forge after Generate requirements:', JSON.stringify(before))
  await opfsWrite(page, '.state/assay-run.json', assayRun)
  await page.locator('.qs-assay-toggle').waitFor({ timeout: 10000 })
  await page.locator('.qs-assay-toggle').click(); await sleep(600)
  console.log('assay panel:', await page.getByRole('dialog', { name: 'Radical Assay — agent run' }).count(), 'forge:', JSON.stringify(await forgeState()))
  await page.keyboard.press('Escape'); await sleep(400)
  await page.getByRole('button', { name: 'Open Radical Forge' }).click(); await sleep(600)
  const after = await forgeState()
  console.log('Forge button after closing the Assay panel:', JSON.stringify(after))
  await shot(page, 'f2-forge-reopened.png')
  const lost = before.active?.[0] === 'Requirements' && after.active?.[0] === 'Description' && after.description === ''
  console.log(lost ? 'The Forge run is lost: Requirements → Description, the description empty' : 'The Forge run is kept')
  console.log(`REPRODUCED: ${lost ? 'yes' : 'no'}`)
  process.exitCode = lost ? 1 : 0
} finally { await b.close() }
