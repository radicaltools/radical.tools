// Sample, Designer, Smart fit off (Settings), so each view keeps its own camera.
// On System Context: zoom in with the wheel, drag KYC / AML Provider. Open Core Banking, zoom out.
// Ctrl+Z there: Undo goes back to System Context and puts KYC back. Then open Core Banking again.
// The camera is not part of undo (rule 3): both views should keep the cameras the user left them at.
// Control: the same with the Undo pressed on System Context itself keeps the camera.
// Args: [port=4592]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4592)
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
const zoom = async (dy, x = 800, y = 400) => { await page.mouse.move(x, y); await page.mouse.wheel(0, dy); await L.wait(page, 1200) }
const at = async (id) => JSON.stringify((await L.frames(page))[id])
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-ctx', 'designer')
  await L.smartFitOff(page)
  await page.reload(); await page.locator('.app-layout').waitFor(); await L.settle(page)
  const saved = await L.vp(page)
  console.log('System Context opened (saved camera):', JSON.stringify(saved))
  // Control: undo on the same canvas.
  await zoom(-150)
  const c0 = await L.vp(page)
  await L.drag(page, 'sys-kyc', 60, 40); await L.wait(page, 1500)
  await page.keyboard.press('Control+z'); await L.wait(page, 2000)
  const c1 = await L.vp(page)
  console.log('control: zoom in, drag KYC, Ctrl+Z on System Context:', JSON.stringify(c0), '->', JSON.stringify(c1), L.sameCam(c0, c1) ? 'camera kept' : 'CAMERA CHANGED')
  // The case.
  await zoom(-150)
  const camCtx = await L.vp(page)
  const kyc0 = await at('sys-kyc')
  await L.drag(page, 'sys-kyc', 60, 40); await L.wait(page, 1500)
  console.log('System Context zoomed in to', JSON.stringify(camCtx), ', KYC dragged', kyc0, '->', await at('sys-kyc'))
  await L.view(page, 'Core Banking'); await L.wait(page, 800)
  await zoom(250, 900, 300)
  const camCore = await L.vp(page)
  console.log('Core Banking zoomed out to', JSON.stringify(camCore))
  await page.keyboard.press('Control+z'); await L.wait(page, 2000)
  const u = await L.vp(page)
  console.log('Ctrl+Z ->', page.url().replace(/^.*\/v\//, 'view '), JSON.stringify(u), 'KYC', await at('sys-kyc'), L.sameCam(camCtx, u) ? 'camera kept' : `SYSTEM CONTEXT CAMERA CHANGED (expected ${JSON.stringify(camCtx)})`)
  await L.shot(page, 'f3-after-undo')
  await L.view(page, 'Core Banking'); await L.wait(page, 800)
  const b2 = await L.vp(page)
  console.log('Core Banking again:', JSON.stringify(b2), L.sameCam(camCore, b2) ? 'camera kept' : `CORE BANKING CAMERA CHANGED (expected ${JSON.stringify(camCore)})`)
} finally { console.log('problems', problems); await browser.close() }
