---
id: "9e3dc112-554f-48cc-80b3-3aae0cbda37b"
type: "scenario"
label: "Remove a repeated step"
given: "the Place Order sequence is being edited"
tests: "apps/e2e/tests/studio/editing.spec.ts › removing one of two steps of the same relation leaves the list as the sequence is"
then: "the relation is appended as a fifth step, and after the removal the list shows the four remaining steps in the stored sequence's order, keeping the relation's appended step"
when: "the user clicks a relation that is already one of its steps, then removes the second step of the list"
---
