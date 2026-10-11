// ─── Renderer minification ──────────────────────────────────────────────────
// Vite 5 scans every built chunk with the es-module-lexer bundled in it, and
// that lexer misreads a variable named `of` inside a `for (…)` header
// (`for(…,sf=of/(c+1);…)`) as the `for…of` keyword, takes the `/` that
// follows for a regular expression and fails the build with "Parse error
// @:1:1". esbuild's minifier hands out `of` like any short name, so whether a
// build fails depends on how many names the bundle needs: any change could
// trip it. Terser can be told never to use the name. The lexer is fixed in
// es-module-lexer 3; drop this once Vite bundles a fixed one.

import type { BuildOptions } from 'vite'

export const RENDERER_MINIFY: Pick<BuildOptions, 'minify' | 'terserOptions'> = {
  minify: 'terser',
  terserOptions: { mangle: { reserved: ['of'] } },
}
