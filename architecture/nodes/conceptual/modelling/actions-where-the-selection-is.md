---
id: "be6069e4-f9bf-40c9-8e29-0ed61c2414e8"
type: "requirement"
label: "Actions where the selection is"
action: "Studio shall offer what is done to one selected element or relation as an Actions section at the foot of its properties card, as a row with its icon and name each, a menu opening in the card under its row, and what is done to several selected elements on a flat bar over the top of the canvas, in the style of the canvas controls and without a shadow, saying how many and ending with Delete; Viewer shall show neither."
ears_type: "state-driven"
precondition: "Designer shows a view and elements are selected"
rationale: "A floating pill at the bottom of the canvas, with its own shadow and labels broken over two or three lines, sat over the canvas controls and repeated the card's actions in a second place (2026-10-22). One element has its card; several have no card, so they have the bar. Evidence: packages/ui/src/components/SelectionActions.tsx (SelectionActionBar, NodeActions, RelationActions, ActionMenu), packages/ui/src/components/RightPanel.tsx, packages/ui/src/index.css (.sel-bar, .pp-action), apps/studio/src/renderer/src/App.tsx; manual#selection"
---
