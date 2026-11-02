---
id: "cda4f62e-a4d8-4b95-8f60-7d3a82a78b69"
type: "scenario"
label: "Labels get room"
given: "a labelled relation whose label would lie over a third element; and the sample's System Context, whose labels lie over no element"
metrics: |
  test(packages/layout/tests/tidy/craft.test.ts › a label is not drawn over an element) passed
  test(packages/layout/tests/tidy/tidy.test.ts › Tidy › leaves room for the labels as the canvas places them) passed
then: "the label lies over no element; on System Context, with curved and with orthogonal lines, the labels as the canvas places them still lie over no element"
when: "Smart Layout tidies it"
---
