---
id: "73fe7c6b-d35a-44ab-b51a-d488cec01297"
type: "scenario"
label: "Labels follow zoom"
given: "the sample model's canvas is shown far zoomed out"
tests: "apps/e2e/tests/studio/edge-labels.spec.ts › relation labels follow the zoom"
then: "no relation label shows at first, the labels of the selected element's relations appear, and once zoomed in more labels show, with their technology"
when: "the user selects an element and then zooms in"
---
