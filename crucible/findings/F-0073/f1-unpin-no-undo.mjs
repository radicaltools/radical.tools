// Smart Layout that only unpins ("nothing left to tidy. Unpinned 1 element.") makes no undo step:
// Ctrl+Z then takes back the drag before it instead of giving the pin back.
// Bookstore fixture, Containers view, Designer, 1280×720.
// node f1-unpin-no-undo.mjs <port>
import { launch, seedFixture, open, settle, frames, diff, stored, wait, out, shot, drag, toast } from './lib.mjs'
const port = +(process.argv[2] || 4585)
const { browser, context, page, problems } = await launch({ port })
const pins = async (id) => { const d = await stored(page, id); return (d.views.find((v) => v.id === 'v-containers').layoutConstraints ?? []).filter((c) => c.type === 'pin').flatMap((c) => c.nodeIds) }
const smart = async () => {
  await page.getByRole('button', { name: 'Smart Layout', exact: true }).click()
  await wait(page, 2500); await settle(page)
  return (await toast(page)).split('\n').filter((l) => /^Smart layout/.test(l)).pop()
}
try {
  const id = await seedFixture(context, 'bookstore')
  await open(page, id, 'v-containers')
  await wait(page, 1500)
  const first = await smart()
  await wait(page, 6000) // let the notice go
  // Drag Payment Provider down and back up: it stands where Smart Layout put it, now pinned.
  await drag(page, 'payments', 0, 150)
  await wait(page, 500)
  await drag(page, 'payments', 0, -150)
  await wait(page, 1500)
  const beforeSecond = await frames(page)
  const pinsBefore = await pins(id)
  const second = await smart()
  await wait(page, 1500)
  const afterSecond = await frames(page)
  const pinsAfter = await pins(id)
  await page.locator('.react-flow__pane').click({ position: { x: 5, y: 300 } })
  await page.keyboard.press('Control+z')
  await wait(page, 1500); await settle(page)
  const afterUndo = await frames(page)
  await shot(page, 'f1-after-undo')
  out({
    first, second, pinsBefore, pinsAfter,
    secondMoved: diff(beforeSecond, afterSecond, 1),
    undoMoved: diff(afterSecond, afterUndo, 1),
    pinsAfterUndo: await pins(id),
    problems,
  })
} finally { await browser.close() }
