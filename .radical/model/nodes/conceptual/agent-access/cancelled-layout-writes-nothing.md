---
id: "2e23c31c-3eed-48f0-aa9e-5545c99492df"
type: "scenario"
label: "Cancelled layout writes nothing"
given: "an MCP server running Smart Layout on a model folder, or one in a Forge run"
then: "the call ends as cancelled with every file of the folder unchanged; the server exits with status 0 and marks the unfinished Forge run closed"
when: "the client cancels the call at its first progress step, or closes its end of the connection"
---
