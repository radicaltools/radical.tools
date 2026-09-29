# @radical/hub-catalogue

The Architecture Hub's concept catalogue and the tooling around it.

- `catalogue/<category>/<id>.radical`: one Radical Studio document per concept,
  with a `hub` metadata block (format in `@radical/common/hubFormat`).
- `@radical/hub-catalogue`: `readCatalogue`, `validateCatalogue`, `buildIndex`,
  `CATALOGUE_DIR`.
- `@radical/hub-catalogue/vite`: `hubCataloguePlugin()`. It serves the catalogue
  under `/hub/` in dev and emits it at build time.

Used by apps/hub (hub.radical.tools) and by apps/studio, which bundles the
catalogue so Hub import works offline.

`./vite` is a small CommonJS file that loads `src/vite.ts` through tsx, so
Vite and electron-vite configs can import it like any other plugin:

```ts
import { hubCataloguePlugin } from '@radical/hub-catalogue/vite'

export default defineConfig({ plugins: [react(), hubCataloguePlugin()] })
```
