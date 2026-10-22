import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
export const BASE = 'http://localhost:4570'
export const REPO = '/Volumes/data/Dev/rd-cli'
export function fixture(name) { return readFileSync(`${REPO}/apps/e2e/fixtures/${name}.radical`, 'utf8') }
export async function launch({ width = 1280, height = 720 } = {}) {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()) })
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) errors.push('external: ' + u) })
  return { browser, context, page, errors }
}
export async function seed(page, json, id = 'e2e-doc') {
  await page.addInitScript(([id, data]) => {
    if (localStorage.getItem('radical-docs-index')) return
    localStorage.setItem('radical-docs-index', JSON.stringify({ docs: [{ id, name: 'E2E', source: 'ls', lastModified: 0 }], activeId: id }))
    localStorage.setItem(`radical-doc:${id}`, data)
  }, [id, json])
}
export async function open(page, view, mode = 'designer', id = 'e2e-doc') {
  await page.goto(`${BASE}/#/d/${encodeURIComponent('ls:' + id)}/m/${mode}/v/${view}`)
  await page.locator('.app-layout').waitFor()
  await settle(page)
}
export async function settle(page) {
  const vp = page.locator('.react-flow__viewport')
  if (!(await vp.count())) { await page.waitForTimeout(500); return }
  let prev = '', stable = 0
  for (let i = 0; i < 60 && stable < 3; i++) {
    const cur = (await vp.first().getAttribute('style')) ?? ''
    stable = cur === prev ? stable + 1 : 0; prev = cur
    await page.waitForTimeout(100)
  }
}
export async function openSample(page) {
  await page.goto(BASE + '/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: /Sample model/ }).click()
  await page.waitForURL(/\/v\/view-ctx$/)
  await page.locator('.app-layout').waitFor()
  await settle(page)
  return decodeURIComponent(page.url()).match(/ls:([^/]+)/)[1]
}
export function rail(page, name) { return page.getByRole('button', { name, exact: true }) }
export function tab(page, name) { return page.getByRole('tab', { name, exact: true }) }
