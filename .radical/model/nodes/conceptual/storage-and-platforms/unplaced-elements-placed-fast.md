---
id: "488145bd-3bea-435d-87b1-be72425cee08"
type: "scenario"
label: "Unplaced elements placed fast"
given: "a model of over 20,000 elements, 250 systems of containers of components, some of whose components have no place on the canvas yet"
metrics: "test(packages/layout/tests/placeUnplacedLarge.test.ts › placing what has no place yet in a model of 20,000 elements › places them without going through every element for each one placed) passed"
then: "each of them gets a place, with fewer than twenty walks over the elements (a walk per element placed and per step was 508)"
when: "they are placed, the walks over the model's elements counted"
---
