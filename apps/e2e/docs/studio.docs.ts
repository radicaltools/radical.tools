import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'
import { fixture } from '../support/fixtures'
import { SHOTS_DIR, calm, expect, test } from './shots'

// Every Studio screenshot of the manual, on the Fintech sample unless it says
// otherwise. One test per figure; its name is the file name. README's demo GIF
// and the social preview are at the end.

const SAMPLE = readFileSync(fileURLToPath(new URL('../../studio/src/renderer/src/store/fintechSampleData.json', import.meta.url)), 'utf8')
const ARCHITECTURE = fileURLToPath(new URL('../../../architecture/', import.meta.url))

/** A few models kept in this browser, so Recent and the Models dialog have rows. */
async function seedModels(page: Page): Promise<void> {
  await page.addInitScript(([sample, bookstore, order]) => {
    if (localStorage.getItem('radical-docs-index')) return
    const docs = [
      { id: 'docs-sample', name: 'Fintech Banking Platform', source: 'ls', lastModified: Date.now() - 60_000, data: sample },
      { id: 'docs-bookstore', name: 'Bookstore', source: 'ls', lastModified: Date.now() - 3_600_000, data: bookstore },
      { id: 'docs-order', name: 'Order lifecycle', source: 'ls', lastModified: Date.now() - 86_400_000, data: order },
    ]
    localStorage.setItem('radical-docs-index', JSON.stringify({
      docs: docs.map(({ data: _data, ...meta }) => meta),
      activeId: 'docs-sample',
    }))
    for (const d of docs) localStorage.setItem(`radical-doc:${d.id}`, d.data)
  }, [SAMPLE, fixture('bookstore'), fixture('order-machine')] as const)
}

/** Open a view of the seeded sample (`docs-sample`). */
async function open(page: Page, view: string, mode = 'designer', extra = ''): Promise<void> {
  await page.goto(`/#/d/${encodeURIComponent('ls:docs-sample')}/m/${mode}/v/${view}${extra}`)
  await expect(page.locator('.app-layout')).toBeVisible()
  await settle(page)
}

/** Camera still, toasts gone. */
async function settle(page: Page): Promise<void> {
  const viewport = page.locator('.react-flow__viewport').first()
  let prev = ''
  for (let i = 0, stable = 0; i < 60 && stable < 3; i++) {
    const cur = (await viewport.count()) ? (await viewport.getAttribute('style')) ?? '' : ''
    stable = cur === prev ? stable + 1 : 0
    prev = cur
    await page.waitForTimeout(100)
  }
  await dismissToasts(page)
}

async function dismissToasts(page: Page): Promise<void> {
  const close = page.getByRole('button', { name: 'Dismiss notification' })
  while (await close.count()) await close.first().click().catch(() => {})
  await expect(page.locator('.toast')).toHaveCount(0)
}

async function menu(page: Page, item: RegExp | string): Promise<void> {
  await page.getByTitle('Menu', { exact: true }).click()
  await page.getByRole('menu').getByRole('menuitem').or(page.getByRole('menu').getByRole('menuitemcheckbox')).filter({ hasText: item }).click()
}

test.beforeEach(async ({ page }) => {
  await seedModels(page)
})

test('welcome', async ({ page, shot }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'New model' })).toBeVisible()
  await shot('welcome')
})

test('documents', async ({ page, shot }) => {
  await open(page, 'view-ctx')
  await menu(page, /Manage models/)
  await expect(page.getByRole('dialog', { name: 'Models' }).locator('.docmgr-item')).toHaveCount(3)
  await shot('documents')
})

test('designer', async ({ page, shot }) => {
  await open(page, 'view-ctx')
  await shot('designer')
})

test('properties', async ({ page, studio, shot }) => {
  await open(page, 'view-core')
  await studio.node('ctn-payments').locator('.c4-node-label').first().click()
  await settle(page)
  await shot('properties')
})

test('mockups', async ({ page, studio, shot }) => {
  await open(page, 'view-screens')
  await studio.nodeByLabel('Review & FX Quote').first().click()
  await settle(page)
  await shot('mockups')
})

test('views', async ({ page, shot }) => {
  await open(page, 'view-payments')
  await shot('views')
})

test('flow', async ({ page, shot }) => {
  await open(page, 'view-payflow')
  await shot('flow')
})

test('hierarchy', async ({ page, shot }) => {
  await open(page, 'view-treemap')
  await page.getByLabel('Levels:').selectOption('all')
  await page.waitForTimeout(500)
  await shot('hierarchy')
})

test('table', async ({ page, shot }) => {
  await open(page, 'view-register')
  await expect(page.locator('.tv-chain-row.depth-0')).toHaveCount(3)
  await shot('table')
})

/** The Requirements Register's chain, open in its properties beside the table it gives. */
test('view-filter', async ({ page, shot }) => {
  await open(page, 'view-register')
  const card = page.locator('.lp-view-card', { hasText: 'Requirements Register' })
  await card.hover()
  await card.getByTitle('View properties').click()
  await expect(page.locator('.rp-pipeline .rp-level')).toHaveCount(3)
  await page.locator('.rp-pipeline').scrollIntoViewIfNeeded()
  await page.mouse.move(1300, 860)
  await shot('view-filter')
})

test('matrix', async ({ page, shot }) => {
  await open(page, 'view-matrix')
  await shot('matrix')
})

test('wiki', async ({ page, shot }) => {
  await open(page, 'view-wiki', 'designer', '/f/ctn-payments')
  await shot('wiki')
})

test('search', async ({ page, shot }) => {
  await open(page, 'view-ctx')
  await page.keyboard.press('ControlOrMeta+p')
  await page.keyboard.type('Payment')
  await page.waitForTimeout(500)
  await shot('search')
})

test('milestones', async ({ page, shot }) => {
  await open(page, 'view-payments', 'designer', '/s/snap-v2')
  await page.locator('.lp-section-header', { hasText: 'Milestones' }).click()
  await settle(page)
  await shot('milestones')
})

test('viewer', async ({ page, shot }) => {
  await open(page, 'view-core', 'viewer')
  await shot('viewer')
})

test('presenter', async ({ page, shot }) => {
  await open(page, 'view-ctx', 'presenter')
  await shot('presenter')
})

test('metamodel', async ({ page, shot }) => {
  await open(page, 'view-ctx')
  await menu(page, 'Metamodel editor…')
  await expect(page.getByRole('dialog', { name: 'Metamodel editor' })).toBeVisible()
  await shot('metamodel')
})

test('metamodel-diagram', async ({ page, shot }) => {
  await open(page, 'view-ctx')
  await menu(page, 'Metamodel editor…')
  const editor = page.getByRole('dialog', { name: 'Metamodel editor' })
  await editor.getByRole('tab', { name: 'Diagram' }).click()
  await editor.locator('.mmd-canvas').getByTestId('rf__node-requirement').click()
  await settle(page)
  await shot('metamodel-diagram')
})

test('hub-import', async ({ page, shot }) => {
  await open(page, 'view-ctx')
  await menu(page, 'Import from Hub…')
  const dialog = page.locator('[aria-label="Import from Hub"]')
  await expect(dialog.getByRole('button', { name: 'Add to Model' }).first()).toBeVisible({ timeout: 15_000 })
  await shot('hub-import')
})

test('ai-settings', async ({ page, shot }) => {
  await open(page, 'view-ctx')
  await menu(page, 'AI providers…')
  await page.waitForTimeout(300)
  await shot('ai-settings')
})

/** The repository's own architecture model, with the test results `radical check` left beside it. */
test('inspector', async ({ page, shot }) => {
  const files: Record<string, string> = {}
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (name === '.DS_Store') continue
      if (statSync(path).isDirectory()) walk(path)
      else files[relative(ARCHITECTURE, path)] = readFileSync(path, 'utf8')
    }
  }
  walk(ARCHITECTURE)
  test.skip(!files['.radical/test-results.json'], 'run npm run check:architecture first')
  delete files['.radical/selection.json']

  await page.addInitScript(() => {
    ;(window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> })
      .showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('architecture', { create: true })
  })
  await page.goto('/')
  await page.evaluate(async (all) => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('architecture', { create: true })
    for (const [rel, text] of Object.entries(all)) {
      let dir = root
      const parts = rel.split('/')
      for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true })
      const w = await (await dir.getFileHandle(parts[parts.length - 1], { create: true })).createWritable()
      await w.write(text)
      await w.close()
    }
  }, files)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  const inspector = page.getByRole('button', { name: /^Inspector/ })
  await expect(inspector).toBeEnabled({ timeout: 20_000 })
  await inspector.click()
  await expect(page.locator('.insp-verdict')).toBeVisible()
  await settle(page)
  await shot('inspector')
})

/** Opens the view whose card in the left panel says `name`, as a reader would. */
async function pickView(page: Page, name: string): Promise<void> {
  await page.locator('.lp-view-card', { hasText: name }).first().click()
  await settle(page)
}

function hasFfmpeg(): boolean {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true } catch { return false }
}

/**
 * README's demo (screenshots/demo.gif): the sample's views one after another,
 * picked in the left panel, recorded and turned into a GIF by ffmpeg. Light only.
 */
test('demo', async ({ playwright, theme }, testInfo) => {
  test.skip(theme !== 'light', 'the README shows the light demo')
  test.skip(!hasFfmpeg(), 'needs ffmpeg on the PATH')
  test.setTimeout(180_000)
  const { viewport, deviceScaleFactor, locale, timezoneId, colorScheme, baseURL, userAgent } = testInfo.project.use
  const size = viewport ?? { width: 1440, height: 900 }
  const profile = await mkdtemp(join(tmpdir(), 'radical-demo-'))
  const videos = testInfo.outputPath('video')
  const context = await playwright.chromium.launchPersistentContext(profile, {
    headless: true, viewport, deviceScaleFactor, locale, timezoneId, colorScheme, baseURL, userAgent,
    recordVideo: { dir: videos, size },
  })
  const page = context.pages()[0] ?? await context.newPage()
  const started = Date.now()
  await page.addInitScript(() => { localStorage.setItem('radical-theme', 'light') })
  await seedModels(page)
  await open(page, 'view-ctx')
  await calm(page)
  const from = (Date.now() - started) / 1000

  await page.waitForTimeout(2500)
  await page.getByTestId('rf__node-sys-core').locator('.c4-node-label').first().click()
  await settle(page)
  await page.waitForTimeout(2500)
  for (const view of ['Core Banking', 'Payment Flow', 'Platform Hierarchy', 'Dependency Matrix', 'Requirements Register', 'Architecture Wiki']) {
    await pickView(page, view)
    await page.waitForTimeout(2800)
  }
  const video = page.video()
  await context.close()
  const webm = await video!.path()
  await rm(profile, { recursive: true, force: true })

  // 880 px wide like the README's <img>, 10 fps, one palette for the whole clip.
  execFileSync('ffmpeg', [
    '-loglevel', 'error', '-y', '-ss', from.toFixed(2), '-i', webm,
    '-vf', 'fps=10,scale=880:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
    `${SHOTS_DIR}demo.gif`,
  ])
})

/**
 * The GitHub repo's social preview and radical.tools' og:image
 * (apps/web/social-preview.png, 1280×640): the pitch beside Designer on the
 * sample in dark. Dark only.
 */
test('social-preview', async ({ page, theme }) => {
  test.skip(theme !== 'dark', 'the social preview is dark')
  await open(page, 'view-core')
  await calm(page)
  const studio = (await page.screenshot({ animations: 'disabled', caret: 'hide' })).toString('base64')

  await page.setViewportSize({ width: 1280, height: 640 })
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0 }
  body { width: 1280px; height: 640px; overflow: hidden; font-family: Inter, sans-serif; color: #e8eaf6;
    background:
      radial-gradient(700px 420px at 100% 0%, rgba(110,168,255,.22), transparent 70%),
      linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px) 0 0 / 32px 32px,
      linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px) 0 0 / 32px 32px,
      #0d0d1a; }
  .pitch { position: absolute; left: 80px; top: 88px; width: 540px }
  .logo { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 600; letter-spacing: -.01em }
  .logo em { font-style: normal; color: #6ea8ff }
  h1 { margin-top: 44px; font-size: 54px; line-height: 1.08; font-weight: 800; letter-spacing: -.035em }
  h1 span { color: #8ab8ff }
  p { margin-top: 24px; font-size: 21px; hyphens: none; line-height: 1.5; color: #b3b8d4 }
  .chips { display: flex; gap: 10px; margin-top: 28px }
  .chips span { padding: 7px 14px; border: 1px solid rgba(110,168,255,.35); border-radius: 999px; background: rgba(110,168,255,.1); font-size: 16px; font-weight: 600 }
  .foot { position: absolute; left: 80px; bottom: 56px; font: 500 18px 'JetBrains Mono', monospace; color: #e8eaf6 }
  .foot span { color: #8a90b0 }
  .shot { position: absolute; left: 650px; top: 86px; width: 900px; border-radius: 14px; overflow: hidden;
    border: 1px solid rgba(110,168,255,.35); box-shadow: 0 30px 80px rgba(0,0,0,.6), 0 0 0 6px rgba(110,168,255,.06) }
  .shot img { display: block; width: 100% }
</style></head><body>
  <div class="pitch">
    <div class="logo"><svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="none" stroke="#6ea8ff" stroke-width="3" stroke-dasharray="5 4"/><circle cx="20" cy="20" r="6" fill="#6ea8ff"/></svg><span>radical<em>.tools</em></span></div>
    <h1>Architecture as<br><span>one living model.</span></h1>
    <p>Open-source studio for C4 models, ADRs, fitness functions and requirements, with an AI co-architect.</p>
    <div class="chips"><span>C4</span><span>ADRs</span><span>Fitness functions</span><span>AI</span><span>MIT</span></div>
  </div>
  <div class="foot">studio.radical.tools <span>· free, in the browser</span></div>
  <div class="shot"><img src="data:image/png;base64,${studio}"></div>
</body></html>`)
  await calm(page)
  await page.screenshot({ path: join(SHOTS_DIR, '..', 'social-preview.png') })
})
