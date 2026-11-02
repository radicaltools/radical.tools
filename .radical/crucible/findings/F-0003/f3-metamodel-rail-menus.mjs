// In the metamodel editor the activity rail shows Models, AI, Export and Settings,
// but a click on one closes the editor and opens no menu.
// arg: the rail button to click (default Settings)
import { launch, seed, open, fixture, rail } from './lib.mjs'
const name = process.argv[2] ?? 'Settings'
const { browser, page, errors } = await launch({ width: 1280, height: 720 })
await seed(page, fixture('bookstore'))
await open(page, 'v-context', 'designer')
await rail(page, 'Metamodel editor').click()
await page.getByRole('button', { name: 'Close metamodel editor' }).waitFor()
const btn = rail(page, name)
const b = await btn.boundingBox()
const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.className, [b.x + b.width / 2, b.y + b.height / 2])
console.log(`element at the centre of the rail's ${name}: "${top}"`)
await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
await page.waitForTimeout(600)
const menuOpen = await page.getByRole('menu', { name }).count()
const editorOpen = await page.getByRole('button', { name: 'Close metamodel editor' }).count()
await page.screenshot({ path: `shots/f3-${name}.png` })
console.log(`after a click on ${name}: its menu open = ${menuOpen > 0}, metamodel editor still open = ${editorOpen > 0}, url = ${decodeURIComponent(page.url()).replace(/^.*#/, '#')}`)
const ok = menuOpen > 0 && editorOpen > 0
console.log(ok ? 'PASS' : `FAIL: the rail's ${name} cannot be used in the metamodel editor`)
if (errors.length) console.log('errors', errors)
await browser.close()
process.exit(ok ? 0 : 1)
