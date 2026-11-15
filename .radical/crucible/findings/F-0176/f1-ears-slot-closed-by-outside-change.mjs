// F1: a requirement's card, its EARS sentence: the slot being typed in closes, and what was typed is lost,
// when another program (an agent, git, an editor) changes any element of the folder meanwhile.
// The sample model moved to a folder (OPFS), Requirements Register (table), double-click 'Four-eyes approval',
// click the action slot of its sentence, type ' abc', another program renames a different element in its file,
// Studio reloads the folder, type ' def', Enter.
//   node f1-ears-slot-closed-by-outside-change.mjs [--port 4512] [--control]
import { startBrowser, openSampleFolder, opfsFiles, sleep, shot, renameOutside, nodeFile, goView, caretEnd, waitFor } from './lib.mjs'
const control = process.argv.includes('--control')
const b = await startBrowser()
const { page, errors, logs } = b
let reproduced = true
try {
  await openSampleFolder(page)
  await goView(page, 'view-register')
  let files = await opfsFiles(page)
  const A = 'req-dual-approval', B = 'need-corporate-feedback'
  await page.locator(`tr[data-node-id="${A}"]`).first().dblclick()
  const panel = page.locator('.right-panel.open')
  await panel.waitFor()
  const slot = panel.locator('.ears-slot-sm', { hasText: 'second authorised signatory' })
  const before = await slot.innerText()
  await slot.click()
  const input = panel.locator('.ears-slot-input-sm')
  await input.waitFor()
  await caretEnd(input)
  await page.keyboard.type(' abc', { delay: 60 })
  if (!control) {
    await renameOutside(page, files, B)
    const seen = await waitFor(async () => logs.some((l) => /changed on disk/.test(l)), 15000, 100)
    console.log('Studio reloaded the folder:', seen)
    await sleep(1000)
  }
  await page.keyboard.type(' def', { delay: 60 })
  const open = await input.count()
  const field = open ? await input.inputValue() : null
  const focus = await page.evaluate(() => `${document.activeElement?.tagName}.${document.activeElement?.className}`)
  await shot(page, control ? 'f1-control.png' : 'f1-ears-slot-closed.png')
  console.log('slot field open:', !!open, '| its text ends:', JSON.stringify(field?.slice(-30) ?? null), '| focus on', focus)
  if (open) await page.keyboard.press('Enter')
  await sleep(4000)
  files = await opfsFiles(page)
  const saved = nodeFile(files, A).text
  const action = /^action:\s*(.*)$/m.exec(saved)?.[1] ?? ''
  console.log('saved action ends:', JSON.stringify(action.slice(-40)))
  const expected = before + ' abc def'
  console.log('expected the slot to hold', JSON.stringify(expected.slice(-40)))
  reproduced = !(field === expected && action.includes('submitted abc def'))
  if (errors.length) console.log('errors', errors)
} finally { await b.close() }
console.log(`REPRODUCED: ${reproduced ? 'yes' : 'no'}`)
process.exitCode = reproduced ? 1 : 0
