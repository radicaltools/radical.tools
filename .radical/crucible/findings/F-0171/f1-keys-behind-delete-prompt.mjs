// F1: the canvas' delete prompt does not hold Studio's keys. Pressed while it asks:
//  - Cmd/Ctrl+P and Enter switch the view behind it, and "Hide from current view" then hides the
//    element from that other view (Payment Provider asked on Containers, hidden from System Context);
//  - F5 starts the presentation with the prompt over the slide (Remove from model then does nothing);
//  - Ctrl+Z undoes the last step behind it.
// node f1-keys-behind-delete-prompt.mjs [studioPort=4515]
import { launch, wait, out, seedFixture, markSetUp, open, node, settle, shot, drag, frames, ids, stored } from './lib.mjs'
const port = +(process.argv[2] ?? 4515)
const r = {}
const prompts = (page) => page.locator('.milestone-modal-title').allTextContents()
const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
async function start() {
  const s = await launch({ port })
  const id = await seedFixture(s.context, 'bookstore')
  await markSetUp(s.context)
  await open(s.page, id, 'v-containers')
  await wait(s.page, 1500)
  return { ...s, id }
}
async function ask(page, nid) {
  await node(page, nid).click({ position: { x: 14, y: 8 } }); await settle(page)
  await page.keyboard.press('Delete'); await wait(page, 500)
  return prompts(page)
}
{ // Quick Search behind the prompt, then Hide from current view
  const { browser, page, problems, id } = await start()
  const asked = await ask(page, 'payments')
  await page.keyboard.press(`${mod}+p`); await page.keyboard.type('System Context'); await wait(page, 800)
  await page.keyboard.press('Enter'); await wait(page, 1500)
  const viewBehind = page.url().replace(/^.*\/v\/([^/]+).*$/, '$1')
  const promptStill = await prompts(page)
  await shot(page, 'f1-view-switched-behind-prompt')
  await page.getByRole('button', { name: /Hide from current view/ }).click(); await wait(page, 2500)
  const doc = await stored(page, id)
  const inView = Object.fromEntries(doc.views.filter(v => v.kind === 'static').map(v => [v.name, (v.nodeIds ?? []).includes('payments')]))
  r.search = { asked, askedOn: 'v-containers', viewBehind, promptStill, paymentsInViewsAfterHide: inView, problems }
  await browser.close()
}
{ // F5
  const { browser, page, problems, id } = await start()
  await ask(page, 'db')
  await page.keyboard.press('F5'); await wait(page, 1000)
  r.f5 = { presenting: await page.locator('.mode-presenting').count(), promptOverSlide: await prompts(page) }
  await shot(page, 'f1-prompt-over-slide')
  await page.getByRole('button', { name: /Remove from model/ }).click(); await wait(page, 800)
  await page.keyboard.press('Escape'); await wait(page, 2500)
  r.f5.afterRemoveClicked = { dbStillInModel: (await stored(page, id)).nodes.some(n => n.id === 'db') }
  r.f5.problems = problems
  await browser.close()
}
{ // Ctrl+Z
  const { browser, page, problems } = await start()
  const at0 = (await frames(page)).db
  await drag(page, 'db', 80, 60); await wait(page, 800)
  const dragged = (await frames(page)).db
  await ask(page, 'db')
  await page.keyboard.press('Control+z'); await wait(page, 800)
  r.undo = { promptStill: await prompts(page), dbStart: at0, dbDragged: dragged, dbAfterCtrlZ: (await frames(page)).db, problems }
  await browser.close()
}
out(r)
const wrongView = r.search.viewBehind !== 'v-containers' && r.search.paymentsInViewsAfterHide['Containers'] === true && r.search.paymentsInViewsAfterHide['System Context'] === false
const f5Leaks = r.f5.presenting > 0 && r.f5.promptOverSlide.length > 0
const undoLeaks = r.undo.promptStill.length > 0 && Math.abs(r.undo.dbAfterCtrlZ.x - r.undo.dbDragged.x) > 1
console.log(`Quick Search switched the view behind the prompt and Hide hid from it: ${wrongView}; F5 started the presentation under it: ${f5Leaks}; Ctrl+Z undid the drag behind it: ${undoLeaks}`)
const bug = wrongView || f5Leaks || undoLeaks
console.log(`REPRODUCED: ${bug ? 'yes' : 'no'}`)
process.exit(bug ? 1 : 0)
