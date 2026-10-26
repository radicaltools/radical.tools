// What happens to a name being typed when F5 starts the presentation, field by field.
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4599)
const { page, problems, close } = await L.launch({ port })
page.setDefaultTimeout(8000)
const saved = (id, nid) => page.evaluate(([id, nid]) => JSON.parse(localStorage.getItem('radical-doc:' + id)).nodes.find(n => n.id === nid)?.label, [id, nid])
const f5 = async () => { await page.keyboard.press('F5'); await L.wait(page, 600); const p = await page.locator('.mode-presenting').count(); await page.keyboard.press('Escape'); await L.wait(page, 800); return p }
try {
  const id = await L.openSample(page)
  const base = page.url().replace(/\/v\/.*$/, '')
  // 1 Table (Requirements Register) rename
  await page.goto(base + '/v/view-register'); await page.locator('.tv-row').first().waitFor(); await L.wait(page, 400)
  const row = page.locator('tr[data-node-id]').first(); const rid = await row.getAttribute('data-node-id')
  await row.click(); await page.keyboard.press('F2'); await page.locator('.tv-cell-input').waitFor(); await page.keyboard.press('End'); await page.keyboard.type(' XYZ')
  const p1 = await f5()
  await L.wait(page, 2500); console.log('table name: presenting', p1, 'input open', await page.locator('.tv-cell-input').count(), 'saved', await saved(id, rid), 'row', await page.locator(`tr[data-node-id="${rid}"]`).first().innerText().catch(() => '-'))
  // 2 Properties card name
  await page.goto(base + '/v/view-ctx'); await L.settle(page)
  const n = page.locator('.react-flow__node').first(); const nid = await n.getAttribute('data-id')
  await n.dblclick(); await L.wait(page, 500)
  const nameField = page.locator('input').filter({ hasNot: page.locator('[role=search] input') })
  const card = page.getByLabel('Name', { exact: true }).first()
  console.log(' card name field', await card.count(), await card.evaluate(e => e.tagName + ' ' + e.className).catch(() => '-'))
  if (await card.count()) {
    await card.click(); await page.keyboard.press('End'); await page.keyboard.type(' XYZ')
    const p2 = await f5()
    await L.wait(page, 2500); console.log('card name: presenting', p2, 'saved', await saved(id, nid), 'node', await page.locator(`.react-flow__node[data-id="${nid}"]`).innerText())
  }
  await L.shot(page, 'e5')
} finally { console.log('problems', problems); await close() }
