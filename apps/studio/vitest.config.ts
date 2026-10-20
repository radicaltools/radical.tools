import { defineConfig } from 'vitest/config'
import { buildDefine } from '@radical/node-files/buildInfo'

export default defineConfig({
  define: buildDefine(__dirname),
  test: {
    setupFiles: ['./tests/setup.ts', './tests/setupPersistence.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.mjs'],
  },
})
