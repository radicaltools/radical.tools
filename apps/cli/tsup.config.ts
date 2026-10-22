import { cp } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsup'
import { buildDefine } from '@radical/node-files/buildInfo'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  // The product version, commit and day of this build (@radical/common/version).
  define: buildDefine(fileURLToPath(new URL('.', import.meta.url))),
  noExternal: ['@radical/common', '@radical/hub-catalogue', '@radical/node-files', '@radical/crucible', 'markdown-to-jsx'],
  onSuccess: async () => {
    await cp(fileURLToPath(new URL('../../LICENSE', import.meta.url)), 'LICENSE')
    // The Hub's concern packs, which radical check's concern-unaddressed
    // reads (check.ts, concernPacks); only they, not the whole catalogue.
    await cp(fileURLToPath(new URL('../../packages/hub-catalogue/catalogue/concern', import.meta.url)), 'dist/hub-catalogue/concern', { recursive: true })
  },
})
