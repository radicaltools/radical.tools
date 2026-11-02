// Bookstore fixture moved to a browser folder (discussions on), System Context. Select Payment
// Provider, press Shift+F10: the Discuss menu opens with the focus on its item. Press F5: the
// presentation starts, but the Discuss menu stays drawn over the playing slide and keeps the keys:
// → does not go to the next slide, and Space (next slide) presses Discuss instead, whose panel
// pops up once the presentation ends. During a presentation the canvas offers no Discuss menu.
// Args: [port=4599] [mode=designer|viewer]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4599)
const mode = process.argv[3] ?? 'designer'
const { context, page, problems, close } = await L.launch({ port })
page.setDefaultTimeout(10000)
const state = async (name) => console.log(name.padEnd(24),
  '| presenting:', !!(await page.locator('.mode-presenting').count()),
  '| Discuss menu shown:', await page.getByRole('menuitem', { name: 'Discuss' }).isVisible().catch(() => false),
  '| slide:', JSON.stringify((await page.locator('.pres-hud').innerText().catch(() => '-')).replace(/\n/g, ' ')),
  '| discussion panels:', await page.locator('.discussion-panel').count())
try {
  const id = await L.seedFixture(context, 'bookstore', 'run199-doc')
  await L.openLs(page, id, 'v-context')
  await L.moveToFolder(page)
  if (mode !== 'designer') { await page.goto(page.url().replace('/m/designer/', `/m/${mode}/`)); await L.settle(page) }
  // Control: with no menu open, F5 then → goes to slide 2.
  await L.node(page, 'payments').click({ position: { x: 20, y: 10 } })
  await page.keyboard.press('F5'); await L.wait(page, 700); await page.keyboard.press('ArrowRight'); await L.wait(page, 700)
  await state('control: F5, →')
  await page.keyboard.press('ArrowLeft'); await L.wait(page, 700)
  await page.keyboard.press('Escape'); await L.wait(page, 700)
  await L.node(page, 'payments').click({ position: { x: 20, y: 10 } })
  await page.keyboard.press('Shift+F10'); await L.wait(page, 300)
  await state('Shift+F10')
  await page.keyboard.press('F5'); await L.wait(page, 700)
  await state('F5')
  await L.shot(page, 'f2-menu-on-slide')
  await page.keyboard.press('ArrowRight'); await L.wait(page, 700)
  await state('→')
  await page.keyboard.press('Space'); await L.wait(page, 700)
  await state('Space')
  await page.keyboard.press('Escape'); await L.wait(page, 700)
  await state('Escape')
} finally { console.log('problems', problems); await close() }
