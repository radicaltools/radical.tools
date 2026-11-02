// Bookstore moved to a browser folder. F5 and Ctrl/⌘+P pressed while writing a comment in the
// discussion panel reach the browser (not prevented): F5 reloads the page (the draft is lost) and
// ⌘P opens the print dialog. In every other text field and dialog of Studio both keys are taken
// (F5 = presentation, ⌘P = Quick Search, or swallowed behind a dialog).
// Measured with a capture listener that reads defaultPrevented after dispatch.
// Args: [port=4588]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4588)
const { context, page, problems, close } = await L.launch({ port })
page.setDefaultTimeout(8000)
const probe = () => page.evaluate(() => {
  window.__keys = []
  if (!window.__probe) window.addEventListener('keydown', (e) => { if (e.key === 'F5' || e.key === 'p') setTimeout(() => window.__keys.push(`${e.key}${e.ctrlKey ? '+ctrl' : ''}${e.metaKey ? '+meta' : ''} prevented=${e.defaultPrevented}`), 0) }, true)
  window.__probe = 1
})
const press = async () => { await page.keyboard.press('F5'); await page.keyboard.press('Control+p'); await page.keyboard.press('Meta+p'); await L.wait(page, 300); return page.evaluate(() => window.__keys) }
try {
  const id = await L.seedFixture(context)
  await L.openLs(page, id, 'v-context')
  await L.moveToFolder(page)
  // Control 1: the Quick search field (a text field).
  await page.getByRole('search').locator('input').click()
  await probe()
  console.log('quick search field:', JSON.stringify(await press()))
  await page.keyboard.press('Escape'); await L.wait(page, 300)
  // Control 2: the Models dialog (another dialog over the canvas).
  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await page.getByRole('menuitem', { name: /Manage models/ }).click()
  const models = page.getByRole('dialog', { name: 'Models' })
  await models.getByRole('button', { name: 'Close' }).focus()
  await probe()
  console.log('Models dialog:', JSON.stringify(await press()))
  await models.getByRole('button', { name: 'Close' }).click(); await L.wait(page, 300)
  // The discussion panel's comment field, with a draft.
  await L.node(page, 'customer').click({ position: { x: 20, y: 10 } })
  const panel = await L.discuss(page, 'customer', 'Customer')
  const body = panel.getByLabel('Comment (Markdown supported)')
  await body.click(); await page.keyboard.type('A long draft')
  await probe()
  console.log('discussion comment field:', JSON.stringify(await press()))
  await L.shot(page, 'f1-keys')
} finally { console.log('problems', problems); await close() }
