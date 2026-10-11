---
id: "2bfaa659-fac1-4293-ab1e-4b3c593a0396"
type: "scenario"
label: "Saving while time-travelling"
gherkin: |
  And no milestone positions are written into the default or view positions
  # Covered by: packages/ui/tests/milestones.test.ts › persists the live model (liveBackup), not the active milestone
given: "a milestone is shown on the canvas"
then: "the saved document holds the live model, not the milestone's content"
when: "the model is saved"
---
