---
id: "1d6a55e0-7581-4c54-8844-941931ea0a97"
type: "requirement"
label: "Selection bar deletes directly"
action: "Studio shall remove the selected nodes from the model without a confirmation."
ears_type: "event-driven"
rationale: "An explicit click on a labelled destructive button is clear intent, and undo is available. Evidence: apps/studio/src/renderer/src/components/SelectionActionBar.tsx:168-186,318-328; manual#selection"
trigger: "the user clicks Delete in the selection bar"
---
