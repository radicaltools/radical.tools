---
id: "8c78ab6a-de7c-4c03-9d7a-cbe7b87d61cc"
type: "scenario"
label: "Removed element leaves references"
given: "a transition triggered by an event and raising two others, and a requirement whose precondition is a state"
tests: |
  packages/common/tests/deleteReferences.test.ts › deleting an element a reference names › takes the trigger event out of the transitions it triggered
  packages/common/tests/deleteReferences.test.ts › deleting an element a reference names › keeps the other events a transition raises
  packages/common/tests/deleteReferences.test.ts › deleting an element a reference names › takes a deleted state out of a requirement's precondition
then: "the transition has no trigger, raises only the event left, the requirement has no precondition state, and Validation reports no reference to nothing"
when: "the event, one raised event or the state is removed from the model"
---
