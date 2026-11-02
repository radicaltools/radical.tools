// Sample, Designer, System Context, window 1280×720 (the e2e size), left panel open as it opens.
// Click Smart Layout with the mouse, leave the mouse where it is, then click the same button again.
// Does the notice land on the button, stay while the pointer rests on it, and swallow the second click?
// Args: [port=4583] [view=view-ctx] [width=1280] [height=720]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4583)
const view = process.argv[3] ?? 'view-ctx'
const width = Number(process.argv[4] ?? 1280), height = Number(process.argv[5] ?? 720)
const { browser, page, problems } = await L.launch({ port, width, height })
page.setDefaultTimeout(30000)
// Each Smart Layout ends with a notice: count the notices that appear.
await page.addInitScript(() => {
  window.__notices = []
  const seen = new WeakSet()
  setInterval(() => { for (const t of document.querySelectorAll('.toast')) if (!seen.has(t) && t.innerText) { seen.add(t); window.__notices.push(t.innerText.replace(/\s+/g, ' ')) } }, 50)
})
const notices = () => page.evaluate(() => window.__notices.filter((t) => /Smart layout/i.test(t)).length)
const box = (b) => b && `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}×${Math.round(b.height)}`
try {
  const id = await L.openSample(page)
  await L.open(page, id, view, 'designer')
  await L.wait(page, 1000)
  const btn = page.getByRole('button', { name: 'Smart Layout', exact: true })
  const b = await btn.boundingBox()
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2
  console.log(`Smart Layout button at ${box(b)}`)
  await page.mouse.move(cx, cy)
  await page.mouse.down(); await page.mouse.up()
  for (let k = 0; k < 120 && (await notices()) < 1; k++) await L.wait(page, 250)
  await L.wait(page, 800)
  const toast = page.locator('.toast').first()
  const t = await toast.boundingBox()
  const hit = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e?.closest('.toast') ? 'the notice' : e?.closest('button')?.textContent?.trim() ?? e?.className }, [cx, cy])
  console.log(`after the first click: ${await notices()} Smart Layout notice(s); notice at ${box(t)}; at the button's centre is ${JSON.stringify(hit)}`)
  console.log(`notice: ${(await toast.innerText().catch(() => '')).replace(/\s+/g, ' ')}`)
  await L.shot(page, 'f1-notice-over-button')
  await L.wait(page, 9000)
  console.log(`9 s later, the pointer still there: notice shown ${await toast.isVisible().catch(() => false)} (notices go after 5 s)`)
  await page.mouse.down(); await page.mouse.up()
  await L.wait(page, 4000)
  console.log(`second click on the button's place: ${await notices()} Smart Layout notice(s) in all (expected 2)`)
} finally { if (problems.length) console.log(problems.slice(0, 5)); await browser.close() }
