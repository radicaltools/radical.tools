---
id: "61e01e62-128e-4d2c-babd-23af06fe7d54"
type: "scenario"
label: "Propagate to later milestones"
gherkin: "# Covered by: packages/ui/tests/milestones.test.ts › commitMilestoneChanges mode=propagate propagates sequence additions to later milestones"
given: "milestone v1 is shown with an added sequence and v2 comes after it"
then: "v1, v2 and the live model all contain the added sequence"
when: "the user chooses Propagate"
---
