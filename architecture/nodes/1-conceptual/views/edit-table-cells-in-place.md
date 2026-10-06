---
id: "ab0ed27c-7b4a-48f4-8471-1c1543622bfa"
type: "requirement"
label: "Edit table cells in place"
action: "The table view shall edit the value in place, offering a dropdown for enum fields, and write it to the model on commit."
ears_type: "event-driven"
rationale: "Bulk editing is the reason the table exists. Evidence: packages/ui/src/components/TableView.tsx:400-424, 479-545, 546-560; manual#view-table"
trigger: "the user clicks an editable cell in the Designer perspective"
---
