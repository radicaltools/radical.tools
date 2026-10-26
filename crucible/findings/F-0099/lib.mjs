// Helpers for run 196. The repository is found by walking up to crucible.json.
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

export async function launch({ port = 4596, width = 1280, height = 720 } = {}) {
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
export async function seedFixture(context, name = 'bookstore', id = 'run196-doc') {
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
  const notices0 = await page.getByText(/already scores best|nothing left to tidy/).count()
  await page.getByRole('button', { name: 'Smart Layout', exact: true }).click()
  const t0 = Date.now()
  let notice = null
  while (Date.now() - t0 < timeout) {
    await wait(page, 250)
    if (line) break
    if ((await page.getByText(/already scores best|nothing left to tidy/).count()) > notices0) { notice = 'already scores best'; break }
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

/** Every drawn relation: its path and its label's spot, by edge id. */
export async function edges(page) {
  const paths = await page.locator('.react-flow__edge').evaluateAll((els) => Object.fromEntries(els.map((e) => {
    const id = (e.getAttribute('data-testid') ?? '').replace(/^rf__edge-/, '')
    const p = e.querySelector('path.react-flow__edge-path')
    return [id, p?.getAttribute('d') ?? null]
  })))
  const labels = await page.locator('.relation-label').evaluateAll((els) => els.map((e) => {
    const m = e.style.transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*$/)
    return { text: e.textContent, x: m ? +(+m[1]).toFixed(1) : null, y: m ? +(+m[2]).toFixed(1) : null }
  }))
  return { paths, labels }
}
/** What differs between two edge captures. */
export function edgeDiff(a, b) {
  const out = []
  for (const k of new Set([...Object.keys(a.paths), ...Object.keys(b.paths)])) {
    if (a.paths[k] !== b.paths[k]) out.push({ edge: k, before: a.paths[k], after: b.paths[k] })
  }
  const key = (l) => l.text
  const la = [...a.labels].sort((p, q) => key(p).localeCompare(key(q)) || p.x - q.x || p.y - q.y)
  const lb = [...b.labels].sort((p, q) => key(p).localeCompare(key(q)) || p.x - q.x || p.y - q.y)
  const labels = []
  if (la.length !== lb.length) labels.push(`label count ${la.length} -> ${lb.length}`)
  for (let i = 0; i < Math.min(la.length, lb.length); i++) {
    if (la[i].text !== lb[i].text || Math.abs(la[i].x - lb[i].x) > 0.5 || Math.abs(la[i].y - lb[i].y) > 0.5) labels.push(`${la[i].text} (${la[i].x},${la[i].y}) -> ${lb[i].text} (${lb[i].x},${lb[i].y})`)
  }
  return { paths: out, labels }
}
/** Sets the active view's Lines in its properties (opened from its card). */
export async function setLines(page, viewName, value) {
  const sel = page.getByLabel('Lines', { exact: true })
  if (await sel.isVisible()) await page.getByRole('button', { name: '◀ Back' }).click()
  await tab(page, 'Views')
  const card = page.locator('.lp-view-card').filter({ hasText: viewName }).first()
  await card.hover()
  await card.getByTitle('View properties').click()
  await page.getByLabel('Lines', { exact: true }).selectOption(value)
  await wait(page, 500)
  await settle(page)
}
/** Clicks the collapse/expand button of a container on the canvas. */
export async function toggle(page, id) {
  await node(page, id).locator('.c4-node-collapse-btn').first().click()
  await wait(page, 800); await settle(page); await wait(page, 800); await settle(page)
}
export async function reload(page) {
  await page.reload(); await page.locator('.app-layout').waitFor(); await settle(page); await wait(page, 1500); await settle(page)
}
export function report(label, f0, f1, e0, e1) {
  const fd = diff(f0, f1), ed = edgeDiff(e0, e1)
  console.log(`${label}: ${Object.keys(fd).length} frames differ ${JSON.stringify(fd)}; ${ed.paths.length} paths differ ${JSON.stringify(ed.paths.slice(0, 2))}; labels ${JSON.stringify(ed.labels.slice(0, 6))}`)
  return { fd, ed }
}

/** Points along an SVG path (M, L, Q, C; absolute), curves sampled. */
export function pathPoints(d) {
  const toks = d.match(/[MLQC]|-?[\d.]+(?:e-?\d+)?/g) ?? []
  const pts = []; let i = 0, cmd = null, cur = null
  const num = () => +toks[i++]
  while (i < toks.length) {
    if (/[MLQC]/.test(toks[i])) cmd = toks[i++]
    if (cmd === 'M' || cmd === 'L') { cur = { x: num(), y: num() }; pts.push(cur) }
    else if (cmd === 'Q') { const c = { x: num(), y: num() }, e = { x: num(), y: num() }; for (let t = 0.25; t <= 1; t += 0.25) pts.push({ x: (1 - t) ** 2 * cur.x + 2 * (1 - t) * t * c.x + t * t * e.x, y: (1 - t) ** 2 * cur.y + 2 * (1 - t) * t * c.y + t * t * e.y }); cur = e }
    else if (cmd === 'C') { const c1 = { x: num(), y: num() }, c2 = { x: num(), y: num() }, e = { x: num(), y: num() }; for (let t = 0.1; t <= 1.0001; t += 0.1) { const u = 1 - t; pts.push({ x: u ** 3 * cur.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * e.x, y: u ** 3 * cur.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * e.y }) } cur = e }
    else i++
  }
  return pts
}
/** Drawn relations with their ends: { id, source, target, d }. */
export async function edgeEnds(page) {
  return page.locator('.react-flow__edge').evaluateAll((els) => els.map((e) => {
    const m = (e.getAttribute('aria-label') ?? '').match(/^Edge from (.+) to (.+)$/)
    return { id: (e.getAttribute('data-testid') ?? '').replace(/^rf__edge-/, ''), source: m?.[1], target: m?.[2], d: e.querySelector('path.react-flow__edge-path')?.getAttribute('d') ?? '' }
  }))
}
/** Lines whose ends are off their element's border, or that run over an element they do not touch. */
export function lineProblems(es, fr, parentOf, { tol = 3, inset = 6 } = {}) {
  const out = []
  const anc = (id) => { const a = []; for (let p = parentOf[id]; p; p = parentOf[p]) a.push(p); return a }
  const kids = new Set(Object.keys(fr).map((k) => parentOf[k]).filter(Boolean))
  const onBorder = (p, b) => {
    if (!b) return false
    const inX = p.x >= b.x - tol && p.x <= b.x + b.w + tol, inY = p.y >= b.y - tol && p.y <= b.y + b.h + tol
    return inX && inY && (Math.abs(p.x - b.x) <= tol || Math.abs(p.x - b.x - b.w) <= tol || Math.abs(p.y - b.y) <= tol || Math.abs(p.y - b.y - b.h) <= tol)
  }
  for (const e of es) {
    const pts = pathPoints(e.d)
    if (!pts.length) continue
    const s = pts[0], t = pts[pts.length - 1]
    if (!onBorder(s, fr[e.source])) out.push(`${e.id}: start (${s.x.toFixed(1)},${s.y.toFixed(1)}) off ${e.source} ${JSON.stringify(fr[e.source])}`)
    if (!onBorder(t, fr[e.target])) out.push(`${e.id}: end (${t.x.toFixed(1)},${t.y.toFixed(1)}) off ${e.target} ${JSON.stringify(fr[e.target])}`)
    const skip = new Set([e.source, e.target, ...anc(e.source), ...anc(e.target)])
    for (const [id, b] of Object.entries(fr)) {
      if (skip.has(id) || kids.has(id)) continue
      if (anc(id).includes(e.source) || anc(id).includes(e.target)) continue
      // walk the polyline finely
      let hit = false
      for (let k = 1; k < pts.length && !hit; k++) {
        const a = pts[k - 1], c = pts[k], n = Math.max(1, Math.ceil(Math.hypot(c.x - a.x, c.y - a.y) / 4))
        for (let j = 0; j <= n; j++) {
          const x = a.x + (c.x - a.x) * j / n, y = a.y + (c.y - a.y) * j / n
          if (x > b.x + inset && x < b.x + b.w - inset && y > b.y + inset && y < b.y + b.h - inset) { hit = true; break }
        }
      }
      if (hit) out.push(`${e.id} (${e.source}->${e.target}) runs over ${id}`)
    }
  }
  return out
}
/** Crossings between drawn lines (polylines from their paths), not counting touches at shared ends. */
export function crossings(es) {
  const segs = es.map((e) => { const p = pathPoints(e.d); return { e, s: p.slice(1).map((q, i) => [p[i], q]) } })
  const x = (a, b, c, d) => {
    const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0
  }
  let n = 0; const pairs = []
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const A = segs[i], B = segs[j]
    if (A.e.source === B.e.source || A.e.source === B.e.target || A.e.target === B.e.source || A.e.target === B.e.target) continue
    let c = 0
    for (const [a, b] of A.s) for (const [p, q] of B.s) if (x(a, b, p, q)) c++
    if (c) { n += 1; pairs.push(`${A.e.id}x${B.e.id}:${c}`) }
  }
  return { n, pairs }
}
/** Relation label boxes in flow coordinates. */
export async function labelBoxes(page) {
  return page.locator('.relation-label').evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden').map((e) => {
    const m = e.style.transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*$/)
    const w = e.offsetWidth, h = e.offsetHeight
    return { text: e.textContent, x: +m[1] - w / 2, y: +m[2] - h / 2, w, h }
  }))
}
/** Labels over elements (leaves) and over each other. */
export function labelProblems(labels, fr, parentOf) {
  const kids = new Set(Object.keys(fr).map((k) => parentOf[k]).filter(Boolean))
  const ov = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  const out = []
  for (const l of labels) for (const [id, b] of Object.entries(fr)) if (!kids.has(id) && ov(l, b) > 4) out.push(`label "${l.text}" over ${id} (${ov(l, b).toFixed(0)} px²)`)
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) if (ov(labels[i], labels[j]) > 4) out.push(`label "${labels[i].text}" over label "${labels[j].text}" (${ov(labels[i], labels[j]).toFixed(0)} px²)`)
  return out
}

/** Exports the view through the rail's Export menu; returns { name, data: Buffer }. */
export async function exportAs(page, item = 'Export as PNG…') {
  const { readFile } = await import('node:fs/promises')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const download = page.waitForEvent('download', { timeout: 30000 })
  await page.getByText(item, { exact: true }).click()
  const file = await download
  return { name: file.suggestedFilename(), data: await readFile(await file.path()) }
}

/** Seed a document (object or JSON string) as the active document before the app loads. */
export async function seedDoc(context, doc, id = 'run196-doc') {
  const json = typeof doc === 'string' ? doc : JSON.stringify(doc)
  await context.addInitScript(([id, data]) => {
    if (localStorage.getItem('radical-docs-index')) return
    localStorage.setItem('radical-docs-index', JSON.stringify({ docs: [{ id, name: 'E2E', source: 'ls', lastModified: 0 }], activeId: id }))
    localStorage.setItem(`radical-doc:${id}`, data)
  }, [id, json])
  return id
}
export function fixture(name = 'bookstore') { return JSON.parse(readFileSync(join(REPO, 'apps/e2e/fixtures', `${name}.radical`), 'utf8')) }
export const focusBtn = (page) => page.locator('.canvas-focus-toggle')
export async function smartFitOff(page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const item = page.getByRole('menuitemcheckbox', { name: /Smart fit/ })
  if ((await item.getAttribute('aria-checked')) === 'true') await item.click()
  await page.keyboard.press('Escape'); await wait(page, 300)
}
export async function perspective(page, name) {
  await page.getByRole('button', { name, exact: true }).first().click()
  await settle(page); await wait(page, 600)
}

/** Lines that run through one of their own end elements (beyond the first and last `skip` px of the path). */
export function ownEndProblems(es, fr, { inset = 4, skip = 12 } = {}) {
  const out = []
  for (const e of es) {
    const pts = pathPoints(e.d)
    if (pts.length < 2) continue
    // walk the polyline finely, keeping the distance along it
    const samples = []
    let along = 0
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], c = pts[k], len = Math.hypot(c.x - a.x, c.y - a.y), n = Math.max(1, Math.ceil(len / 3))
      for (let j = 0; j < n; j++) samples.push({ x: a.x + (c.x - a.x) * j / n, y: a.y + (c.y - a.y) * j / n, s: along + len * j / n })
      along += len
    }
    for (const end of [e.source, e.target]) {
      const b = fr[end]; if (!b) continue
      const hits = samples.filter((p) => p.s > skip && p.s < along - skip && p.x > b.x + inset && p.x < b.x + b.w - inset && p.y > b.y + inset && p.y < b.y + b.h - inset)
      if (hits.length) out.push(`${e.id} (${e.source}->${e.target}) runs ${hits.length * 3} px inside its own end ${end}`)
    }
  }
  return out
}
