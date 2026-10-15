---
id: "10e933f8-41da-413b-a0bc-a0e5295886db"
type: "requirement"
label: "Table shows the view's tree"
action: "The table view shall show what the view's filter gives as a tree — the chain's levels or, without a chain, the elements' containment — one row per element with its name, a guide line per level, its type beside the name and the rows under it folding away, and its summary: one line its type's summary template makes of the data it has, the whole of it in the tooltip; at the end of the row under the pointer a button that opens the element's properties in the right panel (unfolding it) and, for a type with a wizard, one that opens its wizard, its place kept for a type without one."
ears_type: "ubiquitous"
rationale: "The filter in the view's properties decides what the table lists and how; the table shows it with the one line about each element that matters for its type, which the metamodel defines per type from fields the element already has. Its fields are edited in the properties panel or its wizard, one click from its row. Its former tabs per type, columns per property and Relations tab are gone. Evidence: packages/ui/src/components/TableView.tsx (structureRows, renderName, renderSummary, openProperties), packages/common/src/nodeSummary.ts, packages/common/tests/nodeSummary.test.ts, apps/e2e/tests/studio/views.spec.ts, apps/e2e/tests/studio/view-pipeline.spec.ts; manual#view-table"
---
