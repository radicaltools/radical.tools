---
id: "f3fab6d2-26b4-4b51-bc2d-8b8880c67fc9"
type: "scenario"
label: "View edits in a milestone"
given: "a model with a milestone shown in Designer on a view"
then: "each edit asks how to keep the milestone's edits and is not saved into the live view or the live All elements; Discard takes every one of them back (a detached viewpoint comes back) and Save as new leaves the live views as they were, while Unpin all in the milestone leaves the live pins and Multi page's step stays with the live model; the new milestone keeps the view edits with the view's name, folder and layout as the live model has them, shows them when reopened, after a reload and after an outside change, and Propagate from it carries only what was edited in it; Propagate makes what was done on the view the live view's; an edit not yet saved stays done when a change made outside Studio is read, and Propagate then takes it to the live view; the new milestone shows what was done on the live view since, where the milestone did not change it"
when: "the user collapses a container, hides an element from the view, aligns elements, presses Unpin all, edits the filter, switches Multi page, moves an element with Move to…, and sets the view's viewpoint (or detaches it), Auto-layout, Sequence, view type, Size and Levels, then chooses Discard, Save as new or Propagate, and reopens the new milestone"
---
