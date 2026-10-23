// Helpers for run 181. The repository is found by walking up to crucible.json.
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

export async function launch({ port = 4581, width = 1280, height = 720 } = {}) {
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
export async function seedFixture(context, name = 'bookstore', id = 'run181-doc') {
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
/** The metamodel editor's Validation: count and messages (opens and closes the editor). */
export async function validation(page) {
  await openEditor(page)
  const count = (await page.locator('.mm-issues-count').innerText().catch(() => '?')).trim()
  const messages = await page.locator('.mm-issue-msg').allInnerTexts()
  await closeEditor(page); await wait(page, 300)
  return { count, messages }
}
/** Notifications on screen now. */
export async function notices(page) {
  return [...new Set((await page.locator('[class*="notification"], [role="alert"], [role="status"]').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean))]
}
/** The table's lines: rows ("  type name") and + rows ("  + …"). */
export async function tableLines(page) {
  return page.locator('.tv-table tbody tr').evaluateAll((trs) => trs.map((tr) => {
    if (tr.classList.contains('tv-add-row')) return `${'  '.repeat(tr.querySelectorAll('.tv-tree-guide').length)}[${tr.innerText.trim()}]`
    if (!tr.classList.contains('tv-row')) return null
    const depth = tr.querySelectorAll('.tv-tree-guide').length
    const type = tr.querySelector('.tv-chain-type')?.innerText ?? ''
    const name = tr.querySelector('.tv-chain-cell')?.innerText.replace(type, '').trim()
    return `${'  '.repeat(depth)}${type}: ${name}${tr.classList.contains('tv-row-selected') ? '  <sel>' : ''}`
  }).filter(Boolean))
}
/** Welcome → New model → Create model (browser storage, the metamodel's views). */
export async function newModel(page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'New model' }).click()
  await page.getByRole('button', { name: 'Create model' }).click()
  await page.locator('.app-layout').waitFor()
  await settle(page)
  return docId(page)
}
/** Open a view's properties from its card (Views tab). */
export async function viewProps(page, name) {
  await tab(page, 'Views')
  const card = page.locator('.lp-view-card', { hasText: name }).first()
  await card.scrollIntoViewIfNeeded()
  await card.hover()
  await card.getByTitle('View properties').click()
  await wait(page, 400)
}
export async function setViewType(page, name, kind) {
  await viewProps(page, name)
  await page.getByRole('group', { name: 'View type' }).getByRole('button', { name: kind, exact: true }).click()
  await wait(page, 600)
}
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
/** A persistent profile whose directory picker hands out an OPFS folder (apps/e2e/support/folder.ts). */
export async function launchFolder({ port = 4581, width = 1280, height = 720, folder = 'model' } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'run181-'))
  const context = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width, height }, baseURL: `http://localhost:${port}` })
  await context.addInitScript((name) => { window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true }) }, folder)
  const page = context.pages()[0] ?? await context.newPage()
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) problems.push(`console.error: ${m.text()}`) })
  await page.route(/^https?:\/\/(?!localhost[:/])/, (r) => r.abort())
  const browser = { close: async () => { await context.close(); rmSync(profile, { recursive: true, force: true }) } }
  return { browser, context, page, problems, folder }
}
export async function folderFiles(page, name = 'model') {
  return page.evaluate(async (name) => {
    const out = {}
    const walk = async (dir, prefix) => { for await (const [n, e] of dir) { const rel = prefix ? `${prefix}/${n}` : n; if (e.kind === 'directory') await walk(e, rel); else { try { out[rel] = await (await e.getFile()).text() } catch {} } } }
    await walk(await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true }), '')
    return out
  }, name)
}
export async function folderWrite(page, path, text, name = 'model') {
  await page.evaluate(async ([name, rel, text]) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
    const parts = rel.split('/'); for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create: true })
    const w = await (await dir.getFileHandle(parts.at(-1), { create: true })).createWritable(); await w.write(text); await w.close()
  }, [name, path, text])
}
export async function folderRemove(page, path, name = 'model') {
  await page.evaluate(async ([name, rel]) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(name)
    const parts = rel.split('/'); for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p)
    await dir.removeEntry(parts.at(-1))
  }, [name, path])
}
/** The open model to a folder, through Models → Actions → Move to a folder…. */
export async function moveToFolder(page) {
  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await page.getByRole('menuitem', { name: /Manage models/ }).click()
  const models = page.getByRole('dialog', { name: 'Models' })
  await models.waitFor()
  await models.getByRole('button', { name: /^Actions for / }).first().click()
  await page.getByRole('menuitem', { name: 'Move to a folder…' }).click()
  await models.locator('.docmgr-badge.md').first().waitFor()
  await models.getByRole('button', { name: 'Close' }).click()
  await wait(page, 1500)
}
/** "N nodes · M relations" from the search bar. */
export async function counts(page) {
  const t = await page.locator('input[placeholder*="nodes"]').first().getAttribute('placeholder').catch(() => '')
  return t
}
