---
id: "61e01e62-128e-4d2c-babd-23af06fe7d54"
type: "scenario"
label: "Propagate to later milestones"
given: "milestone v1 is shown with an added sequence and v2 comes after it"
metrics: |
  test(packages/ui/tests/milestones.test.ts › commitMilestoneChanges mode=propagate propagates sequence additions to later milestones) passed
  test(packages/ui/tests/milestonePropagate.test.ts › Propagate a change of a sequence › carries forward only the steps and notes the milestone changed) passed
  test(packages/ui/tests/milestonePropagate.test.ts › Propagate a move into a parent the later models lack › leaves the element where it is in a model without that parent) passed
  test(packages/ui/tests/milestonePresenting.test.ts › on a slide that shows the live model carries the milestone's edits, not the slide's model) passed
  test(packages/ui/tests/milestonePresenting.test.ts › does not start the presentation) passed
  test(apps/e2e/tests/studio/milestones.spec.ts › F5 does not start behind the milestone question, and Propagate after a slide played carries the milestone's edit) passed
then: "v1, v2 and the live model all contain the added sequence; a note changed in v1 reaches the later models and the live one, each keeping the steps it added; an element moved into a parent a later model lacks stays where it is in that model"
when: "the user chooses Propagate"
---
