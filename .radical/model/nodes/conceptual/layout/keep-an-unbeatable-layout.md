---
id: "35d8f341-ebd5-45e9-bb39-53334de4940a"
type: "scenario"
label: "Keep an unbeatable layout"
given: "a view was just laid out by Smart Layout; another layout scored against it loses about as much as it gains"
metrics: |
  test(packages/layout/tests/smartLayout.test.ts › keeps the current layout when running again cannot beat it) passed
  test(packages/layout/tests/ranking.test.ts › aggregated quality › keeps the layout on screen unless another is clearly better) passed
  test(packages/layout/tests/ranking.test.ts › aggregated quality › keeps the layout on screen against one that loses about as much as it gains) passed
then: "nothing moves and Studio reports that the current layout already scores best; the layout on screen is kept against one that is not clearly better"
when: "the user runs Smart Layout again"
---
