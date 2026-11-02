---
id: "9ad90e0a-0428-4978-84fc-6b618d11524d"
type: "fitness-fn"
label: "Fitness function classification tests"
cadence: "triggered"
characteristic: "maintainability"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

packages/common/tests/fitnessClassification.test.ts checks the metamodel's classification of fitness functions, the classification on read of a model saved with a category, and the rules fitness-fn-unclassified and fitness-fn-measure-invalid.
