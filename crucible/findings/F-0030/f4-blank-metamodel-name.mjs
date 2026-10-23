// bookstore fixture, Designer: Metamodel editor, clear the metamodel's own name (the header) with
// real keys, Tab, close, reopen. Is the blank name refused or put back, as a type's name is?
// Args: [port=4576]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4576)
const { browser, context, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
try {
  const id = await L.seedFixture(context)
  await L.open(page, id, 'v-containers')
  await L.openEditor(page)
  const name = page.locator('.mm-editor-header .mm-name')
  const was = await name.inputValue()
  await name.click(); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.press('Backspace')
  if (await name.inputValue()) { await name.click({ clickCount: 3 }); await page.keyboard.press('Backspace') }
  await page.keyboard.press('Tab')
  await L.wait(page, 500)
  const header = await name.inputValue()
  const issues = await page.locator('.mm-issues-count').innerText()
  await L.shot(page, 'f4-blank-name')
  await L.closeEditor(page); await L.wait(page, 1500)
  const doc = await L.stored(page, id)
  await page.reload(); await page.locator('.app-layout').waitFor(); await L.settle(page)
  await L.openEditor(page)
  const afterReload = await name.inputValue()
  // The type's Label, for comparison (F-0019's fix puts an emptied one back).
  const card = page.locator('.mm-card', { has: page.locator('.mm-type-id', { hasText: /^database$/ }) })
  await card.locator('.mm-card-header').click()
  const label = card.locator('.mm-field', { hasText: /^Label/ }).locator('input')
  await label.click({ clickCount: 3 }); await page.keyboard.press('Backspace'); await page.keyboard.press('Tab')
  L.out({ nameBefore: was, headerAfterTab: header, validationCount: issues, storedMetamodel: { id: doc.metamodel?.id, name: doc.metamodel?.name }, headerAfterReload: afterReload, databaseLabelAfterEmptying: await label.inputValue() })
} finally { console.log('problems', problems); await browser.close() }
