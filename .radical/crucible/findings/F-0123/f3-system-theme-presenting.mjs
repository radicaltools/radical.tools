// F3: with the System theme, Studio does not follow the operating system while a presentation plays.
// node f3-system-theme-presenting.mjs [studioPort=4505]
import { launch, wait, out, seedFixture, markSetUp, open, shot } from './lib.mjs'
const port = +(process.argv[2] ?? 4505)
const { browser, context, page, problems } = await launch({ port })
const id = await seedFixture(context, 'bookstore')
await markSetUp(context)
await page.emulateMedia({ colorScheme: 'dark' })
await open(page, id, 'v-containers')
const theme = () => page.evaluate(() => ({ pref: localStorage.getItem('radical-theme') ?? '(none: System)', drawn: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundColor }))
const r = { osDark: await theme() }
await page.emulateMedia({ colorScheme: 'light' }); await wait(page, 400)
r.osLightInDesigner = await theme()
await page.emulateMedia({ colorScheme: 'dark' }); await wait(page, 400)
await page.keyboard.press('F5'); await wait(page, 1500)
r.presenting = (await page.locator('.mode-presenting').count()) > 0
await page.emulateMedia({ colorScheme: 'light' }); await wait(page, 800)
r.osLightWhilePresenting = await theme()
await shot(page, 'f3-presenting-dark-os-light')
await page.keyboard.press('Escape'); await wait(page, 1000)
r.afterStop = await theme()
r.problems = problems
out(r)
console.log(r.presenting && r.osLightWhilePresenting.drawn === 'dark' ? 'REPRODUCED' : 'NOT REPRODUCED')
await browser.close()
