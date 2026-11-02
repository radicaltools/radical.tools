---
id: "d7236a54-3f9b-46d0-b66e-14fbcd069b31"
type: "scenario"
label: "Branch changes in Studio"
given: "a folder model with a .state/base.json in which one element has another description, one element is missing and one is extra"
then: "the canvas marks the new, changed and removed elements and the button counts them with the changed relation (4, its tooltip saying 3 elements and 1 relation), the list of views counts the changes each view shows (a removed element too, on a view with a chain), a removed element's ghost lies inside its container clear of its siblings, the card marks the changed description with its removed and added words, the rename counts at once as a change, a box ticked and unticked counts as none, a base saved since HEAD is named so, a branch that only adds a relation counts 1 relation, and turning it off removes every mark"
when: "the user turns on Changes on branch, selects the changed element, renames another and turns it off"
---
