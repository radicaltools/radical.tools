---
id: "c6fccca5-a488-4ef6-9e1b-045998930d00"
type: "requirement"
label: "Fork built-in metamodel"
action: "The MCP server shall save the changed metamodel as a …-custom copy in the folder."
ears_type: "event-driven"
rationale: "Same rule as the Metamodel editor; the built-in preset stays intact. Evidence: packages/common/src/ai/tools/metamodelTools.ts:139; apps/mcp/src/catalogueTools.test.ts:80-112; manual#mcp"
trigger: "an agent changes a built-in metamodel with a metamodel tool"
---
