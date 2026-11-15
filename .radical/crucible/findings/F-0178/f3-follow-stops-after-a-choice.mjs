// F3 (question): Follow on the canvas stops following after a value is picked in a drop-down of the card: the focus
// stays on the drop-down, which counts as a field being typed in, and the agent's writes wait until the user clicks
// somewhere else. The sample model moved to a folder (OPFS); an agent's Forge run (.state/forge-run.json) followed on
// the canvas; Requirements Traceability; Four-eyes approval's card: pick another EARS type; the agent renames Event Bus.
//   node f3-follow-stops-after-a-choice.mjs [--port 4512] [--control]
import { startBrowser, openSampleFolder, opfsFiles, sleep, shot, renameOutside, goView, waitFor, opfsWrite, node } from './lib.mjs'
const control = process.argv.includes('--control')
const b = await startBrowser()
const { page, errors, logs } = b
let reproduced = true
try {
  await openSampleFolder(page)
  await goView(page, 'view-trace')
  await sleep(1500)
  const now = new Date().toISOString()
  await opfsWrite(page, '.state/forge-run.json', JSON.stringify({
    version: 1, client: 'claude-code', need: { id: 'n1', label: 'Click & collect' }, startedAt: now, updatedAt: now, state: 'active',
    stages: ['requirements', 'domain', 'fitness', 'scenarios', 'states', 'processes', 'mockups', 'c4', 'review']
      .map((id, i) => ({ id, status: i === 0 ? 'done' : i === 1 ? 'generating' : 'pending', ...(i === 0 ? { summary: 'requirements', added: { nodes: 1, relations: 0 } } : {}) })),
  }))
  const button = page.locator('.qs-forge-toggle')
  await waitFor(async () => (await button.getAttribute('data-agent-phase')) === 'working', 15000)
  await button.click()
  await page.getByRole('button', { name: 'Follow on the canvas' }).click()
  await sleep(500)
  const viewName = () => page.locator('.lp-view-card.active .lp-card-title').innerText().catch(() => '?')
  await node(page, 'req-dual-approval').dblclick()
  const panel = page.locator('.right-panel.open')
  const sel = panel.getByLabel('EARS type')
  await sel.waitFor()
  if (!control) {
    await sel.focus()
    const cur = await sel.inputValue()
    const opts = await sel.locator('option').evaluateAll((els) => els.map((e) => e.value))
    await sel.selectOption(opts.find((o) => o && o !== cur))
  }
  await sleep(500)
  const focus = await page.evaluate(() => `${document.activeElement?.tagName} ${document.activeElement?.getAttribute('aria-label') ?? ''}`.trim())
  console.log('open view:', await viewName(), '| focus on', focus)
  const files = await opfsFiles(page)
  await opfsWrite(page, '.state/agent-activity.json', JSON.stringify({ client: 'claude-code', at: new Date().toISOString() }))
  await renameOutside(page, files, 'ctn-evtbus', ' (by the agent)')
  console.log('Studio reloaded the folder:', await waitFor(async () => logs.some((l) => /changed on disk/.test(l)), 15000, 100))
  await sleep(4000)
  const after = await viewName()
  console.log('5 s after the agent renamed Event Bus (shown in Core Banking): open view', after)
  await shot(page, control ? 'f3-control.png' : 'f3-follow-stopped.png')
  reproduced = after === 'Requirements Traceability'
  if (errors.length) console.log('errors', errors)
} finally { await b.close() }
console.log(`REPRODUCED: ${reproduced ? 'yes' : 'no'}`)
process.exitCode = reproduced ? 1 : 0
