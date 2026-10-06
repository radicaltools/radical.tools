---
id: "ef232b1c-c18e-4126-a683-a3073f2653e6"
type: "requirement"
label: "Preset chosen at creation"
action: "The system shall let the user pick the metamodel preset, with C4 + DDD + Governance selected by default."
ears_type: "event-driven"
rationale: "The notation is decided once, when the model is born, and governance is on unless the user opts out. Evidence: apps/studio/src/renderer/src/components/WelcomeScreen.tsx:87-100; apps/studio/src/renderer/src/components/DocumentManager.tsx:46-47,92-99; manual#metamodel"
trigger: "the user creates a new model from the welcome screen or the document manager"
---
