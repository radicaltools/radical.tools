import { chromium } from '/Volumes/data/Dev/rd-cli/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
export const BASE = 'http://localhost:4575'
export const DIR = new URL('.', import.meta.url).pathname.replace(/\/$/, '')
export const FIX = '/Volumes/data/Dev/rd-cli/apps/e2e/fixtures'
export function fixture(name) { return readFileSync(`${FIX}/${name}.radical`, 'utf8') }
export function withWhole(json) {
  const d = JSON.parse(json); d.views = [...(d.views ?? []), { id: 'v-whole', name: 'Whole model', kind: 'static', nodeIds: [], positions: {} }]; return JSON.stringify(d)
}
export async function launch({ width = 1280, height = 720, headless = true } = {}) {
  const browser = await chromium.launch({ headless })
  const context = await browser.newContext({ viewport: { width, height }, baseURL: BASE })
  const page = await context.newPage()
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) problems.push(`console.error: ${m.text()}`)
    if (/\[smartLayout\]/.test(m.text())) page.__sl = (page.__sl ?? []).concat(m.text())
  })
  await page.route(/^https?:\/\/(?!localhost[:/])/, (r) => r.abort())
  return { browser, context, page, problems, close: () => browser.close() }
}
export async function seedDocument(page, json, id = 'e2e-doc') {
  await page.addInitScript(([id, data]) => {
    if (localStorage.getItem('radical-docs-index')) return
    localStorage.setItem('radical-docs-index', JSON.stringify({ docs: [{ id, name: 'E2E', source: 'ls', lastModified: 0 }], activeId: id }))
    localStorage.setItem(`radical-doc:${id}`, data)
  }, [id, json])
}
export async function settle(page) {
  if (!(await page.locator('.canvas-area').count())) { await page.waitForTimeout(300); return }
  const vp = page.locator('.react-flow__viewport')
  let prev = '', stable = 0
  for (let i = 0; i < 80 && stable < 3; i++) {
    const cur = (await vp.count()) ? (await vp.getAttribute('style')) ?? '' : ''
    stable = cur === prev ? stable + 1 : 0; prev = cur
    await page.waitForTimeout(100)
  }
}
export async function ready(page) {
  await page.locator('.app-layout').waitFor({ state: 'visible', timeout: 20000 })
  await settle(page)
}
export async function open(page, view, mode = 'designer', docId = 'e2e-doc') {
  await page.goto(`/#/d/${encodeURIComponent(`ls:${docId}`)}/m/${mode}/v/${view}`)
  await ready(page)
}
export function activeDocId(page) {
  const m = page.url().match(/#\/d\/([^/]+)/); return m ? decodeURIComponent(m[1]).replace(/^ls:/, '') : 'e2e-doc'
}
export async function openSample(page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: /Sample model/ }).click()
  await page.waitForURL(/\/v\/view-ctx$/)
  await ready(page)
  return activeDocId(page)
}
export async function stored(page, docId = activeDocId(page)) {
  return JSON.parse(await page.evaluate((k) => localStorage.getItem(k), `radical-doc:${docId}`))
}
/** canvas transforms (absolute) of each node */
export async function canvasPos(page) {
  return page.locator('.react-flow__node').evaluateAll((els) => Object.fromEntries(els.map((el) => {
    const m = el.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
    return [el.dataset.id, { x: m ? +m[1] : NaN, y: m ? +m[2] : NaN, w: el.offsetWidth, h: el.offsetHeight }]
  })))
}
export async function boxes(page) {
  return page.locator('.react-flow__node').evaluateAll((els) => Object.fromEntries(els.map((el) => {
    const r = el.getBoundingClientRect(); return [el.dataset.id, { x: r.x, y: r.y, width: r.width, height: r.height }]
  })))
}
export function violations(b, parentOf) {
  const EPS = 1, ids = Object.keys(b), out = []
  const vp = (id) => { let p = parentOf[id]; while (p && !b[p]) p = parentOf[p]; return p }
  const inter = (a, c) => a.x + a.width - EPS > c.x && c.x + c.width - EPS > a.x && a.y + a.height - EPS > c.y && c.y + c.height - EPS > a.y
  const cont = (o, i) => i.x >= o.x - EPS && i.y >= o.y - EPS && i.x + i.width <= o.x + o.width + EPS && i.y + i.height <= o.y + o.height + EPS
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    if (vp(ids[i]) !== vp(ids[j])) continue
    if (inter(b[ids[i]], b[ids[j]])) out.push(`overlap: ${ids[i]} <> ${ids[j]}`)
  }
  for (const id of ids) { const p = vp(id); if (p && !cont(b[p], b[id])) out.push(`outside: ${id} in ${p}`) }
  return out
}
export async function layoutViolations(page) {
  const d = await stored(page); const parentOf = Object.fromEntries(d.nodes.map((n) => [n.id, n.parentId]))
  return violations(await boxes(page), parentOf)
}
export async function smartLayout(page) {
  await page.getByRole('button', { name: 'Smart Layout', exact: true }).click()
  const done = page.getByTitle(/^Why this layout\?/).or(page.getByText(/^Smart layout: /))
  await done.first().waitFor({ state: 'visible', timeout: 60000 })
  await settle(page)
}
export async function switchView(page, name) {
  await railTab(page, 'Views')
  const card = page.locator('.lp-view-card', { hasText: name }).first()
  await card.click(); await settle(page)
}
export function diff(a, b, eps = 0.5) {
  const out = {}
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!a[k] || !b[k]) { out[k] = [a[k], b[k]]; continue }
    if (Math.abs(a[k].x - b[k].x) > eps || Math.abs(a[k].y - b[k].y) > eps) out[k] = [`${a[k].x.toFixed(1)},${a[k].y.toFixed(1)}`, `${b[k].x.toFixed(1)},${b[k].y.toFixed(1)}`]
  }
  return out
}
export async function waitStill(page, ms = 1500, max = 20000) {
  // wait until canvas positions do not change for ms
  let prev = JSON.stringify(await canvasPos(page)), t0 = Date.now(), still = Date.now()
  while (Date.now() - t0 < max) {
    await page.waitForTimeout(200)
    const cur = JSON.stringify(await canvasPos(page))
    if (cur !== prev) { prev = cur; still = Date.now() } else if (Date.now() - still >= ms) return
  }
}
export async function openSampleWhole(page) {
  const id = await openSample(page)
  const key = `radical-doc:${id}`
  for (let i = 0; i < 50 && !(await page.evaluate((k) => localStorage.getItem(k) !== null, key)); i++) await page.waitForTimeout(100)
  const json = await page.evaluate((k) => localStorage.getItem(k), key)
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, withWhole(json)])
  await page.reload(); await ready(page)
  await open(page, 'v-whole', 'designer', id)
  return id
}
export const show = (a, b) => { const out = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = a[k], y = b[k]; if (!x || !y || Math.abs(x.x - y.x) > .5 || Math.abs(x.y - y.y) > .5 || x.w !== y.w || x.h !== y.h) out[k] = `${x ? `${x.x.toFixed(0)},${x.y.toFixed(0)} ${x.w}x${x.h}` : '-'} -> ${y ? `${y.x.toFixed(0)},${y.y.toFixed(0)} ${y.w}x${y.h}` : '-'}` } return out }

// run 175: the activity rail replaced the accordion and the Radical menu.
export async function railTab(page, name) {
  const tab = page.getByRole('tab', { name, exact: true })
  if ((await tab.getAttribute('aria-selected')) !== 'true') { await tab.click(); await page.waitForTimeout(300) }
}
