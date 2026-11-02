// Helpers for run 173 (milestones, undo, presentations).
import { chromium } from '/Volumes/data/Dev/rd-cli/node_modules/playwright/index.mjs'
export const BASE = 'http://localhost:4573'
export const DIR = new URL('.', import.meta.url).pathname

export async function launch({ width = 1280, height = 720 } = {}) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width, height }, baseURL: BASE })
  const page = await context.newPage()
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) problems.push(`console.error: ${m.text()}`) })
  await page.route(/^https?:\/\/(?!localhost[:/])/, (r) => r.abort())
  return { browser, context, page, problems }
}

export const wait = (page, ms) => page.waitForTimeout(ms)

export async function settle(page) {
  const vp = page.locator('.react-flow__viewport')
  if (!(await vp.count())) { await wait(page, 300); return }
  let prev = '', stable = 0
  for (let i = 0; i < 60 && stable < 3; i++) {
    const cur = (await vp.first().getAttribute('style').catch(() => '')) ?? ''
    stable = cur === prev ? stable + 1 : 0
    prev = cur
    await wait(page, 100)
  }
}

export function docId(page) {
  const m = page.url().match(/#\/d\/([^/]+)/)
  return m ? decodeURIComponent(m[1]).replace(/^ls:/, '') : null
}

export async function openSample(page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: /Sample model/ }).click()
  await page.waitForURL(/\/v\/view-ctx$/)
  await page.locator('.app-layout').waitFor()
  await settle(page)
  return docId(page)
}

export async function open(page, id, view, mode = 'designer', extra = '') {
  await page.goto(`/#/d/${encodeURIComponent(`ls:${id}`)}/m/${mode}/v/${view}${extra}`)
  await page.locator('.app-layout').waitFor()
  await settle(page)
}

export async function mode(page, name) {
  await page.locator('.toolbar-mode-btn', { hasText: name }).click()
  await page.locator('.toolbar-mode-btn.active', { hasText: name }).waitFor()
  await settle(page)
}

export async function stored(page, id) {
  return JSON.parse(await page.evaluate((k) => localStorage.getItem(k), `radical-doc:${id}`))
}
export async function storedRaw(page, id) {
  return page.evaluate((k) => localStorage.getItem(k), `radical-doc:${id}`)
}

export async function tab(page, name) {
  const t = page.getByRole('tab', { name, exact: true })
  if ((await t.getAttribute('aria-selected')) !== 'true') await t.click()
  await wait(page, 200)
}

export async function view(page, name) {
  await tab(page, 'Views')
  await page.locator('.lp-view-card', { hasText: name }).first().click()
  await settle(page)
}

export async function milestone(page, name) {
  await tab(page, 'Milestones')
  if (name === 'live') await page.locator('.lp-snap-current').click()
  else await page.locator('.lp-snap-card', { hasText: name }).first().click()
  await settle(page)
}

export const node = (page, id) => page.getByTestId(`rf__node-${id}`)
export const drawn = (page) => page.locator('.react-flow__node').evaluateAll((els) => els.map((e) => e.dataset.id))
export const positions = (page) => page.locator('.react-flow__node').evaluateAll((els) => Object.fromEntries(els.map((e) => [e.dataset.id, e.style.transform])))

export async function undo(page) { await page.getByTitle(/^Undo/).click(); await settle(page) }
export async function redo(page) { await page.getByTitle(/^Redo/).click(); await settle(page) }
export async function canUndo(page) { return !(await page.getByTitle(/^Undo/).isDisabled()) }

export async function shot(page, name) { await page.screenshot({ path: `${DIR}shots/${name}.png` }) }

export async function plus(page, label) {
  const menu = page.getByRole('menu', { name: `Add to ${label}` })
  const isOpen = await menu.waitFor({ state: 'visible', timeout: 800 }).then(() => true, () => false)
  if (!isOpen) await page.getByRole('button', { name: new RegExp(`^Show \\d+ more related to ${label}$`) }).click()
  await menu.waitFor()
  return menu
}
export async function showAll(page, label) {
  await (await plus(page, label)).getByRole('menuitem', { name: /^Show all/ }).click()
  await settle(page)
}

export async function explore(page, id) {
  await node(page, id).click({ position: { x: 8, y: 8 } })
  await page.locator('.right-panel.open').getByRole('button', { name: 'Explore', exact: true }).click()
  await settle(page)
}

export async function saveAsView(page, name) {
  await page.getByRole('button', { name: 'Save as view…' }).click()
  const form = page.getByRole('form', { name: 'Save as view' })
  await form.getByLabel('Name').fill(''); await form.getByLabel('Name').pressSequentially(name)
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  await settle(page)
}

export const modal = (page) => page.locator('.milestone-modal')
export async function answer(page, which) {
  const m = modal(page)
  await m.waitFor()
  const name = { continue: 'Continue editing (decide later)', propagate: /Propagate to later milestones/, discard: /Discard changes/, new: /Save as new milestone/ }[which]
  await m.getByRole('button', { name }).click()
  await settle(page)
}

export const snaps = (doc) => (doc.snapshots ?? []).map((s) => `${s.name}:${s.nodes?.length}`)
export function out(obj) { console.log(JSON.stringify(obj, null, 1)) }

export async function drag(page, id, dx, dy) {
  const b = await node(page, id).boundingBox()
  const x = b.x + 12, y = b.y + 12
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 5 })
  await page.mouse.move(x + dx, y + dy, { steps: 5 })
  await page.mouse.up()
  await settle(page)
}
export const viewOf = (doc, id) => doc.views.find((v) => v.id === id)

export async function boxes(page) {
  return page.locator('.react-flow__node').evaluateAll((els) => Object.fromEntries(els.map((el) => { const r = el.getBoundingClientRect(); return [el.dataset.id, { x: r.x, y: r.y, width: r.width, height: r.height }] })))
}
export function violations(bx, parentOf) {
  const E = 1, ids = Object.keys(bx), out = []
  const vp = (id) => { let p = parentOf[id]; while (p && !bx[p]) p = parentOf[p]; return p }
  const inter = (a, b) => a.x + a.width - E > b.x && b.x + b.width - E > a.x && a.y + a.height - E > b.y && b.y + b.height - E > a.y
  const cont = (o, i) => i.x >= o.x - E && i.y >= o.y - E && i.x + i.width <= o.x + o.width + E && i.y + i.height <= o.y + o.height + E
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (vp(ids[i]) === vp(ids[j]) && inter(bx[ids[i]], bx[ids[j]])) out.push(`overlap ${ids[i]}~${ids[j]}`)
  for (const id of ids) { const p = vp(id); if (p && !cont(bx[p], bx[id])) out.push(`outside ${id}/${p}`) }
  return out
}
export const parents = (doc) => Object.fromEntries(doc.nodes.map((n) => [n.id, n.parentId]))

/** Pairs of drawn elements whose boxes overlap, neither an ancestor of the other. */
export function overlaps(bx, parentOf) {
  const anc = (a, b) => { let p = parentOf[b]; while (p) { if (p === a) return true; p = parentOf[p] } return false }
  const ids = Object.keys(bx), out = []
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = bx[ids[i]], b = bx[ids[j]]
    if (anc(ids[i], ids[j]) || anc(ids[j], ids[i])) continue
    if (a.x + a.width - 1 > b.x && b.x + b.width - 1 > a.x && a.y + a.height - 1 > b.y && b.y + b.height - 1 > a.y) out.push(`${ids[i]}~${ids[j]}`)
  }
  return out
}
