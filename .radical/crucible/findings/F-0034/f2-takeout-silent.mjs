// Bookstore, Containers view, Customer put in a group "Shoppers" (as apps/e2e nesting.spec does).
// With the special key (Alt) held, an element dragged onto the empty canvas is taken out to the top:
//  1. Customer: taken out (works).
//  2. API (a container, which may not stand at the top): nothing happens and nothing says why,
//     while a Container dropped from the palette onto the empty canvas is refused with a reason.
// Args: [port=4577]
import { launch, stored, settle, wait, out, shot, node, recordToasts, toasts, REPO } from './lib.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const port = +(process.argv[2] || 4577)
const { browser, context, page, problems } = await launch({ port })
await recordToasts(context)
const doc = JSON.parse(readFileSync(join(REPO, 'apps/e2e/fixtures/bookstore.radical'), 'utf8'))
doc.nodes.push({ id: 'shoppers', type: 'group', label: 'Shoppers', x: -400, y: -40, width: 300, height: 260, collapsed: false })
doc.nodes.find((n) => n.id === 'customer').parentId = 'shoppers'
doc.views.find((v) => v.id === 'v-containers').nodeIds.push('shoppers')
const id = 'run177-f2'
await context.addInitScript(([id, data]) => {
  if (localStorage.getItem('radical-docs-index')) return
  localStorage.setItem('radical-docs-index', JSON.stringify({ docs: [{ id, name: 'E2E', source: 'ls', lastModified: 0 }], activeId: id }))
  localStorage.setItem(`radical-doc:${id}`, data)
}, [id, JSON.stringify(doc)])
await page.goto(`/#/d/${encodeURIComponent('ls:' + id)}/m/designer/v/v-containers`)
await page.locator('.app-layout').waitFor(); await settle(page); await wait(page, 1500)
const parentOf = async (nid) => (await stored(page, id)).nodes.find((n) => n.id === nid)?.parentId ?? '(top)'
const takeOut = async (nid) => {
  await node(page, nid).click({ position: { x: 20, y: 12 } }); await settle(page)
  await page.keyboard.down('Alt')
  const b = await node(page, nid).boundingBox(), pane = await page.locator('.react-flow__pane').boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + Math.min(30, b.height / 2)); await page.mouse.down()
  await page.mouse.move(pane.x + pane.width - 60, pane.y + 60, { steps: 10 })
  await page.mouse.up(); await page.keyboard.up('Alt')
  await settle(page); await wait(page, 2000)
}
await toasts(page)
const log = []
log.push({ step: '1. Alt-drag Customer onto the empty canvas', parentBefore: 'shoppers', parentAfter: await (async () => { await takeOut('customer'); return parentOf('customer') })(), toasts: await toasts(page) })
const undoBefore = await page.getByRole('button', { name: 'Undo', exact: true }).isEnabled()
const docBefore = JSON.stringify((await stored(page, id)).nodes)
await takeOut('api')
log.push({ step: '2. Alt-drag API onto the empty canvas', parentAfter: await parentOf('api'), documentChanged: docBefore !== JSON.stringify((await stored(page, id)).nodes), toasts: await toasts(page) })
await shot(page, 'f2-api-not-taken-out')
const pane = await page.locator('.react-flow__pane').boundingBox()
await page.locator('.palette-item', { hasText: /^Container$/ }).first().dragTo(page.locator('.react-flow__pane'), { targetPosition: { x: pane.width - 60, y: 60 }, force: true })
await settle(page); await wait(page, 1500)
log.push({ step: '3. for comparison: a Container from the palette onto the empty canvas', toasts: await toasts(page) })
out({ log, problems })
await browser.close()
