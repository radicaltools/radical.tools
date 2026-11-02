// Clicking the Unpin pin of a pinned container collapses the container and leaves it pinned
// (Enter on the focused pin unpins it, and a click unpins an element without children).
// node f3-unpin-container.mjs <port>
// Bookstore fixture, Containers view, Designer, 1280×720: drag the Bookstore system (it is pinned), select it, click its Unpin pin.
import { launch, seedFixture, open, settle, frames, stored, wait, out, shot, drag, node } from './lib.mjs'
const port = +(process.argv[2] || 4585)
const { browser, context, page, problems } = await launch({ port })
const pins = async (id) => { const d = await stored(page, id); return (d.views.find((v) => v.id === 'v-containers').layoutConstraints ?? []).filter((c) => c.type === 'pin').flatMap((c) => c.nodeIds) }
try {
  const id = await seedFixture(context, 'bookstore')
  await open(page, id, 'v-containers')
  await wait(page, 1500)
  await drag(page, 'bookstore', 0, 120, { at: [150, 40] })
  await wait(page, 800)
  await node(page, 'bookstore').click({ position: { x: 150, y: 40 } })
  await wait(page, 600)
  const before = await frames(page)
  const unpin = page.getByTestId('unpin-node').first()
  const ub = await unpin.boundingBox()
  const hit = await page.evaluate(([x, y]) => {
    const els = document.elementsFromPoint(x, y).slice(0, 4)
    return els.map((e) => `${e.tagName.toLowerCase()}${e.getAttribute('aria-label') ? `[${e.getAttribute('aria-label')}]` : ''}${e.getAttribute('title') ? `{${e.getAttribute('title').slice(0, 40)}}` : ''}.${String(e.className).slice(0, 40)}`)
  }, [ub.x + ub.width / 2, ub.y + ub.height / 2])
  const state0 = { pins: await pins(id), bookstore: before.bookstore, childrenDrawn: ['web', 'api', 'db'].filter((c) => before[c]).length }
  await shot(page, 'f3-before')
  await page.mouse.click(ub.x + ub.width / 2, ub.y + ub.height / 2)
  await wait(page, 1500); await settle(page)
  const after = await frames(page)
  await shot(page, 'f3-after')
  out({ unpinButton: ub, elementsAtItsCentre: hit, before: state0, after: { pins: await pins(id), bookstore: after.bookstore, childrenDrawn: ['web', 'api', 'db'].filter((c) => after[c]).length }, problems })
} finally { await browser.close() }
