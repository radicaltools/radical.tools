---
id: "ac5bb77f-2ae1-4f06-aab3-3fa619ef9efc"
type: "scenario"
label: "Nothing placed in a final state"
given: "the Order state machine with the final state Cancelled"
metrics: "test(packages/common/tests/stateMachine.test.ts › a final state holds nothing) passed"
then: "each is refused with \"a final state cannot contain other states\", the table offers no + under Cancelled, and the model stays as it was"
when: "a state is added under Cancelled, moved into it or placed in it, a table row is offered under it, and a state holding states is made final"
---
