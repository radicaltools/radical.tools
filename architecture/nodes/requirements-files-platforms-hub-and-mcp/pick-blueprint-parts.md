---
id: "af07d058-b14d-4333-a89a-07de1732d1cb"
type: "requirement"
label: "Pick blueprint parts"
action: "Studio shall let the user choose which of the blueprint's elements and which referenced concepts to import, with all of them selected at first."
ears_type: "event-driven"
rationale: "A blueprint is a skeleton; users take only what fits. Evidence: apps/studio/src/renderer/src/components/HubImportModal.tsx:392-396,705-740,965-1085; manual#hub"
trigger: "the user adds a blueprint from the Hub"
---
