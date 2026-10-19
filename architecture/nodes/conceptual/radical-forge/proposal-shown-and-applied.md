---
id: "6b7adfb3-3525-48b7-833b-980a731db1c6"
type: "scenario"
label: "Proposal shown and applied"
given: "a model with a need, a requirement and a scenario before a Processes stage"
tests: |
  packages/common/tests/forgeProposals.test.ts › describeProposal names every element, field and link it would write
  packages/common/tests/forgeProposals.test.ts › applyProposal applies every change or none
then: "describeProposal lists the requirement with its type, label and fields, the link with both labels, and the action's old and new values; applyProposal writes the first proposal whole and reports the new ids, and leaves the model as it was for the second, with the error"
when: "the stage proposes a new requirement under a tempId, a derives link from it to the need, a new action for the earlier requirement and a move, and then a proposal whose last change names an unknown node"
---
