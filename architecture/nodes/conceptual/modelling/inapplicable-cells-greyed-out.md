---
id: "2de823a4-34a0-4e20-93f8-bc8880706d28"
type: "requirement"
label: "Inapplicable cells greyed out"
action: "The table view shall show a dimmed dash in that cell instead of an editable value."
ears_type: "state-driven"
precondition: "a column only applies for certain values of another field on the row"
rationale: "Users should not fill fields that the selected EARS pattern or kind does not use. Evidence: packages/ui/src/components/TableView.tsx:54-56, 436-442; manual#view-table"
---
