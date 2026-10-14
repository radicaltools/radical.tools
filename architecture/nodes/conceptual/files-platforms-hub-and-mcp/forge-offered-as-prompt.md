---
id: "4bdef9d0-1422-433f-a8f4-5891781792fe"
type: "scenario"
label: "Forge offered as prompt"
given: "an MCP server on a model folder"
tests: "apps/mcp/src/forge.test.ts › Radical Forge over MCP › starts from an existing need and offers the flow as a prompt"
then: "forge is listed, and its message holds the description and tells the agent to call forge_start"
when: "the client lists the server's prompts and asks for the forge prompt with a description"
---
