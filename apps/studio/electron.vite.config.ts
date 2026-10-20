import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { hubCataloguePlugin } from '@radical/hub-catalogue/vite'
import { buildDefine } from '@radical/node-files/buildInfo'
import { RENDERER_MINIFY } from './rendererMinify'

// The product version, commit and day of this build (@radical/common/version).
const BUILD = buildDefine(__dirname)

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react(), hubCataloguePlugin()],
    define: BUILD,
    build: RENDERER_MINIFY,
    optimizeDeps: {
      include: ['reactflow', 'webcola']
    },
    server: {
      watch: {
        // Native FS events don't work on external volumes (/Volumes/...).
        // Polling ensures Vite detects file changes regardless of mount type.
        usePolling: true,
        interval: 300,
      },
    },
  }
})
