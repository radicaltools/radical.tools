import { cp } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  noExternal: ['@radical/common', '@radical/node-files', 'markdown-to-jsx'],
  onSuccess: async () => {
    await cp(fileURLToPath(new URL('../../LICENSE', import.meta.url)), 'LICENSE')
  },
})
