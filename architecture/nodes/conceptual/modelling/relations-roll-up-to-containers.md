---
id: "059b89e9-4fec-4503-9138-dce1eb5cb77e"
type: "requirement"
label: "Relations roll up to containers"
action: "Studio shall draw that element's relations to its nearest visible ancestor and merge relations between the same pair into one edge, labelled with each relation's name on a line of its own and with a technology only when they all use it."
ears_type: "state-driven"
precondition: "an element is hidden inside a collapsed container or outside the view"
rationale: "Collapsed, high-level views must still show the real dependencies. A line to a folded container drew its relations' names as one run-on name (\"Admin API calls API calls API calls\") with the first relation's technology alone, as if it were one relation (round 185–192, 2026-10-26, F-0078). Evidence: packages/ui/src/store/diagramStore.ts (deriveRFEdges); packages/ui/src/store/diagramStore.ts:690-775; apps/studio/src/renderer/src/components/MatrixView.tsx:115-135; manual#view-structure"
---
