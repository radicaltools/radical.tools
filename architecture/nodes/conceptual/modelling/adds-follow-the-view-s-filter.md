---
id: "f79a4b49-5a6c-4c19-97ba-bd61c920eed8"
type: "scenario"
label: "Adds follow the view's filter"
given: "the sample's Requirements Register and Processes with filter chains, and Platform Hierarchy drilled into Banking Services"
tests: |
  apps/e2e/tests/studio/view-pipeline.spec.ts › a requirement written in a wiki gets what its level's filter asks, and one the filter leaves out is announced
  apps/e2e/tests/studio/view-pipeline.spec.ts › a step added in a Warnier view its filter leaves it out of keeps its name open, and is announced when it stays out
  apps/e2e/tests/studio/view-pipeline.spec.ts › a matrix with a chain adds only a relation its cell shows, and never a copy
  apps/e2e/tests/studio/view-pipeline.spec.ts › a hierarchy drilled into an element its filter then leaves out shows the top, with no way up
  apps/e2e/tests/studio/view-pipeline.spec.ts › a hierarchy with a chain draws only what the chain gives
  apps/e2e/tests/studio/view-pipeline.spec.ts › a canvas whose filter is a chain
  packages/ui/tests/connectNodes.test.ts › a relation drawn on a canvas whose filter is a chain
  packages/common/tests/aiDocumentTools.test.ts › a within filter on an element that is deleted
then: "the requirement gets what its level's filter asks; the step keeps its name open and is announced when it stays out; the cell gets one relation it shows, never a copy; the hierarchy shows its top with no way up, and with a chain draws only what the chain gives; on a canvas whose filter is a chain an Alt-drag draws a relation of the type the chain follows or adds none, saying why, and an element dropped from the palette that the chain leaves out is announced; a within filter on a deleted element leaves the view, so a viewpoint made from it is not refused"
when: "a requirement is written in the register as a wiki, a step added in a filtered Warnier view, an empty cell of the register as a matrix clicked twice, and the hierarchy's filter started with Software System"
---
