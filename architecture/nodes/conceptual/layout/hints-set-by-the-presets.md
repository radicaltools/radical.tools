---
id: "4b12db2a-a1c9-46c3-a602-9d72b7489877"
type: "scenario"
label: "Hints set by the presets"
given: "the built-in Radical and C4 metamodels"
metrics: |
  test(packages/common/tests/layoutHints.test.ts › layout hints › the presets set them for the built-in types) passed
  test(packages/common/tests/layoutHints.test.ts › layout hints › a role by a property value: an initial pseudostate is a start, a final state an end) passed
then: "a person is an actor on top, a database a store on the right, a queue a broker, an ADR a note on the left, a mockup a screen; derives reads reverse along the vertical axis, navigates-to forward along the horizontal, constrains to the side, interacts forward and free"
when: "their layout hints are read"
---
