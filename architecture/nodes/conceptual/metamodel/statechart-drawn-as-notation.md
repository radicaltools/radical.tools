---
id: "c541d4a4-32e4-4481-b221-e6d4ac945338"
type: "scenario"
label: "Statechart drawn as notation"
given: "an order state machine, the lifecycle of the Order entity, with a transition that has an event, a guard, an action and a raised event"
tests: |
  apps/e2e/tests/studio/state-machines.spec.ts › a machine is named after the entity it is the lifecycle of
  apps/e2e/tests/studio/state-machines.spec.ts › a transition shows its events by name and picks them by reference
  packages/common/tests/stateMachine.test.ts › state machine types (governance preset) › labels a transition `event [guard] / actions ^raised` by the events' names
then: "the machine is headed State machine · Order and the transition reads PaymentReceived [ok] / reserve ^OrderPaid by the events' current names"
when: "it is shown on the canvas and the event is renamed"
---
