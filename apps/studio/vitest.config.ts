import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts', './tests/setupPersistence.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.mjs'],
  },
})
