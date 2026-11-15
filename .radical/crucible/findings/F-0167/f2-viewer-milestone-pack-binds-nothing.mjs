// Viewer shows milestone "v1", which still has Storefront (deleted from the live model since).
// Models → Import from Hub… → Authentication → Add to Model: the wizard offers Storefront, ticked and
// "Suggested"; Add to model takes Studio to Designer (the live model) and the pack's decisions and
// checks constrain nothing, without a word. Viewed on the live model the same import binds them.
// Usage (Studio and the Hub served): node f2-viewer-milestone-pack-binds-nothing.mjs [--port 4511] [--hub 4611]
import { startBrowser, sleep, designer, shot, opfsFiles, opfsWrite, openViewCard, notices, workDir, diskFiles, ready, milestone, BASE } from './lib.mjs'
import { buildShop } from './shopc4.mjs'
import { connect } from './mcp.mjs'
import { join } from 'node:path'
const dir = join(await workDir('c4-'), 'model')
await buildShop(dir)
{ const m = await connect(dir)
  await m.call('create_milestone', { name: 'v1' })
  const web = Object.entries(await diskFiles(dir)).find(([p, c]) => p.startsWith('nodes/') && /label:\s*"?Storefront/.test(c))
  await m.call('delete_node', { id: /^id:\s*"?([^"\n]+)/m.exec(web[1])[1] })
  await m.close() }
const { page, close } = await startBrowser()
let bug = false
try {
  await page.goto(BASE + '/')
  for (const [p, c] of Object.entries(await diskFiles(dir))) if (!p.endsWith('agent-activity.json')) await opfsWrite(page, p, c)
  await page.reload()
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await page.locator('.welcome-overlay').waitFor({ state: 'hidden', timeout: 60000 })
  await ready(page); await designer(page)
  await openViewCard(page, 'Shop'); await sleep(1000)
  await page.locator('.toolbar-mode-btn', { hasText: 'Viewer' }).click(); await sleep(1500)
  await milestone(page, 'v1')
  console.log('Viewer on milestone v1: drawn', await page.locator('.react-flow__node').count())
  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await page.getByText(/Import from Hub/).first().click()
  const dialog = page.locator('[aria-label="Import from Hub"]'); await dialog.waitFor()
  await dialog.getByPlaceholder('Search concern packs…').pressSequentially('Authentication')
  await dialog.locator('li.hi-pack', { has: page.getByRole('heading', { name: 'Authentication', exact: true }) }).getByRole('button', { name: 'Add to Model' }).click()
  const wiz = page.getByTestId('concern-wizard'); await wiz.waitFor(); await sleep(500)
  const scope = await wiz.getByRole('checkbox').evaluateAll((els) => els.map((e) => `${e.getAttribute('aria-checked') ?? e.checked} ${e.textContent.trim().slice(0, 40)}`))
  console.log('Where it applies:', scope.filter((s) => s.startsWith('true')))
  await shot(page, 'f2-wizard-offers-storefront.png')
  await wiz.getByRole('button', { name: 'Add to model' }).click()
  await wiz.waitFor({ state: 'detached' }); await sleep(6000)
  const files = await opfsFiles(page)
  const rj = JSON.parse(files['relations.json']); const rels = rj.relations ?? rj
  const constrains = rels.filter((r) => (r.relationType ?? r.type) === 'constrains').length
  const packNodes = Object.keys(files).filter((p) => p.startsWith('nodes/') && p.endsWith('.md')).length
  const said = (await notices(page)).filter((n) => !/not laid out/.test(n))
  console.log('After Add to model:', (await page.locator('.toolbar-mode-btn.active').innerText()).split('\n')[0], '; saved elements', packNodes, '; constrains relations saved', constrains, '; notices', said)
  bug = scope.some((s) => s.startsWith('true') && s.includes('Storefront')) && constrains === 0 && said.length === 0
} finally { await close() }
console.log(`REPRODUCED: ${bug ? 'yes' : 'no'}`)
process.exit(bug ? 1 : 0)
