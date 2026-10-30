---
id: "6495b5ee-1eef-4114-a5a5-8c21eda35e68"
type: "scenario"
label: "Old measurement is stale"
given: "a fitness function with max_age 7d and a matching measurement taken ten days ago"
metrics: "test(packages/common/tests/checkMetrics.test.ts › stale measurements) passed"
then: "the condition is stale, its age is shown, and the fitness function is not passed"
when: "radical check runs"
---
