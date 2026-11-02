---
id: "92cc1d25-e7f4-434d-963e-7ece6b4c44d4"
type: "requirement"
label: "Remove element from view"
action: "Studio shall remove the elements and all their descendants from the view, without changing the model."
ears_type: "event-driven"
rationale: "Curating which elements a view shows is the core of tailoring views; a filter chain does it by rule, this by hand. The eye toggles of the former Nodes tree are gone with it. Evidence: packages/ui/src/store/diagramStore.ts (removeNodeFromView, deleteSelection), packages/ui/src/components/DeleteConfirmDialog.tsx, packages/ui/tests/views.test.ts; manual#views"
trigger: "the user deletes elements on the canvas of a named view and picks Remove from view"
---
