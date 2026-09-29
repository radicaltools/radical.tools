# @radical/layout

Smart Layout and the other headless layout engines: the ELK ensemble, the
Radical semantic C4 layout, crossing minimisation, simulated-annealing
refinement, port allocation and edge routing. Depends on `@radical/common`
and `elkjs` only.

Studio keeps the browser-specific parts: the Web Worker wrapper
(`smartLayout.worker.ts`, `smartLayoutRunner.ts`) and the live webcola
physics (`liveColaLayout.ts`).

Smart Layout is the product's core differentiator. Before and after changing
it, compare the composite score across several fixtures:

```bash
npm test -w @radical/layout
node --import tsx tests/visual/layoutHarness.mjs   # from packages/layout
```
