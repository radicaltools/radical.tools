---
id: "4cf7fd00-52c2-4db5-8400-117aff7f3d3c"
type: "scenario"
label: "Every element from the steps"
given: "the sample model's Requirements Traceability view, 23 elements"
metrics: |
  test(apps/e2e/tests/studio/view-pipeline.spec.ts › a view shows every element again from its steps, and a chain can start from every element) passed
  test(packages/common/tests/viewPipeline.test.ts › view pipeline: the chain › starts from every element when the first level names no type) passed
  test(packages/common/tests/viewPipeline.test.ts › view pipeline: the chain › suggests the first level's ways by type and the next ones along every relation and containment) passed
then: "the first level reads Every element with 23; afterwards the steps read Every element, the link is gone and the level counts 65; and the engine offers Every element first and Contains → Any element under the domains"
when: "the user starts its chain with Every element, then clicks Show every element"
---
