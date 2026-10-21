---
id: "614a7c57-75c9-4a79-a8d1-db74588b4aaa"
type: "requirement"
label: "Milestones share the views' layout"
action: "Studio shall show each view with the layout it has for the live model and every milestone, show All elements with the milestone's own positions, save none of the milestone's positions into the live views or the live All elements, and take what is done on a view (a move with Move to…, a collapse, Hide from view, an alignment, pins and Unpin all, its filter, Multi page) as an edit of the milestone: asked about as a drag is, kept out of the live views and the live All elements, taken back by Discard, left out of the live views by Save as new, and made the live views' by Propagate; and show the live layout of the canvas shown when the milestone is left, keeping or carrying on the milestone's edits with its All elements positions, whichever view is open."
ears_type: "state-driven"
precondition: "a milestone is shown in Designer"
rationale: "One layout per view puts an element in the same place in every milestone, so comparing two shows only what changed. Switching views while a milestone was shown saved the milestone's positions into the live view, and keeping its edits with a view open carried that view's layout into the live model as changes (2026-10-14). The maintainer decided on 2026-10-21 (D1, exploratory runs 45 to 64) that layout edits made while a milestone is shown are edits of the milestone, as the manual says: a collapse, Hide from view, an alignment or Move to… in a milestone had changed the live view for good. Evidence: packages/ui/src/store/diagramStore.ts (setActiveView, selectMilestone, discardMilestoneChanges, commitMilestoneChanges, _milestoneViewEdit, liveBackup.views, _saveShownCanvas, _showLiveCanvasPositions)"
---
