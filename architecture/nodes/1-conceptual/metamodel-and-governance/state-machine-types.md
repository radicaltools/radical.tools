---
id: "b71c965d-cada-4a74-bbeb-b39ca01d2f5e"
type: "requirement"
label: "State machine types"
action: "The C4 + DDD + Governance preset shall offer state machines whose states nest and may be parallel, with initial, history and choice pseudostates, events that states (on entry, exit or do), machines and C4 elements emit, and transitions that carry an event, a guard and actions."
ears_type: "ubiquitous"
rationale: "Behaviour of entities with a lifecycle (an order, a payment) had no notation, and the scenarios that describe it had nothing to point at. Evidence: packages/common/src/metamodel/presets/governance.ts (state-machine, state, pseudostate, event, transition, lifecycle-of, emits); packages/ui/src/components/nodes/C4Nodes.tsx (StateMachineNode, StateNode, PseudostateNode, EventNode); packages/common/tests/stateMachine.test.ts"
---
