// Harness for run 189: Studio (web build, OPFS folder) + the MCP server on a disk mirror.
// Finds the repository by walking up to crucible.json; the port is argv --port (default 4589).
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, mkdir, rm, writeFile, readFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const RUN = dirname(fileURLToPath(import.meta.url))
let repo = RUN
while (!existsSync(join(repo, 'crucible.json'))) {
  const up = dirname(repo)
  if (up === repo) throw new Error('crucible.json not found above ' + RUN)
  repo = up
}
export const REPO = repo
const require = createRequire(join(REPO, 'package.json'))
const { chromium } = require('playwright')
const portArg = process.argv.indexOf('--port')
export const PORT = portArg > 0 ? Number(process.argv[portArg + 1]) : 4589
export const BASE = `http://localhost:${PORT}`
const clientMod = await import(join(REPO, 'node_modules/@modelcontextprotocol/client/dist/index.mjs'))
const stdioMod = await import(join(REPO, 'node_modules/@modelcontextprotocol/client/dist/stdio.mjs'))

export const fixture = (name) => readFileSync(join(REPO, 'apps/e2e/fixtures', `${name}.radical`), 'utf8')
export const benchModel = (path) => readFileSync(join(REPO, 'packages/layout/bench/models', path), 'utf8')
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function startBrowser({ width = 1600, height = 900 } = {}) {
  await mkdir(join(RUN, 'tmp'), { recursive: true })
  const profile = await mkdtemp(join(RUN, 'tmp', 'profile-'))
  const context = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width, height } })
  const page = context.pages()[0] ?? await context.newPage()
  const errors = []
  const logs = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
    if (/smartLayout|merge|tidy/i.test(m.text())) logs.push(m.text())
  })
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('request', (r) => { const u = r.url(); if (!/^(http:\/\/localhost|data:|blob:)/.test(u)) errors.push('outside request: ' + u) })
  await page.route(/hub\.radical\.tools/, (route) => route.fulfill({ status: 404, body: '' }))
  await page.addInitScript(() => {
    window.__toasts = []
    new MutationObserver(() => {
      for (const el of document.querySelectorAll('.toast-message')) {
        if (!el.__seen) { el.__seen = true; window.__toasts.push(el.innerText) }
      }
    }).observe(document, { childList: true, subtree: true })
  })
  await page.addInitScript((name) => {
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
  }, 'model')
  const close = async () => { await context.close(); await rm(profile, { recursive: true, force: true }) }
  return { context, page, errors, logs, close }
}

export async function seed(page, json, id = 'e2e-doc') {
  await page.addInitScript(([id, data]) => {
    if (localStorage.getItem('radical-docs-index')) return
    localStorage.setItem('radical-docs-index', JSON.stringify({ docs: [{ id, name: 'E2E', source: 'ls', lastModified: 0 }], activeId: id }))
    localStorage.setItem(`radical-doc:${id}`, data)
  }, [id, json])
}

export async function ready(page) {
  await page.locator('.react-flow__node, .tv-table, table').first().waitFor({ timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(800)
}

export async function open(page, view, mode = 'designer', docId = 'e2e-doc') {
  await page.goto(`${BASE}/#/d/${encodeURIComponent(`ls:${docId}`)}/m/${mode}/v/${view}`)
  await ready(page)
}

export async function saveAsFolder(page, docName = 'E2E') {
  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await page.getByRole('menuitem', { name: /Manage models/ }).click()
  const models = page.getByRole('dialog', { name: 'Models' })
  await models.waitFor()
  await page.getByRole('button', { name: `Actions for ${docName}` }).click()
  await page.getByRole('menuitem', { name: 'Move to a folder…' }).click()
  await models.locator('.docmgr-badge.md').waitFor()
  await models.getByRole('button', { name: 'Close' }).click()
  await waitFor(async () => Object.keys(await opfsFiles(page)).some((p) => p.startsWith('nodes/')), 15000)
}

export async function waitFor(fn, timeout = 10000, every = 250) {
  const end = Date.now() + timeout
  while (Date.now() < end) { if (await fn()) return true; await sleep(every) }
  return false
}

export async function opfsFiles(page, name = 'model') {
  return page.evaluate(async (name) => {
    const out = {}
    const walk = async (dir, prefix) => {
      for await (const [n, e] of dir) {
        const rel = prefix ? `${prefix}/${n}` : n
        try {
          if (e.kind === 'directory') await walk(e, rel)
          else {
            for (let i = 0; ; i++) {
              try { out[rel] = await (await e.getFile()).text(); break } catch (err) { if (err.name !== 'NotReadableError' || i > 4) throw err; await new Promise((r) => setTimeout(r, 50)) }
            }
          }
        } catch (err) { if (err.name !== 'NotFoundError') throw err }
      }
    }
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
    await walk(root, '')
    return out
  }, name)
}

export async function opfsWrite(page, path, content, name = 'model') {
  await page.evaluate(async ([name, rel, text]) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
    const parts = rel.split('/')
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true })
    const w = await (await dir.getFileHandle(parts.at(-1), { create: true })).createWritable()
    await w.write(text); await w.close()
  }, [name, path, content])
}

export async function opfsRemove(page, path, name = 'model') {
  await page.evaluate(async ([name, rel]) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(name)
    const parts = rel.split('/')
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part)
    await dir.removeEntry(parts.at(-1))
  }, [name, path])
}

export async function diskFiles(root) {
  const out = {}
  const walk = async (dir, prefix) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name
      if (e.isDirectory()) await walk(join(dir, e.name), rel)
      else out[rel] = await readFile(join(dir, e.name), 'utf8')
    }
  }
  await walk(root, '')
  return out
}

/** An MCP "agent" on a disk mirror of the OPFS folder. Each call: copy OPFS -> disk, call, copy changes back
 *  (unless writeBack is false: then the disk copy keeps the result and Studio sees nothing). */
export async function agent(page) {
  const disk = await mkdtemp(join(RUN, 'tmp', 'disk-'))
  let client = null
  const syncDown = async () => {
    await rm(disk, { recursive: true, force: true }); await mkdir(disk, { recursive: true })
    const files = await opfsFiles(page)
    for (const [p, c] of Object.entries(files)) { await mkdir(dirname(join(disk, p)), { recursive: true }); await writeFile(join(disk, p), c) }
    return files
  }
  const connect = async () => {
    client = new clientMod.Client({ name: 'claude-code', version: '1.0.0' })
    const transport = new stdioMod.StdioClientTransport({ command: process.execPath, args: [join(REPO, 'apps/mcp/dist/index.js'), '--folder', disk], stderr: 'pipe' })
    await client.connect(transport)
  }
  const call = async (name, args = {}, { writeBack = true, sync = true } = {}) => {
    const before = sync ? await syncDown() : await diskFiles(disk)
    await connect()
    let res
    try { res = await client.callTool({ name, arguments: args }, { timeout: 600_000, resetTimeoutOnProgress: true }) } finally { await client.close() }
    const after = await diskFiles(disk)
    if (writeBack) {
      for (const [p, c] of Object.entries(after)) if (c !== before[p]) await opfsWrite(page, p, c)
      for (const p of Object.keys(before)) if (!(p in after)) await opfsRemove(page, p).catch(() => {})
    }
    const text = res.content.map((c) => c.text).join('\n')
    return { ok: !res.isError, text, before, after }
  }
  return { call, disk, close: async () => rm(disk, { recursive: true, force: true }) }
}

export async function shot(page, name) {
  await mkdir(join(RUN, 'shots'), { recursive: true })
  await page.screenshot({ path: join(RUN, 'shots', name) })
}

export async function counts(page) {
  return page.evaluate(() => {
    const t = document.body.innerText.match(/(\d+) nodes? · (\d+) relations?/)
    return t ? { nodes: +t[1], relations: +t[2] } : null
  })
}

export const nodeIds = (page) => page.locator('.react-flow__node').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))
export async function boxes(page) {
  return page.locator('.react-flow__node').evaluateAll((els) => Object.fromEntries(els.map((e) => {
    const r = e.getBoundingClientRect(); return [e.getAttribute('data-id'), { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }]
  })))
}
/** Canvas-space positions from each node's transform (absolute). */
export async function transforms(page) {
  return page.locator('.react-flow__node').evaluateAll((els) => Object.fromEntries(els.map((e) => {
    const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(e.style.transform || '')
    return [e.getAttribute('data-id'), m ? { x: +m[1], y: +m[2] } : null]
  })))
}
/** Every toast message shown since the page loaded (window.__toasts). */
export async function notices(page) {
  return page.evaluate(() => window.__toasts ?? [])
}

export async function railTab(page, name) {
  const tab = page.getByRole('tab', { name, exact: true })
  if ((await tab.getAttribute('aria-selected')) !== 'true') { await tab.click(); await page.waitForTimeout(300) }
}

export function viewsOf(files) { return JSON.parse(files['views.json'] ?? '[]') }
export function viewPositions(files, viewId) {
  if (!viewId) return JSON.parse(files['_layout.json'] ?? '{}').defaultPositions ?? {}
  return viewsOf(files).find((v) => v.id === viewId)?.positions ?? {}
}
export function diffPositions(a, b, tol = 1) {
  const out = []
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const p = a[id], q = b[id]
    if (!p || !q) { out.push({ id, a: p ?? null, b: q ?? null }); continue }
    if (Math.abs(p.x - q.x) > tol || Math.abs(p.y - q.y) > tol) out.push({ id, a: { x: Math.round(p.x), y: Math.round(p.y) }, b: { x: Math.round(q.x), y: Math.round(q.y) } })
  }
  return out
}

/** Clicks Smart Layout and waits for its [smartLayout]/notice to arrive. */
export async function smartLayout(page, logs, timeout = 120000) {
  const before = (await notices(page)).length
  const t = Date.now()
  await page.getByRole('button', { name: /^Smart Layout$/ }).first().click()
  await waitFor(async () => (await notices(page)).slice(before).some((m) => /^Smart layout/i.test(m)), timeout, 200)
  const ms = Date.now() - t
  await sleep(1000)
  return { ms, notice: (await notices(page)).slice(before).filter((m) => /Smart layout/i.test(m)).join(' | ') }
}

/** Waits until no layout runs (the Smart Layout button is not busy). */
export async function layoutIdle(page, timeout = 120000) {
  await sleep(500)
  return waitFor(async () => !(await page.locator('.toolbar-btn-busy').count()), timeout, 250)
}

/** Writes a disk model folder into the OPFS folder and opens it through Open → Folder…. */
export async function openDiskFolder(page, dir) {
  await page.goto(BASE + '/')
  for (const [p, c] of Object.entries(await diskFiles(dir))) await opfsWrite(page, p, c)
  await page.goto(BASE + '/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await page.locator('.welcome-overlay').waitFor({ state: 'hidden', timeout: 60000 })
  await ready(page)
  await designer(page)
}

export async function designer(page) {
  await page.locator('.toolbar-mode-btn', { hasText: 'Designer' }).click()
  await waitFor(async () => /Designer/.test(await page.locator('.toolbar-mode-btn.active').innerText().catch(() => '')))
  await sleep(500)
}

/** Clicks a view card in the Views tab by its title. */
export async function openViewCard(page, name) {
  await railTab(page, 'Views')
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  await page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: new RegExp(`^${esc}$`) }) }).first().click()
  await ready(page)
}

/** Pairs of drawn elements that overlap without one holding the other (screen boxes, 2 px slack). */
export async function overlaps(page) {
  const b = await boxes(page)
  const ids = Object.keys(b).filter((id) => b[id].w > 0)
  const out = []
  const inside = (p, q) => p.x >= q.x - 2 && p.y >= q.y - 2 && p.x + p.w <= q.x + q.w + 2 && p.y + p.h <= q.y + q.h + 2
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const p = b[ids[i]], q = b[ids[j]]
    const ix = Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x), iy = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y)
    if (ix > 2 && iy > 2 && !inside(p, q) && !inside(q, p)) out.push([ids[i], ids[j], Math.round(ix), Math.round(iy)])
  }
  return out
}
