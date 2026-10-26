// Helpers for run 186 scripts: Studio driven through Playwright.
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const here = dirname(fileURLToPath(import.meta.url))

export function repoRoot() {
  let d = here
  while (!existsSync(join(d, 'crucible.json'))) {
    const up = dirname(d)
    if (up === d) throw new Error('crucible.json not found above ' + here)
    d = up
  }
  return d
}

export function shot(name) {
  mkdirSync(join(here, 'shots'), { recursive: true })
  return join(here, 'shots', name)
}

export async function launch(port, { width = 1280, height = 720 } = {}) {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width, height }, baseURL: `http://localhost:${port}` })
  const page = await context.newPage()
  const problems = []
  const infos = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) problems.push(`console.error: ${m.text()}`)
    if (m.text().startsWith('[smartLayout]')) infos.push(m.text())
  })
  await page.route(/^https?:\/\/(?!localhost[:/])/, (r) => r.abort())
  await page.addInitScript(() => {
    window.__toasts = []
    const seen = new WeakSet()
    new MutationObserver(() => {
      for (const t of document.querySelectorAll('.toast')) {
        if (seen.has(t)) continue
        seen.add(t)
        window.__toasts.push(t.textContent)
      }
    }).observe(document, { childList: true, subtree: true })
  })
  return { browser, context, page, problems, infos, close: () => browser.close() }
}

export async function seed(page, id, json) {
  await page.addInitScript(([id, data]) => {
    if (localStorage.getItem('radical-docs-index')) return
    localStorage.setItem('radical-docs-index', JSON.stringify({ docs: [{ id, name: 'Run186', source: 'ls', lastModified: 0 }], activeId: id }))
    localStorage.setItem(`radical-doc:${id}`, data)
  }, [id, typeof json === 'string' ? json : JSON.stringify(json)])
}

export async function open(page, docId, view, mode = 'designer') {
  await page.goto(`/#/d/${encodeURIComponent(`ls:${docId}`)}/m/${mode}/v/${view}`)
  await ready(page)
}

export async function ready(page) {
  await page.locator('.app-layout').waitFor({ timeout: 30000 })
  await settle(page)
}

export async function settle(page) {
  if (!(await page.locator('.react-flow__viewport').count())) { await page.waitForTimeout(500); return }
  let prev = '', stable = 0
  for (let i = 0; i < 80 && stable < 4; i++) {
    const cur = (await page.locator('.react-flow__viewport').getAttribute('style').catch(() => '')) ?? ''
    stable = cur === prev ? stable + 1 : 0
    prev = cur
    await page.waitForTimeout(100)
  }
}

/** Opens the bundled sample; returns its doc id. */
export async function openSample(page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: /Sample model/ }).click()
  await page.waitForURL(/\/v\/view-ctx$/, { timeout: 30000 })
  await ready(page)
  return docId(page)
}

export function docId(page) {
  const m = page.url().match(/#\/d\/([^/]+)/)
  return m ? decodeURIComponent(m[1]).replace(/^ls:/, '') : null
}

export async function stored(page, id) {
  const json = await page.evaluate((k) => localStorage.getItem(k), `radical-doc:${id}`)
  return json ? JSON.parse(json) : null
}

/** Canvas positions: absolute transforms by id. */
export async function canvas(page) {
  return page.locator('.react-flow__node').evaluateAll((els) => Object.fromEntries(els.map((el) => {
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(el.style.transform)
    return [el.dataset.id, { x: Number(m?.[1]), y: Number(m?.[2]), w: el.offsetWidth, h: el.offsetHeight }]
  })))
}

export async function toasts(page) { return page.evaluate(() => window.__toasts.slice()) }

/** Clicks Smart Layout and waits for its notice; returns the notice text and ms taken. */
export async function smartLayout(page, timeout = 120000) {
  const before = (await toasts(page)).length
  const t0 = Date.now()
  await page.getByRole('button', { name: 'Smart Layout', exact: true }).click()
  const end = Date.now() + timeout
  let msg = null
  while (Date.now() < end) {
    const ts = await toasts(page)
    const found = ts.slice(before).find((t) => /Smart layout/i.test(t))
    if (found) { msg = found; break }
    await page.waitForTimeout(200)
  }
  const ms = Date.now() - t0
  await page.waitForTimeout(800)
  await settle(page)
  return { msg, ms }
}

export async function waitSaved(page, id, pred, timeout = 20000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const d = await stored(page, id)
    if (d && pred(d)) return d
    await page.waitForTimeout(250)
  }
  return null
}

/** Overlapping siblings and children outside parents, from canvas boxes. */
export function violations(boxes, parentOf) {
  const ids = Object.keys(boxes)
  const vp = (id) => { let p = parentOf[id]; while (p && !boxes[p]) p = parentOf[p]; return p }
  const out = []
  const E = 1
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = boxes[ids[i]], b = boxes[ids[j]]
    if (vp(ids[i]) !== vp(ids[j])) continue
    if (a.x + a.w - E > b.x && b.x + b.w - E > a.x && a.y + a.h - E > b.y && b.y + b.h - E > a.y) out.push(`overlap ${ids[i]} ~ ${ids[j]}`)
  }
  for (const id of ids) {
    const p = vp(id)
    if (!p) continue
    const o = boxes[p], c = boxes[id]
    if (!(c.x >= o.x - E && c.y >= o.y - E && c.x + c.w <= o.x + o.w + E && c.y + c.h <= o.y + o.h + E)) out.push(`outside ${id} in ${p}`)
  }
  return out
}

export async function screenBoxes(page) {
  return page.locator('.react-flow__node').evaluateAll((els) => Object.fromEntries(els.map((el) => {
    const r = el.getBoundingClientRect()
    return [el.dataset.id, { x: r.x, y: r.y, w: r.width, h: r.height }]
  })))
}

export function diffPositions(a, b, eps = 0.5) {
  const out = []
  for (const id of new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) {
    const p = a?.[id], q = b?.[id]
    if (!p || !q) { out.push([id, p ? 'removed' : 'added']); continue }
    if (Math.abs(p.x - q.x) > eps || Math.abs(p.y - q.y) > eps) out.push([id, Math.round(q.x - p.x), Math.round(q.y - p.y)])
  }
  return out
}
