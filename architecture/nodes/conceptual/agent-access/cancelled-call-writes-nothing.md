---
id: "949697f4-e51a-4dc6-99d3-61c34ff8bed8"
type: "requirement"
label: "Cancelled call writes nothing"
action: "stop the call at its next step and write nothing, and exit once the client has closed its end"
ears_type: "unwanted-behaviour"
rationale: "A Smart Layout of a large model takes minutes; a client that gives up must not get a half-finished or unseen write. The server also marks an unfinished Forge run closed when it exits. Evidence: apps/mcp/src/folderModel.ts (CANCELLED, smartLayout, close), apps/mcp/src/index.ts (AbortSignal.any, stdin end), apps/mcp/src/folderModel.test.ts › long Smart Layout runs"
unwanted_condition: "the MCP client cancels a call, or goes away, while the call runs"
---
