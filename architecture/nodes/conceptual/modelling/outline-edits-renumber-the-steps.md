---
id: "92bc9c05-c416-44f7-aadd-0d6c53bca6a3"
type: "scenario"
label: "Outline edits renumber the steps"
given: "the Checkout tree and a tree of a two-level chain"
tests: "packages/common/tests/warnier.test.ts › outline edits"
then: "each plan names the new parent and numbers the siblings in their new order; a move past the end, an indent of the first sibling and an outdent of a root are no plans; the chain's tree is not editable"
when: "a step is planned after another and inside one, moved up and down, indented and outdented, and the first or last is moved past its end"
---
