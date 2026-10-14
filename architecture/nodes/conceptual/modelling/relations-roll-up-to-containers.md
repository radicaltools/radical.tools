---
id: "059b89e9-4fec-4503-9138-dce1eb5cb77e"
type: "requirement"
label: "Relations roll up to containers"
action: "Studio shall draw that element's relations to its nearest visible ancestor and merge relations between the same pair into one edge."
ears_type: "state-driven"
precondition: "an element is hidden inside a collapsed container or outside the view"
rationale: "Collapsed, high-level views must still show the real dependencies. Evidence: packages/ui/src/store/diagramStore.ts:690-775; apps/studio/src/renderer/src/components/MatrixView.tsx:115-135; manual#view-structure"
---
