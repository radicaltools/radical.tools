# radical.tools

## Architecture model

`architecture/` is the architecture of radical.tools itself, kept as a Radical
Markdown-folder model (Radical metamodel): containers, shared packages,
ADRs, fitness functions, needs and requirements. It lives on the maintainer's
machine, not in the repository: the folder is git-ignored, so it is never part
of a commit or a pull request, and a fresh clone has none (the MCP server then
starts an empty model there). Claude Code reaches it through the project MCP
server `radical-architecture` (`.mcp.json`), which needs
`npm run build -w @radicaltools/mcp` once after cloning and after MCP changes.
Studio can open the same folder.

- **Before a structural change** (a new or removed app or package, a new
  dependency between workspaces, a new external service, or going against a
  decision): call `get_model_summary`, then `search_model` for the elements
  involved and read the ADRs that constrain them (`GET NEIGHBORS OF <id>`).
- **Along with the change**, update the model through the MCP tools rather
  than by editing the files: add or move elements and relations, record a new
  decision as an ADR (status, date, context, decision, consequences,
  alternatives) linked with `constrains`, and an automated check as a fitness
  function that `implements` it. Then run `smart_layout` on the views you
  changed.
- Scenarios and fitness functions name the tests that run them in `tests`
  (one `file › title` per line). When you add a scenario, or rename, move or
  delete a test one names, update `tests` with it.
- To see what the tests say about the model: `npm run test:reports` (plus
  `npm run e2e` for the e2e tests; both write to `reports/`), then
  `npm run check:architecture`. It must report no errors; a test the model
  names that failed or is gone is one.
- Write the model in English.
- When the product gets in the way while doing this (a missing tool, an
  awkward format, a bad layout), add it to `docs/IMPROVEMENTS.md` under
  "Dogfooding".
