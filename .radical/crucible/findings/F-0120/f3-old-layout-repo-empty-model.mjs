// F3: Open → Folder… on a repository whose model is in architecture/ (the
// layout before .radical/, which the CLI still reads) opens an empty model,
// and Studio writes .state/ and, at the first element added, radical.md,
// nodes/, metamodel.json … into the repository's root beside its code.
//   node f3-old-layout-repo-empty-model.mjs [--port 4504]
import * as L from './lib.mjs'
const model = L.genFederation('f3', '--no-fetch')   // a payments model folder (2 elements, 2 views)
const disk = await L.diskFiles(model)
const b = await L.startBrowser()
const { page } = b
const rootFiles = async () => Object.keys(await L.opfsFiles(page)).filter((p) => !p.startsWith('architecture/')).sort()
try {
  // the repository: package.json, src/, and its model in architecture/
  await page.goto(L.BASE + '/')
  for (const [p, c] of Object.entries(disk)) if (p !== 'deps.json' && !p.startsWith('.state/')) await L.opfsWrite(page, `architecture/${p}`, c)
  await L.opfsWrite(page, 'package.json', '{"name":"payments"}')
  await L.opfsWrite(page, 'src/index.ts', 'export {}\n')
  const before = await rootFiles()
  await page.goto(L.BASE + '/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()     // picks the repository's root
  await page.locator('.welcome-overlay').waitFor({ state: 'hidden' })
  await L.sleep(3000)
  const views = await page.locator('.lp-view-card .lp-card-title').allInnerTexts()
  const opened = await rootFiles()
  console.log('views listed:', views, '(architecture/ has Landscape and Payments table)')
  console.log('written into the root by opening:', opened.filter((p) => !before.includes(p)))
  await L.designer(page)
  await page.locator('button:visible', { hasText: 'Add element' }).first().click()
  await page.keyboard.type('Ledger'); await page.keyboard.press('Enter')
  await L.waitFor(async () => (await rootFiles()).includes('radical.md'), 15000)
  await L.sleep(1000)
  const added = await rootFiles()
  console.log('written into the root after one element added:', added.filter((p) => !before.includes(p)))
  await L.shot(page, 'f3.png')
  const bug = !views.includes('Landscape') && added.includes('radical.md')
  console.log(bug ? 'REPRODUCED: an empty model opened and a second model written into the repository root' : 'not reproduced')
  if (b.errors.length) console.log('errors', b.errors)
  process.exitCode = bug ? 1 : 0
} finally { await b.close() }
