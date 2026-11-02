---
id: "9c2be760-a7bc-4e6c-a6db-bc0a48de5e91"
type: "requirement"
label: "Catalogue follows metamodel"
action: "The AI tool catalogue shall be built from the live metamodel for every run, offering its element and relation types to the model, and shall be rebuilt within a run after a metamodel change."
ears_type: "ubiquitous"
rationale: "Custom types from the metamodel editor get full AI support without code changes. Evidence: packages/common/src/ai/tools/index.ts:1-39; packages/common/src/ai/tools/nodeTools.ts:9-11; apps/studio/src/renderer/src/ai/runner.ts:120-176"
---
