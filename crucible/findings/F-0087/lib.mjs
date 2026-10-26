// Helpers for run 188 (node discussions). The repository is found by walking up to crucible.json.
import { existsSync, mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
export const DIR = dirname(fileURLToPath(import.meta.url))
export function repoRoot() {
  let d = DIR
  while (!existsSync(join(d, 'crucible.json'))) { const p = dirname(d); if (p === d) throw new Error('crucible.json not found above ' + DIR); d = p }
  return d
}
export const REPO = repoRoot()
const { chromium } = await import(pathToFileURL(join(REPO, 'node_modules/playwright/index.mjs')).href)

/** A persistent profile (OPFS handles need one), with showDirectoryPicker giving an OPFS folder. */
export async function launch({ port = 4599, width = 1280, height = 720, folder = 'model' } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'run199-'))
  const context = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width, height }, baseURL: `http://localhost:${port}` })
  const problems = []
  const watch = (page) => {
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
    page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) problems.push(`console.error: ${m.text()}`) })
  }
  context.on('page', watch)
  await context.route(/^https?:\/\/(?!localhost[:/])/, (r) => r.abort())
  await context.addInitScript((name) => {
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
  }, folder)
  const page = context.pages()[0] ?? await context.newPage()
  watch(page)
  const close = async () => { await context.close(); rmSync(profile, { recursive: true, force: true }) }
  return { context, page, problems, close, browser: { close } }
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
  return m ? decodeURIComponent(m[1]).replace(/^(ls|md):/, '') : null
}
/** Seed apps/e2e/fixtures/<name>.radical as the active document before the app loads (first load only). */
export async function seedFixture(context, name = 'bookstore', id = 'run199-doc', mutate) {
  let json = readFileSync(join(REPO, 'apps/e2e/fixtures', `${name}.radical`), 'utf8')
  if (mutate) json = JSON.stringify(mutate(JSON.parse(json)))
  await context.addInitScript(([id, data]) => {
    if (localStorage.getItem('radical-docs-index')) return
    localStorage.setItem('radical-docs-index', JSON.stringify({ docs: [{ id, name: 'E2E', source: 'ls', lastModified: 0 }], activeId: id }))
    localStorage.setItem(`radical-doc:${id}`, data)
  }, [id, json])
  return id
}
export async function openLs(page, id, view, mode = 'designer') {
  await page.goto(`/#/d/${encodeURIComponent(`ls:${id}`)}/m/${mode}/v/${view}`)
  await page.locator('.app-layout').waitFor()
  await settle(page)
}
/** Models → Manage models → Actions for <name> → Move to a folder… */
export async function moveToFolder(page, name = 'E2E') {
  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await page.getByRole('menuitem', { name: /Manage models/ }).click()
  await page.getByRole('button', { name: `Actions for ${name}` }).click()
  await page.getByRole('menuitem', { name: 'Move to a folder…' }).click()
  const models = page.getByRole('dialog', { name: 'Models' })
  await models.locator('.docmgr-badge.md').waitFor()
  await models.getByRole('button', { name: 'Close' }).click()
  await settle(page)
}
export const node = (page, id) => page.getByTestId(`rf__node-${id}`)
export async function discuss(page, nodeId, label) {
  await node(page, nodeId).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Discuss', exact: true }).click()
  const panel = page.getByRole('dialog', { name: label, exact: true })
  await panel.waitFor()
  return panel
}
export async function post(panel, text, page) {
  const body = panel.getByLabel('Comment (Markdown supported)')
  await body.click()
  await page.keyboard.type(text)
  await panel.getByRole('button', { name: 'Post comment' }).click()
  await panel.getByRole('status').filter({ hasText: 'Posted.' }).waitFor({ timeout: 8000 })
}
/** Every file in the OPFS folder: relative path → content. */
export async function files(page, name = 'model') {
  return page.evaluate(async (name) => {
    const out = {}
    const walk = async (dir, prefix) => {
      for await (const [entryName, entry] of dir) {
        const rel = prefix ? `${prefix}/${entryName}` : entryName
        try {
          if (entry.kind === 'directory') await walk(entry, rel)
          else out[rel] = await (await entry.getFile()).text()
        } catch (e) { if (e.name !== 'NotFoundError' && e.name !== 'NotReadableError') throw e }
      }
    }
    await walk(await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true }), '')
    return out
  }, name)
}
export async function writeFile(page, path, content, name = 'model') {
  await page.evaluate(async ([name, rel, text]) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
    const parts = rel.split('/')
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true })
    const w = await (await dir.getFileHandle(parts.at(-1), { create: true })).createWritable()
    await w.write(text); await w.close()
  }, [name, path, content])
}
export async function tab(page, name) {
  const t = page.getByRole('tab', { name, exact: true })
  if ((await t.getAttribute('aria-selected')) !== 'true') await t.click()
  await wait(page, 200)
}
export async function shot(page, name) { await page.screenshot({ path: join(DIR, 'shots', `${name}.png`) }) }
export function out(obj) { console.log(JSON.stringify(obj, null, 1)) }
export async function openSample(page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: /Sample model/ }).click()
  await page.waitForURL(/\/v\/view-ctx$/, { timeout: 30000 })
  await page.locator('.app-layout').waitFor()
  await settle(page)
  return docId(page)
}
/** A capture listener on window that records, after dispatch, whether F5 / Mod+P were prevented. */
export async function probeKeys(page) {
  await page.evaluate(() => {
    window.__keys = []
    if (!window.__probe) window.addEventListener('keydown', (e) => { if (e.key === 'F5' || ((e.metaKey || e.ctrlKey) && (e.key === 'p' || e.key === 'P'))) setTimeout(() => window.__keys.push({ key: `${e.ctrlKey ? 'Ctrl+' : ''}${e.metaKey ? 'Meta+' : ''}${e.key}`, prevented: e.defaultPrevented, presenting: !!document.querySelector('.mode-presenting'), focus: (document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName || '') + (document.activeElement?.closest('[role=search]') ? ' (search)' : '') }), 0) }, true)
    window.__probe = 1
  })
}
export async function keysLog(page) { await wait(page, 300); return page.evaluate(() => window.__keys) }
export const active = (page) => page.evaluate(() => { const a = document.activeElement; if (!a) return 'none'; const id = a.closest('.react-flow__node')?.dataset.id; return `${a.tagName}${a.id ? '#' + a.id : ''}${a.className && typeof a.className === 'string' ? '.' + a.className.split(' ')[0] : ''}${a.getAttribute('aria-label') ? '[' + a.getAttribute('aria-label') + ']' : ''}${a.textContent && a.tagName === 'BUTTON' ? '"' + a.textContent.slice(0, 30) + '"' : ''}${id ? ' node=' + id : ''}` })
