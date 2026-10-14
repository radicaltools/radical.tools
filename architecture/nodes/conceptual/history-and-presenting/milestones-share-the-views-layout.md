---
id: "614a7c57-75c9-4a79-a8d1-db74588b4aaa"
type: "requirement"
label: "Milestones share the views' layout"
action: "Studio shall show each view with the layout it has for the live model and every milestone, show All elements with the milestone's own positions, save none of the milestone's positions into the live views or the live All elements, show the live layout of the canvas shown when the milestone is left, and keep or carry on the milestone's edits with its All elements positions, whichever view is open."
ears_type: "state-driven"
precondition: "a milestone is shown in Designer"
rationale: "One layout per view puts an element in the same place in every milestone, so comparing two shows only what changed. Switching views while a milestone was shown saved the milestone's positions into the live view, and keeping its edits with a view open carried that view's layout into the live model as changes (2026-10-14). Evidence: packages/ui/src/store/diagramStore.ts (setActiveView, selectMilestone, discardMilestoneChanges, commitMilestoneChanges, _saveShownCanvas, _showLiveCanvasPositions)"
---
