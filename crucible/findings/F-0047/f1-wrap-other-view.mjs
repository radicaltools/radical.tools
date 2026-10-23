// Sample: Wrap into… → Group on Fraud Detection in Core Banking, then open Payments Domain (which
// also shows Fraud Detection, in Risk & Data) from the Views panel. What moves there?
// Args: [port=4582] [node=ctn-fraud] [type=Group]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4582), held = process.argv[3] ?? 'ctn-fraud', type = process.argv[4] ?? 'Group'
const other = 'view-payments'
const { browser, page, problems } = await L.launch({ port, width: 1600, height: 1000 })
const goView = async (name) => {
  await L.tab(page, 'Views')
  const card = page.locator('.lp-view-card').filter({ hasText: name }).first()
  await card.scrollIntoViewIfNeeded(); await card.click()
  await L.settle(page); await L.wait(page, 2500); await L.settle(page)
}
try {
  const id = await L.openSample(page)
  await L.open(page, id, other)
  await L.wait(page, 1500); await L.settle(page)
  const o0 = await L.frames(page)
  await L.shot(page, 'f1-payments-before')
  await goView('Core Banking')
  const s0 = await L.viewPos(page, id, other)
  const c0 = await L.frames(page)
  await L.node(page, held).dblclick({ position: { x: 10, y: 10 } })
  const actions = page.locator('.right-panel.open').getByRole('region', { name: 'Actions' })
  await actions.getByRole('button', { name: /^Wrap into…/ }).click()
  await actions.getByRole('menu').getByRole('menuitem', { name: type, exact: true }).click()
  await L.wait(page, 3000); await L.settle(page)
  const p1 = await L.parents(page, id)
  const c1 = await L.frames(page)
  console.log(`Core Banking: ${held} now in ${p1[held]}; besides it and the new group, moved: ${JSON.stringify(Object.keys(L.diff(c0, c1)).filter((k) => k !== held))}`)
  await goView('Payments Domain')
  const o1 = await L.frames(page)
  const moved = L.diff(o0, o1)
  console.log(`Payments Domain after the wrap: ${Object.keys(moved).length} of ${Object.keys(o0).length} elements moved or resized`)
  L.out(moved)
  console.log('new group drawn on Payments Domain:', !!o1[p1[held]])
  console.log('violations', L.violations(o1, p1))
  await L.shot(page, 'f1-payments-after')
  await L.wait(page, 2000)
  const s1 = await L.viewPos(page, id, other)
  console.log('saved Payments Domain positions changed for:', Object.keys(L.posDiff(s0, s1)).join(', ') || 'none')
  // Undo the wrap (one step), then back to Payments Domain: is it as it was?
  await L.undo(page)
  console.log('after Undo: url', page.url().replace(/.*\/v\//, 'view '), 'parent', (await L.parents(page, id))[held])
  await goView('Payments Domain')
  const o2 = await L.frames(page)
  console.log('Payments Domain after Undo vs before the wrap:', Object.keys(L.diff(o0, o2)).length, 'moved', Object.keys(L.diff(o0, o2)).join(', '))
  await L.shot(page, 'f1-payments-after-undo')
  await L.wait(page, 2000)
  console.log('saved Payments Domain positions after Undo differ from before the wrap for:', Object.keys(L.posDiff(s0, await L.viewPos(page, id, other))).join(', ') || 'none')
} finally { console.log('problems', problems); await browser.close() }
