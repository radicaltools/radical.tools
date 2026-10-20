---
id: "81671288-bd66-48a1-8409-bbb3f5e4ffab"
type: "requirement"
label: "Forge asks for the languages"
action: "the Forge procedure shall have the agent first ask the user which language to talk in and which language to write the model in (by default the language of the description and English), forge_start shall take both for the run, and every brief of the run (clarify, stage, wireframe) shall say to talk to the user in the one and to write the labels, descriptions and texts of the model in the other"
ears_type: "event-driven"
rationale: "A team may discuss a system in their own language and still keep the model in the language the code and its readers share, or model in their own language. Asked before the view structure, nothing is written in the wrong language. Kept for the run only, not in the model. Evidence: packages/common/src/ai/forge/prompts.ts (forgeLanguageRules), apps/mcp/src/forge.ts (FORGE_PROCEDURE, forge_start languages)"
trigger: "an agent starts a Radical Forge run over MCP"
---
