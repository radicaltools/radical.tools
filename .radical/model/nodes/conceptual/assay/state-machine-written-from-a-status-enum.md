---
id: "9043ec64-996f-4593-b8d4-e25392bac67c"
type: "scenario"
label: "State machine written from a status enum"
given: "an Assay run with an order entity written and a state fact of the order's statuses"
then: "the machine is written inferred with an initial pseudostate, its states, transitions and events, lifecycle of the order and implemented by the container; a state the fact does not hold is refused"
when: "the agent applies a plan with the order's state machine, its states from the fact and transitions citing the code that sets them"
---
