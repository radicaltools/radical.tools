// The repository's own model ×copies in a folder, open in Designer with an
// element's card. While a name is typed into the card, another program
// changes a different element's file: the letters typed while Studio reads
// the folder again are lost.
//   node f2-typing-lost-on-outside-change.mjs <app port> [copies=4] [ms per key=60]
import { launch, largeModel, seed, openFolder, shot, wait, readFile, writeFile } from './lib.mjs'
const port = Number(process.argv[2] ?? 4503)
const copies = Number(process.argv[3] ?? 4)
const keyDelay = Number(process.argv[4] ?? 60)
const A = { path: 'nodes/conceptual/metamodel/requirement-trace-links.md', label: 'Requirement trace links' }
const B = { id: '6c9bc471-0eb1-499a-86e1-93e207cfcb7f', label: 'Need is not a requirement' }
const { page, problems, close } = await launch({ port })
await page.goto('/')
await seed(page, largeModel(copies))
await openFolder(page)
await page.goto(page.url().replace(/\/m\/viewer\/.*$/, `/m/designer/v/all/e/${B.id}`))
await page.reload()
await page.locator('.app-layout').waitFor()
await wait(page, 8000)
await page.locator(`tr[data-node-id="${B.id}"]`).first().dblclick({ timeout: 60_000 })
const name = page.locator('.right-panel.open').getByLabel('Name', { exact: true })
await name.waitFor()
await name.click()
await name.evaluate((el) => el.setSelectionRange(el.value.length, el.value.length))
const typed = ' abcdefghijklmnopqrstuvwxyz0123456789'
const a = await readFile(page, A.path)
const typing = page.keyboard.type(typed, { delay: keyDelay })
await wait(page, 300)
// Another program renames element A in its file.
await writeFile(page, A.path, a.replace(`label: "${A.label}"`, `label: "${A.label} (edited outside)"`))
await typing
await name.press('Tab')
await wait(page, 6000)
const actual = await name.inputValue()
const expected = B.label + typed
console.log('expected', JSON.stringify(expected))
console.log('actual  ', JSON.stringify(actual))
await shot(page, 'f2-typing-lost.png')
console.log(actual === expected ? 'ok' : `BUG: ${expected.length - actual.length} typed characters lost`)
console.log('problems', problems)
await close()
