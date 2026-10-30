---
id: "488145bd-3bea-435d-87b1-be72425cee08"
type: "scenario"
label: "Unplaced elements placed fast"
given: "a model of over 20,000 elements, 250 systems of containers of components, some of whose components have no place on the canvas yet"
metrics: "test(packages/layout/tests/placeUnplacedLarge.test.ts › placing what has no place yet in a model of 20,000 elements › places them within 300 ms) passed"
then: "each of them gets a place, and the fastest of the three takes under 300 ms"
when: "they are placed, three times"
---
