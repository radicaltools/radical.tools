---
id: "48bc69bd-88bc-43f9-a948-b774b267eda9"
type: "requirement"
label: "Forge ends with a review"
action: "Radical Forge shall read the whole model against the brief, close the open gaps and the inconsistencies between its parts (names that differ, a scenario that contradicts a transition, a step no requirement asks for) and list everything it added or changed as refinements to keep or reject"
ears_type: "event-driven"
rationale: "Per-stage refinement sees the model only up to that stage; only after C4 is every part there to be checked against every other. Evidence: packages/common/src/ai/forge/prompts.ts ('review'); packages/common/tests/forgePrompts.test.ts; apps/mcp/src/forge.test.ts"
trigger: "the user generates the Review stage, after the C4 model"
---
