# @radical/layout

Smart Layout and the other headless layout engines: the ELK ensemble, the
Radical semantic C4 layout, crossing minimisation, simulated-annealing
refinement, port allocation and edge routing, and the live WebCoLa physics
engine. Depends on `@radical/common`, `elkjs`, `webcola` and three d3
modules (`d3-dispatch`, `d3-timer`, `d3-drag`) the WebCoLa adaptor needs.

Public entry points are the ones listed in `exports` in package.json
(`smartLayout`, `elkLayout`, `radicalLayout`, `crossingOpt`, `geometry`,
`portAllocator`, `edgeRouting`, `side`, `viewInput`, `constraints`,
`liveColaEngine`).
`constraints` applies the user's kept rows, columns and grids
(`LayoutConstraint` in `@radical/common`) to a layout. The annealing refinement, score
weights, ELK spacing and finalising steps are internal.

`liveColaEngine` is the physics the canvas runs while a diagram is edited
(`LiveColaEngine`: it moves what is added or dragged, with its surroundings,
and leaves a laid-out diagram alone) and `relaxLayout`, the same physics run
over a whole diagram in one go. Smart Layout scores that relaxation of its
winner as one more candidate, so Studio and the MCP server get the same
result.

Studio keeps the browser-specific parts: the Web Worker wrappers
(`smartLayout.worker.ts`, `smartLayoutRunner.ts`, `liveCola.worker.ts`,
`liveColaLayout.ts`).

Smart Layout is the product's core differentiator. Before and after changing
it, compare the composite score across several fixtures:

```bash
npm test -w @radical/layout
node --import tsx tests/visual/layoutHarness.mjs   # from packages/layout
```
