---
id: "8376d082-b4d3-4adc-b4ee-35d888d30505"
type: "scenario"
label: "Goal below its minimum"
given: "a model where two of three scenarios name a test, and a check.json with a goal of 67 % for scenarios that name a test"
metrics: "test(packages/common/tests/checkGoals.test.ts › radical check goals) passed"
then: "the metric shows 66 %, below its goal, one goal-unmet error says so with the counts and the check fails; with goal-unmet/scenarios-with-metrics set to warning it passes"
when: "radical check runs"
---
