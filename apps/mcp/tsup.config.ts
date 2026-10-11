import { cp } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defineConfig } from 'tsup'

// Forge reads the Hub catalogue at runtime (src/forge.ts), so the build ships a
// copy beside the bundle. Located the way @radical/hub-catalogue's CATALOGUE_DIR
// is (its TypeScript can't be imported from this config).
const catalogue = fileURLToPath(new URL('../catalogue', pathToFileURL(createRequire(import.meta.url).resolve('@radical/hub-catalogue'))))

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  noExternal: ['@radical/common', '@radical/hub-catalogue', '@radical/layout', '@radical/node-files'],
  onSuccess: async () => { await cp(catalogue, 'dist/hub-catalogue', { recursive: true }) },
})
