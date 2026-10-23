---
id: "e6c9690d-8764-4a95-8273-71f5d66c1224"
type: "scenario"
label: "A container not linked to its system"
given: "the bookstore, whose API sits in the Bookstore system, and a state machine whose state holds another"
tests: |
  packages/common/tests/relationEndpoints.test.ts › a relation to what holds it › is refused either way round and when an end moves there, but a transition to an enclosing state is not
  apps/e2e/tests/studio/editing.spec.ts › a container is not connected to the system that holds it, only marked as where it is
then: "the Bookstore is marked only \"holds\" while the Web App and the Orders DB are marked with a relation, and the drop adds no relation and says that the Bookstore holds the API; the engine refuses the relation either way round and when an end is moved there, and allows the transition"
when: "the user selects the API on the Containers view and holds the connection key, then draws a line from the API onto the Bookstore; and the engine is asked to add a relation between an element and one that holds it, and a transition from a nested state to the state holding it"
---
