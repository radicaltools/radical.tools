/**
 * Standalone Vite config for building the renderer as a plain SPA
 * (no Electron shell). Output lands in out/renderer/ — same path as
 * electron-vite build so the GitHub Actions sync script just works.
 *
 * index.html → Radical Studio (studio.radical.tools). The Hub viewer is its
 * own app in apps/hub; this build still bundles the catalogue under hub/ so
 * the studio's Hub import works offline and in development.
 *
 * Usage:  npm run build:web   /   npm run dev:web
 *
 * Note: window.electronAPI calls in the code are all optional-chained
 * (?.readFile, ?.saveDiagram etc.) so the SPA gracefully degrades —
 * filesystem-backed document storage is disabled in the browser but
 * all diagram editing works via localStorage.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { hubCataloguePlugin } from '@radical/hub-catalogue/vite'
import { RENDERER_MINIFY } from './rendererMinify'

const root = resolve(__dirname, 'src/renderer')

export default defineConfig({
  plugins: [react(), hubCataloguePlugin()],
  root,
  base: './',
  build: {
    outDir: resolve(__dirname, 'out/renderer'),
    emptyOutDir: true,
    ...RENDERER_MINIFY,
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
