---
id: "dc23ee9d-6a83-4c90-bb0d-431edaf5b6bb"
type: "requirement"
label: "C4 + DDD opens as Radical"
action: "The system shall run it under the Radical metamodel, which holds every C4 + DDD type unchanged."
ears_type: "event-driven"
rationale: "No model breaks when the preset leaves the picker, and its owner gains the governance types. Evidence: packages/common/src/model.ts (documentMetamodel); packages/ui/tests/model.test.ts › loads a model saved under the retired C4 + DDD preset as Radical; .claude/skills/radical-diagram/scripts/validate.mjs"
trigger: "a document saved under the retired C4 + DDD preset (id c4-ddd-builtin) is loaded, in Studio, the MCP server or the radical-diagram skill's validator"
---
