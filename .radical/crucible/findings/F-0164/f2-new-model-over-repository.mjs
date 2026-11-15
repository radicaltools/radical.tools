// F2: New model → In a folder, picking my repository whose model is in
// .radical/model (the layout Open → Folder… and the CLI read), writes a
// second, empty model into the repository's root without a question; from
// then on Open → Folder… on the repository opens that empty model and the
// repository's own model (payments) is out of reach. Move to a folder… takes
// the same path (pickAndWriteFolder).
//   node f2-new-model-over-repository.mjs [--port 4520]
import * as L from './lib.mjs'
const model = L.genFederation('f2', '--no-fetch')   // a payments model folder (2 elements, views Landscape and Payments table)
const disk = await L.diskFiles(model)
const b = await L.startBrowser()
const { page } = b
const dialogs = []
page.on('dialog', (d) => { dialogs.push(d.message()); d.accept() })
const rootFiles = async () => Object.keys(await L.opfsFiles(page)).filter((p) => !p.startsWith('.radical/')).sort()
let bug = false
try {
  // the repository: package.json, src/, .git, and its model in .radical/model
  await page.goto(L.BASE + '/')
  for (const [p, c] of Object.entries(disk)) if (p !== 'deps.json' && !p.startsWith('.state/')) await L.opfsWrite(page, `.radical/model/${p}`, c)
  await L.opfsWrite(page, 'package.json', '{"name":"payments"}')
  await L.opfsWrite(page, 'src/index.ts', 'export {}\n')
  await L.opfsWrite(page, '.git/HEAD', 'ref: refs/heads/main\n')
  const before = await rootFiles()
  await page.goto(L.BASE + '/')
  await page.getByRole('button', { name: 'New model', exact: true }).click()
  await page.getByRole('radio', { name: /In a folder/ }).check()
  await page.getByRole('button', { name: /Choose folder and create/ }).click()   // picks the repository's root
  await L.waitFor(async () => (await rootFiles()).includes('radical.md'), 10000)
  await L.sleep(1500)
  const written = (await rootFiles()).filter((p) => !before.includes(p))
  console.log('questions asked:', dialogs.length ? dialogs : 'none')
  console.log('written into the repository root:', written)
  await L.shot(page, 'f2-new.png')
  // A fresh start: Open → Folder… on the same repository
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('radical-studio-settings', JSON.stringify({ setupDone: true })) })
  await page.goto(L.BASE + '/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await page.locator('.welcome-overlay').waitFor({ state: 'hidden' })
  await L.sleep(2500)
  await L.railTab(page, 'Views')
  const name = (await page.locator('.app-brand-switch').first().innerText()).split('\n')[0]
  const views = await page.locator('.lp-view-card .lp-card-title').allInnerTexts()
  console.log(`Open → Folder… on the repository now opens "${name}", views:`, views.slice(0, 6), views.length > 6 ? `… (${views.length})` : '')
  await L.shot(page, 'f2.png')
  bug = dialogs.length === 0 && written.includes('radical.md') && !views.includes('Landscape')
  if (b.errors.length) console.log('errors', b.errors)
} finally { await b.close() }
console.log(bug ? 'REPRODUCED: yes' : 'REPRODUCED: no')
process.exitCode = bug ? 1 : 0
