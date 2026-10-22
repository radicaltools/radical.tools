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
  noExternal: ['@radical/common', '@radical/node-files', '@radical/crucible', 'markdown-to-jsx'],
  onSuccess: async () => {
    await cp(fileURLToPath(new URL('../../LICENSE', import.meta.url)), 'LICENSE')
  },
})
