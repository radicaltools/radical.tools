---
id: "29ce51dc-deaa-4954-bfc0-fd32d1535671"
type: "scenario"
label: "Milestone named on a table"
given: "a model with a milestone, and a table view open"
tests: |
  apps/e2e/tests/studio/milestones.spec.ts › a table in a milestone names it, with Propagate, New milestone and Discard once it is edited
  apps/e2e/tests/studio/milestones.spec.ts › in a milestone, the name of a row added to a table stays open through the question how to save it
then: "the table shows the milestone's chip, which offers Propagate, New milestone and Discard once the milestone is edited; the new row's name stays open through the question"
when: "the user picks the milestone, renames an element in the table, and adds a row whose name is being typed when the question how to save the milestone comes"
---
