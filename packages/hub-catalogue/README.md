# @radical/hub-catalogue

The Architecture Hub's catalogue of concern packs and the tooling around it.

- `packs/<group>/<id>.ts`: one pack per concern, written as a spec (the
  default export, type `PackSpec` in `src/packSpec.ts`): its trigger and
  questions, the need, the requirements with the scenario that verifies each,
  the decisions per answer, and the fitness functions with their tool, their
  snippet and the requirements they check.
- `catalogue/concern/<id>.radical`: the Radical Studio document each spec
  builds, with a `hub` metadata block (format in `@radical/common/hubFormat`).
  `npm run build:packs -w @radical/hub-catalogue` builds every spec (or the
  files given as arguments) and refuses a pack below the standard, naming
  what it lacks; `--check` fails when a file is not what its spec builds.
- `@radical/hub-catalogue`: `readCatalogue`, `validateCatalogue`, `buildIndex`,
  `CATALOGUE_DIR`.
- `@radical/hub-catalogue/vite`: `hubCataloguePlugin()`. It serves the catalogue
  under `/hub/` in dev and emits it at build time.

## The standard

Kept by the build and `tests/concernPacks.test.ts`, as ADR *Concern groups and
pack standard* decides:

- `concernPackProblems` (`@radical/common/concerns`): one group of the nine;
  at least three questions with options, each option saying what it means and
  when to pick it; at least two sources with links; one need, an ADR marked
  with the concern, every requirement derived from the need and verified by a
  scenario, every fitness function implementing an ADR with a `Tool:` line and
  a fenced snippet; every `{{KEY}}` a question or detail, every detail used,
  no token in an option's label or description, no detail's value hard-coded
  beside a `# KEY` comment, no EARS clause starting with its own keyword,
  every option decided by an element imported for it or a decision naming it,
  every fitness function imported with a decision it implements.
- `specProblems` (`src/packSpec.ts`): every requirement named in the `checks`
  of a fitness function imported whenever it is, or `unchecked` with a reason
  the team keeps it by hand.
- `boundImportProblems` (`src/packCheck.ts`): imported with every combination
  of answers and bound in a shop model, the pack passes `radical check` apart
  from the tests the team still has to name.

What the build cannot check is reviewed: one decision has one owner pack and
the others refer to it in words; every snippet is run against a sample or
verified against the tool's documentation; numbers come from the details;
labels read in the sentences they fill.

Used by apps/hub (hub.radical.tools) and by apps/studio, which bundles the
catalogue so Hub import works offline; the MCP server's and the CLI's builds
ship a copy for `get_issues`, Forge and `radical check`.

`./vite` is a small CommonJS file that loads `src/vite.ts` through tsx, so
Vite and electron-vite configs can import it like any other plugin:

```ts
import { hubCataloguePlugin } from '@radical/hub-catalogue/vite'

export default defineConfig({ plugins: [react(), hubCataloguePlugin()] })
```
