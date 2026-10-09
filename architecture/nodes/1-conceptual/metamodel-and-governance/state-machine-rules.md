---
id: "addb3dc1-46c0-44ba-bdbd-f0c5f4ab3a30"
type: "requirement"
label: "State machine rules"
action: "The system shall warn about a machine or compound state without exactly one initial pseudostate, a parallel state with fewer than two regions, a final state with children or outgoing transitions, a transition that leaves its machine or names an event no event node declares, unguarded transitions competing for one event, and states the initial state cannot reach."
ears_type: "state-driven"
precondition: "the model holds a state machine"
rationale: "allowedParents and allowedPairs cannot express how a statechart is entered or whether it can run. Evidence: packages/common/src/metamodel/statechart.ts; packages/common/src/metamodel/validate.ts; packages/common/tests/stateMachine.test.ts"
---
