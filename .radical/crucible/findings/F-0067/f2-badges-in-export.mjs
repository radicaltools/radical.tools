// Bookstore moved to a browser folder; a comment posted on Customer (System Context), so its
// canvas shows a speech-bubble discussion icon. Export → Export as SVG… (and PNG): the exported
// image carries the icon, though the manual says "These controls stay out of diagram exports."
// Args: [port=4588]
import * as L from './lib.mjs'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
const port = Number(process.argv[2] ?? 4588)
const { context, page, problems, close } = await L.launch({ port })
page.setDefaultTimeout(10000)
async function exportAs(kind) {
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: `Export as ${kind}…` }).click(),
  ])
  const path = await download.path()
  return path
}
try {
  const id = await L.seedFixture(context)
  await L.openLs(page, id, 'v-context')
  await L.moveToFolder(page)
  const svgBefore = (await import('node:fs')).readFileSync(await exportAs('SVG'), 'utf8')
  const panel = await L.discuss(page, 'customer', 'Customer')
  await L.post(panel, 'Is the customer a person or a company?', page)
  await panel.getByRole('button', { name: 'Close discussions' }).click()
  await page.locator('button[data-discussion-node="customer"]').waitFor()
  await L.wait(page, 500)
  console.log('badge on screen:', await page.locator('.node-discussion-badge').count())
  const svgPath = await exportAs('SVG')
  const svg = (await import('node:fs')).readFileSync(svgPath, 'utf8')
  const count = (s) => (s.match(/node-discussion-badge/g) ?? []).length
  console.log(`exported SVG before the comment: ${count(svgBefore)} discussion icon(s); after: ${count(svg)} (data-discussion-node=customer: ${svg.includes('data-discussion-node=\\"customer\\"') || svg.includes('data-discussion-node="customer"')})`)
  const pngPath = await exportAs('PNG')
  const { copyFileSync } = await import('node:fs')
  copyFileSync(pngPath, join(L.DIR, 'shots', 'f2-exported.png'))
  console.log('exported PNG saved as shots/f2-exported.png')
  await L.shot(page, 'f2-canvas')
} finally { console.log('problems', problems); await close() }
