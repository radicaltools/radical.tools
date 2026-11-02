---
id: "405d5e52-9528-498c-89d7-dbfdc2c047bc"
type: "scenario"
label: "A milestone's list follows the live layout"
given: "a milestone, and a later one, that keep their own element list of a view because they hold an element the live model deleted"
then: "the fold and the line style show in every milestone that holds the view; the propagated fold reaches the later milestone and the live view; Propagate carries only the edit, so the live view keeps what was added and folded on it and does not list what it deleted"
when: "a fold and the line style are set on the live view; a fold made in the earlier milestone is propagated; and the live view gains and folds an element and deletes another before an edit in the milestone is propagated"
---
