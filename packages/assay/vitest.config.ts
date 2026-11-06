import { configDefaults, defineConfig } from 'vitest/config'

// The fixture repositories hold test files of their own, which are data here.
export default defineConfig({ test: { exclude: [...configDefaults.exclude, 'tests/fixtures/**'] } })
