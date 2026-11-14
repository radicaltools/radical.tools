---
id: "72c351b2-0cb5-4ca8-95fc-873210c0cf1f"
type: "requirement"
label: "Summary with metamodel rules"
action: "The MCP server shall return the counts, views (with their alignments), sequences, presentations (with each slide's milestone and focus), milestones, the metamodel's name, the modelling rules Studio's chat and Forge follow (AI_MODELLING_RULES: needs, requirements, state machines), and each node and relation type of the metamodel in one line (allowed parents and root, cardinality, property keys with enum options when they are short, allowed pairs) and the viewpoints by name, saying that the types parameter gives a type in full."
ears_type: "event-driven"
rationale: "The agent learns the rules before it writes, without the whole metamodel at every call (ADR Agent answers brief, details on request). Until 2026-10-09 the modelling rules reached MCP agents only inside Forge briefs; until 2026-11-12 the summary carried the whole metamodel. Evidence: apps/mcp/src/folderModel.ts (get_model_summary); packages/common/src/ai/metamodelContext.ts; apps/mcp/src/index.ts (INSTRUCTIONS); apps/mcp/src/folderModel.test.ts; manual#mcp"
trigger: "an agent calls get_model_summary"
---
