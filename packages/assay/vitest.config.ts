import { configDefaults, defineConfig } from 'vitest/config'

// The fixture repositories hold test files of their own, which are data here.
// The grammars the readers parse code with load before every test file (tests/syntax-setup.ts).
export default defineConfig({ test: { exclude: [...configDefaults.exclude, 'tests/fixtures/**'], setupFiles: ['tests/syntax-setup.ts'] } })
