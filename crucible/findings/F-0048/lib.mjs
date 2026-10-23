// Helpers for run 182. The repository is found by walking up to crucible.json.
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
export const DIR = dirname(fileURLToPath(import.meta.url))
export function repoRoot() {
  let d = DIR
  while (!existsSync(join(d, 'crucible.json'))) { const p = dirname(d); if (p === d) throw new Error('crucible.json not found above ' + DIR); d = p }
  return d
}
export const REPO = repoRoot()
const { chromium } = await import(pathToFileURL(join(REPO, 'node_modules/playwright/index.mjs')).href)

export async function launch({ port = 4582, width = 1280, height = 720 } = {}) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width, height }, baseURL: `http://localhost:${port}` })
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
    const cur = await page.locator('.react-flow__node').evaluateAll((els) => els.map((e) => e.style.transform + e.style.width + e.style.height).join('|')).catch(() => '')
    stable = cur === prev ? stable + 1 : 0
    prev = cur
    await wait(page, 120)
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
export async function stored(page, id) { return JSON.parse(await page.evaluate((k) => localStorage.getItem(k), `radical-doc:${id}`)) }
export async function tab(page, name) {
  const t = page.getByRole('tab', { name, exact: true })
  if ((await t.getAttribute('aria-selected')) !== 'true') await t.click()
  await wait(page, 200)
}
export async function milestone(page, name) {
  await tab(page, 'Milestones')
  if (name === 'live') await page.locator('.lp-snap-current').click()
  else await page.locator('.lp-snap-card', { hasText: name }).first().click()
  await settle(page)
}
export const node = (page, id) => page.getByTestId(`rf__node-${id}`)
/** Drawn boxes in flow coordinates: transform + style size. */
export async function frames(page) {
  return page.locator('.react-flow__node').evaluateAll((els) => Object.fromEntries(els.map((e) => {
    const m = e.style.transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/)
    const r = e.getBoundingClientRect()
    return [e.dataset.id, { x: m ? +(+m[1]).toFixed(1) : null, y: m ? +(+m[2]).toFixed(1) : null, w: +(parseFloat(e.style.width) || r.width).toFixed(1), h: +(parseFloat(e.style.height) || r.height).toFixed(1) }]
  })))
}
export async function drag(page, id, dx, dy, { at = [12, 12] } = {}) {
  const b = await node(page, id).boundingBox()
  const x = b.x + at[0], y = b.y + at[1]
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 5 })
  await page.mouse.move(x + dx, y + dy, { steps: 5 })
  await page.mouse.up()
  await settle(page)
}
export function diff(a, b, eps = 0.5) {
  const out = {}
  for (const k of Object.keys(a)) {
    if (!b[k]) { out[k] = 'gone'; continue }
    const d = {}
    for (const f of ['x', 'y', 'w', 'h']) if (Math.abs((a[k][f] ?? 0) - (b[k][f] ?? 0)) > eps) d[f] = `${a[k][f]} -> ${b[k][f]}`
    if (Object.keys(d).length) out[k] = d
  }
  return out
}
export async function shot(page, name) { await page.screenshot({ path: join(DIR, 'shots', `${name}.png`) }) }
export function out(obj) { console.log(JSON.stringify(obj, null, 1)) }
import { readFileSync } from 'node:fs'
/** Seed apps/e2e/fixtures/<name>.radical as the active document before the app loads. */
export async function seedFixture(context, name = 'bookstore', id = 'run182-doc') {
  const json = readFileSync(join(REPO, 'apps/e2e/fixtures', `${name}.radical`), 'utf8')
  await context.addInitScript(([id, data]) => {
    if (localStorage.getItem('radical-docs-index')) return
    localStorage.setItem('radical-docs-index', JSON.stringify({ docs: [{ id, name: 'E2E', source: 'ls', lastModified: 0 }], activeId: id }))
    localStorage.setItem(`radical-doc:${id}`, data)
  }, [id, json])
  return id
}
export async function openEditor(page) {
  await page.getByRole('button', { name: 'Metamodel editor', exact: true }).click()
  await page.getByRole('button', { name: 'Close metamodel editor' }).waitFor()
}
export const closeEditor = (page) => page.getByRole('button', { name: 'Close metamodel editor' }).click()

/** Geometry problems on the drawn canvas: a child outside its parent, siblings overlapping. */
export function violations(fr, parentOf, tol = 1) {
  const out = []
  const ids = Object.keys(fr)
  for (const id of ids) {
    const p = parentOf[id]
    if (p && fr[p]) {
      const c = fr[id], f = fr[p]
      if (c.x < f.x - tol || c.y < f.y - tol || c.x + c.w > f.x + f.w + tol || c.y + c.h > f.y + f.h + tol) out.push(`${id} outside ${p}`)
    }
  }
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i], b = ids[j]
    if ((parentOf[a] ?? '') !== (parentOf[b] ?? '')) continue
    const A = fr[a], B = fr[b]
    const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x), oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y)
    if (ox > tol && oy > tol) out.push(`${a} overlaps ${b} (${ox.toFixed(0)}x${oy.toFixed(0)})`)
  }
  return out
}
export async function parents(page, id) { return Object.fromEntries((await stored(page, id)).nodes.map((n) => [n.id, n.parentId])) }
export async function undo(page) { await page.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(page); await wait(page, 800); await settle(page) }
export async function redo(page) { await page.getByRole('button', { name: 'Redo', exact: true }).click(); await settle(page); await wait(page, 800); await settle(page) }
/** Special-key drag of `from` onto `to` (at a point inside it), with `from` selected first. */
export async function nestDrag(page, from, to, { at, key = 'Alt', select = true } = {}) {
  if (select) { await node(page, from).click({ position: { x: 10, y: 10 } }); await settle(page) }
  await page.keyboard.down(key)
  const a = await node(page, from).boundingBox()
  const b = await node(page, to).boundingBox()
  const tx = b.x + (at ? at[0] : b.width / 2), ty = b.y + (at ? at[1] : b.height / 2)
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(tx, ty, { steps: 10 })
  await wait(page, 200)
  await page.mouse.up()
  await page.keyboard.up(key)
  await settle(page)
}
export function posDiff(a, b) { const d = {}; for (const k of new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) { const x = a?.[k], y = b?.[k]; if (!x || !y || Math.abs(x.x - y.x) > 0.01 || Math.abs(x.y - y.y) > 0.01 || Math.abs((x.width ?? 0) - (y.width ?? 0)) > 0.01 || Math.abs((x.height ?? 0) - (y.height ?? 0)) > 0.01) d[k] = [x, y] } return d }
export async function viewPos(page, id, view) { const doc = await stored(page, id); return view === 'canvas' ? doc.defaultPositions : doc.views.find((v) => v.id === view).positions }
/** Clicks Smart Layout and waits for its console line or its notice. Returns { line, notice }. */
export async function smartLayout(page, { timeout = 60000 } = {}) {
  let line = null
  const on = (m) => { if (m.text().startsWith('[smartLayout]') && !m.text().includes('failed')) line = m.text() }
  page.on('console', on)
  const notices0 = await page.getByText(/already scores best/).count()
  await page.getByRole('button', { name: 'Smart Layout', exact: true }).click()
  const t0 = Date.now()
  let notice = null
  while (Date.now() - t0 < timeout) {
    await wait(page, 250)
    if (line) break
    if ((await page.getByText(/already scores best/).count()) > notices0) { notice = 'already scores best'; break }
  }
  page.off('console', on)
  await settle(page); await wait(page, 1500); await settle(page)
  return { winner: line ? line.split(' ')[1] : null, notice }
}
export async function focusOff(page) {
  const b = page.locator('button.canvas-focus-toggle')
  if ((await b.getAttribute('aria-pressed')) === 'true') await b.click()
  await wait(page, 200)
}
