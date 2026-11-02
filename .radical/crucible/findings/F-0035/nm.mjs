// Helpers for a new model in the browser.
import { stored, docId, settle, wait, tab } from './lib.mjs'
export async function newModel(page, { empty = false } = {}) {
  await page.goto('/')
  await page.getByRole('button', { name: 'New model' }).click()
  if (empty) await page.getByRole('radio', { name: /Empty/ }).check()
  await page.getByRole('button', { name: 'Create model' }).click()
  await page.locator('.app-layout').waitFor(); await settle(page); await wait(page, 1500)
  return docId(page)
}
export async function openCard(page, nth) { await tab(page, 'Views'); await page.locator('.lp-view-card').nth(nth).click(); await settle(page); await wait(page, 600) }
export async function openCardNamed(page, text) { await tab(page, 'Views'); await page.locator('.lp-view-card', { hasText: text }).first().click(); await settle(page); await wait(page, 600) }
export async function dropType(page, type, x, y, { alt = true } = {}) {
  if (alt) await page.keyboard.down('Alt')
  await page.locator('.palette-item', { hasText: new RegExp(`^${type}$`) }).first().dragTo(page.locator('.react-flow__pane'), { targetPosition: { x, y }, force: true })
  if (alt) await page.keyboard.up('Alt')
  await settle(page); await wait(page, 2500)
}
export const undo = async (page) => { await page.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(page); await wait(page, 2500) }
export const redo = async (page) => { await page.getByRole('button', { name: 'Redo', exact: true }).click(); await settle(page); await wait(page, 2500) }
export const model = (d) => JSON.stringify({ nodes: d.nodes.map(n => ({ id: n.id, t: n.type, l: n.label, p: n.parentId })).sort((a, b) => a.id < b.id ? -1 : 1), rels: d.relations, views: d.views.map(v => ({ id: v.id, name: v.name, n: v.nodeIds, e: v.empty, f: v.folder, pl: v.pipeline, pos: v.positions, g: v.group, vp: v.viewpoint, el: v.element ?? v.subject })) })
export function viewDiff(a, b) {
  const A = JSON.parse(model(a)), B = JSON.parse(model(b)); const out = []
  if (JSON.stringify(A.nodes) !== JSON.stringify(B.nodes)) out.push({ nodes: [A.nodes, B.nodes] })
  if (JSON.stringify(A.rels) !== JSON.stringify(B.rels)) out.push({ rels: [A.rels, B.rels] })
  const va = Object.fromEntries(A.views.map(v => [v.id, v])), vb = Object.fromEntries(B.views.map(v => [v.id, v]))
  for (const k of new Set([...Object.keys(va), ...Object.keys(vb)])) if (JSON.stringify(va[k]) !== JSON.stringify(vb[k])) out.push({ view: k, a: va[k], b: vb[k] })
  return out
}
export async function openMember(page, group, member) {
  await tab(page, 'Views')
  const body = page.getByRole('group', { name: group, exact: true })
  if (!(await body.count())) await page.locator('.lp-view-group', { hasText: group }).first().click()
  await body.locator('.lp-view-card', { hasText: member }).first().click()
  await settle(page); await wait(page, 800)
}
