---
id: "c50054d8-2ca1-447d-bb06-fa3936cace38"
type: "requirement"
label: "Requirements derive from need"
action: "Radical Forge shall instruct the model to link every top-level requirement to that need with derives and not to edit the need."
ears_type: "event-driven"
rationale: "Every generated requirement traces back to the brief it came from. Evidence: packages/common/src/ai/forge/prompts.ts:188-209; apps/studio/src/renderer/src/components/RadicalForgeModal.tsx:385-387; manual#forge"
trigger: "the Requirements stage runs with a stored need"
---
