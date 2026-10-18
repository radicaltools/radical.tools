---
id: "85e4de78-2072-479b-9a1c-8bb2f379852e"
type: "scenario"
label: "Any hierarchy as a Warnier tree"
given: "the Checkout process, a state machine with a compound and a parallel state, and a view with a chain of two levels"
tests: "packages/common/tests/warnier.test.ts › warnierTree"
then: "the steps stand in their order with their repetition, the choice's children are alternatives with (0,1) under each and the concurrent ones concurrent; the compound state's children are alternatives, each (0,1), and the parallel state's regions concurrent; the chain's levels nest as the chain says, and a one-level chain nests its elements by containment"
when: "each is made a Warnier tree"
---
