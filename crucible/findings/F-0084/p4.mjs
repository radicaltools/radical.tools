import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4592)
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
const log = async (label) => console.log(label.padEnd(44), JSON.stringify(await L.vp(page)), page.url().replace(/^.*\/m\//, ''))
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-ctx', 'designer')
  await L.smartFitOff(page)
  await page.reload(); await page.locator('.app-layout').waitFor(); await L.settle(page); await L.wait(page, 1000)
  const ser = async (v='view-ctx') => { const d = await L.stored(page, id); return JSON.stringify(d.views.find(x=>x.id===v).viewport) }
  await log('reloaded, smart fit off'); console.log('stored', await ser())
  await page.mouse.move(700, 400); await page.mouse.wheel(0, -300); await L.wait(page, 2500)
  await log('wheel zoom'); console.log('stored', await ser())
  await page.reload(); await page.locator('.app-layout').waitFor(); await L.settle(page); await L.wait(page, 1000)
  await log('reloaded'); console.log('stored', await ser())
  await L.node(page, 'sys-core').click({ position: { x: 10, y: 10 } }); await L.wait(page, 2500)
  await log('click sys-core'); console.log('stored', await ser())
  await page.reload(); await page.locator('.app-layout').waitFor(); await L.settle(page); await L.wait(page, 1000)
  await log('reloaded'); console.log('stored', await ser())
  await page.mouse.click(900, 650); await L.wait(page, 1200)
  await log('empty click')
} finally { console.log('problems', problems); await browser.close() }
