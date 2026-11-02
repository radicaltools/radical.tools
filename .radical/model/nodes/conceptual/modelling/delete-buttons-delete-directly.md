---
id: "1d6a55e0-7581-4c54-8844-941931ea0a97"
type: "requirement"
label: "Delete buttons delete directly"
action: "Studio shall remove the selected nodes from the model without a confirmation."
ears_type: "event-driven"
rationale: "An explicit click on a labelled destructive button is clear intent, and undo is available. Evidence: packages/ui/src/components/SelectionActions.tsx (SelectionActionBar), packages/ui/src/components/RightPanel.tsx (DeleteSection); manual#selection"
trigger: "the user clicks Delete on the selection bar, or Delete element at the foot of an element's card"
---
