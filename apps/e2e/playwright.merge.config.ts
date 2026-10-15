/**
 * Merges the blob reports of the CI shards (.github/workflows/e2e.yml) into
 * the reports one unsharded run writes:
 *
 *   npx playwright merge-reports --config playwright.merge.config.ts <blob dir>
 */
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: '../../reports/e2e.json' }],
  ],
})
