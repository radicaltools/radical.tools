// A slide of an Explore view shows what the view lists now, at the places captured
// when the view listed less: the slide's elements pile up on each other.
// Sample, Core Banking: Explore from API Gateway, Show all, Save as view "GW";
// Presenter > Add slide (8 elements on screen); Designer: + of Payments Service > Show all;
// Presenter: click the new slide's card.  Arg: 'hide' instead hides Fraud Detection from a
// Core Banking slide's view (the static-view counterpart).
import * as L from './lib.mjs'
const variant = process.argv[2] ?? 'explore'
const { browser, page, problems } = await L.launch()
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-core')
  if (variant === 'explore') {
    await L.explore(page, 'ctn-apigw')
    await L.showAll(page, 'API Gateway')
    await L.saveAsView(page, 'GW')
  }
  await L.mode(page, 'Presenter')
  const cards = page.locator('.pres-dock-card-wrap')
  const n0 = await cards.count()
  await page.getByRole('button', { name: 'Add slide' }).click()
  await L.wait(page, 1000)
  const shown = (await L.drawn(page)).sort()
  const doc0 = await L.stored(page, id)
  const atCapture = L.overlaps(await L.boxes(page), L.parents(doc0))
  console.log(`on screen at Add slide: ${shown.length} elements, ${atCapture.length} overlaps`)
  await L.mode(page, 'Designer')
  if (variant === 'explore') {
    await (await L.plus(page, 'Payments Service')).getByRole('menuitem', { name: /^Show all/ }).click()
  } else {
    await L.node(page, 'ctn-fraud').click({ position: { x: 8, y: 8 } })
    await page.locator('.right-panel.open').getByRole('button', { name: 'Hide from view' }).click()
  }
  await L.settle(page); await L.wait(page, 2500)
  const designer = await L.positions(page)
  console.log('Designer now draws', Object.keys(designer).length, 'overlaps', L.overlaps(await L.boxes(page), L.parents(await L.stored(page, id))).length)
  await L.mode(page, 'Presenter')
  await cards.nth(n0).click(); await L.settle(page); await L.wait(page, 800)
  const slide = (await L.drawn(page)).sort()
  const doc = await L.stored(page, id)
  const v = L.overlaps(await L.boxes(page), L.parents(doc))
  console.log(`the slide draws ${slide.length} elements (captured ${shown.length}); not on screen at capture: ${slide.filter((x) => !shown.includes(x)).length}; missing: ${shown.filter((x) => !slide.includes(x)).join(',') || 'none'}; overlaps: ${v.length}`, v.slice(0, 6))
  await L.shot(page, `f2-${variant}`)
  await L.mode(page, 'Designer'); await L.shot(page, `f2-${variant}-designer`)
} finally { console.log('problems', problems); await browser.close() }
