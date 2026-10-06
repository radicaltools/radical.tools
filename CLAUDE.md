# radical.tools

## Architecture model

`architecture/` is the architecture of radical.tools itself, kept as a Radical
Markdown-folder model (C4 + DDD + Governance): containers, shared packages,
ADRs, fitness functions, needs and requirements. Claude Code reaches it through
the project MCP server `radical-architecture` (`.mcp.json`), which needs
`npm run build -w @radical/mcp` once after cloning and after MCP changes.
Studio can open the same folder.

- **Before a structural change** (a new or removed app or package, a new
  dependency between workspaces, a new external service, or going against a
  decision): call `get_model_summary`, then `search_model` for the elements
  involved and read the ADRs that constrain them (`GET NEIGHBORS OF <id>`).
- **In the same pull request**, update the model through the MCP tools rather
  than by editing the files: add or move elements and relations, record a new
  decision as an ADR (status, date, context, decision, consequences,
  alternatives) linked with `constrains`, and an automated check as a fitness
  function that `implements` it. Then run `smart_layout` on the views you
  changed.
- Write the model in English.
- When the product gets in the way while doing this (a missing tool, an
  awkward format, a bad layout), add it to `docs/IMPROVEMENTS.md` under
  "Dogfooding".
