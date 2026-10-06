---
id: "1b4b50ca-d1e7-4160-9773-50aaa35cdb94"
type: "requirement"
label: "Success only after write"
action: "The MCP server shall report success only after the files are written, listing the changed files and a revision hash."
ears_type: "event-driven"
rationale: "The agent can trust that a reported change is on disk. Evidence: apps/mcp/src/folderModel.ts:295-308; manual#mcp"
trigger: "a write tool call succeeds"
---
