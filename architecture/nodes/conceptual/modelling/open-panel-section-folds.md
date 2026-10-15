---
id: "5af5eb12-a22c-45fa-bc72-2e71819d269f"
type: "requirement"
label: "Open panel section folds"
action: "Studio shall fold that section when it is open, and otherwise open it and fold the other section of that panel."
ears_type: "event-driven"
rationale: "Before, an open section folded only when another one was opened, so a panel could not show its sections all closed. Evidence: packages/ui/src/components/RightPanel.tsx (openSection in LeftPanel and RightPanel), apps/e2e/tests/studio/editing.spec.ts"
trigger: "the user clicks the header of a section in the left panel (Views, Milestones) or the right panel (Nodes, Relations, Sequences)"
---
