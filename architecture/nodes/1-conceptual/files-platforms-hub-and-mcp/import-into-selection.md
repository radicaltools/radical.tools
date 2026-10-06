---
id: "064b235a-2699-4983-a44b-288d53fdbd08"
type: "requirement"
label: "Import into selection"
action: "Studio shall import the concept's root elements as children of the selected element."
ears_type: "state-driven"
precondition: "an element is selected whose type may contain every root element of the concept"
rationale: "Patterns can be dropped straight into the system or container they refine. Evidence: apps/studio/src/renderer/src/components/HubImportModal.tsx:436-465,529-546,879-900; manual#hub"
---
