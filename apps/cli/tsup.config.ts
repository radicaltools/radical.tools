import { cp, mkdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsup'
import { buildDefine } from '@radical/node-files/buildInfo'

/** The tree-sitter runtime and grammars of @radical/assay/src/syntax.ts, copied into dist/tree-sitter. */
async function shipGrammars(): Promise<void> {
  const list = createRequire(import.meta.url).resolve('@radical/assay/grammars')
  const wasm = dirname(createRequire(list).resolve('@vscode/tree-sitter-wasm'))
  const { runtime, grammars } = JSON.parse(await readFile(list, 'utf8')) as { runtime: string[]; grammars: Record<string, string> }
  await mkdir('dist/tree-sitter', { recursive: true })
  // The runtime is CommonJS: beside an ES module bundle it is named .cjs to load as such.
  for (const file of [...runtime, ...Object.values(grammars)]) await cp(join(wasm, file), join('dist/tree-sitter', file.replace(/\.js$/, '.cjs')))
}

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  // The product version, commit and day of this build (@radical/common/version).
  define: buildDefine(fileURLToPath(new URL('.', import.meta.url))),
  noExternal: ['@radical/assay', '@radical/common', '@radical/hub-catalogue', '@radical/node-files', '@radical/crucible', 'markdown-to-jsx'],
  onSuccess: async () => {
    await cp(fileURLToPath(new URL('../../LICENSE', import.meta.url)), 'LICENSE')
    // The Hub's concern packs, which radical check's concern-unaddressed
    // reads (check.ts, concernPacks); only they, not the whole catalogue.
    await cp(fileURLToPath(new URL('../../packages/hub-catalogue/catalogue/concern', import.meta.url)), 'dist/hub-catalogue/concern', { recursive: true })
    // The tree-sitter runtime and the grammars Assay's readers parse code with (@radical/assay's syntax.ts finds
    // them beside the bundle), only those it uses.
    await shipGrammars()
  },
})
