---
id: "7032c204-b530-48b3-a25b-08bd11a6a857"
type: "scenario"
label: "Tests and threshold migrated"
given: "a folder whose scenario names two tests and whose fitness function has a test and a threshold"
metrics: "test(packages/common/tests/metricsMigration.test.ts) passed"
then: "the scenario's metrics holds two test() lines, the fitness function's metrics its test() line and its description ends with the threshold, and no tests or threshold property is left"
when: "it is read and saved"
---
