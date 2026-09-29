/**
 * End-to-end regression suite for the web builds of Studio and Hub.
 *
 * The suite drives the production bundles (`vite preview` of out/), not the
 * dev servers, so it checks what is deployed. Build them first:
 *
 *   npm run e2e            (root: builds Studio + Hub, then runs this suite)
 *
 * Screenshot baselines are Linux-only: they are generated and compared in CI,
 * inside the Playwright Docker image, where fonts and rasterisation are fixed.
 * On other platforms screenshot assertions are skipped (the functional checks
 * still run); set E2E_VISUAL=1 to force them. See README.md.
 */
import { defineConfig, devices } from '@playwright/test'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const studioDir = dirname(require.resolve('radical-model/package.json'))
const hubDir = dirname(require.resolve('@radical/hub/package.json'))

export const STUDIO_PORT = 4310
export const HUB_PORT = 4311

for (const [app, out] of [['Studio', join(studioDir, 'out/renderer/index.html')], ['Hub', join(hubDir, 'out/index.html')]]) {
  if (!existsSync(out)) throw new Error(`${app} web build not found (${out}). Run \`npm run build:web && npm run build:hub\` first, or \`npm run e2e\` from the repo root.`)
}

const CI = !!process.env.CI
const visual = process.platform === 'linux' || !!process.env.E2E_VISUAL

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,

  ignoreSnapshots: !visual,
  // One baseline per test and name, no platform suffix: baselines only ever
  // come from the Linux image.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      // Canvas edges are anti-aliased; tolerate a sliver of noise, never a
      // moved node or a missing label.
      maxDiffPixelRatio: 0.005,
    },
  },

  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'dark',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'studio', testDir: './tests/studio', use: { baseURL: `http://localhost:${STUDIO_PORT}` } },
    { name: 'hub', testDir: './tests/hub', use: { baseURL: `http://localhost:${HUB_PORT}` } },
  ],

  webServer: [
    {
      command: `npm run preview:web -- --port ${STUDIO_PORT} --strictPort`,
      cwd: studioDir,
      url: `http://localhost:${STUDIO_PORT}/`,
      reuseExistingServer: !CI,
    },
    {
      command: `npm run preview -- --port ${HUB_PORT} --strictPort`,
      cwd: hubDir,
      url: `http://localhost:${HUB_PORT}/`,
      reuseExistingServer: !CI,
    },
  ],
})
