import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Studio's window / rAF stubs: the viewer runs on Studio's diagram store
    setupFiles: ['../studio/tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
})
