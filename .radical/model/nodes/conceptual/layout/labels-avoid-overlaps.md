---
id: "ad0984ed-13d3-4afe-9020-d685aa9c3c04"
type: "scenario"
label: "Labels avoid overlaps"
given: "relations whose labels would meet: parallel, crossing, beside an element, or in a dense random scene"
metrics: "test(packages/layout/tests/edgeLabels.test.ts › placeEdgeLabels) passed"
then: "a label stays at the middle of its path when that is free, parallel and crossing labels are separated, a label moves off an element and covers its body rather than its name, and the placement is the same every time with fewer overlaps"
when: "the canvas places the labels together"
---
