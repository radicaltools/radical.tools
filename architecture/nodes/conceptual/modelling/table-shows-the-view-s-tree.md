---
id: "10e933f8-41da-413b-a0bc-a0e5295886db"
type: "requirement"
label: "Table shows the view's tree"
action: "The table view shall show what the view's filter gives as a tree — the chain's levels or, without a chain, the elements' containment — one row per element with its name, a guide line per level, its type beside the name and the rows under it folding away, and its summary on one line, the whole of it in the tooltip: a requirement's EARS sentence, a scenario's When → then, an ADR's status and the first sentence of its decision, a fitness function's description and threshold, a mockup's screen, a C4 element's technology and the first sentence of its description, and otherwise the first sentence of its description."
ears_type: "ubiquitous"
rationale: "The filter in the view's properties decides what the table lists and how; the table only shows it, with the one line about each element that matters for its type. Its former tabs per type, columns per property and Relations tab are gone: fields are edited in the properties panel, relations on the canvas or in the matrix. Evidence: packages/ui/src/components/TableView.tsx (structureRows, renderCell), packages/common/src/nodeSummary.ts, packages/common/tests/nodeSummary.test.ts, apps/e2e/tests/studio/views.spec.ts, apps/e2e/tests/studio/view-pipeline.spec.ts; manual#view-table"
---
