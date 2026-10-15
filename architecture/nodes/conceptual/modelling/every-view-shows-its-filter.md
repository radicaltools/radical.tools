---
id: "cd07ab8a-2e59-4d07-9468-cc5ff6b26359"
type: "scenario"
label: "Every view shows its filter"
given: "the sample model's Requirements Traceability view, 23 elements; and a model of domains, needs, requirements and scenarios"
tests: |
  apps/e2e/tests/studio/view-pipeline.spec.ts › a canvas view draws what its chain gives, and the relations it follows unless asked for all
  apps/e2e/tests/studio/view-pipeline.spec.ts › every kind of view follows its chain, again when the chain or the model changes
  packages/common/tests/viewPipeline.test.ts › view pipeline: every view kind follows the chain › every kind shows the chain's elements, not the containers they sit in
  packages/common/tests/viewPipeline.test.ts › view pipeline: every view kind follows the chain › follows a change to the model: a requirement refined from a need joins the chain
  packages/common/tests/viewPipeline.test.ts › view pipeline: every view kind follows the chain › answers queries on a view with what its chain gives
  packages/layout/tests/drawnLines.test.ts › the lines a layout sees › holds shown elements in the containers they sit in, as frames no line ends at
  apps/studio/tests/inspector.test.ts › going to an element › lists what each view shows — not the containers it holds them in — and all for an unfiltered view
then: "the canvas draws 10 elements and the 7 derives lines, requirements alone no line until every relation is asked for, and the 23 elements after Reset; the matrix rows follow each change to the chain and to the model; the hierarchy, table and wiki show the same chain, and the hierarchy more without it; every kind shows the chain's elements and not the containers they sit in, which a canvas holds invisible with no line ending at them"
when: "the user starts its filter with Need and adds Refined into → Requirement; starts with Requirement alone and asks for every relation; resets; then, with a text filter on the requirements, switches the view to Matrix, adds Verified by → Scenario, renames a requirement out of the filter, and switches to Hierarchy, Table and Wiki"
---
