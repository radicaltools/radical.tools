import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { buildDefine } from '@radical/node-files/buildInfo'

export default defineConfig({
  // The build's version and commit, as tsup.config.ts gives them to the bundle.
  define: buildDefine(fileURLToPath(new URL('.', import.meta.url))),
})
