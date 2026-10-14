---
id: "2e23c31c-3eed-48f0-aa9e-5545c99492df"
type: "scenario"
label: "Cancelled layout writes nothing"
given: "an MCP server running Smart Layout on a model folder, or one in a Forge run"
tests: |
  apps/mcp/src/folderModel.test.ts › long Smart Layout runs › stops at the next step once the client cancels, and writes nothing
  apps/mcp/src/folderModel.test.ts › long Smart Layout runs › exits when the client closes its end
  apps/mcp/src/forge.test.ts › Radical Forge over MCP › marks an unfinished run closed when the client goes away
then: "the call ends as cancelled with every file of the folder unchanged; the server exits with status 0 and marks the unfinished Forge run closed"
when: "the client cancels the call at its first progress step, or closes its end of the connection"
---
