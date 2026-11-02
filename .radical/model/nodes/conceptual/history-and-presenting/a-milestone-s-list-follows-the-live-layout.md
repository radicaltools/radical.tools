---
id: "405d5e52-9528-498c-89d7-dbfdc2c047bc"
type: "scenario"
label: "A milestone's list follows the live layout"
given: "a milestone, and a later one, that keep their own element list of a view because they hold an element the live model deleted"
metrics: |
  test(packages/ui/tests/milestoneDeletedSince.test.ts › The view a milestone keeps its own list of has the live view's layout (F-0089, F-0091) › a fold and the line style set on the live view after the delete show in every milestone that holds it) passed
  test(packages/ui/tests/milestoneDeletedSince.test.ts › The view a milestone keeps its own list of has the live view's layout (F-0089, F-0091) › Propagate of a fold from the earlier milestone reaches the later one and the live view) passed
  test(packages/ui/tests/milestoneDeletedSince.test.ts › The view a milestone keeps its own list of has the live view's layout (F-0089, F-0091) › Propagate carries only the edit: the live view keeps what was added and folded on it, and does not list what it deleted) passed
then: "the fold and the line style show in every milestone that holds the view; the propagated fold reaches the later milestone and the live view; Propagate carries only the edit, so the live view keeps what was added and folded on it and does not list what it deleted"
when: "a fold and the line style are set on the live view; a fold made in the earlier milestone is propagated; and the live view gains and folds an element and deletes another before an edit in the milestone is propagated"
---
