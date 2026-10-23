// Sample model, Designer: + New view → Blank view (a table), Filter: + Start with Step (12 steps).
// 9 of them store no Repeat, and their card says Repeat 1 (the type's default), as the Warnier view
// draws them (no repetition mark). + Filter offers "Repeat is 1 · 0" beside "Repeat is not set · 9";
// "Repeat is 1" leaves the table empty. A step added now from the + row (which stores the default)
// is the only one it then shows.   Args: [port=4581]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4581)
const { browser, page, problems } = await L.launch({ port })
try {
  const id = await L.openSample(page)
  await L.tab(page, 'Views')
  await page.getByRole('button', { name: 'New view' }).click()
  await page.getByRole('menuitem', { name: /Blank view/ }).click()
  await L.wait(page, 800)
  await page.getByRole('button', { name: '+ Start with' }).click()
  await page.locator('.rp-step-menu .rp-step-option', { hasText: /^Step/ }).first().click()
  await L.wait(page, 500)
  const rowsBefore = (await L.tableLines(page)).filter((l) => l.startsWith('STEP'))
  const doc = await L.stored(page, id)
  const noRepeat = doc.nodes.filter((n) => n.type === 'step' && (n.repeat === undefined || n.repeat === '')).map((n) => n.label)
  // The card of a step that stores no Repeat (the view's properties stay in the left panel).
  await page.locator('tr.tv-row', { hasText: 'Enter the payment' }).dblclick()
  await L.wait(page, 500)
  const cardRepeat = await page.locator('.right-panel').getByLabel('Repeat', { exact: true }).inputValue()
  await L.shot(page, 'f3-card')
  await page.getByRole('button', { name: /^Add a filter to/ }).click()
  const menu = (await page.locator('.rp-step-menu .rp-step-option').allInnerTexts()).map((t) => t.replace(/\n/g, ' · '))
  await L.shot(page, 'f3-filter-menu')
  await page.locator('.rp-step-menu .rp-step-option').filter({ has: page.locator('.rp-step-option-label', { hasText: /^Repeat is 1$/ }) }).click()
  await L.wait(page, 600)
  const rowsIs1 = (await L.tableLines(page)).filter((l) => l.startsWith('STEP'))
  const tableSays = await page.locator('.tv-empty').innerText().catch(() => '')
  await L.shot(page, 'f3-repeat-is-1')
  const addRow = (await page.locator('tr.tv-add-row').last().innerText()).replace(/\s+/g, ' ')
  await page.locator('tr.tv-add-row button').last().click()
  await L.wait(page, 300)
  await page.keyboard.type('Notify the customer'); await page.keyboard.press('Enter')
  await L.wait(page, 1200)
  const rowsAfterAdd = (await L.tableLines(page)).filter((l) => l.startsWith('STEP'))
  const added = (await L.stored(page, id)).nodes.find((n) => n.label === 'Notify the customer')
  await L.shot(page, 'f3-after-add')
  L.out({ stepsInTable: rowsBefore.length, stepsStoringNoRepeat: noRepeat, cardOf_EnterThePayment_Repeat: cardRepeat,
    filterMenuRepeat: menu.filter((m) => /^Repeat/.test(m)), rowsWithRepeatIs1: rowsIs1.length, tableSays,
    addRow, addedStepStores: added?.repeat, rowsWithRepeatIs1AfterAdd: rowsAfterAdd })
} finally { console.log('problems', problems); await browser.close() }
