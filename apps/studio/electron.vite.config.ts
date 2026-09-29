import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { hubCataloguePlugin } from '@radical/hub-catalogue/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react(), hubCataloguePlugin()],
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
