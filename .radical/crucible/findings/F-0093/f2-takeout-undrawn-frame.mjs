// F2. Sample. Take an entity out of its domain to the top with the special key (drop on the empty canvas)
// on Domain model, a view that draws entities only: its domain is an undrawn frame there.
//  payment:   Payment, on Domain model itself -> it jumps 400 px down (F-0072's steps), with nothing drawn in its way.
//  fraudcase: Fraud Case -> it stays on Domain model, but on Fraud case lifecycle (entity drawn, domain not)
//             it jumps 240 px up, clear of the domain frame that view does not draw.
// Args: [port=4598] [payment|fraudcase]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4598), which = process.argv[3] ?? 'payment'
const X = which === 'payment' ? '73809fc5-c735-440f-abe5-62c8ce5dd226' : '96ee9ee3-3872-47cf-88b8-e55349602dd9'
const OTHER = which === 'payment' ? 'view-payment-lifecycle' : 'view-fraud-case-lifecycle'
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
try {
  const id = await L.openSample(page)
  const doc = await L.stored(page, id)
  const parent = doc.nodes.find((n) => n.id === X).parentId
  const name = (n) => doc.nodes.find((x) => x.id === n)?.label ?? n
  await L.open(page, id, OTHER); await L.wait(page, 1500)
  const other0 = await L.frames(page)
  console.log(`${OTHER} draws "${name(X)}": ${X in other0}, its domain "${name(parent)}": ${parent in other0}`)
  await L.open(page, id, 'view-domain-model'); await L.wait(page, 1500)
  const focus = page.getByRole('button', { name: 'Focus', exact: true })
  if ((await focus.getAttribute('aria-pressed')) !== 'false') await focus.click()
  await page.getByRole('button', { name: 'Fit All', exact: true }).click(); await L.wait(page, 800)
  const s = await L.node(page, X).boundingBox()
  await page.mouse.click(s.x + s.width / 2, s.y + s.height - 4); await L.wait(page, 400)
  const here0 = await L.frames(page)
  console.log(`view-domain-model draws ${Object.keys(here0).length} elements, its domain "${name(parent)}": ${parent in here0}`)
  await L.shot(page, `f2-${which}-before`)
  const empty = await page.evaluate(() => { for (let y = 640; y > 100; y -= 20) for (let x = 1240; x > 400; x -= 20) { const e = document.elementFromPoint(x, y); if (e?.classList.contains('react-flow__pane')) return [x, y] } return null })
  await page.keyboard.down('Alt'); await L.wait(page, 300)
  await page.mouse.move(s.x + s.width / 2, s.y + s.height - 4); await page.mouse.down()
  await page.mouse.move(empty[0], empty[1], { steps: 12 }); await L.wait(page, 300)
  await page.mouse.up(); await page.keyboard.up('Alt'); await L.wait(page, 3000); await L.settle(page)
  console.log(`released at screen ${empty}; notices`, await page.locator('.toast-message').allInnerTexts())
  const here1 = await L.frames(page)
  console.log('moved on Domain model:', JSON.stringify(L.diff(here0, here1)))
  await L.shot(page, `f2-${which}-after`)
  await L.tab(page, 'Views')
  await page.locator('.lp-view-card', { hasText: doc.views.find((v) => v.id === OTHER).name }).first().click()
  await L.wait(page, 1500); await L.settle(page)
  const other1 = await L.frames(page)
  console.log(`moved on ${OTHER}:`, JSON.stringify(L.diff(other0, other1)))
  await L.shot(page, `f2-${which}-other-after`)
} finally { console.log('problems', problems); await browser.close() }
