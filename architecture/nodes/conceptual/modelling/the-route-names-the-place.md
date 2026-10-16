---
id: "79afbbbd-4127-4873-a0ef-48f653122580"
type: "scenario"
label: "The route names the place"
given: "a place in the Inspector's Changes tab with an element's card open, and one on a canvas with an element selected"
tests: "apps/studio/tests/route.test.ts › route parse/format › round-trips the Inspector tab and the selected element, in one form"
then: "it holds the tab and the element in a fixed place among the segments, reads back to the same place, and writes back to the same text"
when: "each route is written and read back"
---
