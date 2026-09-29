/**
 * Radical Hub (hub.radical.tools): the concept catalogue plus the read-only
 * viewer. The viewer is built on Studio's canvas and panels, imported from
 * `radical-model/viewer`.
 *
 * Output: out/index.html + out/assets/** + out/hub/{index.json,<category>/<id>.radical}
 * + out/hub-data.json (legacy single-file catalogue for older desktop builds).
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { hubCataloguePlugin } from './tools/hubCatalogue'

export default defineConfig({
  plugins: [react(), hubCataloguePlugin({ hubDir: resolve(__dirname, 'catalogue') })],
  base: './',
  build: {
    outDir: resolve(__dirname, 'out'),
    emptyOutDir: true,
  },
  optimizeDeps: {
    include: ['reactflow', 'webcola'],
  },
})
