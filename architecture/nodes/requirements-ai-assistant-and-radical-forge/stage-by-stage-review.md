---
id: "fea9d667-e424-4573-8c7e-f716e49ae6d3"
type: "requirement"
label: "Stage-by-stage review"
action: "Radical Forge shall stop after each generated stage until the user chooses Regenerate, Continue or Finish here, and shall not let the user open a stage the run has not reached yet."
ears_type: "ubiquitous"
rationale: "Each stage is reviewed before the next builds on it. Evidence: apps/studio/src/renderer/src/components/RadicalForgeModal.tsx:473-480,558-590,646-658; manual#forge"
---
