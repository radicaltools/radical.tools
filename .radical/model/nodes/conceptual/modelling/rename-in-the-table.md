---
id: "ab0ed27c-7b4a-48f4-8471-1c1543622bfa"
type: "requirement"
label: "Rename in the table"
action: "The table view shall edit the element's name in place and write it to the model on Enter, Tab or leaving the cell, changing nothing when it is left as it was or emptied."
ears_type: "event-driven"
rationale: "Names are what a reader scans a table for; the other fields are edited in the properties panel. Evidence: packages/ui/src/components/TableView.tsx (commitEdit, renderCell); apps/e2e/tests/studio/views.spec.ts; manual#view-table"
trigger: "the user clicks a name in the table in the Designer perspective"
---
