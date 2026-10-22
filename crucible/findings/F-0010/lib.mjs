// Helpers for run 172: Studio on 4572, Hub on 4672.
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const APP = 'http://localhost:4572'
export const HUB = 'http://localhost:4672'
export const DIR = fileURLToPath(new URL('.', import.meta.url))
export const DOC_ID = 'r172-doc'
mkdirSync(DIR + 'shots', { recursive: true })

export function fixture(name) {
  return readFileSync(`/Volumes/data/Dev/rd-cli/apps/e2e/fixtures/${name}.radical`, 'utf8')
}
export const RADICAL_MM = { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} }

export async function launch({ width = 1280, height = 720 } = {}) {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  const errors = []
  const outside = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  await context.route(/^https:\/\/hub\.radical\.tools\/hub\//, async (route) => {
    const local = HUB + new URL(route.request().url()).pathname
    const response = await route.fetch({ url: local })
    await route.fulfill({ response, headers: { ...response.headers(), 'content-type': 'application/json' } })
  })
  page.on('request', (r) => { const u = r.url(); if (!/^(http:\/\/localhost|data:|blob:|about:)/.test(u) && !/hub\.radical\.tools\/hub\//.test(u)) outside.push(u) })
  return { browser, context, page, errors, outside }
}

export async function seed(page, json, id = DOC_ID) {
  await page.addInitScript(([id, data]) => {
    if (localStorage.getItem('radical-docs-index')) return
    localStorage.setItem('radical-docs-index', JSON.stringify({ docs: [{ id, name: 'R172', source: 'ls', lastModified: 0 }], activeId: id }))
    localStorage.setItem(`radical-doc:${id}`, data)
  }, [id, typeof json === 'string' ? json : JSON.stringify(json)])
}

export async function settle(page) {
  const vp = page.locator('.react-flow__viewport')
  if (!(await vp.count())) { await page.waitForTimeout(500); return }
  let prev = '', stable = 0
  for (let i = 0; i < 60 && stable < 3; i++) {
    const cur = (await vp.first().getAttribute('style').catch(() => '')) ?? ''
    stable = cur === prev ? stable + 1 : 0
    prev = cur
    await page.waitForTimeout(100)
  }
}

export async function open(page, view, mode = 'designer', id = DOC_ID, query = '') {
  await page.goto(`${APP}/${query}#/d/${encodeURIComponent(`ls:${id}`)}/m/${mode}/v/${view}`)
  await page.locator('.app-layout').waitFor()
  await settle(page)
}

export async function stored(page, id = DOC_ID) {
  return JSON.parse(await page.evaluate((k) => localStorage.getItem(k), `radical-doc:${id}`))
}

export async function waitFor(fn, timeout = 15000, step = 200) {
  const end = Date.now() + timeout
  let last
  while (Date.now() < end) { last = await fn(); if (last) return last; await new Promise((r) => setTimeout(r, step)) }
  return last
}

export async function openHubImport(page) {
  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await page.getByText(/Import from Hub/).first().click()
  const dialog = page.locator('[aria-label="Import from Hub"]')
  await dialog.waitFor()
  return dialog
}

export async function addPack(page, name) {
  const dialog = await openHubImport(page)
  await dialog.getByPlaceholder('Search concern packs…').pressSequentially(name)
  const card = dialog.locator('div', { has: page.getByRole('heading', { name, exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Add to Model' }) }).last()
  await card.getByRole('button', { name: 'Add to Model' }).click()
  const wizard = page.getByTestId('concern-wizard')
  await wizard.waitFor()
  return wizard
}

export async function canvasNodes(page) {
  return page.locator('.react-flow__node').evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect()
    return { id: el.dataset.id, label: el.innerText.split('\n')[0], x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), t: el.style.transform }
  }))
}

export async function openViewCard(page, name) {
  const tab = page.getByRole('tab', { name: 'Views' })
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click()
  const card = page.locator('.lp-view-card', { hasText: name })
  if (!(await card.first().isVisible())) {
    // maybe in a closed folder
    const folder = page.locator('.lp-view-folder, [class*="folder"]', { hasText: 'Concerns' }).first()
    if (await folder.count()) await folder.click().catch(() => {})
  }
  await card.first().click()
  await settle(page)
}
