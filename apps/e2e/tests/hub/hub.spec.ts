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
  for (const [label, group] of [['Secure by Design', 'security'], ['Compliance', 'compliance'], ['Tech Radar', 'technology']]) {
    const count = all.filter((c) => c.concern?.group === group).length
    expect(count).toBeGreaterThan(0)
    await expect(page.getByRole('button', { name: new RegExp(`^${label}\\s*${count}\\b`) })).toBeVisible()
  }
  await studio.settle()
  await expect(page).toHaveScreenshot('landing.png')
})

test('browse a category and search', async ({ page, studio }) => {
  const all = await catalogue(page)
  const packs = all.filter((c) => c.concern?.group === 'operability')
  await page.goto('/')
  await studio.until(page.getByRole('button', { name: /^Operability & Reliability\s*\d/ }))
  await page.getByRole('button', { name: /^Operability & Reliability\s*\d/ }).click()
  await studio.until(page.getByText(`${packs.length} of ${all.length}`))
  await expect(page).toHaveURL(/#\/cat\/operability/)
  for (const c of packs) await expect(page.getByText(c.name, { exact: true })).toBeVisible()
  await expect(page.getByText('Authentication', { exact: true })).toHaveCount(0)
  await studio.settle()
  await expect(page).toHaveScreenshot('category-operability.png')

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
    // A concern pack opens on its default answers: as many elements as the
    // Answers panel counts.
    const count = page.locator('.hub-answers-count')
    await expect(count).toHaveText(new RegExp(`^\\d+ of ${concept.nodes.length} elements$`))
    const shown = Number((await count.innerText()).split(' ')[0])
    expect(shown).toBeLessThanOrEqual(concept.nodes.length)
    if (view === 'canvas') {
      await studio.until(studio.nodes)
      await expect(studio.nodes).toHaveCount(shown)
    }
    if (view === 'table') await expect(page.locator('tbody tr')).toHaveCount(shown)
    await studio.settle()
    await expect(page).toHaveScreenshot(`concept-${view}.png`)
  })
}

test('a concern pack shows its group', async ({ page, studio }) => {
  const pack = await (await page.request.get(`hub/concern/${CONCEPT}.radical`)).json()
  await page.goto(`/#/c/${CONCEPT}/v/wiki`)
  await studio.until(page.getByText(pack.hub.name, { exact: true }).first())
  await expect(page.locator('.hub-toolbar-cat')).toHaveText(/Secure by Design/)
})

test('the answers panel previews what an answer brings in', async ({ page, studio }) => {
  const pack = await (await page.request.get(`hub/concern/${CONCEPT}.radical`)).json()
  await page.goto(`/#/c/${CONCEPT}/v/canvas`)
  const panel = page.getByRole('complementary', { name: 'Answers' })
  await studio.until(panel)
  await studio.until(studio.nodes)
  // Opens on the defaults: the identity provider's decision, not our own store's.
  const node = (label: string) => studio.nodes.filter({ hasText: label })
  await expect(node('Users sign in through an identity provider')).toHaveCount(1)
  await expect(node('Users sign in with our own user store')).toHaveCount(0)
  const count = panel.locator('.hub-answers-count')
  await expect(count).toHaveText(new RegExp(`^\\d+ of ${pack.nodes.length} elements$`))
  const before = await count.innerText()
  // Each other option says what it would change.
  const option = panel.locator('label', { hasText: 'our own user store' })
  await expect(option.locator('.hub-answers-delta')).toHaveText(/\+\d+/)

  await option.getByRole('radio').check()
  await expect(node('Users sign in with our own user store')).toHaveCount(1)
  await expect(node('Users sign in through an identity provider')).toHaveCount(0)
  await expect(count).not.toHaveText(before)
  await expect(panel.locator('.hub-answers-last')).toHaveText(/^Last answer: \+\d+/)
  // The elements the answer added are lit, for a moment.
  await expect(node('Users sign in with our own user store').getByText('NEW', { exact: true })).toBeVisible()
  await studio.advance(5000)
  await expect(studio.nodes.getByText('NEW', { exact: true })).toHaveCount(0)

  // All shows every variant again.
  await panel.getByRole('button', { name: 'All', exact: true }).click()
  await expect(count).toHaveText(`All ${pack.nodes.length} elements, every variant`)
  await expect(studio.nodes).toHaveCount(pack.nodes.length)
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
