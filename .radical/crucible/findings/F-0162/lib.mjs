// Helpers for run 214: Studio on a large model folder (OPFS in a persistent profile).
// The repository is found by walking up to the folder that holds .radical/crucible/crucible.json.
import { existsSync, mkdtempSync, rmSync, readFileSync, mkdirSync, cpSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
export const DIR = dirname(fileURLToPath(import.meta.url))
export function repoRoot() {
  let d = DIR
  while (!existsSync(join(d, '.radical/crucible/crucible.json'))) { const p = dirname(d); if (p === d) throw new Error('repository not found above ' + DIR); d = p }
  return d
}
export const REPO = repoRoot()
const { chromium } = await import(pathToFileURL(join(REPO, 'node_modules/playwright/index.mjs')).href)
export const wait = (page, ms) => page.waitForTimeout(ms)

/** The repository's own model repeated `copies` times, as path → text
 *  (a copy of .radical/model read without writing anything to it). */
export function largeModel(copies) {
  const out = join(DIR, `x${copies}.json`)
  if (!existsSync(out)) {
    const tmp = mkdtempSync(join(tmpdir(), 'r214-src-'))
    cpSync(join(REPO, '.radical/model'), tmp, { recursive: true })
    rmSync(join(tmp, '.state'), { recursive: true, force: true })
    const r = spawnSync(process.execPath, ['--import', 'tsx', join(DIR, 'gen.mts'), tmp, String(copies), out], { cwd: DIR, encoding: 'utf8' })
    rmSync(tmp, { recursive: true, force: true })
    if (r.status !== 0) throw new Error(r.stderr)
  }
  return JSON.parse(readFileSync(out, 'utf8'))
}

/** A Chromium with a persistent (on-disk) profile, the folder picker handing out OPFS `name`. */
export async function launch({ port = 4514, width = 1440, height = 900, name = 'model' } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'r214-prof-'))
  const context = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width, height }, baseURL: `http://localhost:${port}` })
  const page = context.pages()[0] ?? await context.newPage()
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) problems.push(`console.error: ${m.text().slice(0, 400)}`) })
  page.on('console', (m) => { if (process.env.LOG && /smartLayout|cache|error/i.test(m.text())) console.log('  [console]', m.text().slice(0, 300)) })
  await context.route(/^https?:\/\/(?!localhost[:/])/, (r) => r.abort())
  await page.addInitScript(() => { if (!localStorage.getItem('radical-studio-settings')) localStorage.setItem('radical-studio-settings', JSON.stringify({ setupDone: true })) })
  await page.addInitScript((n) => {
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(n, { create: true })
  }, name)
  const close = async () => { await context.close(); rmSync(profile, { recursive: true, force: true }) }
  return { context, page, problems, close, name }
}

/** Writes `files` into OPFS folder `name` (needs a page on the app's origin). */
export async function seed(page, files, name = 'model') {
  const entries = Object.entries(files)
  for (let i = 0; i < entries.length; i += 500) {
    await page.evaluate(async ([n, chunk]) => {
      const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(n, { create: true })
      const dirs = new Map()
      for (const [rel, text] of chunk) {
        const parts = rel.split('/')
        let dir = root
        for (let j = 0; j < parts.length - 1; j++) {
          const key = parts.slice(0, j + 1).join('/')
          dir = dirs.get(key) ?? await dir.getDirectoryHandle(parts[j], { create: true })
          dirs.set(key, dir)
        }
        const w = await (await dir.getFileHandle(parts[parts.length - 1], { create: true })).createWritable()
        await w.write(text); await w.close()
      }
    }, [name, entries.slice(i, i + 500)])
  }
}

export async function readFile(page, rel, name = 'model') {
  return page.evaluate(async ([n, rel]) => {
    try {
      let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(n)
      const parts = rel.split('/')
      for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p)
      return await (await (await dir.getFileHandle(parts[parts.length - 1])).getFile()).text()
    } catch { return null }
  }, [name, rel])
}
export async function writeFile(page, rel, text, name = 'model') {
  await page.evaluate(async ([n, rel, text]) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(n, { create: true })
    const parts = rel.split('/')
    for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create: true })
    const w = await (await dir.getFileHandle(parts[parts.length - 1], { create: true })).createWritable()
    await w.write(text); await w.close()
  }, [name, rel, text])
}
export async function removeEntry(page, rel, name = 'model') {
  await page.evaluate(async ([n, rel]) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(n)
    const parts = rel.split('/')
    for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p)
    await dir.removeEntry(parts[parts.length - 1], { recursive: true })
  }, [name, rel])
}
export async function listFiles(page, name = 'model') {
  return page.evaluate(async (n) => {
    const out = {}
    const walk = async (dir, prefix) => {
      for await (const [e, h] of dir) {
        const rel = prefix ? `${prefix}/${e}` : e
        if (h.kind === 'directory') await walk(h, rel)
        else { const f = await h.getFile(); out[rel] = `${f.lastModified}:${f.size}` }
      }
    }
    await walk(await (await navigator.storage.getDirectory()).getDirectoryHandle(n), '')
    return out
  }, name)
}

/** Opens the folder through Open → Folder…, waits until the views are listed. */
export async function openFolder(page, { least = 5 } = {}) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await page.locator('.app-layout').waitFor({ timeout: 300_000 })
  for (let i = 0; i < 600; i++) { if ((await page.locator('.lp-view-card').count()) >= least) break; await wait(page, 200) }
}

export async function settle(page) {
  const vp = page.locator('.react-flow__viewport')
  if (!(await vp.count())) { await wait(page, 500); return }
  let prev = '', stable = 0
  for (let i = 0; i < 100 && stable < 3; i++) {
    const cur = await page.locator('.react-flow__node').evaluateAll((els) => els.map((e) => e.style.transform + e.style.width + e.style.height).join('|')).catch(() => '')
    stable = cur === prev ? stable + 1 : 0
    prev = cur
    await wait(page, 150)
  }
}

export async function tab(page, name) {
  const t = page.getByRole('tab', { name, exact: true })
  if ((await t.getAttribute('aria-selected')) !== 'true') await t.click()
  await wait(page, 200)
}
export const card = (page, name) => page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first()
export async function openView(page, name) {
  await tab(page, 'Views')
  const c = card(page, name)
  if (!(await c.isVisible())) await c.scrollIntoViewIfNeeded().catch(() => {})
  await c.click()
  await settle(page)
}
export async function viewCards(page) {
  return page.locator('.lp-view-card').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()))
}
export async function waitCache(page, name = 'model', files = ['model.json']) {
  for (const f of files) {
    for (let i = 0; i < 600; i++) {
      const t = await readFile(page, `.state/cache/${f}`, name)
      if (t && t.length > 100) break
      await wait(page, 500)
    }
  }
}
export function shot(page, file) { mkdirSync(join(DIR, 'shots'), { recursive: true }); return page.screenshot({ path: join(DIR, 'shots', file) }) }
