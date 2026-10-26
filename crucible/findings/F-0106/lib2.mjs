// More helpers for run 195: selection, drags, alignment, Tidy around, undo/redo, pins.
import { settle, toasts, stored } from './lib.mjs'
export * from './lib.mjs'

export const node = (page, id) => page.locator(`.react-flow__node[data-id="${id}"]`)
export const wait = (page, ms) => page.waitForTimeout(ms)

/** Selects ids: a click on the first, Alt+click on the rest. */
export async function fitAll(page) { await page.getByRole('button', { name: 'Fit All' }).click(); await wait(page, 400); await settle(page) }
/** A point on the node's drawn box that the node itself takes (not a pill or another element over it). */
async function freePoint(page, id) {
  return page.evaluate((id) => {
    const el = document.querySelector(`.react-flow__node[data-id="${id}"]`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    for (let fy = 0.15; fy < 1; fy += 0.17) for (let fx = 0.1; fx < 1; fx += 0.1) {
      const x = r.x + r.width * fx, y = r.y + r.height * fy
      if (x < 360 || y < 60 || x > innerWidth - 10 || y > innerHeight - 50) continue
      const hit = document.elementFromPoint(x, y)
      if (hit && hit.closest('.react-flow__node') === el && !hit.closest('button, .react-flow__handle, .c4-node-collapse-btn')) return { x, y }
    }
    return null
  }, id)
}
/** Selects ids: a click on the first, the special key (Alt) + click on the rest, each where the node shows. */
export async function dismissToasts(page) {
  for (let i = 0; i < 10; i++) {
    const b = page.getByRole('button', { name: 'Dismiss notification' })
    if (!(await b.count())) break
    await b.first().click().catch(() => {})
    await wait(page, 150)
  }
  await wait(page, 300)
}
export async function select(page, ids) {
  await dismissToasts(page)
  for (let i = 0; i < ids.length; i++) {
    if (i) await page.keyboard.down('Alt')
    await wait(page, 250)
    let p = await freePoint(page, ids[i])
    if (!p) {
      if (i) await page.keyboard.up('Alt')
      await fitAll(page)
      if (i) await page.keyboard.down('Alt')
      await wait(page, 250)
      p = await freePoint(page, ids[i])
    }
    if (!p) throw new Error('no free point on ' + ids[i])
    await page.mouse.click(p.x, p.y)
    if (i) await page.keyboard.up('Alt')
    await wait(page, 300)
    await settle(page)
  }
  await wait(page, 300)
}

export async function align(page, ids, kind = 'row') {
  await select(page, ids)
  await page.getByRole('button', { name: /^Align/ }).click()
  await page.getByRole('menuitem', { name: kind === 'row' ? /Keep in a row/ : kind === 'column' ? /Keep in a column/ : /Keep in a grid/ }).click()
  await wait(page, 800)
  await settle(page)
}

/** Drags an element by (dx, dy) screen px, grabbing it near its top-left corner. */
export async function drag(page, id, dx, dy) {
  await dismissToasts(page)
  let p = await freePoint(page, id)
  if (!p) { await fitAll(page); p = await freePoint(page, id) }
  if (!p) throw new Error('no free point on ' + id)
  const { x, y } = p
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 6 })
  await page.mouse.move(x + dx, y + dy, { steps: 6 })
  await page.mouse.up()
  await wait(page, 500)
  await settle(page)
}

async function waitNotice(page, before, timeout) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const found = (await toasts(page)).slice(before).find((t) => /Smart layout/i.test(t))
    if (found) return found
    await wait(page, 150)
  }
  return null
}

/** Tidy around the current selection (the selection bar's or the card's button). */
export async function tidyAround(page, timeout = 120000) {
  const before = (await toasts(page)).length
  const t0 = Date.now()
  await page.getByRole('button', { name: 'Tidy around' }).first().click()
  const msg = await waitNotice(page, before, timeout)
  await wait(page, 600)
  await settle(page)
  return { msg, ms: Date.now() - t0 }
}

export async function undo(page) { await page.getByRole('button', { name: /^Undo/ }).first().click(); await wait(page, 400); await settle(page) }
export async function redo(page) { await page.getByRole('button', { name: /^Redo/ }).first().click(); await wait(page, 400); await settle(page) }

export async function viewOf(page, docId, viewId) {
  const d = await stored(page, docId)
  return d?.views?.find((v) => v.id === viewId)
}
export const pinsOf = (v) => (v?.layoutConstraints ?? []).filter((c) => c.type === 'pin').flatMap((c) => c.nodeIds ?? [c.nodeId]).sort()
export const alignsOf = (v) => (v?.layoutConstraints ?? []).filter((c) => c.type !== 'pin')

/** Largest spread of drawn centres on one axis. */
export function spread(boxes, ids, axis) {
  const c = ids.map((id) => axis === 'y' ? boxes[id].y + boxes[id].h / 2 : boxes[id].x + boxes[id].w / 2)
  return Math.max(...c) - Math.min(...c)
}
/** Double-clicks an element where it shows: opens its card. */
export async function openCard(page, id) {
  await dismissToasts(page)
  let p = await freePoint(page, id)
  if (!p) { await fitAll(page); p = await freePoint(page, id) }
  await page.mouse.dblclick(p.x, p.y)
  await wait(page, 600)
}
