---
id: "9ad90e0a-0428-4978-84fc-6b618d11524d"
type: "fitness-fn"
label: "Fitness function classification tests"
cadence: "triggered"
characteristic: "maintainability"
invocation: "automated"
metrics: |
  test(packages/common/tests/fitnessClassification.test.ts › fitness function classification › gives a fitness function the dimensions of Building Evolutionary Architectures) passed
  test(packages/common/tests/fitnessClassification.test.ts › fitness function classification › classifies a fitness function saved with a category, and leaves empty what the category cannot tell) passed
  test(packages/common/tests/fitnessClassification.test.ts › fitness function classification › reports a fitness function that lacks a dimension, naming the ones it lacks) passed
  test(packages/common/tests/fitnessClassification.test.ts › fitness function classification › reports a measure line that names no sensor) passed
scope: "atomic"
trigger: "pull-request"
---

packages/common/tests/fitnessClassification.test.ts checks the metamodel's classification of fitness functions, the classification on read of a model saved with a category, and the rules fitness-fn-unclassified and fitness-fn-measure-invalid.
