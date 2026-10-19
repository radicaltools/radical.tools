---
id: "0c64ecde-8012-47dc-8007-f777a69a064c"
type: "scenario"
label: "Long relation name is cut"
given: "a relation whose name takes many lines at the label's width, with a long technology"
tests: |
  packages/layout/tests/edgeLabels.test.ts › relationLabelLines › measures a long name as two lines and its technology as one
  apps/e2e/tests/studio/edge-labels.spec.ts › a long relation name is cut after two lines, and shown whole while the relation is selected
then: "the label is measured as two lines of the name and one of the technology, no wider than 160 px; the canvas draws the name cut after two lines and the technology after one, both with an ellipsis; selected, the label shows the whole name"
when: "its label is measured for layout and drawn on the canvas, then the relation is selected"
---
