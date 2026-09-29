# @radical/ui

The canvas, properties panel, Wiki and Table views, and the diagram store,
shared by Studio (apps/studio) and the read-only Hub viewer (apps/hub).

It has no documents, host bridge or AI. Apps plug those in:

- `store/documentBackend`: `configureDocumentBackend()` gives the store the
  document to start from and lazily loaded node bodies. Call it before the
  store module is first imported, because the store builds its initial state
  on import. Studio does this in `persistence/configureDocuments.ts`. Saving is
  the app's job: subscribe to the store (Studio's `persistence/autosave.ts`).
- `components/wireframeGeneration`: `setWireframeGenerator()` enables
  "Generate wireframe" on mockups. Studio registers its AI-backed generator.
- `window.__RADICAL_PROFILE = 'viewer'`, set before any module runs, starts
  the store empty and read-only (the Hub).

Entry points are listed in `exports` in package.json. `@radical/ui/viewer`
bundles everything the Hub needs; `@radical/ui/styles.css` is the global
stylesheet; `@radical/ui/testing/setup` stubs `window` and
`requestAnimationFrame` for tests under node.
