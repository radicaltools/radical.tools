// F2: another program deletes one element's file (its relations stay listed in relations.json, as an editor or a
// file manager leaves them) while the user has an unsaved edit of another element: the merge notice says the
// relations of the deleted element were made in Studio and dropped, though the user drew none of them.
// The sample model moved to a folder (OPFS), Core Banking, rename Accounts DB in its card, Event Bus's file deleted.
//   node f2-merge-notice-blames-studio.mjs [--port 4512] [--control]
import { startBrowser, openSampleFolder, opfsFiles, sleep, shot, nodeFile, goView, caretEnd, waitFor, opfsRemove, node, notices, folderNodes } from './lib.mjs'
const control = process.argv.includes('--control')
const b = await startBrowser()
const { page, errors, logs } = b
let reproduced = true
try {
  await openSampleFolder(page)
  await goView(page, 'view-core')
  await sleep(1000)
  let files = await opfsFiles(page)
  const A = 'ctn-evtbus', B = 'ctn-db-acc'
  const rels = JSON.parse(files['relations.json']).filter((r) => r.sourceId === A || r.targetId === A)
  console.log(`Event Bus has ${rels.length} relations in relations.json; the user edits none of them`)
  await node(page, B).dblclick()
  const name = page.locator('.right-panel.open').getByLabel('Name', { exact: true })
  await name.click(); await caretEnd(name)
  await page.keyboard.type(' abc', { delay: 60 })
  if (!control) {
    await opfsRemove(page, nodeFile(files, A).path)
    console.log('Studio reloaded the folder:', await waitFor(async () => logs.some((l) => /changed on disk/.test(l)), 15000, 100))
  }
  await sleep(1000)
  await page.keyboard.press('Tab')
  await sleep(6000)
  const shown = (await notices(page)).filter((m) => /merged/.test(m))
  for (const m of shown) console.log('notice:', m.slice(0, 600))
  const blamed = shown.join(' ').match(/the relation [^;]*? made to it in Studio was dropped/g) ?? []
  const more = Number(/and (\d+) more/.exec(shown.join(' '))?.[1] ?? 0)
  console.log(`relation changes the notice says Studio made and lost: ${blamed.length}${more ? ` (+${more} more items)` : ''}; made by the user: 0`)
  files = await opfsFiles(page)
  console.log('saved Accounts DB:', JSON.stringify(folderNodes(files)[B]))
  await shot(page, control ? 'f2-control.png' : 'f2-merge-notice.png')
  reproduced = blamed.length > 0
  if (errors.length) console.log('errors', errors)
} finally { await b.close() }
console.log(`REPRODUCED: ${reproduced ? 'yes' : 'no'}`)
process.exitCode = reproduced ? 1 : 0
