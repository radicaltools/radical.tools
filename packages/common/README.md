# @radical/common

The radical model, shared by Studio, the VS Code extension and the MCP server.

| Import | What it holds |
|---|---|
| `@radical/common/c4` | `DiagramData`, `C4Node`, `C4Relation`, views, node sizes |
| `@radical/common/metamodel` | Metamodel types, built-in presets (C4, DDD, Governance), validation, EARS |
| `@radical/common/model` | The rules and edits behind every model change (add / update / remove nodes, relations, views), shared by Studio's store and the headless facade |
| `@radical/common/hubFormat` | Hub concept documents and the catalogue index format |
| `@radical/common/formats/*` | Structurizr DSL import, markdown-folder persistence, Gherkin export |
| `@radical/common/ai/*` | Query language, `DiagramFacade`, the AI tool catalogue (`ToolDef` + handlers) and `createModelFacade`, which runs those tools on a plain `DiagramData` with no UI |

Rules:

- No UI, browser or store dependencies. The package type-checks without the
  DOM lib, so `window` or `document` here fails `npm run typecheck`.
- AI tools are written against `DiagramFacade`, not against Studio's store,
  so the MCP server can serve the same tools over a headless model.
- Consumers import `.ts` source directly; there is no build step.
- Only the subpaths listed in `exports` in package.json are public. Tests
  import internals by relative path.
