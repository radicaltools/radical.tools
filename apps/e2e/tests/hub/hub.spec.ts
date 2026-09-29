import { readFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import { test, expect } from '../../support/fixtures'

// Hub (hub.radical.tools): the concept catalogue and its read-only viewer.
// Expected counts come from the catalogue this build publishes, so adding a
// concept does not break the suite.

interface Concept { id: string; category: string; name: string }

const CONCEPT = 'bp-fintech-ledger-platform'
const CONCEPT_NAME = 'Fintech Ledger & Payments Platform'

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
  for (const [label, category] of [['Patterns', 'pattern'], ['ADRs', 'adr'], ['Blueprints', 'blueprint']]) {
    const count = all.filter((c) => c.category === category).length
    await expect(page.getByRole('button', { name: new RegExp(`^${label}\\s*${count}\\b`) })).toBeVisible()
  }
  await studio.settle()
  await expect(page).toHaveScreenshot('landing.png')
})

test('browse a category and search', async ({ page, studio }) => {
  const all = await catalogue(page)
  const blueprints = all.filter((c) => c.category === 'blueprint')
  await page.goto('/')
  await studio.until(page.getByRole('button', { name: /^Blueprints/ }))
  await page.getByRole('button', { name: /^Blueprints/ }).click()
  await studio.until(page.getByText(`${blueprints.length} of ${all.length}`))
  await expect(page).toHaveURL(/#\/cat\/blueprint/)
  for (const c of blueprints) await expect(page.getByText(c.name, { exact: true })).toBeVisible()
  await studio.settle()
  await expect(page).toHaveScreenshot('category-blueprints.png')

  await page.getByPlaceholder('Search concepts…').fill('ledger')
  await studio.advance(500)
  await expect(page.getByText(CONCEPT_NAME, { exact: true })).toBeVisible()
  await expect(page.getByText('AI Support Assistant Platform', { exact: true })).toHaveCount(0)
})

test('open a concept from the catalogue', async ({ page, studio }) => {
  await page.goto('/#/browse')
  await studio.until(page.getByText(CONCEPT_NAME, { exact: true }))
  await page.getByText(CONCEPT_NAME, { exact: true }).click()
  await studio.until(studio.nodes)
  await expect(page).toHaveURL(new RegExp(`#/c/${CONCEPT}`))
})

for (const view of ['canvas', 'wiki', 'table'] as const) {
  test(`concept ${view} view`, async ({ page, studio }) => {
    const concept = await (await page.request.get(`hub/blueprint/${CONCEPT}.radical`)).json()
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

test('an unknown concept link falls back to the catalogue', async ({ page, studio }) => {
  await page.goto('/#/c/no-such-concept')
  await studio.until(page.getByPlaceholder('Search concepts…'))
  await expect(studio.nodes).toHaveCount(0)
})
