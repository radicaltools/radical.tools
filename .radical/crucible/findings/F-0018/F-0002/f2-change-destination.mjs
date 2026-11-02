// Change destination… of a typed relation to an element where several relation types fit: Studio makes an untyped relation, which its Validation then flags.
import { launch, seed, open, stored, openEditor, sleep, DIR } from './lib.mjs'
import { entitiesModel } from './models.mjs'

const { browser, page, errors } = await launch()
try {
  // run 175: the properties card now covers the right of the canvas, where Customer was drawn; for the drag, Customer sits below Order.
  const model = JSON.parse(entitiesModel())
  if (process.argv[2] === 'drag') Object.assign(model.nodes.find((n) => n.id === 'ent-b'), { x: 0, y: 600 })
  await seed(page, JSON.stringify(model))
  await open(page, 'v-dom')
  await sleep(1500)
  const edge = page.locator('.react-flow__edge[data-id="r-sat"], [data-testid="rf__edge-r-sat"]').first()
  await edge.locator('path').last().click({ force: true })
  await page.getByRole('button', { name: /Change destination/ }).waitFor() // run 175: the relation's actions are in its card now
  if (process.argv[2] === 'drag') {
    // The reconnect handle at the relation's target end, dragged onto Customer.
    await sleep(500)
    const handles = page.locator('circle.nodrag.nopan')
    const h = await handles.nth(1).boundingBox()
    const t = await page.getByTestId('rf__node-ent-b').boundingBox()
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
    await page.mouse.down()
    await page.mouse.move(h.x + 5, h.y + 5, { steps: 3 }) // run 175: a small first move starts the reconnect
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 20 })
    await sleep(300)
    await page.mouse.up()
    console.log('dragged the target end onto Customer')
  } else {
    await page.getByRole('button', { name: /Change destination/ }).click()
    const items = await page.getByRole('menuitem').allInnerTexts()
    console.log('destinations offered:', items.map((t) => t.replace(/\s+/g, ' ')))
    await page.getByRole('menuitem', { name: /Customer/ }).click()
  }
  await sleep(2500)
  const d = await stored(page)
  const r = d.relations.find((x) => x.id === 'r-sat')
  console.log('relation after the change:', JSON.stringify(r))
  const notes = await page.locator('[class*=notif]').allInnerTexts()
  console.log('notices:', notes.map((t) => t.replace(/\s+/g, ' ')).filter(Boolean))
  await page.screenshot({ path: `${DIR}/shots/f2-canvas-${process.argv[2] ?? "menu"}.png` })
  await openEditor(page)
  await sleep(500)
  console.log('Validation count:', await page.locator('.mm-issues-count').innerText())
  console.log('Validation list:', (await page.locator('.mm-editor-side').innerText()).replace(/\s+/g, ' '))
  await page.screenshot({ path: `${DIR}/shots/f2-validation-${process.argv[2] ?? "menu"}.png` })
} finally {
  console.log('errors', errors)
  await browser.close()
}
