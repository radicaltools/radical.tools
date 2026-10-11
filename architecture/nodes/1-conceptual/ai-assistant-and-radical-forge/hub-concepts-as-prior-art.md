---
id: "e5ed7e65-57cb-4e93-91ab-9dd29d41593b"
type: "requirement"
label: "Hub concepts as prior art"
action: "Radical Forge shall list those concepts with an Import button and pass the ones the user keeps selected to the model as prior art."
ears_type: "state-driven"
precondition: "the Requirements, Fitness functions or C4 model stage is open and the Hub has concepts matching the description"
rationale: "Generation reuses proven patterns, ADRs and thresholds instead of starting from scratch. Which concepts are listed: ADR Hub matching ranks, the model picks. Evidence: apps/studio/src/renderer/src/components/RadicalForgeModal.tsx (Hub suggestions, runStage); packages/common/src/ai/forge/prompts.ts (buildHubGuidanceBlock); manual#forge"
---
