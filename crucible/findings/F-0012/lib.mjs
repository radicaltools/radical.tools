// Helpers for run 171's scripts. Studio at http://localhost:4571.
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

export const HERE = dirname(fileURLToPath(import.meta.url))
export const BASE = process.env.BASE ?? 'http://localhost:4571'
export const REPO = '/Volumes/data/Dev/rd-cli'
mkdirSync(join(HERE, 'shots'), { recursive: true })

export function fixture(name) {
  return readFileSync(`${REPO}/apps/e2e/fixtures/${name}.radical`, 'utf8')
}
export function withWhole(json) {
  const doc = JSON.parse(json)
  doc.views = [...(doc.views ?? []), { id: 'v-whole', name: 'Whole model', kind: 'static', nodeIds: [], positions: {} }]
  return JSON.stringify(doc)
}

export async function launch({ width = 1280, height = 720 } = {}) {
  const browser = await chromium.launch({ headless: process.env.HEADED ? false : true })
  const context = await browser.newContext({ viewport: { width, height }, baseURL: BASE })
  const page = await context.newPage()
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) problems.push(`console.error: ${m.text()}`)
  })
  await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort())
  return { browser, context, page, problems }
}

export async function seed(page, json, id = 'e2e-doc') {
  await page.addInitScript(([id, data]) => {
    if (localStorage.getItem('radical-docs-index')) return
    localStorage.setItem('radical-docs-index', JSON.stringify({ docs: [{ id, name: 'E2E', source: 'ls', lastModified: 0 }], activeId: id }))
    localStorage.setItem(`radical-doc:${id}`, data)
  }, [id, json])
}

export async function settle(page) {
  if (!(await page.locator('.canvas-area').count())) { await page.waitForTimeout(300); return }
  const vp = page.locator('.react-flow__viewport')
  let prev = '', stable = 0
  for (let i = 0; i < 60 && stable < 3; i++) {
    const cur = (await vp.count()) ? (await vp.first().getAttribute('style')) ?? '' : ''
    stable = cur === prev ? stable + 1 : 0
    prev = cur
    await page.waitForTimeout(100)
  }
}

export async function ready(page) {
  await page.locator('.app-layout').waitFor({ state: 'visible', timeout: 20000 })
  await settle(page)
}

export async function open(page, view, mode = 'designer', docId = 'e2e-doc') {
  await page.goto(`/#/d/${encodeURIComponent(`ls:${docId}`)}/m/${mode}/v/${view}`)
  await ready(page)
}

export async function openSample(page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: /Sample model/ }).click()
  await page.waitForURL(/\/v\/view-ctx$/, { timeout: 20000 })
  await ready(page)
  return docIdOf(page)
}

export function docIdOf(page) {
  const m = page.url().match(/#\/d\/([^/]+)/)
  return m ? decodeURIComponent(m[1]).replace(/^ls:/, '') : 'e2e-doc'
}

export async function stored(page, docId = 'e2e-doc') {
  const s = await page.evaluate((k) => localStorage.getItem(k), `radical-doc:${docId}`)
  return s ? JSON.parse(s) : null
}

export const node = (page, id) => page.locator(`.react-flow__node[data-id="${id}"]`)
export const card = (page) => page.locator('.right-panel.open')

export async function positions(page) {
  return page.locator('.react-flow__node').evaluateAll((els) => Object.fromEntries(els.map((el) => [el.dataset.id, el.style.transform])))
}

export async function shot(page, name) {
  await page.screenshot({ path: join(HERE, 'shots', name) })
}

export function report(obj) { console.log(JSON.stringify(obj, null, 1)) }

/** Click an element on its title bar (a container's middle is its children). */
export async function clickNode(page, id, opts = {}) {
  const b = await page.locator(`.react-flow__node[data-id="${id}"]`).boundingBox()
  if (!b) throw new Error(`node ${id} not drawn`)
  if (opts.shift) await page.keyboard.down('Shift')
  await page.mouse.click(b.x + (opts.dx ?? 8), b.y + (opts.dy ?? 8))
  if (opts.shift) await page.keyboard.up('Shift')
}

/** Open a rail section (Views, Milestones, Sequences) unless it is open. */
export async function railTab(page, name) {
  const tab = page.getByRole('tab', { name, exact: true })
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click()
  await page.waitForTimeout(150)
}
export async function openView(page, name) {
  await railTab(page, 'Views')
  await page.locator('.lp-view-card', { hasText: name }).first().click()
  await settle(page)
}
