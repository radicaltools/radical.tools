---
id: "92cae04e-99a6-49a5-b154-503c9e88daa1"
type: "scenario"
label: "Category becomes the classification"
given: "a model saved with fitness functions of each category, one checked by tests alone and one by a metric, and its fitness-function type with category"
metrics: |
  test(packages/common/tests/fitnessClassification.test.ts › fitness function classification › classifies a fitness function saved with a category, and leaves empty what the category cannot tell) passed
  test(packages/common/tests/fitnessClassification.test.ts › fitness function classification › brings a saved fitness-function type from its category to the classification) passed
then: "the holistic one has scope holistic, the structural one the characteristic maintainability, the one with tests alone is triggered on pull-request and automated, the one with a metric has no cadence, none has a category, and the type has the classification in its properties and wizard"
when: "the model is read"
---
