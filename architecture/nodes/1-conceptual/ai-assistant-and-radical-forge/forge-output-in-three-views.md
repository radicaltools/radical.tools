---
id: "85daf72a-7014-48d9-bbbd-e240ac96e940"
type: "requirement"
label: "Forge output in three views"
action: "Radical Forge shall add each of them to its view: Conceptual for needs, requirements, scenarios and mockups, Logical & physical for C4 elements, Governance for fitness functions and ADRs; it shall create a view when its first element arrives and reuse a view of that name."
ears_type: "event-driven"
rationale: "A whole run on one canvas grows into one tall, overlapping diagram; the layers read separately. Evidence: packages/common/src/ai/forge/views.ts; apps/studio/src/renderer/src/components/RadicalForgeModal.tsx (runStage, ensureNeed); apps/mcp/src/forge.ts (forge_start, forge_complete_stage)"
trigger: "a Forge stage adds elements to the model"
---
