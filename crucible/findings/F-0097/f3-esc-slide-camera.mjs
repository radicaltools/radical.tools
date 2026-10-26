// F5 from Designer (Smart fit off), one slide on (slide 2, Core Banking), Esc: Designer's view comes back drawn at the last slide's camera
// (a slide of another view), not its own; a reload then moves the camera.
// node f3-esc-slide-camera.mjs [port]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4597)
async function run(withReload) {
  const { browser, context, page, problems } = await L.launch({ port })
  page.setDefaultTimeout(8000)
  await context.addInitScript(() => { if (!localStorage.getItem('radical-studio-settings')) localStorage.setItem('radical-studio-settings', JSON.stringify({ smartFit: false })) })
  const where = () => page.url().replace(/^.*\/m\//, '')
  const reload = async () => { await page.reload(); await page.locator('.app-layout').waitFor(); await L.settle(page); await L.wait(page, 1500) }
  const tag = withReload ? 'reload while playing: ' : ''
  try {
    const id = await L.openSample(page)
    await L.open(page, id, 'view-core', 'designer'); await L.wait(page, 800)
    console.log(tag + 'Designer, Core Banking'.padEnd(30), JSON.stringify(await L.vp(page)))
    await L.open(page, id, 'view-ctx', 'designer'); await L.wait(page, 800)
    await page.mouse.move(700, 400); await page.mouse.wheel(0, -300); await L.wait(page, 1500)
    console.log(tag + 'Designer, System Context zoomed'.padEnd(30), JSON.stringify(await L.vp(page)))
    await page.keyboard.press('F5'); await L.wait(page, 1200)
    await page.keyboard.press('ArrowRight'); await L.wait(page, 1200)
    console.log(tag + 'slide 2 (Core Banking)'.padEnd(30), JSON.stringify(await L.vp(page)), where())
    if (withReload) { await reload(); console.log('reloaded while playing'.padEnd(30), JSON.stringify(await L.vp(page)), where()) }
    await page.keyboard.press('Escape'); await L.wait(page, 4000)
    const esc = await L.vp(page)
    console.log(tag + 'Esc'.padEnd(30), JSON.stringify(esc), where())
    await L.shot(page, withReload ? 'f3-reload-after-esc' : 'f3-after-esc')
    await reload()
    const after = await L.vp(page)
    console.log(tag + 'reload in Designer'.padEnd(30), JSON.stringify(after), where())
    await L.shot(page, withReload ? 'f3-reload-after-reload' : 'f3-after-reload')
    console.log(tag + (L.sameCam(esc, after) ? 'OK: the reload keeps the camera' : `BUG: after Esc ${where()} is drawn at ${JSON.stringify(esc)}, the camera of slide 2 (Core Banking); a reload moves it to ${JSON.stringify(after)}`))
    if (problems.length) console.log('problems', problems)
  } finally { await browser.close() }
}
await run(process.argv[3] === 'reload')
