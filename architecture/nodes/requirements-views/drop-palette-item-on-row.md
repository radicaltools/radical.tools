---
id: "6f73e497-3d29-4afe-a530-4626bcc89967"
type: "requirement"
label: "Drop palette item on row"
action: "The table view shall create the new element inside that row's element, or inside the row's parent when only that is allowed, and otherwise show an error naming the allowed parents."
ears_type: "event-driven"
rationale: "Adding children from the table keeps bulk modelling in one place while respecting the metamodel. Evidence: packages/ui/src/components/TableView.tsx:312-381; manual#view-table"
trigger: "the user drops a palette item onto a table row"
---
