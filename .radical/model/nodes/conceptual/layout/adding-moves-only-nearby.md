---
id: "eb72fe5a-c6c0-4a06-9f79-4cda0b39efbb"
type: "scenario"
label: "Adding moves only nearby"
given: "a laid-out 15 by 15 grid of linked elements"
metrics: "test(apps/e2e/tests/studio/physics.spec.ts › adding an element to a large diagram moves only its surroundings) passed"
then: "at most the 40 elements around it move and the rest stay where they were"
when: "the user adds a Software System from the palette"
---
