---
id: "61e01e62-128e-4d2c-babd-23af06fe7d54"
type: "scenario"
label: "Propagate to later milestones"
gherkin: ""
given: "milestone v1 is shown with an added sequence and v2 comes after it"
tests: |
  packages/ui/tests/milestones.test.ts › commitMilestoneChanges mode=propagate propagates sequence additions to later milestones
  packages/ui/tests/milestonePropagate.test.ts › Propagate a change of a sequence › carries forward only the steps and notes the milestone changed
then: "v1, v2 and the live model all contain the added sequence; a note changed in v1 reaches the later models and the live one, each keeping the steps it added"
when: "the user chooses Propagate"
---
