---
id: "e5ed7e65-57cb-4e93-91ab-9dd29d41593b"
type: "requirement"
label: "Hub concepts as prior art"
action: "Radical Forge shall list those concepts with an Import button and pass the ones the user keeps selected to the model as prior art."
ears_type: "state-driven"
precondition: "the Requirements, Fitness functions or C4 model stage is open and the Hub has concepts matching the description"
rationale: "Generation reuses proven patterns, ADRs and thresholds instead of starting from scratch. Evidence: apps/studio/src/renderer/src/components/RadicalForgeModal.tsx:60-68,242-257,373-381,457-470,711-735; apps/studio/src/renderer/src/ai/forgePrompts.ts:84-99; manual#forge"
---
