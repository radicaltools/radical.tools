---
id: "317eb49a-15e6-4c37-81e8-090f2eca12bc"
type: "scenario"
label: "A box drawn from inside a frame"
given: "a frame holding elements, in Viewer or in Presenter"
metrics: |
  test(apps/e2e/tests/studio/selection-focus.spec.ts › a box drawn with the special key from the empty inside of a frame selects what it holds in viewer) passed
  test(apps/e2e/tests/studio/selection-focus.spec.ts › a box drawn with the special key from the empty inside of a frame selects what it holds in presenter) passed
then: "what the box covers is selected, not the frame"
when: "the user draws a box with the special key from the empty inside of the frame over what it holds"
---
