// Sample model moved to a folder (Models → Actions → Move to a folder…), Requirements Register (table).
// + under "Retail payments brief" opens Add or link; type "Four-eyes": Existing lists Four-eyes approval.
// While it is open, an outside edit (git, an editor, an agent) removes that requirement from the folder:
// its file and its relations. Studio reloads (283 → 282 nodes); the picker stays open and still lists
// it. Pick it: Studio writes a relation to the missing element into relations.json, and Validation
// then flags it.   Args: [port=4581]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4581)
const { browser, page, problems } = await L.launchFolder({ port })
try {
  await L.openSample(page)
  await L.moveToFolder(page)
  await L.tab(page, 'Views')
  await page.locator('.lp-view-card', { hasText: 'Requirements Register' }).first().click()
  await L.wait(page, 2000)
  let files = await L.folderFiles(page)
  const [path, text] = Object.entries(files).find(([p, t]) => p.startsWith('nodes/') && /^label: "Four-eyes approval"/m.test(t))
  const nid = text.match(/^id: "([^"]+)"/m)[1]
  const before = await L.counts(page)
  await page.getByRole('button', { name: 'Add under Retail payments brief', exact: true }).click()
  await page.keyboard.type('Four-eyes')
  const picker = page.getByRole('dialog', { name: 'Add under Retail payments brief' })
  const listedBefore = await picker.locator('.add-picker-row:not(.new) .add-picker-row-label').allInnerTexts()
  // The outside edit.
  const rels = JSON.parse(files['relations.json'])
  await L.folderWrite(page, 'relations.json', JSON.stringify(rels.filter((r) => r.sourceId !== nid && r.targetId !== nid), null, 2) + '\n')
  await L.folderRemove(page, path)
  let after = before
  for (let i = 0; i < 40 && after === before; i++) { await L.wait(page, 500); after = await L.counts(page) }
  const pickerOpen = await picker.isVisible()
  const listedAfter = pickerOpen ? await picker.locator('.add-picker-row:not(.new) .add-picker-row-label').allInnerTexts() : []
  await L.shot(page, 'f2-picker-after-outside-edit')
  if (pickerOpen && listedAfter.includes('Four-eyes approval')) await picker.getByRole('option', { name: 'Four-eyes approval' }).click()
  await L.wait(page, 4000)
  const notes = await L.notices(page)
  files = await L.folderFiles(page)
  const dangling = JSON.parse(files['relations.json']).filter((r) => r.sourceId === nid || r.targetId === nid)
  const v = await L.validation(page)
  await L.shot(page, 'f2-after-pick')
  L.out({ removedOutside: `${path} (id ${nid})`, searchBarBefore: before, searchBarAfterReload: after, pickerStillOpen: pickerOpen, listedBefore, listedAfter,
    notices: notes, relationsToMissingElementInFolder: dangling, validation: v.count, validationMessages: v.messages })
} finally { console.log('problems', problems); await browser.close() }
