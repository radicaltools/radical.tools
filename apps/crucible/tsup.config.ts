import { cp } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.ts', vitest: 'src/vitest.ts', findings: 'src/findings.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  // The engine is bundled, as the CLI bundles it. fast-check is a dependency and Vitest a
  // peer, so a project's own copies are the ones that run.
  noExternal: ['@radical/crucible'],
  external: ['fast-check', 'vitest'],
  // The types come along too, so the package names no private one.
  dts: {
    resolve: [/^@radical\/crucible/],
    compilerOptions: {
      baseUrl: '.',
      paths: {
        '@radical/crucible': ['../../packages/crucible/src/index.ts'],
        '@radical/crucible/vitest': ['../../packages/crucible/src/vitest.ts'],
        '@radical/crucible/findings': ['../../packages/crucible/src/findingFiles.ts'],
      },
    },
  },
  onSuccess: async () => {
    await cp(fileURLToPath(new URL('../../LICENSE', import.meta.url)), 'LICENSE')
  },
})
