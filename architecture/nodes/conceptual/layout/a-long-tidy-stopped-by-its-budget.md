---
id: "5e277067-8bbc-4d37-9ac5-2bd03f92143a"
type: "scenario"
label: "A long tidy stopped by its budget"
given: "a view whose tidying would take longer than the time budget"
tests: "packages/layout/tests/tidy/craft.test.ts › Tidy, the finer points › a time budget stops the tidying with what was done"
then: "it stops when the budget runs out and hands over the moves made so far, each reported as it was made"
when: "Smart Layout tidies it with a budget"
---
