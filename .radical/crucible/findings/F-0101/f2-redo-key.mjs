// Bookstore, Element Table: rename Orders DB in place (F2), Ctrl+Z, then redo with Ctrl+Shift+Z as a keyboard on
// Windows or Linux sends it (KeyboardEvent.key "Z": Shift makes the letter upper case), and with Ctrl+Y to compare.
// The same for Ctrl+Z with Caps Lock on (key "Z", no Shift): the undo does nothing.
// Args: [port=4500]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4500)
const { browser, context, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
const id = await L.seedDoc(context, L.fixtureDoc('bookstore'))
const label = async () => (await L.stored(page, id)).nodes.find((n) => n.id === 'db').label
const keys = []
try {
  await L.open(page, id, 'v-table'); await L.wait(page, 800)
  await page.evaluate(() => window.addEventListener('keydown', (e) => { if (/^[zZyY]$/.test(e.key)) window.__keys = [...(window.__keys ?? []), `${e.ctrlKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}key "${e.key}"`] }, true))
  await page.locator('tr.tv-row', { hasText: 'Orders DB' }).click()
  await page.keyboard.press('F2'); await page.keyboard.type('Order Store'); await page.keyboard.press('Enter'); await L.wait(page, 1500)
  const out = { renamed: await label() }
  await page.keyboard.press('Control+z'); await L.wait(page, 1500)
  out.afterCtrlZ = await label()
  await page.keyboard.press('Control+Shift+Z'); await L.wait(page, 1500)
  out.afterCtrlShiftZ = await label()
  out.redoButtonEnabled = await page.getByRole('button', { name: 'Redo', exact: true }).isEnabled()
  await page.keyboard.press('Control+y'); await L.wait(page, 1500)
  out.afterCtrlY = await label()
  // Caps Lock on: Ctrl+Z sends key "Z" without Shift.
  await page.keyboard.press('Control+Z'); await L.wait(page, 1500)
  out.afterCtrlZWithCapsLock = await label()
  out.keysSeen = await page.evaluate(() => window.__keys)
  out.redoTooltip = await page.getByRole('button', { name: 'Redo', exact: true }).getAttribute('title')
  await L.shot(page, 'f2-redo-key')
  out.problems = problems
  L.out(out)
} finally { await browser.close() }
