// Sample, Core Banking. Collapse Risk & Data. Select Event Bus (it publishes to / is read by
// elements in Risk & Data, so a rolled-up line joins it to the collapsed group), hold the special
// key and drag it onto the group's "inside" pill. Release on the pill: nothing happens, no notice.
// The rolled-up line ends at the pill and lies over it, and takes the drop.
// Args: [port=4590] [collapsed|open]   (open: the same with Risk & Data open, which nests)
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4590), how = process.argv[3] ?? 'collapsed'
const X = 'ctn-evtbus', C = 'dom-risk'
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-core'); await L.wait(page, 2000)
  const focus = page.getByRole('button', { name: 'Focus', exact: true })
  if ((await focus.getAttribute('aria-pressed')) !== 'false') await focus.click()
  if (how === 'collapsed') { await L.node(page, C).locator('.c4-node-collapse-btn').first().click(); await L.wait(page, 1500); await L.settle(page) }
  await page.getByRole('button', { name: 'Fit All', exact: true }).click(); await L.wait(page, 1000)
  const parent = async () => (await L.stored(page, id)).nodes.find((n) => n.id === X).parentId
  console.log(`Risk & Data ${how}; Event Bus in`, await parent())
  const s = await L.node(page, X).boundingBox()
  await page.mouse.click(s.x + 12, s.y + 8); await L.wait(page, 500)
  await page.keyboard.down('Alt'); await L.wait(page, 300)
  const t = await L.node(page, C).boundingBox()
  await page.mouse.move(s.x + 12, s.y + 8); await page.mouse.down()
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 10 }); await L.wait(page, 300)
  const pill = page.locator(`.connect-pill[data-connect-target="${C}"]`, { hasText: 'inside' }).first()
  console.log('pills over Risk & Data:', await page.locator(`.connect-pill[data-connect-target="${C}"]`).allInnerTexts())
  const pb = await pill.boundingBox()
  const px = pb.x + pb.width / 2, py = pb.y + pb.height / 2
  await page.mouse.move(px, py, { steps: 4 }); await L.wait(page, 300)
  console.log('under the pill\'s centre:', await page.evaluate(([x, y]) => {
    const e = document.elementFromPoint(x, y)
    return e?.closest('.connect-pill') ? 'the pill' : `${e?.tagName} ${e?.getAttribute('class')} of ${e?.closest('g[data-testid]')?.getAttribute('data-testid') ?? '?'}`
  }, [px, py]))
  await L.shot(page, `f2-${how}-on-pill`)
  await page.mouse.up(); await page.keyboard.up('Alt')
  await L.wait(page, 3000); await L.settle(page)
  console.log('notices:', JSON.stringify(await page.locator('.toast-message').allInnerTexts()))
  console.log('Event Bus now in', await parent())
  await L.shot(page, `f2-${how}-after`)
} finally { console.log('problems', problems); await browser.close() }
