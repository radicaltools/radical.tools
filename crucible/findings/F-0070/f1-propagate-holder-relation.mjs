// Sample, Core Banking. In the live model FX Engine (a component of Payments Service) gets
// "uses" Accounts Service with the special key. Then, in milestone v3, FX Engine is nested into
// Accounts Service with the special key and the edit is propagated. Back in the live model, FX Engine
// is inside Accounts Service and still "uses" it: a structural relation to what holds it, which
// Studio refuses to draw and a nest made in the live model removes.
// mode connect: the other way round: FX Engine is nested into Accounts Service in the live model, then in
// v3 (where it is still in Payments Service) it gets "uses" Accounts Service, propagated.
// Args: [port=4590] [mode=propagate|connect|live]   (live: the same nest made in the live model, to compare)
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4590), mode = process.argv[3] ?? 'propagate'
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
const X = 'comp-fx', C = 'ctn-accounts'
async function gesture(pill) {
  const focus = page.getByRole('button', { name: 'Focus', exact: true })
  if ((await focus.getAttribute('aria-pressed')) !== 'false') await focus.click()
  await page.getByRole('button', { name: 'Fit All', exact: true }).click(); await L.wait(page, 1000)
  const s = await L.node(page, X).boundingBox()
  await page.mouse.click(s.x + 12, s.y + 8); await L.wait(page, 500)
  await page.keyboard.down('Alt'); await L.wait(page, 300)
  const t = await L.node(page, C).boundingBox()
  await page.mouse.move(s.x + 12, s.y + 8); await page.mouse.down()
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 10 }); await L.wait(page, 300)
  const pills = await page.locator(`.connect-pill[data-connect-target="${C}"]`).evaluateAll((e) => e.map((x) => `${x.dataset.connectType}:${x.textContent}`))
  const p = page.locator(`.connect-pill[data-connect-target="${C}"]`, { hasText: pill }).first()
  if (await p.count()) { const pb = await p.boundingBox(); await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2, { steps: 4 }); await L.wait(page, 200) }
  await page.mouse.up(); await page.keyboard.up('Alt')
  await L.wait(page, 2500); await L.settle(page)
  return pills
}
const toasts = () => page.locator('.toast-message').allInnerTexts()
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-core'); await L.wait(page, 2000)
  const state = async (d) => {
    const nodes = Array.isArray(d.nodes) ? d.nodes : Object.values(d.nodes)
    const rels = Array.isArray(d.relations) ? d.relations : Object.values(d.relations)
    return { parent: nodes.find((n) => n.id === X)?.parentId, rel: rels.filter((r) => r.sourceId === X && r.targetId === C).map((r) => r.relationType ?? '(untyped)') }
  }
  console.log('live at start:', JSON.stringify(await state(await L.stored(page, id))))
  const first = mode === 'connect' ? 'inside' : 'uses', second = mode === 'connect' ? 'uses' : 'inside'
  console.log(`pills (live, ${first}):`, await gesture(first))
  await L.wait(page, 1500)
  console.log(`live after ${first}:`, JSON.stringify(await state(await L.stored(page, id))))
  if (mode !== 'live') {
    await L.milestone(page, 'v3 – Full Platform'); await L.wait(page, 1000)
    const v3 = (await L.stored(page, id)).snapshots.find((s) => s.name.startsWith('v3'))
    console.log('v3 before:', JSON.stringify(await state(v3)))
    console.log(`pills (v3, ${second}):`, await gesture(second))
    console.log('notices:', JSON.stringify(await toasts()))
    await page.locator('.milestone-modal').waitFor()
    await page.getByRole('button', { name: /Propagate to later milestones/ }).click()
    await L.wait(page, 1500); await L.settle(page)
    await L.milestone(page, 'live'); await L.wait(page, 2500)
  } else {
    console.log('pills (live, inside):', await gesture('inside'))
    console.log('notices:', JSON.stringify(await toasts()))
  }
  await L.wait(page, 2000)
  const d = await L.stored(page, id)
  console.log('live at end:', JSON.stringify(await state(d)))
  console.log('v3 at end:', JSON.stringify(await state(d.snapshots.find((s) => s.name.startsWith('v3')))))
  console.log('v4 at end:', JSON.stringify(await state(d.snapshots.find((s) => s.name.startsWith('v4')))))
  await L.shot(page, `f1-${mode}-live-after`)
  const relIds = (Array.isArray(d.relations) ? d.relations : Object.values(d.relations)).filter((r) => r.sourceId === X && r.targetId === C).map((r) => r.id)
  const drawn = await page.locator('.react-flow__edge').evaluateAll((e) => e.map((x) => x.dataset.id))
  console.log(`live Core Banking draws that relation: ${relIds.filter((r) => drawn.some((e) => e?.includes(r))).length} of ${relIds.length}`)
  // Studio itself refuses that relation now: drawn again it says why.
  if (mode === 'propagate') {
    console.log('pills (live, after):', await gesture('uses'))
    console.log('notices:', JSON.stringify(await toasts()))
  }
} finally { console.log('problems', problems); await browser.close() }
