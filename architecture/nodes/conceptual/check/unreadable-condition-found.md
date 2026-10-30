---
id: "370dcbe8-0153-4418-9055-406af1a0d967"
type: "scenario"
label: "Unreadable condition found"
given: "a fitness function with a line that is no condition and one whose unit is ms against a measurement in %"
metrics: "test(packages/common/tests/checkMetrics.test.ts › invalid conditions) passed"
then: "both lines are reported with what is wrong and the fitness function is not passed"
when: "radical check runs"
---
