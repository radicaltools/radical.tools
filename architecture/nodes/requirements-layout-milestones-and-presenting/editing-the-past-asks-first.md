---
id: "15f629eb-401b-4be9-a8f0-f28bbd02509b"
type: "scenario"
label: "Editing the past asks first"
gherkin: "# Covered by: packages/ui/tests/milestones.test.ts › addSequence marks milestoneDirty and opens the prompt"
given: "a milestone is shown in the Designer perspective"
then: "the milestone is marked unsaved and the propagate / save as new / discard prompt opens"
when: "the user adds a sequence"
---
