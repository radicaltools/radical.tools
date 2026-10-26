// Sample, Designer on Core Banking: delete Payments Service (Delete, Remove from model). Milestone v3
// still holds it, so it keeps its own copy of the views that listed it (Core Banking, Payments Domain,
// Payment Flow, ...). Open v3 and rename the view folder "Logical" to "Architecture" (Folder properties,
// Rename folder), and rename the view Core Banking to "Core Banking X" (View properties, Rename view).
// The list shows all 8 views under Architecture. Back on Current (live) the list has two folders:
// Architecture with 2 views and Logical with the 6 views v3 keeps its own way, and Core Banking has its
// old name. The saved document is split the same way already while v3 is shown.
// Args: [port=4591]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4591)
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
const folders = async (id) => { const d = await L.stored(page, id); const f = {}; for (const v of d.views) if (/Logical|Architecture/.test(v.folder ?? '')) (f[v.folder] ??= []).push(v.name); return f }
const rows = () => page.locator('.lp-folder-row').evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()))
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-core', 'designer')
  await L.node(page, 'ctn-payments').click({ position: { x: 14, y: 8 } })
  await page.keyboard.press('Delete')
  await page.locator('.milestone-modal').waitFor()
  await page.getByRole('button', { name: /Remove from model/ }).click()
  await L.settle(page); await L.wait(page, 2500)
  console.log(`live, before: ${JSON.stringify(await folders(id))}`)
  await L.milestone(page, 'v3 – Full Platform')
  await L.tab(page, 'Views')
  const row = page.locator('.lp-folder-row', { hasText: 'Logical' })
  await row.hover()
  await row.getByTitle('Folder properties').click()
  await page.getByTitle('Rename folder').click()
  const box = page.getByLabel('Folder name')
  await box.press('ControlOrMeta+a'); await box.press('Backspace'); await box.pressSequentially('Architecture'); await box.press('Enter')
  await L.wait(page, 500)
  await page.locator('.left-panel .rp-back-btn').click()
  const card = page.locator('.lp-view-card').filter({ hasText: 'Core Banking' }).first()
  await card.hover()
  await card.getByTitle('View properties').click()
  await page.getByTitle('Rename view').click()
  await page.keyboard.press('End'); await page.keyboard.type(' X'); await page.keyboard.press('Enter')
  await L.wait(page, 500)
  await page.locator('.left-panel .rp-back-btn').click()
  await L.wait(page, 2000)
  console.log(`in v3, the list: ${JSON.stringify(await rows())}; the card: ${(await page.locator('.lp-view-card').filter({ hasText: 'Core Banking' }).first().innerText()).split('\n')[0]}`)
  console.log(`in v3, saved: ${JSON.stringify(await folders(id))}`)
  await L.milestone(page, 'live')
  await L.wait(page, 2000)
  await L.tab(page, 'Views')
  console.log(`live again, the list: ${JSON.stringify(await rows())}`)
  console.log(`live again, saved: ${JSON.stringify(await folders(id))}`)
  console.log(`live again, view-core is named: "${(await L.stored(page, id)).views.find((v) => v.id === 'view-core').name}"`)
  await L.shot(page, 'f3-live-two-folders')
} finally { console.log('problems', problems); await browser.close() }
