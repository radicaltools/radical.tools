/**
 * The screenshots of the manual (apps/web/manual.html), taken from the web
 * builds of Studio and Hub the way the e2e suite drives them. Not a test
 * suite: every "test" writes a light and a dark PNG to apps/web/screenshots.
 *
 *   npm run docs:screenshots            (root: builds Studio + Hub first)
 *   npm run docs:screenshots -- -g wiki (only the shots whose name matches)
 *
 * Take them on macOS, where the manual's screenshots have always come from;
 * fonts are not blocked here, unlike the e2e suite.
 */
import { defineConfig, devices } from '@playwright/test'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import type { DocsOptions } from './docs/shots'

const require = createRequire(import.meta.url)
const studioDir = dirname(require.resolve('radical-model/package.json'))
const hubDir = dirname(require.resolve('@radical/hub/package.json'))

const STUDIO_PORT = 4320
export const DOCS_HUB_PORT = 4321
const HUB_PORT = DOCS_HUB_PORT

const themes = ['light', 'dark'] as const

export default defineConfig<DocsOptions>({
  testDir: './docs',
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  timeout: 120_000,
  outputDir: './test-results/docs',

  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
  },

  projects: themes.flatMap((theme) => [
    { name: `studio-${theme}`, testMatch: /studio\.docs\.ts/, use: { baseURL: `http://localhost:${STUDIO_PORT}`, theme, colorScheme: theme } },
    { name: `hub-${theme}`, testMatch: /hub\.docs\.ts/, use: { baseURL: `http://localhost:${HUB_PORT}`, theme, colorScheme: theme } },
  ]),

  webServer: [
    {
      command: `npm run preview:web -- --port ${STUDIO_PORT} --strictPort`,
      cwd: studioDir,
      url: `http://localhost:${STUDIO_PORT}/`,
      reuseExistingServer: true,
    },
    {
      command: `npm run preview -- --port ${HUB_PORT} --strictPort`,
      cwd: hubDir,
      url: `http://localhost:${HUB_PORT}/`,
      reuseExistingServer: true,
    },
  ],
})
