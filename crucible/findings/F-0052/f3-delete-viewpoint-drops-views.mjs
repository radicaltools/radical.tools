// Sample, metamodel editor → List → Viewpoints → delete "State machine" (the viewpoint of the
// group State machines, whose views Payment lifecycle and Fraud case lifecycle are laid out).
// The button says "its views keep their kind and filter". Which views are left?
// Args: [port=4583]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4583)
const { browser, page, problems } = await L.launch({ port, width: 1280, height: 720 })
page.setDefaultTimeout(15000)
const of = (d) => d.views.filter((v) => /lifecycle$|^State machines$/.test(v.name) && v.name !== 'Entity lifecycles')
  .map((v) => `${v.name} (${v.kind ?? 'static'}, viewpoint ${v.viewpoint ?? 'none'}, ${Object.keys(v.positions ?? {}).length} positions)`)
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-ctx', 'designer'); await L.wait(page, 2500)
  const d0 = await L.stored(page, id)
  console.log(`before: ${d0.views.length} views: ${of(d0).join('; ')}`)
  await L.open(page, id, 'view-ctx', 'metamodel')
  const editor = page.getByRole('dialog', { name: 'Metamodel editor' })
  await editor.getByRole('tab', { name: 'List' }).click()
  const del = editor.getByRole('button', { name: 'Delete viewpoint State machine', exact: true })
  console.log(`the button's title: "${await del.getAttribute('title')}"`)
  await del.click()
  await L.wait(page, 1000)
  console.log(`a question asked: ${(await page.locator('.milestone-modal:not(.mm-editor-modal), [role=alertdialog]').count()) > 0}`)
  await page.getByRole('button', { name: 'Close metamodel editor' }).click(); await L.settle(page); await L.wait(page, 2500)
  const d1 = await L.stored(page, id)
  console.log(`after: ${d1.views.length} views: ${of(d1).join('; ')}`)
  console.log(`notices: ${JSON.stringify((await page.locator('.toast').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')))}`)
  await L.tab(page, 'Views'); await L.shot(page, 'f3-views-gone')
} finally { if (problems.length) console.log(problems.slice(0, 5)); await browser.close() }
