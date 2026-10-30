---
id: "a9d52253-848c-402d-bbf1-5b11c1719f75"
type: "scenario"
label: "AI run placed sideways"
given: "a canvas with one element"
metrics: |
  test(apps/studio/tests/aiRunner.test.ts › places a run's new nodes beside the canvas in a block that grows sideways, and the next run beside that) passed
  test(packages/layout/tests/geometry.test.ts › createBatchPlacer) passed
then: "the first five fill two rows and three columns right of the element, and the second run starts right of them"
when: "the AI adds five elements, then five more in a second run"
---
