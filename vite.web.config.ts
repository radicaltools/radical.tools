/**
 * Standalone Vite config for building the renderer as a plain SPA
 * (no Electron shell). Output lands in out/renderer/ — same path as
 * electron-vite build so the GitHub Actions sync script just works.
 *
 * Two HTML entries share one bundle:
 *   index.html → Radical Studio  (studio.radical.tools)
 *   hub.html   → Radical Hub     (hub.radical.tools) — the embedded viewer
 *
 * Usage:  npm run build:web   /   npm run dev:web  (then open /hub.html)
 *
 * Note: window.electronAPI calls in the code are all optional-chained
 * (?.readFile, ?.saveDiagram etc.) so the SPA gracefully degrades —
 * filesystem-backed document storage is disabled in the browser but
 * all diagram editing works via localStorage.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { hubCataloguePlugin } from './tools/hubCatalogue'

const root = resolve(__dirname, 'src/renderer')

export default defineConfig({
  plugins: [react(), hubCataloguePlugin({ hubDir: resolve(__dirname, 'hub') })],
  root,
  base: './',
  build: {
    outDir: resolve(__dirname, 'out/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        hub: resolve(root, 'hub.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
    },
  },
  optimizeDeps: {
    include: ['reactflow', 'webcola'],
  },
})
