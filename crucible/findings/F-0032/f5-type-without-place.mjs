// bookstore fixture (no queue in it), Designer: Metamodel editor, Queue card, untick every allowed
// parent and At the root. Is anything asked, does Validation say anything? Then drop a Queue from the
// palette on the canvas and into Bookstore.   Args: [port=4576] [type=queue]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4576), typeId = process.argv[3] ?? 'queue'
const { browser, context, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
const dialogs = []
page.on('dialog', (d) => { dialogs.push(d.message().slice(0, 160)); void d.accept() })
try {
  const id = await L.seedFixture(context)
  await L.open(page, id, 'v-containers')
  await L.openEditor(page)
  const card = page.locator('.mm-card', { has: page.locator('.mm-type-id', { hasText: new RegExp(`^${typeId}$`) }) })
  await card.locator('.mm-card-header').click()
  const boxes = card.locator('.mm-parent-grid label')
  const n = await boxes.count()
  for (let i = 0; i < n; i++) {
    const input = boxes.nth(i).locator('input')
    if (await input.isChecked()) { await input.click(); await L.wait(page, 200) }
  }
  const ticked = []
  for (let i = 0; i < n; i++) if (await boxes.nth(i).locator('input').isChecked()) ticked.push(await boxes.nth(i).innerText())
  const validation = await page.locator('.mm-issues-count').innerText()
  const messages = await page.locator('.mm-issue-msg').allInnerTexts()
  await L.shot(page, 'f5-no-place')
  await L.closeEditor(page); await L.wait(page, 800)
  const doc = await L.stored(page, id)
  const def = doc.metamodel?.nodeTypes?.[typeId]
  // Drop one from the palette: on empty canvas, then into Bookstore.
  const item = page.locator('.palette-item', { hasText: /^\s*Queue/ }).first()
  const inPalette = await item.count()
  const notices = []
  const readNotices = async () => (await page.locator('[class*="notification"], [role="alert"], [role="status"]').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const canvas = await page.locator('.react-flow__pane').boundingBox()
  const before = (await L.stored(page, id)).nodes.length
  if (inPalette) {
    await item.dragTo(page.locator('.react-flow__pane'), { targetPosition: { x: canvas.width - 120, y: canvas.height - 120 } })
    await L.wait(page, 800); notices.push(...await readNotices())
    const bk = await L.node(page, 'bookstore').boundingBox()
    await item.dragTo(page.locator('.react-flow__pane'), { targetPosition: { x: bk.x - canvas.x + bk.width / 2, y: bk.y - canvas.y + bk.height - 30 } })
    await L.wait(page, 800); notices.push(...await readNotices())
  }
  const after = (await L.stored(page, id)).nodes.length
  await L.shot(page, 'f5-drops')
  L.out({ dialogs, stillTicked: ticked, stored: { allowedParents: def?.allowedParents ?? null, allowedAtRoot: def?.allowedAtRoot ?? null }, validation, messages, paletteOffersIt: inPalette, nodesBeforeDrops: before, nodesAfterDrops: after, notices: [...new Set(notices)] })
} finally { console.log('problems', problems); await browser.close() }
