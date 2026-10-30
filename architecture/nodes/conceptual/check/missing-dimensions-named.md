---
id: "a04bd8cb-389b-4574-8038-184b2c41afbc"
type: "scenario"
label: "Missing dimensions named"
given: "a fitness function with a characteristic and a scope but no cadence or invocation"
metrics: "test(packages/common/tests/fitnessClassification.test.ts › fitness function classification › reports a fitness function that lacks a dimension, naming the ones it lacks) passed"
then: "fitness-fn-unclassified names cadence and invocation for it, and a fully classified one gets none"
when: "radical check runs"
---
