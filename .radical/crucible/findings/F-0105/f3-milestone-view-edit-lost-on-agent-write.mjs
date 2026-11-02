// F3: an agent's write while a milestone with an unsaved view edit is shown throws that view edit away.
// Sample as a folder (OPFS) in Studio's web build; the agent is the MCP server on a disk mirror of it.
// Studio: milestone v3, Core Banking, select Transactions DB, Delete key, "Hide from current view", Continue editing:
// the chip says unsaved. The agent renames Mobile App (on no view shown). Transactions DB is drawn again on v3's
// Core Banking, the chip still says unsaved, and Propagate leaves it on the live Core Banking.
// With "control" as an argument the agent does nothing (Propagate then takes it off the live view).
// Usage: node f3-milestone-view-edit-lost-on-agent-write.mjs --port 4594 [control]
import * as L from './flib.mjs'
const control = process.argv.includes('control')
const { page, errors, close } = await L.startBrowser()
const ag = await L.agent(page)
const drawn = (id) => L.node(page, id).count()
const chip = async () => (await page.locator('.milestone-chip').first().innerText().catch(() => '-')).replace(/\n/g, ' ')
try {
  await L.openSampleFolder(page)
  await L.milestone(page, 'v3 – Full Platform')
  console.log('v3, Core Banking: Transactions DB drawn =', await drawn('ctn-db-tx'))
  await L.node(page, 'ctn-db-tx').click({ position: { x: 14, y: 8 } })
  await page.keyboard.press('Delete'); await page.locator('.milestone-modal').first().waitFor()
  await page.locator('.milestone-modal').getByRole('button', { name: /Hide from current view/ }).click(); await L.sleep(800)
  const cont = page.getByRole('button', { name: /Continue editing/ })
  if (await cont.count()) await cont.click()
  await L.sleep(800)
  console.log('hidden in v3: Transactions DB drawn =', await drawn('ctn-db-tx'), '| chip:', await chip())
  if (!control) {
    const r = await ag.call('update_node', { id: 'ctn-mobile', label: 'Mobile App X' })
    console.log('agent update_node Mobile App -> Mobile App X:', r.ok)
  }
  await L.sleep(6000)
  console.log('6 s later in v3: Transactions DB drawn =', await drawn('ctn-db-tx'), '| chip:', await chip())
  await L.shot(page, control ? 'f3-control.png' : 'f3-after-agent.png')
  await page.locator('.milestone-chip').getByRole('button', { name: 'Propagate' }).click(); await L.sleep(1500)
  await L.milestone(page, 'live')
  console.log('Propagate, Current (live): Transactions DB drawn on Core Banking =', await drawn('ctn-db-tx'))
  await L.sleep(17000)
  const f = await L.opfsFiles(page)
  console.log('saved: live Core Banking lists Transactions DB =', L.json(f, 'views.json').find((v) => v.id === 'view-core').nodeIds.includes('ctn-db-tx'), '| Mobile App label', L.folderNodes(f)['ctn-mobile'])
} finally { console.log('errors', errors.slice(0, 5)); await ag.close(); await close() }
