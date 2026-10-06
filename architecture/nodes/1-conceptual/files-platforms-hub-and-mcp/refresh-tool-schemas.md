---
id: "20415bf3-ca3b-4385-aad8-6f8f38380c2b"
type: "requirement"
label: "Refresh tool schemas"
action: "The MCP server shall rebuild and re-announce the element and relation tool schemas with the new types."
ears_type: "event-driven"
rationale: "The agent can use new types immediately. Evidence: apps/mcp/src/folderModel.ts:128-136,169-173,226-228; apps/mcp/src/index.ts:29-46; apps/mcp/src/catalogueTools.test.ts:80-90; manual#mcp"
trigger: "the folder's metamodel changes, through a metamodel tool or in Studio"
---
