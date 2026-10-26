---
id: "5e277067-8bbc-4d37-9ac5-2bd03f92143a"
type: "scenario"
label: "A long tidy stopped by its budget"
given: "a view whose tidying would take more work than the budget"
tests: |
  packages/layout/tests/tidy/craft.test.ts › Tidy, the finer points › a budget stops the tidying with what was done
  packages/layout/tests/tidy/craft.test.ts › Tidy, the finer points › a budget is counted in work: the same layout on a slow machine as on a fast one (F-0080)
then: "it stops when the budget runs out and hands over the moves made so far, each reported as it was made; the budget is counted in work, so a slow machine gets the same layout as a fast one"
when: "Smart Layout tidies it with a budget"
---
