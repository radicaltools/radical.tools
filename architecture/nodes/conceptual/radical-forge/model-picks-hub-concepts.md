---
id: "0316aaaa-ea9d-4327-af2f-1f41617ffff0"
type: "requirement"
label: "Model picks Hub concepts"
action: "Radical Forge shall have the model pick, from the stage's Hub concepts ranked by keyword relevance, at most five that fit the description in whatever language it is written, and offer only those for the user to confirm."
ears_type: "event-driven"
rationale: "Keyword overlap alone suggested a RAG pipeline for a click & collect shop and nothing at all for a brief in Polish. Evidence: packages/common/src/ai/forge/clarify.ts (buildClarifyPrompt, pickedHubConcepts); apps/studio/src/renderer/src/ai/forgeClarify.ts; apps/mcp/src/forge.ts (forge_clarify, forge_generate)"
trigger: "a Forge stage asks its clarifying questions"
---
