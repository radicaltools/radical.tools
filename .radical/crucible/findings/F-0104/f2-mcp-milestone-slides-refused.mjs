// F2: Studio shows a milestone's own views (kept since the live model deleted what they show) and plays slides
// of them, but the MCP server and `radical check` judge a milestone's slide against the live views:
//  - create_presentation: a slide of Payment lifecycle in milestone M -> "unknown viewId"
//  - update_presentation: focus on a state on the slide Studio made of it -> "without viewId it shows the All elements table"
//  - create_presentation: a slide of Core Banking in v3 focused on Fraud Detection -> "not in view Core Banking"
//  - radical check: "Slide … shows view view-payment-lifecycle, which the model does not have"
// Sample model as a folder (OPFS) in Studio's web build; the agent is the MCP server on a disk mirror of it.
// Usage: node f2-mcp-milestone-slides-refused.mjs --port 4594
import * as L from './flib.mjs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
const { page, errors, close } = await L.startBrowser()
const ag = await L.agent(page)
const SM = '789719df-db16-4f7d-95cd-c9c244fbd575' // the Payment lifecycle state machine
try {
  await L.openSampleFolder(page)
  let r = await ag.call('create_milestone', { name: 'M' }); const M = /\(([0-9a-f-]{36})\)/.exec(r.text)[1]
  console.log('agent create_milestone:', r.ok, r.text.slice(0, 70))
  await L.sleep(4000)
  r = await ag.call('delete_node', { id: SM }); console.log('agent delete_node Payment lifecycle:', r.ok)
  await L.sleep(4000)
  r = await ag.call('delete_node', { id: 'ctn-fraud' }); console.log('agent delete_node Fraud Detection:', r.ok)
  await L.sleep(4000)
  // Studio: milestone v3 still has Fraud Detection on Core Banking
  await L.milestone(page, 'v3 – Full Platform')
  await L.openViewCard(page, 'Core Banking')
  console.log('Studio, v3, Core Banking: Fraud Detection drawn =', await L.node(page, 'ctn-fraud').count())
  await L.shot(page, 'f2-v3-core-banking.png')
  await L.milestone(page, 'live')
  // Studio Presenter: milestone M, its view Payment lifecycle, Add slide
  await page.locator('.toolbar-mode-btn', { hasText: 'Presenter' }).click(); await L.sleep(1500)
  await L.milestone(page, 'M')
  await L.openViewCard(page, 'State machines')
  await page.locator('.lp-group-body .lp-view-card', { hasText: 'Payment lifecycle' }).first().click(); await L.sleep(1500)
  console.log('Studio Presenter, M, Payment lifecycle: drawn =', (await L.nodeIds(page)).length)
  await page.getByRole('button', { name: /Add slide/ }).click()
  await L.sleep(18000) // Studio holds its saves 15 s after an agent's write
  const files = await L.opfsFiles(page)
  const pres = L.json(files, 'presentations.json')[0]
  const slide = pres.slides.at(-1)
  console.log(`Studio saved slide "${slide.name}": viewId ${slide.viewId}, milestone M: ${slide.snapshotId === M}`)
  // The agent
  const state = Object.values(L.json(files, 'snapshots.json').find((s) => s.id === M).nodes).find((n) => n.parentId === SM && n.type === 'state')
  r = await ag.call('create_presentation', { name: 'P', slides: [{ name: 'Payment lifecycle in M', viewId: 'view-payment-lifecycle', milestone: M }] })
  console.log('agent, slide of Payment lifecycle in M:', r.ok, '-', r.text)
  r = await ag.call('update_presentation', { id: pres.id, slides: pres.slides.map((s) => (s.id === slide.id ? { id: s.id, name: s.name, focus: [state.id] } : { id: s.id, name: s.name })) })
  console.log(`agent, focus on "${state.label}" on Studio's slide:`, r.ok, '-', r.text)
  r = await ag.call('create_presentation', { name: 'P', slides: [{ name: 'Fraud in v3', viewId: 'view-core', milestone: 'snap-v3', focus: ['ctn-fraud'] }] })
  console.log('agent, slide of Core Banking in v3 focused on Fraud Detection:', r.ok, '-', r.text)
  // radical check on the agent's copy of the folder
  await ag.call('list_milestones', {}, { writeBack: false })
  let out = ''
  try { out = execFileSync(process.execPath, [join(L.REPO, 'apps/cli/dist/index.js'), 'check', ag.disk], { encoding: 'utf8' }) } catch (e) { out = String(e.stdout) }
  console.log('radical check:', out.split('\n').filter((l) => /Slide|presentations/.test(l)).join('\n') || '(nothing about slides)')
} finally { console.log('errors', errors.slice(0, 5)); await ag.close(); await close() }
