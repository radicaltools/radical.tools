// Explore from here on a need with more requirements than a canvas draws (1,000):
// its + menu opens with every row off, takes no focus, and Esc does not close it
// (with fewer requirements the menu has the focus and Esc closes it).
//   node f3-explore-menu-esc.mjs <app port> [requirements=1200]
import { launch, seed, openFolder, shot, wait, settle } from './lib.mjs'
import { briefModel } from './model4.mjs'
const port = Number(process.argv[2] ?? 4514)
const n = Number(process.argv[3] ?? 1200)
const { page, problems, close } = await launch({ port })
await page.goto('/')
await seed(page, briefModel(n))
await openFolder(page, { least: 2 })
await page.goto(page.url().replace(/\/m\/viewer\/v\/.*/, '/m/designer/v/v-brief'))
await page.locator('.react-flow__node[data-id="need"]').waitFor()
await settle(page)
await page.locator('.react-flow__node[data-id="need"]').dblclick()
await wait(page, 800)
await page.getByRole('button', { name: 'Explore', exact: true }).first().click()
await wait(page, 1500)
await settle(page)
const menu = page.getByRole('menu', { name: /^Add to/ })
await menu.waitFor()
const items = await menu.getByRole('menuitem').evaluateAll((els) => els.map((e) => `${e.textContent.trim()}${e.disabled ? ' [off]' : ''}`))
const focused = await page.evaluate(() => !!document.activeElement?.closest('[role=menu]'))
console.log(`menu "Add to The brief": ${items.join(' | ')}; focus in the menu: ${focused}`)
await shot(page, 'f3-menu.png')
await page.keyboard.press('Escape')
await wait(page, 500)
const open = await menu.count()
console.log(`after Escape the menu is ${open ? 'still open' : 'closed'}`)
if (problems.length) console.log('problems', problems.slice(0, 5))
console.log(open ? 'REPRODUCED: yes' : 'REPRODUCED: no')
await close()
process.exit(open ? 1 : 0)
