---
id: "6f84875d-7998-4d7f-a676-b2aa41dab92c"
type: "requirement"
label: "Assistant sees model"
action: "The AI assistant shall send the provider its rules, the active metamodel's types, properties and containment and relation rules, and a fresh snapshot of the model's nodes, relations and views without layout fields on every round."
ears_type: "ubiquitous"
rationale: "Answers and edits are only correct if the model sees the current architecture and its rules. Evidence: packages/common/src/ai/systemPrompt.ts:10-91; apps/studio/src/renderer/src/ai/systemPrompt.ts; packages/common/src/ai/metamodelContext.ts:31-79; apps/studio/src/renderer/src/ai/runner.ts:178-197; manual#ai"
---
