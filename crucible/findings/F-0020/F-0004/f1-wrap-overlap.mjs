// Wrap into… → Group puts the new group over its neighbours.
// node f1-wrap-overlap.mjs [sample|bookstore]
import * as L from './lib.mjs'
const which = process.argv[2] ?? 'sample'
const { page, problems, close } = await L.launch()
let id, view, target
if (which === 'sample') { id = await L.openSample(page); view = 'view-core'; target = 'ctn-fraud' }
else { await L.seedDocument(page, L.fixture('bookstore')); id = 'e2e-doc'; view = 'v-containers'; target = 'api' }
await L.open(page, view, 'designer', id); await L.waitStill(page)
console.log('violations before:', await L.layoutViolations(page))
await page.locator(`[data-id="${target}"]`).click({ position: { x: 20, y: 30 } })
await page.getByRole('button', { name: /Wrap into/ }).click()
await page.locator('button,li,[role=menuitem]', { hasText: /^Group$/ }).first().click()
await page.waitForTimeout(500); await L.waitStill(page, 2000)
await page.keyboard.press('Escape'); await L.settle(page)
const d = await L.stored(page)
const g = d.nodes.find((n) => n.label === 'New Group')
const b = await L.boxes(page)
console.log('new group', g?.id, 'box', JSON.stringify(b[g?.id]))
console.log('violations after wrap:', await L.layoutViolations(page))
await page.screenshot({ path: `shots/f1-wrap-${which}.png` })
await page.waitForTimeout(3000)
await page.reload(); await L.ready(page); await L.waitStill(page)
console.log('violations after reload:', await L.layoutViolations(page))
console.log('problems', problems)
await close()
