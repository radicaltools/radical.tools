---
id: "5f3fb9b2-4385-4002-b376-4c502177e2b3"
type: "requirement"
label: "MCP bound to one folder"
action: "The MCP server shall run locally over stdio, bound to the one Markdown model folder given as an absolute --folder path."
ears_type: "ubiquitous"
rationale: "Nothing leaves the machine except what the agent sends to its own provider, and the agent cannot reach other folders. Evidence: apps/mcp/src/index.ts:6-11,25-49; apps/mcp/src/folderModel.ts:138-147; manual#mcp"
---
