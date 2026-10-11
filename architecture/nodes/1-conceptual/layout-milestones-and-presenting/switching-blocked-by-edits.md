---
id: "46c3982d-4178-4877-b608-3eb5adf48337"
type: "scenario"
label: "Switching blocked by edits"
gherkin: "# Covered by: packages/ui/tests/milestones.test.ts › selectMilestone blocks (milestonePromptOpen) when sequences are dirty"
given: "a milestone is shown and has unsaved sequence edits"
then: "the shown milestone stays active and the save prompt reopens"
when: "the user clicks a different milestone"
---
