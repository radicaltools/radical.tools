---
id: "2bfaa659-fac1-4293-ab1e-4b3c593a0396"
type: "scenario"
label: "Saving while time-travelling"
gherkin: "And no milestone positions are written into the default or view positions"
given: "a milestone is shown on the canvas"
metrics: |
  test(packages/ui/tests/milestones.test.ts › persists the live model (liveBackup), not the active milestone) passed
  test(apps/e2e/tests/studio/milestones.spec.ts › opening a milestone and going back to the live model writes nothing) passed
  test(apps/e2e/tests/studio/milestones.spec.ts › leaving the page with unsaved edits of a milestone asks, and staying keeps them) passed
  test(apps/e2e/tests/studio/milestones.spec.ts › leaving the page with a milestone shown and nothing edited in it asks nothing) passed
then: "the saved document holds the live model, not the milestone's content; opening and leaving the milestone writes nothing; leaving the page with unsaved edits of the milestone asks, and staying keeps them, while with nothing edited it asks nothing"
when: "the model is saved; a milestone is opened and left for the live model without an edit; the page is left while the milestone is shown, with and without unsaved edits"
---
