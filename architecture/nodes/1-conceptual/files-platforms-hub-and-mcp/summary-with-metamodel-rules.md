---
id: "72c351b2-0cb5-4ca8-95fc-873210c0cf1f"
type: "requirement"
label: "Summary with metamodel rules"
action: "The MCP server shall return the counts, views, sequences and presentations of the model together with the modelling rules Studio's chat and Forge follow (AI_MODELLING_RULES: needs, requirements, state machines) and the metamodel context: property keys and enum options, reference targets, allowed parents, cardinality and allowed relation pairs."
ears_type: "event-driven"
rationale: "The agent learns the rules before it writes; until 2026-10-09 the modelling rules reached MCP agents only inside Forge briefs. Evidence: apps/mcp/src/folderModel.ts (get_model_summary); apps/mcp/src/index.ts (INSTRUCTIONS); apps/mcp/src/folderModel.test.ts; manual#mcp"
trigger: "an agent calls get_model_summary"
---
