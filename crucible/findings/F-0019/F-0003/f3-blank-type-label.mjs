// Emptying a node type's or relation type's Label in the metamodel editor.
import { launch, seed, open, fixture, stored, openEditor, closeEditor, card, sleep, DIR } from './lib.mjs'

const { browser, page, errors } = await launch()
try {
  await seed(page, fixture('bookstore'))
  await open(page, 'v-containers')
  await openEditor(page)
  const c = card(page, 'database')
  await c.locator('.mm-card-header').click()
  const label = c.locator('.mm-card-body .mm-field', { hasText: 'Label' }).locator('input').first()
  await label.click({ clickCount: 3 })
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Tab')
  await sleep(300)
  console.log('label field after Tab:', JSON.stringify(await label.inputValue()))
  console.log('card header:', JSON.stringify(await c.locator('.mm-type-label').innerText()))
  const notes = await page.locator('[class*=notif]').allInnerTexts()
  console.log('notices:', notes.map((t) => t.replace(/\s+/g, ' ')).filter(Boolean))
  await closeEditor(page)
  await sleep(2500)
  const d = await stored(page)
  console.log('stored database label:', JSON.stringify(d.metamodel?.nodeTypes?.database?.label))
  const pal = await page.locator('.palette-item').evaluateAll((els) => els.map((e) => (e.getAttribute('title') || e.getAttribute('aria-label') || e.textContent || '').trim()))
  console.log('palette items:', JSON.stringify(pal))
  await page.getByTestId('rf__node-db').click()
  await sleep(500)
  const head = await page.locator('.right-panel.open').innerText().catch(() => '')
  console.log('card of Orders DB (first 120 chars):', JSON.stringify(head.slice(0, 120)))
  await page.screenshot({ path: `${DIR}/shots/f3.png` })
} finally {
  console.log('errors', errors)
  await browser.close()
}
