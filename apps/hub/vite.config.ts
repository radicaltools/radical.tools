/**
 * Radical Hub (hub.radical.tools): the concept catalogue plus the read-only
 * viewer, built on the canvas and panels in @radical/ui.
 *
 * Output: out/index.html + out/assets/** + out/hub/{index.json,<category>/<id>.radical}
 * + out/hub-data.json (legacy single-file catalogue for older desktop builds).
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { hubCataloguePlugin } from '@radical/hub-catalogue/vite'

export default defineConfig({
  plugins: [react(), hubCataloguePlugin()],
  base: './',
  build: {
    outDir: resolve(__dirname, 'out'),
    emptyOutDir: true,
  },
  optimizeDeps: {
    include: ['reactflow', 'webcola'],
  },
})
