---
id: "40ed544b-79fe-44b5-9e24-3ce7c1af05c8"
type: "scenario"
label: "Labels sized as drawn"
given: "the sample's views, and a relation 'Identity & AML screening' [REST / JSON]"
tests: |
  packages/layout/tests/edgeLabels.test.ts › relationLabelSize › sizes a label as the canvas draws it: one row while the name fits, the full width once it wraps
  apps/e2e/tests/studio/edge-labels.spec.ts › every relation label of the sample is drawn the size the layouts give it room for
then: "each label's drawn box is within a few pixels of the size the layouts give it room for; a name that fits stays on one row, and a label with a wrapped line takes the full width"
when: "the canvas draws every relation label and the layouts size them"
---
