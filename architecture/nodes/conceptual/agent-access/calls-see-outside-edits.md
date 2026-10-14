---
id: "42faa514-97a7-401c-b02d-7a477e53dc7b"
type: "requirement"
label: "Calls see outside edits"
action: "run the calls one at a time, each on the model as the folder holds it when the call starts, so edits made in Studio, by hand or by another client since the previous call are part of it"
ears_type: "event-driven"
rationale: "The server keeps no copy of the model between calls: it re-reads the folder for every call and queues calls, so an agent never works on, or writes back, a stale model. Evidence: apps/mcp/src/folderModel.ts (FolderModel.call, run)"
trigger: "an agent calls a tool of the MCP server"
---
