---
id: "cf57028b-d044-4957-9f74-03af8bead446"
type: "adr"
label: "One radical CLI"
alternatives: "`radical lint`: a lint is static and fast and has --fix, while the check will also read test results and judge whether the system works. A separate radical-check executable per command: one name per tool to install and document. Putting the check into the MCP server: a pipeline cannot use a stdio server, and the server's package version is its MCP handshake version."
consequences: "A new app depends only on packages (Monorepo with npm workspaces). Studio's Validation list, get_issues and a future MCP tool can show the same findings as CI. A pipeline needs the model folder in the repository; this repository's own architecture/ is local-only, so its CI runs the command's tests, not a check of the model."
context: "Checking a model in CI (files, metamodel, completeness, later test evidence and code drift) needs a command a pipeline can run. The only executable so far is radical-mcp, an MCP server over stdio, which a CI job cannot use as a check. More commands will follow (headless Smart Layout, export and import)."
date: "2026-10-14"
decision: "Add one `radical` executable in a new app, apps/cli (@radicaltools/cli), with subcommands; the first is `radical check`. The command line only reads files, formats and sets the exit status: the rules live in @radical/common (src/check) and are pure functions of the folder's files and a config. The MCP server keeps its radical-mcp executable; serving it as `radical mcp` too is a later step. The package stays private until it is published the way Public MCP distribution publishes the MCP server."
status: "accepted"
---
