// Helpers for run 207 (Hub). The repository is found by walking up to the
// folder that holds .radical/crucible/crucible.json. Ports come as arguments.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
export const DIR = dirname(fileURLToPath(import.meta.url))
export function repoRoot() {
  let d = DIR
  while (!existsSync(join(d, '.radical', 'crucible', 'crucible.json'))) { const p = dirname(d); if (p === d) throw new Error('.radical/crucible/crucible.json not found above ' + DIR); d = p }
  return d
}
export const REPO = repoRoot()
const { chromium } = await import(pathToFileURL(join(REPO, 'node_modules/playwright/index.mjs')).href)
export const arg = (i, d) => process.argv[2 + i] ?? d

/** Answers requests to hub.radical.tools from the Hub served on hubPort, as JSON the way the CDN does. */
export async function routeHub(page, hubPort) {
  await page.route(/^https:\/\/hub\.radical\.tools\/hub\//, async (route) => {
    const local = `http://localhost:${hubPort}` + new URL(route.request().url()).pathname
    const response = await route.fetch({ url: local })
    await route.fulfill({ response, headers: { ...response.headers(), 'content-type': 'application/json' } })
  })
}

export async function launch({ port, hubPort, width = 1280, height = 720 } = {}) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width, height }, baseURL: `http://localhost:${port}` })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) problems.push(`console.error: ${m.text()}`) })
  await page.route(/^https?:\/\/(?!localhost[:/])(?!hub\.radical\.tools)/, (r) => r.abort())
  if (hubPort) await routeHub(page, hubPort)
  if (port !== hubPort) await page.addInitScript(() => {
    if (!localStorage.getItem('radical-studio-settings')) localStorage.setItem('radical-studio-settings', JSON.stringify({ setupDone: true }))
  })
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
export async function view(page, name) {
  await tab(page, 'Views')
  await page.locator('.lp-view-card', { hasText: name }).first().click()
  await settle(page)
}
export const ids = (page) => page.locator('.react-flow__node').evaluateAll((els) => els.map((e) => e.dataset.id).sort())
export async function shot(page, name) { await page.screenshot({ path: join(DIR, 'shots', `${name}.png`) }) }
export function out(obj) { console.log(JSON.stringify(obj, null, 1)) }
/** Seed apps/e2e/fixtures/<name>.radical as the active document before the app loads. */
export async function seedFixture(context, name = 'bookstore', id = 'run207-doc', mutate) {
  let doc = JSON.parse(readFileSync(join(REPO, 'apps/e2e/fixtures', `${name}.radical`), 'utf8'))
  if (mutate) doc = mutate(doc) ?? doc
  const json = JSON.stringify(doc)
  await context.addInitScript(([id, data]) => {
    if (localStorage.getItem('radical-docs-index')) return
    localStorage.setItem('radical-docs-index', JSON.stringify({ docs: [{ id, name: 'E2E', source: 'ls', lastModified: 0 }], activeId: id }))
    localStorage.setItem(`radical-doc:${id}`, data)
  }, [id, json])
  return id
}
export async function openHubDialog(page) {
  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await page.getByText(/Import from Hub/).first().click()
  const dialog = page.locator('[aria-label="Import from Hub"]')
  await dialog.waitFor()
  return dialog
}
export async function packWizard(page, name) {
  const dialog = await openHubDialog(page)
  await dialog.getByPlaceholder('Search concern packs…').pressSequentially(name)
  await dialog.locator('li.hi-pack', { has: page.getByRole('heading', { name, exact: true }) })
    .getByRole('button', { name: 'Add to Model' }).click()
  const wiz = page.getByTestId('concern-wizard')
  await wiz.waitFor()
  return wiz
}
export async function undo(page, n = 1) { for (let i = 0; i < n; i++) { await page.keyboard.press('Control+z'); await wait(page, 300) } await settle(page) }
export async function redo(page, n = 1) { for (let i = 0; i < n; i++) { await page.keyboard.press('Control+Shift+z'); await wait(page, 300) } await settle(page) }

// ─── Folder models in OPFS (as apps/e2e/support/folder.ts) ───────────────────
import { mkdtempSync, rmSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
/** A persistent-profile browser whose directory picker hands out OPFS folder `name`. */
export async function launchFolder({ port, hubPort, width = 1280, height = 720, name = 'model' } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'run207-'))
  const context = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width, height }, baseURL: `http://localhost:${port}` })
  const page = context.pages()[0] ?? await context.newPage()
  page.setDefaultTimeout(10000)
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) problems.push(`console.error: ${m.text()}`) })
  await page.route(/^https?:\/\/(?!localhost[:/])(?!hub\.radical\.tools)/, (r) => r.abort())
  if (hubPort) await routeHub(page, hubPort)
  await page.addInitScript((n) => {
    if (!localStorage.getItem('radical-studio-settings')) localStorage.setItem('radical-studio-settings', JSON.stringify({ setupDone: true }))
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(n, { create: true })
  }, name)
  const close = async () => { await context.close(); rmSync(profile, { recursive: true, force: true }) }
  return { browser: { close }, context, page, problems }
}
export async function writeOpfs(page, rel, text, name = 'model') {
  await page.evaluate(async ([n, rel, text]) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(n, { create: true })
    const parts = rel.split('/')
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true })
    const w = await (await dir.getFileHandle(parts[parts.length - 1], { create: true })).createWritable()
    await w.write(text); await w.close()
  }, [name, rel, text])
}
/** Copies a folder on disk into OPFS (skipping .state/cache). */
export async function copyToOpfs(page, src, name = 'model') {
  const walk = (d, pre) => readdirSync(d).flatMap((e) => {
    const p = join(d, e), r = pre ? `${pre}/${e}` : e
    if (r === '.state/cache' || r === '.state/agent-activity.json') return []
    return statSync(p).isDirectory() ? walk(p, r) : [[r, readFileSync(p, 'utf8')]]
  })
  for (const [r, t] of walk(src, '')) await writeOpfs(page, r, t, name)
}
export async function readOpfs(page, name = 'model') {
  return page.evaluate(async (n) => {
    const out = {}
    const walk = async (dir, pre) => { for await (const [e, h] of dir) { const r = pre ? `${pre}/${e}` : e; if (h.kind === 'directory') await walk(h, r); else out[r] = await (await h.getFile()).text() } }
    await walk(await (await navigator.storage.getDirectory()).getDirectoryHandle(n, { create: true }), '')
    return out
  }, name)
}
export async function openFolder(page) {
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await page.locator('.app-layout').waitFor()
  await settle(page)
}
export const testResults = () => JSON.stringify({ version: 1, readAt: new Date().toISOString(), reports: ['reports/unit.json'], cases: [{ file: '/repo/tests/pay.test.ts', title: ['pays by card'], status: 'passed' }] })
