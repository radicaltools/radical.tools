---
id: "6edf7637-1490-452b-a653-f12efcdeff87"
type: "requirement"
label: "Forge saves the need"
action: "Radical Forge shall save the description in the model as a Need named after its first line, with source \"Radical Forge\"."
ears_type: "event-driven"
rationale: "The brief becomes part of the model so generated requirements can trace to it. Evidence: apps/studio/src/renderer/src/components/RadicalForgeModal.tsx:484-511; packages/common/src/ai/forge/prompts.ts:141-156; manual#forge"
trigger: "the user presses Start with a new description and the metamodel has the Need type"
---
