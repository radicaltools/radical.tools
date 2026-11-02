// One special-key gesture with several elements selected takes one Undo per element.
//  relate: Bookstore fixture, Containers view. Select Web App, Alt+click API, Alt-drag Web App
//          onto Orders DB: two relations made; Ctrl+Z once takes back only one.
//  nest:   Sample, Core Banking view. Select Auth Service (in Access & Security), Alt+click Fraud
//          Detection (in Risk & Data), Alt-drag onto Banking Services' "inside" pill: both nested;
//          Ctrl+Z once takes back only one.
// Args: [port=4578] [relate|nest]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4578), kind = process.argv[3] ?? 'relate'
const cfg = kind === 'nest'
  ? { a: 'ctn-auth', b: 'ctn-fraud', target: 'dom-banking', pill: '@inside', view: 'view-core' }
  : { a: 'web', b: 'api', target: 'db', pill: null, view: 'v-containers' }
const { browser, context, page, problems } = await L.launch({ port })
try {
  let id
  if (kind === 'nest') id = await L.openSample(page)
  else id = await L.seedFixture(context, 'bookstore')
  await L.open(page, id, cfg.view); await L.wait(page, 2500)
  const state = async () => { const d = await L.stored(page, id); const p = Object.fromEntries(d.nodes.map((n) => [n.id, n.parentId ?? null]))
    return `relations ${d.relations.length}; ${cfg.a} in ${p[cfg.a]}, ${cfg.b} in ${p[cfg.b]}` }
  const s0 = await state(); console.log('before:        ', s0)
  // Focus off, so that a selection does not move the camera (the browser remembers it).
  const focus = page.getByRole('button', { name: 'Focus', exact: true })
  if ((await focus.getAttribute('aria-pressed')) !== 'false') await focus.click()
  await page.getByRole('button', { name: 'Fit All', exact: true }).click(); await L.wait(page, 1000)
  const at = async (id) => { const r = await L.node(page, id).boundingBox(); return [r.x + 20, r.y + 20] }
  await page.mouse.click(...await at(cfg.a)); await L.wait(page, 800)
  await page.keyboard.down('Alt')
  await page.mouse.click(...await at(cfg.b)); await L.wait(page, 500)
  console.log('selected:      ', await page.locator('.react-flow__node.selected').evaluateAll((e) => e.map((x) => x.dataset.id)))
  const b = await L.node(page, cfg.a).boundingBox(), t = await L.node(page, cfg.target).boundingBox()
  await page.mouse.move(b.x + 20, b.y + 20); await page.mouse.down()
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2 + 10, { steps: 10 }); await L.wait(page, 300)
  if (cfg.pill) {
    const pb = await page.locator(`.connect-pill[data-connect-target="${cfg.target}"][data-connect-type="${cfg.pill}"]`).boundingBox()
    await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2, { steps: 4 }); await L.wait(page, 200)
  }
  await page.mouse.up(); await page.keyboard.up('Alt')
  await L.wait(page, 3000); await L.settle(page)
  await L.shot(page, `f1-${kind}-after-gesture`)
  console.log('after gesture: ', await state())
  await page.keyboard.press('Control+z'); await L.wait(page, 3000); await L.settle(page)
  const s1 = await state(); console.log('after 1 undo:  ', s1, s1 === s0 ? '(back at start)' : '(NOT back at start)')
  await L.shot(page, `f1-${kind}-after-undo`)
  await page.keyboard.press('Control+z'); await L.wait(page, 3000)
  console.log('after 2 undos: ', await state())
} finally { console.log('problems', problems); await browser.close() }
