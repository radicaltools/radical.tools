---
id: "40825b56-0822-4490-8dc8-1645836c5f30"
type: "requirement"
label: "Treemap goes up a level"
action: "The hierarchy view shall move the focus to the parent of the current subtree."
ears_type: "event-driven"
rationale: "Drilling in is only useful when getting back out is just as easy. Evidence: apps/studio/src/renderer/src/components/TreemapView.tsx:434-456, 525-533; manual#view-hierarchy"
trigger: "the user presses Esc or Backspace, or clicks Up, while a Hierarchy view is focused on a subtree"
---
