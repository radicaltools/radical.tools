// Helpers for run 169's scripts. Studio on 4569, Hub on 4669.
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

export const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO = '/Volumes/data/Dev/rd-cli'
export const APP = 'http://localhost:4575'
export const HUB = 'http://localhost:4675'
export const DOC_ID = 'e2e-doc'
mkdirSync(join(HERE, 'shots'), { recursive: true })

export function fixture(name) {
  return readFileSync(`${REPO}/apps/e2e/fixtures/${name}.radical`, 'utf8')
}

export async function launch({ width = 1280, height = 720 } = {}) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width, height }, baseURL: APP })
  const page = await context.newPage()
  const problems = []
  const external = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) problems.push(`console.error: ${m.text()}`)
  })
  const logs = []
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`))
  await page.route(/^https:\/\/hub\.radical\.tools\/hub\//, async (route) => {
    const local = HUB + new URL(route.request().url()).pathname
    const response = await route.fetch({ url: local })
    await route.fulfill({ response, headers: { ...response.headers(), 'content-type': 'application/json' } })
  })
  await page.route(/^https?:\/\/(?!localhost[:/])(?!hub\.radical\.tools\/hub\/)/, (route) => { external.push(route.request().url()); route.abort() })
  return { browser, context, page, problems, external, logs, close: () => browser.close() }
}

export async function seedDocument(page, json, id = DOC_ID) {
  await page.addInitScript(([id, data]) => {
    if (localStorage.getItem('radical-docs-index')) return
    localStorage.setItem('radical-docs-index', JSON.stringify({ docs: [{ id, name: 'E2E', source: 'ls', lastModified: 0 }], activeId: id }))
    localStorage.setItem(`radical-doc:${id}`, data)
  }, [id, json])
}

export async function open(page, view, mode = 'designer', docId = DOC_ID) {
  await page.goto(`${APP}/#/d/${encodeURIComponent(`ls:${docId}`)}/m/${mode}/v/${view}`)
  await ready(page)
}

export async function ready(page) {
  await page.locator('.app-layout').waitFor({ state: 'visible', timeout: 20000 })
  await settle(page)
}

export async function settle(page) {
  if (!(await page.locator('.canvas-area').count())) { await page.waitForTimeout(300); return }
  const viewport = page.locator('.react-flow__viewport')
  if (!(await viewport.count())) { await page.waitForTimeout(500); return }
  let prev = ''
  let stable = 0
  for (let i = 0; i < 60 && stable < 3; i++) {
    const cur = (await viewport.getAttribute('style').catch(() => '')) ?? ''
    stable = cur === prev ? stable + 1 : 0
    prev = cur
    await page.waitForTimeout(100)
  }
}

export function activeDocId(page) {
  const m = page.url().match(/#\/d\/([^/]+)/)
  return m ? decodeURIComponent(m[1]).replace(/^ls:/, '') : DOC_ID
}

export async function stored(page, docId = DOC_ID) {
  const json = await page.evaluate((k) => localStorage.getItem(k), `radical-doc:${docId}`)
  return json ? JSON.parse(json) : null
}
export async function storedRaw(page, docId = DOC_ID) {
  return page.evaluate((k) => localStorage.getItem(k), `radical-doc:${docId}`)
}

export async function positions(page) {
  return page.locator('.react-flow__node').evaluateAll((els) => Object.fromEntries(els.map((el) => [el.dataset.id, el.style.transform])))
}

export async function openSample(page) {
  await page.goto(APP + '/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: /Sample model/ }).click()
  await page.waitForTimeout(1000)
  await ready(page)
}

export async function designer(page) {
  await page.locator('.toolbar-mode-btn', { hasText: 'Designer' }).click()
}

export async function shot(page, name) {
  await page.screenshot({ path: join(HERE, 'shots', name) })
}

export function report(obj) { console.log(JSON.stringify(obj, null, 2)) }

import { mkdtempSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
/** A persistent-profile browser whose directory picker hands out OPFS dir `name`. */
export async function launchFolder({ width = 1280, height = 720, name = 'model' } = {}) {
  const profile = mkdtempSync(join(HERE, 'profile-'))
  const context = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width, height }, baseURL: APP })
  const page = context.pages()[0] ?? await context.newPage()
  const problems = [], external = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) problems.push(`console.error: ${m.text()}`) })
  await page.route(/^https:\/\/hub\.radical\.tools\/hub\//, async (route) => {
    const response = await route.fetch({ url: HUB + new URL(route.request().url()).pathname })
    await route.fulfill({ response, headers: { ...response.headers(), 'content-type': 'application/json' } })
  })
  await page.route(/^https?:\/\/(?!localhost[:/])(?!hub\.radical\.tools\/hub\/)/, (route) => { external.push(route.request().url()); route.abort() })
  await page.addInitScript((name) => {
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
  }, name)
  const writeFile = (rel, text) => page.evaluate(async ([name, rel, text]) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
    const parts = rel.split('/')
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true })
    const w = await (await dir.getFileHandle(parts[parts.length - 1], { create: true })).createWritable()
    await w.write(text); await w.close()
  }, [name, rel, text])
  const writeDir = async (src) => {
    const walk = (d, pre) => readdirSync(d).flatMap((e) => statSync(join(d, e)).isDirectory() ? walk(join(d, e), pre + e + '/') : [[pre + e, join(d, e)]])
    for (const [rel, abs] of walk(src, '')) await writeFile(rel, readFileSync(abs, 'utf8'))
  }
  const close = async () => { await context.close() }
  return { context, page, problems, external, writeFile, writeDir, close }
}
export async function openFolder(page) {
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await page.locator('.welcome-overlay').waitFor({ state: 'hidden' })
  await ready(page)
}

export async function boxes(page) {
  return page.locator('.react-flow__node').evaluateAll((els) => Object.fromEntries(els.map((el) => {
    const r = el.getBoundingClientRect()
    return [el.dataset.id, { x: r.x, y: r.y, width: r.width, height: r.height }]
  })))
}
export function violations(bx, parentOf) {
  const EPS = 1
  const inter = (a, b) => a.x + a.width - EPS > b.x && b.x + b.width - EPS > a.x && a.y + a.height - EPS > b.y && b.y + b.height - EPS > a.y
  const cont = (o, i) => i.x >= o.x - EPS && i.y >= o.y - EPS && i.x + i.width <= o.x + o.width + EPS && i.y + i.height <= o.y + o.height + EPS
  const vp = (id) => { let p = parentOf[id]; while (p && !bx[p]) p = parentOf[p]; return p }
  const ids = Object.keys(bx), out = []
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const a = ids[i], b = ids[j]; if (vp(a) !== vp(b)) continue; if (inter(bx[a], bx[b])) out.push(`overlap: ${a} <> ${b}`) }
  for (const id of ids) { const p = vp(id); if (p && !cont(bx[p], bx[id])) out.push(`outside parent: ${id} in ${p}`) }
  return out
}
export async function importDsl(page, file) {
  await page.goto(APP + '/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /Structurizr DSL/ }).click()
  await (await chooser).setFiles(file)
  await page.waitForTimeout(2000)
  await ready(page)
  await page.waitForTimeout(1500)
}
export async function clickView(page, name) {
  const card = page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first()
  await railTab(page, 'Views')
  await card.click()
  await page.waitForTimeout(800)
  await settle(page)
}

// run 175: the activity rail replaced the accordion and the Radical menu.
export async function railTab(page, name) {
  const tab = page.getByRole('tab', { name, exact: true })
  if ((await tab.getAttribute('aria-selected')) !== 'true') { await tab.click(); await page.waitForTimeout(300) }
}
