// Studio on a folder (OPFS, as apps/e2e/support/folder.ts) and the MCP server
// on a disk mirror of it. Port 4574.
import { ROOT } from './root.mjs'
import { connect } from './mcp.mjs'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
const { chromium } = await import(join(ROOT, 'node_modules/playwright/index.mjs'))
export const BASE = `http://localhost:${process.env.PORT ?? 4574}`
export const DIR = process.cwd()
export const wait = (page, ms) => page.waitForTimeout(ms)

export async function launch({ width = 1280, height = 720 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'run174-prof-'))
  const context = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width, height }, baseURL: BASE })
  const page = context.pages()[0] ?? await context.newPage()
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) problems.push(`console.error: ${m.text()}`) })
  await page.route(/^https?:\/\/(?!localhost[:/])/, (r) => r.abort())
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('model', { create: true })
  })
  const close = async () => { await context.close(); rmSync(profile, { recursive: true, force: true }) }
  return { context, page, problems, close }
}

export function fixture(name = 'bookstore') { return readFileSync(join(ROOT, `apps/e2e/fixtures/${name}.radical`), 'utf8') }

export async function seed(page, json, id = 'e2e-doc') {
  await page.addInitScript(([id, data]) => {
    if (localStorage.getItem('radical-docs-index')) return
    localStorage.setItem('radical-docs-index', JSON.stringify({ docs: [{ id, name: 'E2E', source: 'ls', lastModified: 0 }], activeId: id }))
    localStorage.setItem(`radical-doc:${id}`, data)
  }, [id, json])
}

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

export async function open(page, view, mode = 'designer', id = 'e2e-doc') {
  await page.goto(`/#/d/${encodeURIComponent(`ls:${id}`)}/m/${mode}/v/${view}`)
  await page.locator('.app-layout').waitFor()
  await settle(page)
}

/** Seeded document → folder, through the Models dialog. */
export async function moveToFolder(page) {
  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await page.getByRole('menuitem', { name: /Manage models/ }).click()
  const models = page.getByRole('dialog', { name: 'Models' })
  await models.waitFor()
  await page.getByRole('button', { name: 'Actions for E2E' }).click()
  await page.getByRole('menuitem', { name: 'Move to a folder…' }).click()
  await models.locator('.docmgr-badge.md').waitFor()
  await models.getByRole('button', { name: 'Close' }).click()
  await settle(page)
}

/** Every file of the OPFS folder. */
export async function files(page) {
  return page.evaluate(async () => {
    const out = {}
    const walk = async (dir, prefix) => {
      for await (const [name, entry] of dir) {
        const rel = prefix ? `${prefix}/${name}` : name
        try {
          if (entry.kind === 'directory') await walk(entry, rel)
          else for (let t = 0; ; t++) { try { out[rel] = await (await entry.getFile()).text(); break } catch (e) { if (t > 4) throw e; await new Promise((r) => setTimeout(r, 50)) } }
        } catch (e) { if (e.name !== 'NotFoundError') throw e }
      }
    }
    await walk(await (await navigator.storage.getDirectory()).getDirectoryHandle('model', { create: true }), '')
    return out
  })
}
export async function writeFile(page, rel, text) {
  await page.evaluate(async ([rel, text]) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('model', { create: true })
    const parts = rel.split('/')
    for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create: true })
    const w = await (await dir.getFileHandle(parts.at(-1), { create: true })).createWritable()
    await w.write(text); await w.close()
  }, [rel, text])
}
export async function removeFile(page, rel) {
  await page.evaluate(async (rel) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('model')
    const parts = rel.split('/')
    for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p)
    await dir.removeEntry(parts.at(-1))
  }, rel)
}

function readDisk(dir) {
  const out = {}
  const walk = (d, prefix) => { for (const n of readdirSync(d)) { const p = join(d, n), rel = prefix ? `${prefix}/${n}` : n; if (statSync(p).isDirectory()) walk(p, rel); else out[rel] = readFileSync(p, 'utf8') } }
  walk(dir, '')
  return out
}

/** Runs `calls(call)` with the MCP server on a disk copy of the folder, then
 *  writes what it changed back into the folder Studio has open (as the
 *  e2e test "an MCP model edit appears in the open browser canvas" does). */
export async function agent(page, calls) {
  const disk = mkdtempSync(join(tmpdir(), 'run174-disk-'))
  try {
    const before = await files(page)
    for (const [rel, text] of Object.entries(before)) { mkdirSync(dirname(join(disk, rel)), { recursive: true }); writeFileSync(join(disk, rel), text) }
    const c = await connect(disk)
    let result
    try { result = await calls(c.call) } finally { await c.close() }
    const after = readDisk(disk)
    const changed = []
    for (const [rel, text] of Object.entries(after)) if (text !== before[rel]) { await writeFile(page, rel, text); changed.push(rel) }
    for (const rel of Object.keys(before)) if (!(rel in after)) { await removeFile(page, rel); changed.push('-' + rel) }
    return { result, changed }
  } finally { rmSync(disk, { recursive: true, force: true }) }
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
export const positions = (page) => page.locator('.react-flow__node').evaluateAll((els) => Object.fromEntries(els.map((e) => [e.dataset.id, e.style.transform])))
export const node = (page, id) => page.getByTestId(`rf__node-${id}`)
export async function shot(page, name) { mkdirSync(join(DIR, 'shots'), { recursive: true }); await page.screenshot({ path: join(DIR, 'shots', `${name}.png`) }) }
export async function counts(page) { return page.locator('.search-bar, .toolbar').first().innerText().catch(() => '') }

/** Copies a disk folder into the OPFS folder and opens it with Open → Folder…. */
export async function openDiskFolder(page, dir) {
  await page.goto('/'); await page.waitForLoadState()
  for (const [rel, text] of Object.entries(readDisk(dir))) await writeFile(page, rel, text)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…', exact: true }).click()
  await page.locator('.app-layout').waitFor()
  await settle(page)
}
export { readDisk }
export async function designer(page) {
  await page.locator('.toolbar-mode-btn', { hasText: 'Designer' }).click()
  await page.locator('.toolbar-mode-btn.active', { hasText: 'Designer' }).waitFor()
  await settle(page)
}
