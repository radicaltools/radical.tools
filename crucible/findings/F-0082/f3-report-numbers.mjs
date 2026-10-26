// f3: For the same layout, MCP smart_layout tells the agent "crossings 76 -> 75, overdraws 13 -> 22" (worse)
// while Studio tells the user "crossings 44 → 21"; the positions are identical.
// Sample model (Open → Sample model) moved to a folder; the MCP server works on a disk copy (not written back).
// 1. open the view in Designer, 2. MCP smart_layout { viewId }, 3. Studio Smart Layout, 4. compare positions and reports.
// node f3-report-numbers.mjs [--port N] [--view view-encryption-in-transit-and-at-rest]
import { startBrowser, open, saveAsFolder, agent, sleep, opfsFiles, viewPositions, diffPositions, smartLayout, shot, BASE, layoutIdle } from './lib.mjs'

const vi = process.argv.indexOf('--view')
const viewId = vi > 0 ? process.argv[vi + 1] : 'view-encryption-in-transit-and-at-rest'
const { page, errors, logs, close } = await startBrowser()
try {
  await page.goto(BASE + '/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: /Sample model/ }).click()
  await sleep(3000)
  const docId = decodeURIComponent(page.url()).match(/ls:([^/]+)/)[1]
  const docName = await page.evaluate((id) => JSON.parse(localStorage.getItem('radical-docs-index')).docs.find((d) => d.id === id).name, docId)
  await open(page, viewId, 'designer', docId)
  await saveAsFolder(page, docName)
  await layoutIdle(page); await sleep(4000)
  const a = await agent(page)
  const m = await a.call('smart_layout', { viewId }, { writeBack: false })
  const s = await smartLayout(page, logs)
  await layoutIdle(page); await sleep(3000)
  const d = diffPositions(viewPositions(m.after, viewId), viewPositions(await opfsFiles(page), viewId), 1)
  await page.locator('button[title^="Why this layout?"]').first().click()
  await sleep(500)
  const rows = await page.locator('.smart-layout-report-parts tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.children].map((td) => td.innerText).join(' ')))
  await shot(page, 'f3-why.png')
  console.log('MCP smart_layout says:', m.text.slice(0, 200))
  console.log('Studio says:', s.notice)
  console.log('Studio "Why this layout?":', rows.filter((r) => /Crossings|Lines over|brushing/i.test(r)).join(' | '))
  console.log('positions that differ between the two:', d.length)
  console.log('errors', errors.slice(0, 5))
  await a.close()
} finally { await close() }
