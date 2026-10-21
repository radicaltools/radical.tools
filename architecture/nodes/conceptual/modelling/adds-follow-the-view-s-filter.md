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
then: "the requirement gets what its level's filter asks; the step keeps its name open and is announced when it stays out; the cell gets one relation it shows, never a copy; the hierarchy shows its top with no way up"
when: "a requirement is written in the register as a wiki, a step added in a filtered Warnier view, an empty cell of the register as a matrix clicked twice, and the hierarchy's filter started with Software System"
---
