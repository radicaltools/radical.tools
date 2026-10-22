import { readFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import { test, expect } from '../../support/fixtures'

// Hub (hub.radical.tools): the catalogue of concern packs and its read-only viewer.
// Expected counts come from the catalogue this build publishes, so adding a
// concept does not break the suite.

interface Concept { id: string; category: string; name: string; concern?: { group: string } }

const CONCEPT = 'concern-authentication'
const CONCEPT_NAME = 'Authentication'

async function catalogue(page: Page): Promise<Concept[]> {
  const res = await page.request.get('hub/index.json')
  expect(res.ok()).toBe(true)
  return res.json()
}

test.beforeEach(async ({ page, baseURL, studio }) => {
  // A production Hub build reads the catalogue from hub.radical.tools. Serve
  // those requests from this build's own out/hub/, as JSON the way the CDN
  // does, so the suite tests the catalogue that is about to be deployed.
  await page.route('https://hub.radical.tools/hub/**', async (route) => {
    const local = new URL(new URL(route.request().url()).pathname.slice(1), baseURL)
    const response = await route.fetch({ url: local.href })
    await route.fulfill({ response, headers: { ...response.headers(), 'content-type': 'application/json' } })
  })
  await studio.freezeTime()
})

test('landing page', async ({ page, studio }) => {
  const all = await catalogue(page)
  await page.goto('/')
  await studio.until(page.getByRole('button', { name: 'Browse the catalogue' }))
  // One tile per group, with its number of packs.
  for (const [label, group] of [['Identity & access', 'identity'], ['Data', 'data'], ['Technology', 'technology']]) {
    const count = all.filter((c) => c.concern?.group === group).length
    expect(count).toBeGreaterThan(0)
    await expect(page.getByRole('button', { name: new RegExp(`^${label}\\s*${count}\\b`) })).toBeVisible()
  }
  await studio.settle()
  await expect(page).toHaveScreenshot('landing.png')
})

test('browse a category and search', async ({ page, studio }) => {
  const all = await catalogue(page)
  const packs = all.filter((c) => c.concern?.group === 'data')
  await page.goto('/')
  await studio.until(page.getByRole('button', { name: /^Data\s*\d/ }))
  await page.getByRole('button', { name: /^Data\s*\d/ }).click()
  await studio.until(page.getByText(`${packs.length} of ${all.length}`))
  await expect(page).toHaveURL(/#\/cat\/data/)
  for (const c of packs) await expect(page.getByText(c.name, { exact: true })).toBeVisible()
  await expect(page.getByText('Authentication', { exact: true })).toHaveCount(0)
  await studio.settle()
  await expect(page).toHaveScreenshot('category-data.png')

  await page.getByPlaceholder('Search concepts…').fill('backup')
  await studio.advance(500)
  await expect(page.getByText('Backup and recovery', { exact: true })).toBeVisible()
  await expect(page.getByText('Personal data', { exact: true })).toHaveCount(0)
})

test('open a concept from the catalogue', async ({ page, studio }) => {
  await page.goto('/#/browse')
  await studio.until(page.getByText(CONCEPT_NAME, { exact: true }))
  await page.getByText(CONCEPT_NAME, { exact: true }).click()
  // A concern pack opens on its wiki page.
  await expect(page).toHaveURL(new RegExp(`#/c/${CONCEPT}`))
  await expect(page.getByText('Callers are who they claim').first()).toBeVisible()
})

for (const view of ['canvas', 'wiki', 'table'] as const) {
  test(`concept ${view} view`, async ({ page, studio }) => {
    const concept = await (await page.request.get(`hub/concern/${CONCEPT}.radical`)).json()
    await page.goto(`/#/c/${CONCEPT}/v/${view}`)
    await studio.until(page.getByText(concept.hub.name, { exact: true }))
    if (view === 'canvas') {
      await studio.until(studio.nodes)
      await expect(studio.nodes).toHaveCount(concept.nodes.length)
    }
    if (view === 'table') await expect(page.locator('tbody tr')).toHaveCount(concept.nodes.length)
    await studio.settle()
    await expect(page).toHaveScreenshot(`concept-${view}.png`)
  })
}

test('download a concept as a .radical file', async ({ page, studio }) => {
  await page.goto(`/#/c/${CONCEPT}/v/canvas`)
  await studio.until(studio.nodes)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download' }).click()
  await studio.advance(500)
  const file = await download
  expect(file.suggestedFilename()).toMatch(/\.radical$/)
  const doc = JSON.parse(await readFile(await file.path(), 'utf8'))
  expect(doc.hub.id).toBe(CONCEPT)
  expect(doc.nodes.length).toBeGreaterThan(0)
  expect(doc.relations.length).toBeGreaterThan(0)
})

test('a concern pack shows its group and its sources', async ({ page, studio }) => {
  const pack = await (await page.request.get(`hub/concern/${CONCEPT}.radical`)).json()
  await page.goto(`/#/c/${CONCEPT}/v/wiki`)
  await studio.until(page.getByText(pack.hub.name, { exact: true }).first())
  await expect(page.locator('.hub-toolbar-cat')).toHaveText(/Identity & access/)
  const sources = page.getByRole('navigation', { name: 'Sources' })
  for (const src of pack.hub.sources) await expect(sources.getByRole('link', { name: src.title })).toHaveAttribute('href', src.url)
})

test('a concept link followed inside the Hub opens that concept', async ({ page, studio }) => {
  // The address was written back to the catalogue's while the concept was
  // still loading, and the link opened nothing.
  await page.goto('/#/browse')
  await studio.until(page.getByPlaceholder('Search concepts…'))
  await page.goto(`/#/c/${CONCEPT}/v/canvas`)
  await studio.until(studio.nodes)
  await expect(page).toHaveURL(new RegExp(`#/c/${CONCEPT}`))
})

test('an unknown concept link falls back to the catalogue', async ({ page, studio }) => {
  await page.goto('/#/c/no-such-concept')
  await studio.until(page.getByPlaceholder('Search concepts…'))
  await expect(studio.nodes).toHaveCount(0)
})
