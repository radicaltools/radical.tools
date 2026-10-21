---
id: "f3fab6d2-26b4-4b51-bc2d-8b8880c67fc9"
type: "scenario"
label: "View edits in a milestone"
given: "a model with a milestone shown in Designer on a view"
tests: |
  packages/ui/tests/milestoneViewEdits.test.ts › A view edited while a milestone is shown
  packages/ui/tests/milestoneViewEdits.test.ts › Move to… in a milestone
then: "each edit asks how to keep the milestone's edits and is not saved into the live view or the live All elements; Discard takes every one of them back and Save as new leaves the live views as they were, while Unpin all in the milestone leaves the live pins and Multi page's step stays with the live model; Propagate makes what was done on the view the live view's"
when: "the user collapses a container, hides an element from the view, aligns elements, presses Unpin all, edits the filter, switches Multi page and moves an element with Move to…, then chooses Discard, Save as new or Propagate"
---
