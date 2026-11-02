---
id: "bb8b7ee1-a961-48ea-85fa-c5787153f67c"
type: "scenario"
label: "Overview lists what needs attention"
given: "a model folder with a failed test, a requirement without a scenario and an accepted ADR without a fitness function"
metrics: "test(apps/e2e/tests/studio/inspector.spec.ts › the Inspector opens on Overview with what needs attention, and each finding leads to its element or fixes it) passed"
then: "it opens on Overview with the scores and Needs attention listing the error group before the warning groups, each with its count; a group opens to its elements, Open shows the element, Add scenario starts a scenario that verifies the requirement, and This branch narrows the list"
when: "the Inspector opens"
---
