---
id: "ccbc6834-edc8-44d5-b054-2279a553adee"
type: "scenario"
label: "A key-click after a box selection"
given: "elements selected by a box drawn with the special key, in Designer, Viewer and Presenter"
tests: |
  apps/e2e/tests/studio/selection-focus.spec.ts › after a box selection, a click with the special key on one of the selected takes it out in designer
  apps/e2e/tests/studio/selection-focus.spec.ts › after a box selection, a click with the special key on one of the selected takes it out in viewer
  apps/e2e/tests/studio/selection-focus.spec.ts › after a box selection, a click with the special key on one of the selected takes it out in presenter
then: "it leaves the selection; the others stay selected"
when: "the user clicks one of them with the key held"
---
