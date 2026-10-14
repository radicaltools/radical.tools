---
id: "ef232b1c-c18e-4126-a683-a3073f2653e6"
type: "requirement"
label: "Preset chosen at creation"
action: "The system shall let the user pick the metamodel, with the Radical metamodel selected by default and C4 as the other choice."
ears_type: "event-driven"
rationale: "The notation is decided once, when the model is born, and governance is on unless the user opts out. Evidence: apps/studio/src/renderer/src/components/ModelSteps.tsx (NewModelStep); apps/e2e/tests/studio/boot.spec.ts; manual#getting-started"
trigger: "the user creates a new model from the welcome screen or the Models dialog"
---
