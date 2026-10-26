// Opening the sample from Models (a model already open) draws System Context at All elements' camera, and keeps it.
// node f1-sample-all-camera.mjs [port]
import * as L from './lib.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const port = Number(process.argv[2] ?? 4597)
const { browser, context, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
const sample = JSON.parse(readFileSync(join(L.REPO, 'apps/studio/src/renderer/src/store/fintechSampleData.json'), 'utf8'))
const own = sample.views.find((v) => v.id === 'view-ctx').viewport
const all = sample.defaultViewport
// Smart fit off (Settings), and the bookstore fixture open as the model in use.
await L.seedFixture(context, 'bookstore')
await context.addInitScript(() => { if (!localStorage.getItem('radical-studio-settings')) localStorage.setItem('radical-studio-settings', JSON.stringify({ smartFit: false })) })
const kept = async (id) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}')['view-ctx'] ?? null, 'radical-view-cameras:' + id)
const r = (c) => c && { x: Math.round(c.x), y: Math.round(c.y), zoom: +c.zoom.toFixed(3) }
try {
  await L.open(page, 'run197-doc', 'v-context', 'designer'); await L.wait(page, 800)
  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await page.getByRole('menuitem', { name: /Manage models/ }).click()
  await page.getByRole('button', { name: 'Open…' }).click()
  await page.getByRole('button', { name: /Sample model/ }).click()
  await page.waitForURL((u) => !u.href.includes('run197-doc') && /\/v\/view-ctx$/.test(u.href)); await L.settle(page); await L.wait(page, 1500)
  const id = L.docId(page)
  const shown = await L.vp(page)
  console.log('System Context saved camera ', JSON.stringify(own), ' All elements camera', JSON.stringify(all))
  console.log('sample opened from Models   ', JSON.stringify(shown), page.url().replace(/^.*\/m\//, ''), 'kept', JSON.stringify(r(await kept(id))))
  await L.shot(page, 'f1-opened-from-models')
  await page.reload(); await page.locator('.app-layout').waitFor(); await L.settle(page); await L.wait(page, 1000)
  const after = await L.vp(page)
  console.log('after a reload              ', JSON.stringify(after))
  console.log(L.sameCam(shown, own) ? 'OK: System Context opens at its own camera' : `BUG: System Context opens at ${JSON.stringify(shown)} (All elements' camera ${JSON.stringify(all)}), not its own ${JSON.stringify(own)}; kept after reload: ${JSON.stringify(after)}`)
} finally { console.log('problems', problems); await browser.close() }
