// Helpers for run 216. The repository is found by walking up to .radical/crucible/crucible.json.
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
export const DIR = dirname(fileURLToPath(import.meta.url))
let d = DIR
while (!existsSync(join(d, '.radical', 'crucible', 'crucible.json'))) { const p = dirname(d); if (p === d) throw new Error('crucible.json not found above ' + DIR); d = p }
export const REPO = d
const { chromium } = await import(pathToFileURL(join(REPO, 'node_modules/playwright/index.mjs')).href)

/** A fresh browser on Studio at `port`; Hub requests answered from the local Hub build at `hubPort`. */
export async function launch({ port = 4516, hubPort = 4616, width = 1280, height = 720 } = {}) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width, height }, baseURL: `http://localhost:${port}` })
  const page = await context.newPage()
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`) })
  page.on('request', (r) => { const u = r.url(); if (!/^(http:\/\/localhost|data:|blob:|https:\/\/hub\.radical\.tools)/.test(u)) problems.push('outside request: ' + u) })
  await context.route(/^https?:\/\/(?!localhost[:/])/, async (route) => {
    const u = new URL(route.request().url())
    if (u.hostname === 'hub.radical.tools' && hubPort) {
      try {
        const response = await route.fetch({ url: `http://localhost:${hubPort}${u.pathname}` })
        return route.fulfill({ response, headers: { ...response.headers(), 'content-type': 'application/json' } })
      } catch { return route.abort() }
    }
    return route.abort()
  })
  return { browser, context, page, problems }
}
export const wait = (page, ms) => page.waitForTimeout(ms)
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
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
export const fixture = (name) => readFileSync(join(REPO, 'apps/e2e/fixtures', `${name}.radical`), 'utf8')
/** Seeds a document as the active one before the app loads (only into an empty store). */
export async function seed(context, json, id = 'run216-doc', name = 'E2E') {
  await context.addInitScript(([id, data, name]) => {
    if (localStorage.getItem('radical-docs-index')) return
    localStorage.setItem('radical-docs-index', JSON.stringify({ docs: [{ id, name, source: 'ls', lastModified: Date.now() }], activeId: id }))
    localStorage.setItem(`radical-doc:${id}`, data)
  }, [id, json, name])
  return id
}
/** Bookstore with the Radical metamodel (as the e2e Hub tests do). */
export function bookstoreRadical() {
  const doc = JSON.parse(fixture('bookstore'))
  doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} }
  return JSON.stringify(doc)
}
export async function markSetUp(context) {
  await context.addInitScript(() => { if (!localStorage.getItem('radical-studio-settings')) localStorage.setItem('radical-studio-settings', JSON.stringify({ setupDone: true })) })
}
export async function stored(page, id) { return JSON.parse(await page.evaluate((k) => localStorage.getItem(k), `radical-doc:${id}`)) }
export function docId(page) {
  const m = page.url().match(/#\/d\/([^/]+)/)
  return m ? decodeURIComponent(m[1]).replace(/^ls:/, '') : null
}
export async function dialogs(page) {
  return page.getByRole('dialog').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || e.getAttribute('data-testid') || e.className))
}
/** What is on top at the centre of `locator`'s box. */
export async function onTop(page, locator) {
  const b = await locator.boundingBox().catch(() => null)
  if (!b) return null
  return page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? (el.closest('[role=dialog]')?.getAttribute('aria-label') ?? el.closest('[data-testid]')?.getAttribute('data-testid') ?? el.className) : null }, [b.x + b.width / 2, b.y + Math.min(20, b.height / 2)])
}
export async function shot(page, name) { mkdirSync(join(DIR, 'shots'), { recursive: true }); await page.screenshot({ path: join(DIR, 'shots', name.endsWith('.png') ? name : `${name}.png`) }) }
export function out(obj) { console.log(JSON.stringify(obj, null, 1)) }
export function verdict(bug, msg = '') {
  console.log(msg)
  console.log(`REPRODUCED: ${bug ? 'yes' : 'no'}`)
  process.exitCode = bug ? 1 : 0
}
