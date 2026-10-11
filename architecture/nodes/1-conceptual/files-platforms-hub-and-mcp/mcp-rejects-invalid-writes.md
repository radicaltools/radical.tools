---
id: "176a4beb-7817-4ae9-aacf-67c87345be43"
type: "requirement"
label: "MCP rejects invalid writes"
action: "The MCP server shall reject the write with a message the agent can act on and leave the folder unchanged."
ears_type: "unwanted-behaviour"
rationale: "Agent writes are validated like the editor's. Evidence: apps/mcp/src/folderModel.ts:214-218,276-294; packages/common/src/ai/modelFacade.ts:83-108; apps/mcp/src/catalogueTools.test.ts; manual#mcp"
unwanted_condition: "a tool call would add an invalid type, parent or relation pair or a new metamodel error"
---
