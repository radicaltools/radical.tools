---
id: "72c351b2-0cb5-4ca8-95fc-873210c0cf1f"
type: "requirement"
label: "Summary with metamodel rules"
action: "The MCP server shall return the counts, views, sequences and presentations of the model together with the metamodel context: property keys and enum options, allowed parents, cardinality and allowed relation pairs."
ears_type: "event-driven"
rationale: "The agent learns the rules before it writes. Evidence: apps/mcp/src/folderModel.ts:185-205; apps/mcp/src/index.ts:13-23; apps/mcp/src/folderModel.test.ts; manual#mcp"
trigger: "an agent calls get_model_summary"
---
