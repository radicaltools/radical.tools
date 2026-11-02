---
id: "8c78ab6a-de7c-4c03-9d7a-cbe7b87d61cc"
type: "scenario"
label: "Removed element leaves references"
given: "a transition triggered by an event and raising two others, and a requirement whose precondition is a state"
metrics: |
  test(packages/common/tests/deleteReferences.test.ts › deleting an element a reference names › takes the trigger event out of the transitions it triggered) passed
  test(packages/common/tests/deleteReferences.test.ts › deleting an element a reference names › keeps the other events a transition raises) passed
  test(packages/common/tests/deleteReferences.test.ts › deleting an element a reference names › takes a deleted state out of a requirement's precondition) passed
  test(packages/ui/tests/milestonePropagate.test.ts › Propagate a delete of an element a later reference names (F-0054) › takes it out of the references of the later milestones and the live model) passed
  test(packages/ui/tests/deleteCleanUp.test.ts › Unwrap (remove an element, keep what it holds) › cleans up after the element as a delete does: references, sequence steps and views) passed
  test(packages/common/tests/modelMerge.test.ts › mergeModels › lets go of an element one side deleted in what the other side made to name it (a transition's event), as a delete does) passed
then: "the transition has no trigger, raises only the event left, the requirement has no precondition state, and Validation reports no reference to nothing; the later milestones and the live model lose the reference after Propagate, Unwrap cleans up references, sequence steps and views as a delete does, and the merge lets go of the deleted event"
when: "the event, one raised event or the state is removed from the model; deleted in a milestone and propagated to the later ones; unwrapped; or deleted on one side of a merge while the other side made a transition name it"
---
