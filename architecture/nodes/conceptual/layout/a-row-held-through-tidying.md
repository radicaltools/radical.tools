---
id: "65e572c1-c846-4274-8a9a-146d07e73a40"
type: "scenario"
label: "A row held through tidying"
given: "a view with a row the author set; and views with a row, a column or a grid set"
metrics: |
  test(packages/layout/tests/tidy/craft.test.ts › Tidy, the finer points › a row the author set holds through tidying, and a second run keeps the layout) passed
  test(packages/layout/tests/tidy/tidy.test.ts › Tidy › leaves nothing for a second or third run with a row, a column or a grid set on the view (F-0108)) passed
then: "the row holds through every move, and the second run keeps the layout, with nothing left to tidy; with a row, a column or a grid set, neither a second nor a third run finds anything"
when: "Smart Layout tidies it, and tidies it again"
---
