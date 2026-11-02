// New model (Radical metamodel), All elements as a structure: a Software System (named System) satisfies a Requirement (special-key drag);
// then the requirement is nested into Shop (special key, "inside"). The "satisfies" relation is removed,
// it cannot be drawn again, and the new model's Responsibilities view (systems that satisfy requirements) empties.
import { launch, stored, settle, wait, out, shot, node, recordToasts, toasts } from './lib.mjs'
import { newModel, openCard, openCardNamed, dropType } from './nm.mjs'
const port = +(process.argv[2] || 4577)
const { browser, context, page, problems } = await launch({ port })
await recordToasts(context)
const id = await newModel(page)
await openCard(page, 1) // All elements, structure
await dropType(page, 'Software System', 700, 250)
await dropType(page, 'Requirement', 350, 500)
const d0 = await stored(page, id)
const S = d0.nodes.find(n => n.type === 'system'), R = d0.nodes.find(n => n.type === 'requirement')
const centre = async (nid) => { const b = await node(page, nid).boundingBox(); return { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 20) } }
const altDrag = async (from, to, pill) => {
  await node(page, from).click({ position: { x: 20, y: 10 } }); await settle(page)
  await page.keyboard.down('Alt')
  const a = await centre(from), b = await centre(to)
  await page.mouse.move(a.x, a.y); await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 10 })
  await wait(page, 300)
  const pills = await page.locator('.connect-pill').allInnerTexts()
  if (pill) {
    const p = page.locator('.connect-pill', { hasText: pill }).first()
    if (await p.count()) { const pb = await p.boundingBox(); await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2, { steps: 3 }) }
  }
  await page.mouse.up(); await page.keyboard.up('Alt')
  await settle(page); await wait(page, 2500)
  return pills
}
const rels = async () => (await stored(page, id)).relations.map(r => `${r.sourceId === S.id ? 'Shop' : r.sourceId === R.id ? 'Requirement' : r.sourceId} -${r.relationType}-> ${r.targetId === S.id ? 'Shop' : r.targetId === R.id ? 'Requirement' : r.targetId}`)
const parentOfR = async () => ((await stored(page, id)).nodes.find(n => n.id === R.id).parentId === S.id ? 'Shop' : 'top')
const log = []
log.push({ step: '1. Shop -> Requirement with the special key', pills: await altDrag(S.id, R.id), relations: await rels(), toasts: await toasts(page) })
const rows = async () => (await page.locator('.tv-row').allInnerTexts()).map(s => s.replace(/\s+/g, ' '))
await openCardNamed(page, 'Responsibilities')
log.push({ step: '1b. Responsibilities view', rows: await rows() })
await openCard(page, 1)
log.push({ step: '2. Requirement into Shop with the special key (inside)', pills: await altDrag(R.id, S.id, 'inside'), parent: await parentOfR(), relations: await rels(), toasts: await toasts(page) })
await shot(page, 'f3-nested')
log.push({ step: '3. Shop -> Requirement again', pills: await altDrag(S.id, R.id), relations: await rels(), toasts: await toasts(page) })
await openCardNamed(page, 'Responsibilities')
log.push({ step: '4. Responsibilities view', rows: await rows(), empty: await page.locator('.tv-empty').allInnerTexts() })
await shot(page, 'f3-responsibilities')
out({ log, problems })
await browser.close()
