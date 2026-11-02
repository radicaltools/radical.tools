// Unchecking a type's last allowed parent in the metamodel editor: is it asked about, and does Validation flag the children left inside?
import { launch, seed, open, fixture, stored, openEditor, closeEditor, card, sleep, DIR } from './lib.mjs'

const { browser, page, errors } = await launch()
const dialogs = []
page._dialogHandler = async (d) => { dialogs.push(d.message().split('\n').slice(0, 3).join(' | ')); await d.accept() }
try {
  await seed(page, fixture('bookstore'))
  await open(page, 'v-containers')
  await openEditor(page)
  const c = card(page, 'database')
  await c.locator('.mm-card-header').click()
  const box = (name) => c.locator('.mm-parent-grid label', { hasText: new RegExp(`^${name}$`) }).locator('input')
  console.log('checked before: system', await box('Software System').isChecked(), 'group', await box('Group').isChecked(), 'root', await box('At the root').isChecked())
  await box('Group').uncheck()
  await sleep(300)
  console.log('dialogs after unchecking Group:', dialogs.length, dialogs)
  await box('Software System').click()
  await sleep(500)
  console.log('dialogs after unchecking Software System (the last one):', dialogs.length, dialogs.slice(1))
  console.log('checked after: system', await box('Software System').isChecked(), 'group', await box('Group').isChecked(), 'root', await box('At the root').isChecked())
  console.log('Validation count:', await page.locator('.mm-issues-count').innerText())
  await page.screenshot({ path: `${DIR}/shots/f1-editor.png` })
  await closeEditor(page)
  await sleep(2500)
  const d = await stored(page)
  console.log('stored database type: allowedParents', JSON.stringify(d.metamodel?.nodeTypes?.database?.allowedParents), 'allowedAtRoot', d.metamodel?.nodeTypes?.database?.allowedAtRoot)
  console.log('Orders DB parent:', d.nodes.find((n) => n.id === 'db')?.parentId)
  // Studio's own placing rule: drop another Database into Bookstore.
  const sys = page.getByTestId('rf__node-bookstore')
  const b = await sys.boundingBox()
  const pane = await page.locator('.react-flow__pane').boundingBox()
  await page.locator('.palette-item', { hasText: 'Database' }).first().dragTo(page.locator('.react-flow__pane'), { targetPosition: { x: b.x - pane.x + b.width - 60, y: b.y - pane.y + b.height - 40 } })
  await sleep(1500)
  const notes = await page.locator('.notification, .toast, .notification-item, [class*=notif]').allInnerTexts()
  console.log('notices after dropping a Database into Bookstore:', notes.map((t) => t.replace(/\s+/g, ' ')).filter(Boolean))
  await sleep(2000)
  const d2 = await stored(page)
  console.log('databases now:', d2.nodes.filter((n) => n.type === 'database').map((n) => `${n.label} in ${n.parentId}`))
  await page.screenshot({ path: `${DIR}/shots/f1-drop.png` })
} finally {
  console.log('errors', errors)
  await browser.close()
}
