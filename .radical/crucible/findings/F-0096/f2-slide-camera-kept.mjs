// A slide shown in Presenter (not playing) becomes the view's kept camera: after a reload, Designer opens the view at the slide's camera.
// node f2-slide-camera-kept.mjs [port]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4597)
const { browser, context, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
await context.addInitScript(() => { if (!localStorage.getItem('radical-studio-settings')) localStorage.setItem('radical-studio-settings', JSON.stringify({ smartFit: false })) })
const kept = async (id) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}')['view-ctx'], 'radical-view-cameras:' + id)
const r = (c) => c && { x: Math.round(c.x), y: Math.round(c.y), zoom: +c.zoom.toFixed(3) }
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-ctx', 'designer'); await L.wait(page, 800)
  await page.mouse.move(700, 400); await page.mouse.wheel(0, -300); await L.wait(page, 1500)
  const designer = await L.vp(page)
  console.log('Designer, System Context, zoomed in   ', JSON.stringify(designer), 'kept', JSON.stringify(r(await kept(id))))
  // control: Presenter, slide 1, back to Designer without a reload
  await L.perspective(page, 'Presenter')
  await page.locator('.pres-slide-card .pres-slide-name', { hasText: 'System Context' }).first().click(); await L.settle(page); await L.wait(page, 800)
  const slide = await L.vp(page)
  console.log('Presenter, slide "1 – System Context" ', JSON.stringify(slide), 'kept', JSON.stringify(r(await kept(id))))
  await L.perspective(page, 'Designer'); await L.wait(page, 800)
  const control = await L.vp(page)
  console.log('control: back in Designer, no reload  ', JSON.stringify(control), 'same as before:', L.sameCam(control, designer))
  // now the same with a reload while in Presenter
  await L.perspective(page, 'Presenter')
  await page.locator('.pres-slide-card .pres-slide-name', { hasText: 'System Context' }).first().click(); await L.settle(page); await L.wait(page, 800)
  console.log('Presenter, slide 1 again              ', JSON.stringify(await L.vp(page)), 'kept', JSON.stringify(r(await kept(id))))
  await page.reload(); await page.locator('.app-layout').waitFor(); await L.settle(page); await L.wait(page, 1000)
  await L.perspective(page, 'Designer'); await L.wait(page, 800)
  const after = await L.vp(page)
  console.log('reload in Presenter, then Designer    ', JSON.stringify(after), page.url().replace(/^.*\/m\//, ''))
  await L.shot(page, 'f2-designer-after-reload')
  console.log(L.sameCam(after, designer) ? 'OK: Designer has its camera' : `BUG: Designer opens System Context at the slide's camera ${JSON.stringify(after)}, not its own ${JSON.stringify(designer)}`)
} finally { console.log('problems', problems); await browser.close() }
