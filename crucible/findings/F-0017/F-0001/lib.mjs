// Helpers for run 168 scripts: Studio at http://localhost:4575, seeded through localStorage.
import { chromium } from '/Volumes/data/Dev/rd-cli/node_modules/playwright/index.mjs'
import { readFileSync, mkdirSync } from 'node:fs'

export const BASE = process.env.BASE ?? 'http://localhost:4575'
export const DOC_ID = 'e2e-doc'
export const DIR = new URL('.', import.meta.url).pathname.replace(/\/$/, '')
mkdirSync(`${DIR}/shots`, { recursive: true })

export function fixture(name) {
  return readFileSync(`/Volumes/data/Dev/rd-cli/apps/e2e/fixtures/${name}.radical`, 'utf8')
}
export function withWhole(json) {
  const doc = JSON.parse(json)
  doc.views = [...(doc.views ?? []), { id: 'v-whole', name: 'Whole model', kind: 'static', nodeIds: [], positions: {} }]
  return JSON.stringify(doc)
}

export async function launch({ width = 1600, height = 900 } = {}) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith('http://localhost') && !u.startsWith('data:') && !u.startsWith('blob:')) errors.push('external request: ' + u) })
  page.on('dialog', async (d) => {
    const h = page._dialogHandler
    page.lastDialog = d.message()
    if (h) await h(d); else await d.accept()
  })
  return { browser, context, page, errors }
}

export async function seed(page, json) {
  await page.addInitScript(([id, data]) => {
    if (localStorage.getItem('radical-docs-index')) return
    localStorage.setItem('radical-docs-index', JSON.stringify({ docs: [{ id, name: 'E2E', source: 'ls', lastModified: 0 }], activeId: id }))
    localStorage.setItem(`radical-doc:${id}`, data)
  }, [DOC_ID, json])
}

export async function open(page, view, mode = 'designer', docId = DOC_ID) {
  await page.goto(`${BASE}/#/d/${encodeURIComponent(`ls:${docId}`)}/m/${mode}/v/${view}`)
  await page.locator('.app-layout').waitFor()
  await settle(page)
}

export async function settle(page) {
  const vp = page.locator('.react-flow__viewport')
  if (!(await vp.count())) { await page.waitForTimeout(500); return }
  let prev = ''; let stable = 0
  for (let i = 0; i < 60 && stable < 3; i++) {
    const cur = (await vp.first().getAttribute('style').catch(() => '')) ?? ''
    stable = cur === prev ? stable + 1 : 0
    prev = cur
    await page.waitForTimeout(100)
  }
}

export async function stored(page, docId = DOC_ID) {
  const json = await page.evaluate((k) => localStorage.getItem(k), `radical-doc:${docId}`)
  return JSON.parse(json)
}

export async function openEditor(page) {
  await page.getByRole('button', { name: 'Metamodel editor', exact: true }).click()
  await page.getByRole('button', { name: 'Close metamodel editor' }).waitFor()
}
export const closeEditor = (page) => page.getByRole('button', { name: 'Close metamodel editor' }).click()

export function card(page, typeId) {
  return page.locator('.mm-card', { has: page.locator('.mm-type-id', { hasText: new RegExp(`^${typeId}$`) }) })
}

export async function waitFor(fn, { timeout = 10000, interval = 200 } = {}) {
  const end = Date.now() + timeout
  let last
  while (Date.now() < end) {
    last = await fn()
    if (last) return last
    await new Promise((r) => setTimeout(r, interval))
  }
  return last
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// run 175: the activity rail replaced the accordion and the Radical menu.
export async function railTab(page, name) {
  const tab = page.getByRole('tab', { name, exact: true })
  if ((await tab.getAttribute('aria-selected')) !== 'true') { await tab.click(); await page.waitForTimeout(300) }
}
