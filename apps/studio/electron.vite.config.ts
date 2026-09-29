import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
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
    define: {
      __DEV_SAMPLE_DATA_PATH__: JSON.stringify(
        resolve(__dirname, 'src/renderer/src/store/fintechSampleData.json')
      ),
    },
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
