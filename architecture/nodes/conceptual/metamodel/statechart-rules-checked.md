---
id: "717f11af-7542-4dbf-82e0-c893ddbead52"
type: "scenario"
label: "Statechart rules checked"
given: "models holding state machines"
tests: "packages/common/tests/stateMachine.test.ts › state machine rules"
then: "a well-formed machine passes; missing or extra initial pseudostates, a parallel state with one region, a final state that is left, unguarded conflicts, transitions leaving the machine, unreachable states and machines without exactly one entity are flagged"
when: "they are validated"
---
