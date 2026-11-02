---
id: "8c78ab6a-de7c-4c03-9d7a-cbe7b87d61cc"
type: "scenario"
label: "Removed element leaves references"
given: "a transition triggered by an event and raising two others, and a requirement whose precondition is a state"
then: "the transition has no trigger, raises only the event left, the requirement has no precondition state, and Validation reports no reference to nothing; the later milestones and the live model lose the reference after Propagate, Unwrap cleans up references, sequence steps and views as a delete does, and the merge lets go of the deleted event"
when: "the event, one raised event or the state is removed from the model; deleted in a milestone and propagated to the later ones; unwrapped; or deleted on one side of a merge while the other side made a transition name it"
---
