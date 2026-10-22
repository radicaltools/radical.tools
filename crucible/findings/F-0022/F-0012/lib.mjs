// Helpers for run 165: Studio driven through its real UI at 1280x720,
// state read from localStorage.
import { chromium } from '/Volumes/data/Dev/rd-cli/node_modules/playwright/index.mjs'
import { mkdirSync } from 'node:fs'

export const BASE = 'http://localhost:4575'
export const DIR = new URL('.', import.meta.url).pathname.replace(/\/$/, '')
mkdirSync(`${DIR}/shots`, { recursive: true })

export async function launch({ width = 1280, height = 720 } = {}) {
  const browser = await chromium.launch({ headless: true })
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

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function settle(page) {
  const viewport = page.locator('.react-flow__viewport')
  if (!(await viewport.count())) { await sleep(400); return }
  let prev = ''
  let stable = 0
  for (let i = 0; i < 60 && stable < 3; i++) {
    const cur = (await viewport.getAttribute('style').catch(() => '')) ?? ''
    stable = cur === prev ? stable + 1 : 0
    prev = cur
    await sleep(100)
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

export async function go(page, id, mode, view) {
  await page.goto(`/#/d/${encodeURIComponent(`ls:${id}`)}/m/${mode}/v/${view}`)
  await page.locator('.app-layout').waitFor()
  await settle(page)
}

export async function stored(page, id) {
  const json = await page.evaluate((k) => localStorage.getItem(k), `radical-doc:${id}`)
  return json ? JSON.parse(json) : null
}

/** Poll the saved document until `pred(doc)` holds or time runs out. */
export async function waitStored(page, id, pred, ms = 8000) {
  const end = Date.now() + ms
  let doc = null
  while (Date.now() < end) {
    doc = await stored(page, id)
    if (doc && pred(doc)) return doc
    await sleep(200)
  }
  return doc
}

export async function openSection(page, name) {
  const header = page.locator('.lp-section-header', { hasText: name })
  // Accordion: open only when closed.
  const open = ''
  await railTab(page, name)
  return open
}

export async function milestoneCard(page, name) {
  return page.locator('.lp-snap-card', { has: page.locator('.lp-card-title', { hasText: new RegExp(`^${name}$`) }) }).first()
}

export const names = (doc) => (doc?.snapshots ?? []).map((m) => m.name)

/** Open an accordion section of the left panel unless its cards show. */
export async function ensureSection(page, name, cardSel) {
  for (const b of await page.locator('.rp-back-btn').all()) {
    const box = await b.boundingBox()
    if (box && box.x >= 0 && box.x < 240 && box.width > 0) { await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await sleep(300); break }
  }
  const cards = page.locator(cardSel)
  if ((await cards.count()) && (await cards.first().isVisible())) {
    const box = await cards.first().boundingBox()
    if (box && box.height > 5) return
  }
  await railTab(page, name)
}

export function jsonDiff(a, b, path = '', out = [], max = 40) {
  if (out.length >= max) return out
  if (JSON.stringify(a) === JSON.stringify(b)) return out
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) jsonDiff(a[k], b[k], `${path}.${k}`, out, max)
  } else out.push(`${path}: ${JSON.stringify(a)?.slice(0, 80)} -> ${JSON.stringify(b)?.slice(0, 80)}`)
  return out
}

// run 175: the activity rail replaced the accordion and the Radical menu.
export async function railTab(page, name) {
  const tab = page.getByRole('tab', { name, exact: true })
  if ((await tab.getAttribute('aria-selected')) !== 'true') { await tab.click(); await page.waitForTimeout(300) }
}
