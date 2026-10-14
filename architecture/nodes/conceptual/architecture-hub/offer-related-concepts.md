---
id: "7f30b049-1848-43af-a5de-07846bcaa9ef"
type: "requirement"
label: "Offer related concepts"
action: "Studio shall ask which of the referred concepts to import as well, all of them selected at first, and import the chosen ones beside the concept in the same undo step."
ears_type: "event-driven"
rationale: "An ADR is rarely useful without the fitness function that checks it. Evidence: apps/studio/src/renderer/src/components/HubImportModal.tsx (relatedPickerConcept, resolvableRefs, Also import related hub concepts?)."
trigger: "the user adds a Hub concept other than a blueprint that refers to other Hub concepts"
---
